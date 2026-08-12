import { NextResponse } from 'next/server';
import { supabaseAdmin, getServerUser } from '../../../../../lib/supabase';
import { addNotification } from '../../../../../lib/notificationsStore';

export const dynamic = 'force-dynamic';

async function checkIsAdmin(projectId, currentUser) {
  if (!projectId || !currentUser) return false;

  // 1. Check project owner
  const { data: proj } = await supabaseAdmin
    .from('projects')
    .select('owner_id')
    .eq('id', projectId)
    .maybeSingle();

  if (proj && proj.owner_id === currentUser.id) return true;

  // 2. Fetch all project members to compare against currentUser ID & email
  const { data: members } = await supabaseAdmin
    .from('project_members')
    .select('id, user_id, role, user:profiles(id, email)')
    .eq('project_id', projectId);

  const matchedMember = (members || []).find((m) =>
    m.user_id === currentUser.id ||
    m.user?.id === currentUser.id ||
    (currentUser.email && m.user?.email === currentUser.email)
  );

  if (proj && matchedMember && proj.owner_id === matchedMember.user_id) {
    return true;
  }

  return Boolean(matchedMember && matchedMember.role === 'ADMIN');
}

// Invite new member with role (ADMIN, MEMBER, VIEWER)
export async function POST(req, { params }) {
  try {
    const currentUser = await getServerUser(req);
    const projectId = params.id;

    if (!currentUser || !(await checkIsAdmin(projectId, currentUser))) {
      return NextResponse.json({ error: 'Forbidden: Only Admins can invite members' }, { status: 403 });
    }

    const body = await req.json();
    const { identifier, role = 'MEMBER' } = body;

    if (!identifier || identifier.trim() === '') {
      return NextResponse.json({ error: 'Email or username is required' }, { status: 400 });
    }

    const cleanId = identifier.trim().toLowerCase();
    const targetRole = ['ADMIN', 'MEMBER', 'VIEWER'].includes(role.toUpperCase()) ? role.toUpperCase() : 'MEMBER';

    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .or(`email.eq.${cleanId},github_username.eq.${cleanId}`);

    const targetUser = profiles && profiles.length > 0 ? profiles[0] : null;

    if (!targetUser) {
      return NextResponse.json({ error: 'User profile not found. The user must sign up for an account first.' }, { status: 404 });
    }

    const { data: member, error: memberErr } = await supabaseAdmin
      .from('project_members')
      .insert({
        project_id: projectId,
        user_id: targetUser.id,
        role: targetRole,
      })
      .select()
      .single();

    if (memberErr) {
      return NextResponse.json({ error: 'User is already a member of this project' }, { status: 400 });
    }

    return NextResponse.json({
      member: {
        id: member.id,
        role: member.role,
        user: {
          id: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
          avatarUrl: targetUser.avatar_url || null,
          githubUsername: targetUser.github_username,
          skillProfile: targetUser.skill_profile || {},
        },
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Invite member error:', error);
    return NextResponse.json({ error: 'Failed to invite member' }, { status: 500 });
  }
}

// Update member role (ADMIN only) + Send Notification
export async function PUT(req, { params }) {
  try {
    const currentUser = await getServerUser(req);
    const projectId = params.id;

    if (!currentUser || !(await checkIsAdmin(projectId, currentUser))) {
      return NextResponse.json({ error: 'Forbidden: Only Admins can change member roles' }, { status: 403 });
    }

    const body = await req.json();
    const { memberId, role } = body;

    if (!memberId || !role) {
      return NextResponse.json({ error: 'Member ID and role are required' }, { status: 400 });
    }

    const targetRole = ['ADMIN', 'MEMBER', 'VIEWER'].includes(role.toUpperCase()) ? role.toUpperCase() : 'MEMBER';

    // 1. Fetch current member details & project name
    const { data: memberRow } = await supabaseAdmin
      .from('project_members')
      .select('id, user_id, role, projects(name), user:profiles(email)')
      .eq('id', memberId)
      .eq('project_id', projectId)
      .maybeSingle();

    if (!memberRow) {
      return NextResponse.json({ error: 'Member record not found' }, { status: 404 });
    }

    let userIdsToUpdate = [memberRow.user_id];
    if (memberRow.user?.email) {
      const { data: matchedProfiles } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', memberRow.user.email);
      if (matchedProfiles) {
        matchedProfiles.forEach((p) => userIdsToUpdate.push(p.id));
      }
    }
    userIdsToUpdate = Array.from(new Set(userIdsToUpdate));

    // 2. Update role in database for all resolved profile entries of this member in this project + direct memberId update
    const { error: updateErr } = await supabaseAdmin
      .from('project_members')
      .update({ role: targetRole })
      .eq('project_id', projectId)
      .in('user_id', userIdsToUpdate);

    await supabaseAdmin
      .from('project_members')
      .update({ role: targetRole })
      .eq('id', memberId);

    if (updateErr) {
      console.error('Failed to update member role:', updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // 3. Send Notification to the member
    const projectName = memberRow.projects?.name || 'the project';
    const adminName = currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || 'Project Admin';
    const isPromoted = targetRole === 'ADMIN';

    const notifText = isPromoted
      ? `You have been promoted to Admin in project "${projectName}" by ${adminName}.`
      : `Your role in project "${projectName}" has been updated to ${targetRole} by ${adminName}.`;

    addNotification({
      userId: memberRow.user_id,
      type: isPromoted ? 'role_promoted' : 'role_updated',
      author: adminName,
      action: isPromoted ? 'promoted you to Admin' : `updated your role to ${targetRole}`,
      text: notifText,
      projectId: projectId,
      role: targetRole,
    });

    try {
      await supabaseAdmin.from('notifications').insert({
        user_id: memberRow.user_id,
        title: isPromoted ? 'Promoted to Admin' : 'Role Updated',
        message: notifText,
        read: false,
        created_at: new Date().toISOString(),
      });
    } catch (e) {}

    return NextResponse.json({ message: 'Role updated successfully', role: targetRole });
  } catch (error) {
    console.error('Role update error:', error);
    return NextResponse.json({ error: 'Failed to update member role' }, { status: 500 });
  }
}

// Remove member (ADMIN only)
export async function DELETE(req, { params }) {
  try {
    const currentUser = await getServerUser(req);
    const projectId = params.id;

    if (!currentUser || !(await checkIsAdmin(projectId, currentUser))) {
      return NextResponse.json({ error: 'Forbidden: Only Admins can remove members' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get('memberId');

    if (!memberId) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
    }

    const { error: deleteErr } = await supabaseAdmin
      .from('project_members')
      .delete()
      .eq('id', memberId)
      .eq('project_id', projectId);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }
}
