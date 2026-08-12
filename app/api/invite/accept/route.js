import { NextResponse } from 'next/server';
import { supabaseAdmin, getServerUser, ensureProfile } from '../../../../lib/supabase';
import { getEmailInviteByToken, deleteEmailInviteToken } from '../../../../lib/invitesStore';
import { logActivity } from '../../../../lib/activityLogger';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Invite token is required' }, { status: 400 });
    }

    const invite = await getEmailInviteByToken(token);
    if (!invite) {
      return NextResponse.json({ error: 'Invalid or expired invite link.' }, { status: 404 });
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invite link has expired.' }, { status: 400 });
    }

    const user = await getServerUser(req);

    if (!user) {
      return NextResponse.json({
        requiresAuth: true,
        inviteToken: token,
        email: invite.email,
        projectId: invite.project_id,
        projectName: invite.project?.name,
      });
    }

    await ensureProfile(user);

    // Directly add user to project_members (admin-initiated email invite = auto join)
    const { error: memberErr } = await supabaseAdmin
      .from('project_members')
      .insert({
        project_id: invite.project_id,
        user_id: user.id,
        role: invite.role || 'MEMBER',
      })
      .select()
      .single();

    if (memberErr && memberErr.code !== '23505') {
      console.error('Member insert on invite accept error:', memberErr);
    }

    await deleteEmailInviteToken(token);

    await logActivity({
      projectId: invite.project_id,
      userId: user.id,
      action: 'member_joined',
      metadata: { method: 'email_invite_link' },
    });

    return NextResponse.json({
      message: 'Successfully joined project!',
      joined: true,
      projectId: invite.project_id,
      projectName: invite.project?.name,
    });
  } catch (error) {
    console.error('Accept invite error:', error);
    return NextResponse.json({ error: 'Failed to process invite' }, { status: 500 });
  }
}
