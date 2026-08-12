import { supabaseAdmin } from './supabase.js';

export async function addNotification({
  userId,
  type = 'join_request',
  author = 'FlowBoard',
  action = 'sent a request',
  text = '',
  projectId = null,
  taskId = null,
  requestId = null,
  requesterId = null,
  role = 'MEMBER',
  status = 'pending',
  userPreferences = null,
}) {
  if (!userId) return null;

  // Respect user notification preference toggles
  if (userPreferences) {
    if (type === 'task_assigned' && userPreferences.taskAssigned === false) return null;
    if (type === 'join_request' && userPreferences.joinRequests === false) return null;
    if (type === 'comment' && userPreferences.comments === false) return null;
  }

  try {
    const insertObj = {
      user_id: userId,
      type,
      author,
      action,
      text: text || `${author} ${action}`,
      project_id: projectId || null,
      task_id: taskId || null,
      request_id: requestId || null,
      requester_id: requesterId || null,
      role,
      status: type === 'join_request' ? status : null,
      read: false,
    };

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert(insertObj)
      .select()
      .single();

    if (error) {
      console.error('[NotificationsStore] addNotification error:', error.message);
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      type: data.type,
      author: data.author,
      action: data.action,
      text: data.text,
      projectId: data.project_id,
      taskId: data.task_id,
      requestId: data.request_id,
      requesterId: data.requester_id,
      role: data.role,
      status: data.status,
      read: data.read,
      time: 'Just now',
      createdAt: data.created_at,
    };
  } catch (err) {
    console.error('[NotificationsStore] addNotification exception:', err);
    return null;
  }
}

export async function updateNotificationStatusByRequestId({ requestId, projectId, requesterId, status }) {
  const isApproved = status === 'approved' || status === 'accepted' || status === 'accept';
  const resolvedAction = isApproved ? 'accepted join request' : 'declined join request';
  const finalStatus = isApproved ? 'approved' : 'rejected';

  try {
    let query = supabaseAdmin
      .from('notifications')
      .update({
        status: finalStatus,
        read: true,
        action: resolvedAction,
      });

    if (requestId) {
      query = query.eq('request_id', requestId);
    } else if (projectId && requesterId) {
      query = query.eq('project_id', projectId).eq('requester_id', requesterId);
    } else {
      return;
    }

    const { error } = await query;
    if (error) {
      console.error('[NotificationsStore] updateNotificationStatusByRequestId error:', error.message);
    }
  } catch (err) {
    console.error('[NotificationsStore] updateNotificationStatusByRequestId exception:', err);
  }
}

export async function getNotificationsForUser(userId) {
  if (!userId) return [];
  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[NotificationsStore] getNotificationsForUser error:', error.message);
      return [];
    }

    return (data || []).map((n) => ({
      id: n.id,
      userId: n.user_id,
      type: n.type,
      author: n.author,
      action: n.action,
      text: n.text,
      projectId: n.project_id,
      taskId: n.task_id,
      requestId: n.request_id,
      requesterId: n.requester_id,
      role: n.role,
      status: n.status,
      read: n.read,
      time: n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
      createdAt: n.created_at,
    }));
  } catch (err) {
    console.error('[NotificationsStore] getNotificationsForUser exception:', err);
    return [];
  }
}

export async function deleteNotifications(userId, notificationId = null) {
  if (!userId) return;
  try {
    let query = supabaseAdmin.from('notifications').delete().eq('user_id', userId);
    if (notificationId) {
      query = query.eq('id', notificationId);
    }
    const { error } = await query;
    if (error) {
      console.error('[NotificationsStore] deleteNotifications error:', error.message);
    }
  } catch (err) {
    console.error('[NotificationsStore] deleteNotifications exception:', err);
  }
}

export async function markNotificationsRead(userId, notificationId = null) {
  await deleteNotifications(userId, notificationId);
}
