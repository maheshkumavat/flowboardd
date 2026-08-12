import { NextResponse } from 'next/server';
import { rankMembersForSkill } from '../../../../lib/ai/githubSkillMatcher';
import { supabaseAdmin, getServerUser } from '../../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const body = await req.json();
    const { projectId, requiredSkill } = body;

    if (!projectId || !requiredSkill) {
      return NextResponse.json({ error: 'Project ID and required skill tag are required' }, { status: 400 });
    }

    const currentUser = await getServerUser(req);
    let memberRows = [];
    let projectTechStack = [];

    // 1. Fetch project tech stack from project description
    try {
      const { data: proj } = await supabaseAdmin
        .from('projects')
        .select('description')
        .eq('id', projectId)
        .maybeSingle();

      if (proj && proj.description) {
        const knownTech = ['react', 'node.js', 'node', 'python', 'java', 'sql', 'postgresql', 'typescript', 'javascript', 'tailwind', 'next.js', 'aws', 'docker'];
        const descLower = proj.description.toLowerCase();
        projectTechStack = knownTech.filter((tech) => descLower.includes(tech));
      }
    } catch (e) {}

    // 2. Fetch project members with profiles
    try {
      const { data, error } = await supabaseAdmin
        .from('project_members')
        .select(`
          id,
          role,
          user_id,
          user:profiles(id, name, email, github_username, skill_profile)
        `)
        .eq('project_id', projectId);

      if (!error && data && data.length > 0) {
        memberRows = data;
      }
    } catch (e) {
      console.warn('DB project_members fetch warning in recommend-assignees:', e);
    }

    // 3. Fallback: If DB returns 0 members (e.g. newly created project), include current user if they have profile
    if (memberRows.length === 0 && currentUser) {
      const userMeta = currentUser.user_metadata || {};
      memberRows = [
        {
          id: `pm-${currentUser.id}`,
          role: 'ADMIN',
          user_id: currentUser.id,
          user: {
            id: currentUser.id,
            name: userMeta.name || currentUser.email?.split('@')[0] || 'Project Admin',
            email: currentUser.email || '',
            github_username: userMeta.github_username || userMeta.user_name || null,
            skill_profile: userMeta.skill_profile || null,
          },
        },
      ];
    }

    if (memberRows.length === 0) {
      return NextResponse.json({
        recommendations: [],
        emptyReason: 'NO_MEMBERS',
        message: 'No project members found for this project',
      });
    }

    // Format member records
    const formattedMembers = memberRows.map((m) => {
      const prof = m.user || m.profiles || {};
      let skillProf = prof.skill_profile || prof.skillProfile || {};

      if (typeof skillProf === 'string') {
        try {
          skillProf = JSON.parse(skillProf);
        } catch (e) {
          skillProf = {};
        }
      }

      return {
        id: m.id,
        role: m.role || 'MEMBER',
        user: {
          id: prof.id || m.user_id,
          name: prof.name || prof.email?.split('@')[0] || 'Team Member',
          email: prof.email || '',
          githubUsername: prof.github_username || prof.githubUsername || null,
          skillProfile: skillProf,
        },
      };
    });

    // Rank candidates using requiredSkill + projectTechStack
    const ranked = rankMembersForSkill(requiredSkill, formattedMembers, projectTechStack);

    const rankedUserIds = new Set(ranked.map((r) => r.user.id));
    const unprofiledMembers = formattedMembers
      .filter((m) => !rankedUserIds.has(m.user.id))
      .map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
      }));

    return NextResponse.json({
      recommendations: ranked,
      unprofiledMembers: unprofiledMembers,
      techStackUsed: projectTechStack,
    });
  } catch (error) {
    console.error('Recommend assignees API error:', error);
    return NextResponse.json({ error: 'Failed to rank candidate skills' }, { status: 500 });
  }
}
