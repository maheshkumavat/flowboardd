import { NextResponse } from 'next/server';
import { supabaseAdmin, getServerUser } from '../../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function performAccountDeletePreCheck(userId) {
  // 1. Fetch projects owned by user
  const { data: ownedProjects } = await supabaseAdmin
    .from('projects')
    .select('id, name, owner_id')
    .eq('owner_id', userId);

  // 2. Fetch project memberships of user
  const { data: memberRows } = await supabaseAdmin
    .from('project_members')
    .select('project_id, role, project:projects(id, name, owner_id)')
    .eq('user_id', userId);

  const projectMap = new Map();

  (ownedProjects || []).forEach((p) => {
    projectMap.set(p.id, { id: p.id, name: p.name, isOwner: true, role: 'ADMIN' });
  });

  (memberRows || []).forEach((m) => {
    if (m.project) {
      projectMap.set(m.project.id, {
        id: m.project.id,
        name: m.project.name,
        isOwner: m.project.owner_id === userId,
        role: m.role || 'MEMBER',
      });
    }
  });

  const blockingProjects = [];
  const autoDeleteProjects = [];
  const memberOnlyProjects = [];

  for (const [projId, proj] of projectMap.entries()) {
    // Fetch all members for this project
    const { data: members } = await supabaseAdmin
      .from('project_members')
      .select('user_id, role')
      .eq('project_id', projId);

    const memberList = members || [];
    const totalMembers = memberList.length;

    // Determine admin count
    const adminMembers = memberList.filter(
      (m) => m.role === 'ADMIN' || m.user_id === proj.isOwner
    );

    const isUserAdmin = proj.role === 'ADMIN' || proj.isOwner;
    const isSoleAdmin = isUserAdmin && adminMembers.length <= 1;

    if (isSoleAdmin) {
      if (totalMembers > 1) {
        // Sole admin of project with other members -> BLOCKS account deletion
        blockingProjects.push({
          id: proj.id,
          name: proj.name,
          memberCount: totalMembers,
        });
      } else {
        // Sole admin and ONLY member -> Project auto-deletes with account
        autoDeleteProjects.push({
          id: proj.id,
          name: proj.name,
        });
      }
    } else {
      // Regular member or multi-admin project -> Soft remove member entry
      memberOnlyProjects.push({
        id: proj.id,
        name: proj.name,
      });
    }
  }

  return {
    canDelete: blockingProjects.length === 0,
    blockingProjects,
    autoDeleteProjects,
    memberOnlyProjects,
  };
}

// GET: Check deletion prerequisites & return summary of affected projects
export async function GET(req) {
  try {
    const user = await getServerUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const checkResult = await performAccountDeletePreCheck(user.id);
    return NextResponse.json({ userEmail: user.email, ...checkResult });
  } catch (error) {
    console.error('Delete account check GET error:', error);
    return NextResponse.json({ error: 'Failed to perform account deletion check' }, { status: 500 });
  }
}

// DELETE: Perform permanent account deletion
export async function DELETE(req) {
  try {
    const user = await getServerUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const checkResult = await performAccountDeletePreCheck(user.id);
    if (!checkResult.canDelete) {
      return NextResponse.json(
        {
          error: 'Cannot delete account while you are the sole Admin of projects with other members.',
          blockingProjects: checkResult.blockingProjects,
        },
        { status: 400 }
      );
    }

    // 1. Delete projects where user is sole member (autoDeleteProjects)
    for (const proj of checkResult.autoDeleteProjects) {
      try {
        await supabaseAdmin.from('tasks').delete().eq('project_id', proj.id);
        await supabaseAdmin.from('columns').delete().eq('project_id', proj.id);
        await supabaseAdmin.from('project_invite_codes').delete().eq('project_id', proj.id);
        await supabaseAdmin.from('project_members').delete().eq('project_id', proj.id);
        await supabaseAdmin.from('projects').delete().eq('id', proj.id);
      } catch (e) {
        console.error(`Error deleting single-member project ${proj.id}:`, e);
      }
    }

    // 2. Remove user from project_members in remaining projects
    await supabaseAdmin.from('project_members').delete().eq('user_id', user.id);

    // 3. Remove pending join requests
    try {
      await supabaseAdmin.from('join_requests').delete().eq('user_id', user.id);
    } catch (e) {}

    // 4. Delete profile row
    await supabaseAdmin.from('profiles').delete().eq('id', user.id);

    // 5. Delete Supabase Auth user record permanently
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (authErr) {
      console.error('Failed to delete Supabase auth user:', authErr);
      return NextResponse.json({ error: 'Failed to delete user authentication credentials' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Account permanently deleted successfully', deleted: true });
  } catch (error) {
    console.error('Delete account DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
