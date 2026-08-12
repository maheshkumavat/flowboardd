import { NextResponse } from 'next/server';
import { supabaseAdmin, getServerUser, ensureProfile } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const startTime = Date.now();
  try {
    const currentUser = await getServerUser(req);

    if (!currentUser) {
      console.warn(`[GET /api/projects] Unauthorized (elapsed: ${Date.now() - startTime}ms) - no active user session.`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureProfile(currentUser);

    console.log(`[GET /api/projects] Active Session User ID: ${currentUser.id} | Email: ${currentUser.email}`);

    // 1. Resolve all profile IDs associated with current user (by ID, Email, and GitHub username)
    let userIds = [currentUser.id];
    const userEmail = currentUser.email;
    const ghUsername = currentUser.user_metadata?.github_username || currentUser.user_metadata?.user_name;

    try {
      let queryStr = `id.eq.${currentUser.id}`;
      if (userEmail) queryStr += `,email.eq.${userEmail}`;
      if (ghUsername) queryStr += `,github_username.eq.${ghUsername}`;

      const { data: matchingProfiles } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .or(queryStr);

      if (matchingProfiles && matchingProfiles.length > 0) {
        matchingProfiles.forEach((p) => userIds.push(p.id));
      }
    } catch (e) {
      console.warn('[GET /api/projects] Profile alias resolution warning:', e.message);
    }

    userIds = Array.from(new Set(userIds));

    // 2. Fetch owned projects across all resolved user IDs
    const { data: ownedProjects } = await supabaseAdmin
      .from('projects')
      .select('id')
      .in('owner_id', userIds);

    // 3. Fetch member projects across all resolved user IDs
    const { data: memberRows } = await supabaseAdmin
      .from('project_members')
      .select('project_id, role')
      .in('user_id', userIds);

    const ownedIds = (ownedProjects || []).map((p) => p.id);
    const memberIds = (memberRows || []).map((m) => m.project_id);
    const allProjectIds = Array.from(new Set([...ownedIds, ...memberIds]));

    if (allProjectIds.length === 0) {
      console.log(`[GET /api/projects] 0 projects found for User ID ${currentUser.id}. Elapsed: ${Date.now() - startTime}ms.`);
      return NextResponse.json({ projects: [] });
    }

    // 4. Query all projects base info
    const { data: projData, error } = await supabaseAdmin
      .from('projects')
      .select(`
        id,
        name,
        description,
        owner_id,
        suggested_skills,
        created_at,
        columns(id, name, position),
        tasks(id)
      `)
      .in('id', allProjectIds)
      .order('created_at', { ascending: false });

    if (error || !projData) {
      console.error('[GET /api/projects] Query error:', error);
      return NextResponse.json({ projects: [] });
    }

    // 5. Fetch all project_members for these project IDs
    const { data: allProjectMembers } = await supabaseAdmin
      .from('project_members')
      .select('id, project_id, user_id, role')
      .in('project_id', allProjectIds);

    const allMemberUserIds = Array.from(new Set((allProjectMembers || []).map((m) => m.user_id).filter(Boolean)));

    // 6. Fetch profiles for all member user IDs
    let profileMap = {};
    if (allMemberUserIds.length > 0) {
      const { data: profileRows } = await supabaseAdmin
        .from('profiles')
        .select('id, name, email, avatar_url, role, github_username, skill_profile')
        .in('id', allMemberUserIds);

      (profileRows || []).forEach((p) => {
        profileMap[p.id] = p;
      });
    }

    // Group members by project_id
    const projectMembersMap = {};
    const projOwnerMap = {};
    (projData || []).forEach((p) => { projOwnerMap[p.id] = p.owner_id; });

    (allProjectMembers || []).forEach((m) => {
      if (!projectMembersMap[m.project_id]) projectMembersMap[m.project_id] = [];
      const p = profileMap[m.user_id] || {};
      const isOwner = projOwnerMap[m.project_id] === m.user_id;
      projectMembersMap[m.project_id].push({
        id: m.id,
        role: isOwner ? 'ADMIN' : (m.role || 'MEMBER'),
        userId: m.user_id,
        user: {
          id: p.id || m.user_id,
          name: (p.name && p.name !== 'Team Member' ? p.name : null) || (p.email ? p.email.split('@')[0] : null) || 'Member',
          email: p.email || '',
          avatarUrl: p.avatar_url || null,
          githubUsername: p.github_username || null,
          primaryRole: p.primary_role || p.skill_profile?.primaryRole || p.skill_profile?.role || 'Other',
          skillProfile: p.skill_profile || {},
        },
      });
    });

    const projects = projData.map((p) => {
      const members = projectMembersMap[p.id] || [];
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        ownerId: p.owner_id,
        suggestedSkills: p.suggested_skills || [],
        suggested_skills: p.suggested_skills || [],
        createdAt: p.created_at,
        members: members,
        memberCount: members.length,
        columns: (p.columns || []).map((c) => ({
          id: c.id,
          name: c.name,
          position: c.position,
        })),
        taskCount: (p.tasks || []).length,
      };
    });

    const duration = Date.now() - startTime;
    console.log(`[GET /api/projects] Successfully returned ${projects.length} project cards in ${duration}ms.`);
    return NextResponse.json({ projects });
  } catch (error) {
    console.error(`[GET /api/projects] Exception (elapsed: ${Date.now() - startTime}ms):`, error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const currentUser = await getServerUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureProfile(currentUser);

    const body = await req.json();
    const { name, description } = body;
    let suggestedSkills = body.suggestedSkills || body.suggested_skills || [];

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    if (!suggestedSkills || suggestedSkills.length === 0) {
      try {
        const { generateProjectDescription } = require('../../../lib/ai/projectDescriptionGenerator');
        const res = await generateProjectDescription({ title: name, keyPoints: description || '' });
        suggestedSkills = res?.suggestedSkills || ['Software Engineering'];
      } catch (e) {
        suggestedSkills = ['Software Engineering'];
      }
    }

    // Insert project (with automatic fallback if suggested_skills column isn't migrated yet on live DB)
    let project = null;
    let { data: projData, error: projErr } = await supabaseAdmin
      .from('projects')
      .insert({
        name: name.trim(),
        description: description ? description.trim() : null,
        owner_id: currentUser.id,
        suggested_skills: suggestedSkills,
      })
      .select()
      .single();

    if (projErr && (projErr.code === 'PGRST204' || projErr.message?.includes('suggested_skills'))) {
      console.warn('[POST /api/projects] DB missing suggested_skills column; attempting fallback insertion');
      const { data: fallbackProj, error: fallbackErr } = await supabaseAdmin
        .from('projects')
        .insert({
          name: name.trim(),
          description: description ? description.trim() : null,
          owner_id: currentUser.id,
        })
        .select()
        .single();

      projData = fallbackProj;
      projErr = fallbackErr;
    }

    if (projErr || !projData) {
      console.error('Failed to create project:', projErr);
      return NextResponse.json({ error: projErr?.message || 'Failed to create project' }, { status: 500 });
    }

    project = {
      ...projData,
      suggested_skills: projData.suggested_skills || suggestedSkills,
      suggestedSkills: projData.suggested_skills || suggestedSkills,
    };

    // Insert default columns (To Do, In Progress, In Review, Done)
    const defaultCols = [
      { project_id: project.id, name: 'To Do', position: 1 },
      { project_id: project.id, name: 'In Progress', position: 2 },
      { project_id: project.id, name: 'In Review', position: 3 },
      { project_id: project.id, name: 'Done', position: 4 },
    ];

    await supabaseAdmin.from('columns').insert(defaultCols);

    // Insert creator as ADMIN in project_members
    await supabaseAdmin.from('project_members').insert({
      project_id: project.id,
      user_id: currentUser.id,
      role: 'ADMIN',
    });

    // Auto-generate initial 5-min invite code for the new project
    try {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let initCode = '';
      for (let i = 0; i < 6; i++) {
        initCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      await supabaseAdmin.from('project_invite_codes').insert({
        project_id: project.id,
        code: initCode,
        role: 'MEMBER',
        created_by: currentUser.id,
        created_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      });
    } catch (codeErr) {
      console.warn('[POST /api/projects] Initial invite code generation warning:', codeErr);
    }

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error('Project creation error:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
