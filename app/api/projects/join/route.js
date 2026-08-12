import { NextResponse } from 'next/server';
import { supabaseAdmin, getServerUser, ensureProfile } from '../../../../lib/supabase';
import { createJoinRequest } from '../../../../lib/invitesStore';
import { addNotification } from '../../../../lib/notificationsStore';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const body = await req.json();
    const { code } = body;

    if (!code || code.trim() === '') {
      return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
    }

    const cleanCode = code.trim().toUpperCase();

    // Fetch code from project_invite_codes
    const { data: codeData, error: codeErr } = await supabaseAdmin
      .from('project_invite_codes')
      .select('*, project:projects(id, name, owner_id)')
      .eq('code', cleanCode)
      .single();

    if (codeErr || !codeData) {
      return NextResponse.json({ error: 'This invite code is invalid or has expired' }, { status: 404 });
    }

    // Check expiration / revocation
    if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invite code is invalid or has expired' }, { status: 400 });
    }

    const user = await getServerUser(req);

    if (!user) {
      return NextResponse.json({ error: 'You must be logged in to join a project' }, { status: 401 });
    }

    const requesterProfile = await ensureProfile(user);

    // Check if user is already a member
    const { data: existingMember } = await supabaseAdmin
      .from('project_members')
      .select('id')
      .eq('project_id', codeData.project_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingMember) {
      return NextResponse.json({
        message: 'You are already a member of this project!',
        alreadyMember: true,
        projectId: codeData.project_id,
      });
    }

    // Create pending join request
    const { request, isDuplicate } = await createJoinRequest({
      projectId: codeData.project_id,
      userId: user.id,
      inviteCode: cleanCode,
      role: codeData.role || 'MEMBER',
    });

    // Notify Project Owner & Admins
    const projectName = codeData.project?.name || 'Project Workspace';
    const requesterName = requesterProfile?.name || user.user_metadata?.name || user.email;
    const ownerId = codeData.project?.owner_id;

    if (ownerId && ownerId !== user.id) {
      await addNotification({
        userId: ownerId,
        type: 'join_request',
        author: requesterName,
        action: 'requested to join',
        text: `${requesterName} requested to join project "${projectName}" using code ${cleanCode}`,
        projectId: codeData.project_id,
        requestId: request?.id || null,
        requesterId: user.id,
        role: codeData.role || 'MEMBER',
      });
    }

    return NextResponse.json({
      message: `Your request to join "${projectName}" has been sent. You'll be notified once an Admin approves it.`,
      status: 'pending',
      projectId: codeData.project_id,
      projectName,
    }, { status: 200 });
  } catch (error) {
    console.error('Join with code error:', error);
    return NextResponse.json({ error: 'Failed to submit join request' }, { status: 500 });
  }
}
