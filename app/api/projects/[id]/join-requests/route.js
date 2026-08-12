import { NextResponse } from 'next/server';
import { supabaseAdmin, getServerUser, checkIsProjectAdmin } from '../../../../../lib/supabase';
import { getPendingJoinRequests, updateJoinRequestStatus } from '../../../../../lib/invitesStore';
import { addNotification, updateNotificationStatusByRequestId } from '../../../../../lib/notificationsStore';
import { logActivity } from '../../../../../lib/activityLogger';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  try {
    const projectId = params.id;
    const user = await getServerUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requests = await getPendingJoinRequests(projectId);
    return NextResponse.json({ requests: requests || [] });
  } catch (error) {
    console.error('Join requests GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch join requests' }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const projectId = params.id;
    const body = await req.json();
    let { requestId, action, userId, role = 'MEMBER' } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action (accept/reject) is required' }, { status: 400 });
    }

    const adminUser = await getServerUser(req);
    if (!adminUser || !(await checkIsProjectAdmin(projectId, adminUser))) {
      return NextResponse.json({ error: 'Forbidden: Only Admins can accept or decline join requests' }, { status: 403 });
    }

    // Lookup pending request if requestId is missing
    const pendingReqs = await getPendingJoinRequests(projectId);

    let targetReq = null;
    if (requestId) {
      targetReq = pendingReqs.find((r) => r.id === requestId);
    }
    if (!targetReq && userId) {
      targetReq = pendingReqs.find((r) => r.user_id === userId);
    }
    if (!targetReq && pendingReqs.length > 0) {
      targetReq = pendingReqs[0];
    }

    const finalRequestId = targetReq?.id || requestId;
    const targetUserId = userId || targetReq?.user_id;

    // Fetch project details
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .single();

    const projectName = project?.name || 'Project';

    if (action === 'accept') {
      if (targetUserId) {
        const { error: memberErr } = await supabaseAdmin
          .from('project_members')
          .insert({
            project_id: projectId,
            user_id: targetUserId,
            role,
          })
          .select()
          .single();

        if (memberErr && memberErr.code !== '23505') {
          console.error('Member insert on accept error:', memberErr);
        }

        await logActivity({
          projectId,
          userId: targetUserId,
          action: 'member_joined',
          metadata: { method: 'approved_join_request' },
        });

        // Notify requester
        addNotification({
          userId: targetUserId,
          type: 'assign',
          author: adminUser.user_metadata?.name || adminUser.email,
          action: 'approved your join request',
          text: `You have been accepted as a member of "${projectName}"!`,
          projectId,
        });
      }

      if (finalRequestId) {
        await updateJoinRequestStatus(finalRequestId, 'approved');
      }
      updateNotificationStatusByRequestId({ requestId: finalRequestId, projectId, requesterId: targetUserId, status: 'approved' });

      return NextResponse.json({ message: 'Join request accepted and member added!', status: 'approved' });
    } else if (action === 'reject' || action === 'decline') {
      if (targetUserId) {
        addNotification({
          userId: targetUserId,
          type: 'join_request',
          author: adminUser.user_metadata?.name || adminUser.email,
          action: 'declined join request',
          text: `Your request to join "${projectName}" was declined.`,
          projectId,
        });
      }

      if (finalRequestId) {
        await updateJoinRequestStatus(finalRequestId, 'rejected');
      }
      updateNotificationStatusByRequestId({ requestId: finalRequestId, projectId, requesterId: targetUserId, status: 'rejected' });

      return NextResponse.json({ message: 'Join request rejected.', status: 'rejected' });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Join requests POST error:', error);
    return NextResponse.json({ error: 'Failed to update join request' }, { status: 500 });
  }
}
