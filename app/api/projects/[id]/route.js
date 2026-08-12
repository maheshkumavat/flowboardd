import { NextResponse } from 'next/server';
import { supabaseAdmin, getServerUser, checkIsProjectAdmin } from '../../../../lib/supabase';
import { enrichTasksWithRisk } from '../../../../lib/ai/riskEvaluator';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  try {
    const projectId = params.id;
    const currentUser = await getServerUser(req);

    // 1. Fetch project base details
    const { data: projData, error } = await supabaseAdmin
      .from('projects')
      .select(`
        id,
        name,
        description,
        owner_id,
        columns(
          id,
          name,
          position,
          tasks(
            id,
            column_id,
            title,
            description,
            assignee_id,
            due_date,
            priority,
            status,
            required_skill,
            risk_flag,
            created_at,
            comments(id, content, created_at)
          )
        )
      `)
      .eq('id', projectId)
      .single();

    if (error || !projData) {
      console.error('GET /api/projects/[id] query error:', error);
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 2. Fetch project_members directly
    const { data: memberRows } = await supabaseAdmin
      .from('project_members')
      .select('id, user_id, role, joined_at')
      .eq('project_id', projectId);

    const memberUserIds = Array.from(new Set((memberRows || []).map((m) => m.user_id).filter(Boolean)));

    // 3. Fetch profiles for all member user IDs
    let profileMap = {};
    if (memberUserIds.length > 0) {
      const { data: profileRows } = await supabaseAdmin
        .from('profiles')
        .select('id, name, email, avatar_url, role, github_username, skill_profile')
        .in('id', memberUserIds);

      (profileRows || []).forEach((p) => {
        profileMap[p.id] = p;
      });
    }

    const processedMembers = (memberRows || []).map((m) => {
      const p = profileMap[m.user_id] || {};
      const isOwner = projData.owner_id === m.user_id || projData.owner_id === p.id;
      return {
        id: m.id,
        role: isOwner ? 'ADMIN' : (m.role || 'MEMBER'),
        user: {
          id: p.id || m.user_id,
          name: (p.name && p.name !== 'Team Member' ? p.name : null) || (p.email ? p.email.split('@')[0] : null) || 'Member',
          email: p.email || '',
          avatarUrl: p.avatar_url || null,
          githubUsername: p.github_username || null,
          primaryRole: p.primary_role || p.skill_profile?.primaryRole || p.skill_profile?.role || 'Developer',
          skillProfile: p.skill_profile || {},
        },
      };
    });

    // 4. Determine current user's role in project with full profile alias resolution
    let userRole = 'MEMBER';
    if (currentUser) {
      let userIds = [currentUser.id];
      if (currentUser.email) {
        const { data: matchedProfiles } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .or(`id.eq.${currentUser.id},email.eq.${currentUser.email}`);
        if (matchedProfiles) {
          matchedProfiles.forEach((p) => userIds.push(p.id));
        }
      }
      userIds = Array.from(new Set(userIds));

      const isOwner = userIds.includes(projData.owner_id);
      if (isOwner) {
        userRole = 'ADMIN';
      } else {
        const { data: pmRoleRow } = await supabaseAdmin
          .from('project_members')
          .select('role')
          .eq('project_id', projectId)
          .in('user_id', userIds)
          .maybeSingle();

        if (pmRoleRow && pmRoleRow.role) {
          userRole = pmRoleRow.role;
        } else {
          const member = processedMembers.find((m) =>
            userIds.includes(m.user?.id) || userIds.includes(m.id) || (m.user?.email && m.user.email === currentUser.email)
          );
          if (member) {
            userRole = member.role || 'MEMBER';
          }
        }
      }
    }

    // 5. Fetch profile details for all assignees across tasks
    const allAssigneeIds = Array.from(new Set(
      (projData.columns || [])
        .flatMap((col) => col.tasks || [])
        .map((t) => t.assignee_id)
        .filter(Boolean)
    ));

    let assigneeMap = {};
    if (allAssigneeIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, name, email, avatar_url, role, github_username')
        .in('id', allAssigneeIds);

      (profiles || []).forEach((p) => {
        assigneeMap[p.id] = {
          id: p.id,
          name: p.name || 'Member',
          email: p.email || '',
          avatarUrl: p.avatar_url || null,
          githubUsername: p.github_username || null,
        };
      });
    }

    const processedColumns = (projData.columns || []).map((col) => ({
      id: col.id,
      name: col.name,
      position: col.position,
      tasks: enrichTasksWithRisk(
        (col.tasks || []).map((t) => ({
          id: t.id,
          projectId,
          columnId: t.column_id,
          title: t.title,
          description: t.description,
          assigneeId: t.assignee_id,
          assignee: t.assignee_id ? assigneeMap[t.assignee_id] || null : null,
          startDate: (() => {
            if (t.start_date) return t.start_date;
            if (t.description) {
              const match = t.description.match(/\[START_DATE:([^\]]+)\]/);
              if (match) return match[1];
            }
            // Fallback: created_at date (or 3 days prior to due_date)
            if (t.created_at) return t.created_at;
            if (t.due_date) {
              const d = new Date(t.due_date);
              d.setDate(d.getDate() - 3);
              return d.toISOString();
            }
            return new Date().toISOString();
          })(),
          dueDate: t.due_date,
          priority: t.priority || 'MEDIUM',
          status: t.status || col.name,
          requiredSkill: t.required_skill,
          riskFlag: t.risk_flag,
          comments: (t.comments || []).map((c) => ({
            id: c.id,
            content: c.content,
            createdAt: c.created_at,
          })),
        }))
      ),
    }));

    return NextResponse.json({
      project: {
        id: projData.id,
        name: projData.name,
        description: projData.description,
        ownerId: projData.owner_id,
        userRole: userRole,
        suggestedSkills: [],
        columns: processedColumns,
        members: processedMembers,
      },
    });
  } catch (error) {
    console.error('Project GET [id] exception:', error);
    return NextResponse.json({ error: 'Failed to fetch project board' }, { status: 500 });
  }
}

// Update project general info (Admin only)
export async function PUT(req, { params }) {
  try {
    const currentUser = await getServerUser(req);
    const projectId = params.id;

    if (!currentUser || !(await checkIsProjectAdmin(projectId, currentUser))) {
      return NextResponse.json({ error: 'Forbidden: Only Admins can update project settings' }, { status: 403 });
    }

    const body = await req.json();
    const { name, description } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    const { data: updatedProj, error: updateErr } = await supabaseAdmin
      .from('projects')
      .update({
        name: name.trim(),
        description: description ? description.trim() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId)
      .select()
      .single();

    if (updateErr) {
      console.error('Update project error:', updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ project: updatedProj });
  } catch (error) {
    console.error('Update project exception:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

// Delete project (Admin only)
export async function DELETE(req, { params }) {
  try {
    const currentUser = await getServerUser(req);
    const projectId = params.id;

    if (!currentUser || !(await checkIsProjectAdmin(projectId, currentUser))) {
      return NextResponse.json({ error: 'Forbidden: Only Admins can delete this project' }, { status: 403 });
    }

    const { error: deleteErr } = await supabaseAdmin
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
