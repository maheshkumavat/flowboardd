import { supabaseAdmin } from './supabase';

/**
 * Log a human-readable activity event into public.activity_log
 */
export async function logActivity({ projectId, userId, action, metadata = {} }) {
  if (!projectId || !userId || !action) return;

  try {
    await supabaseAdmin.from('activity_log').insert({
      project_id: projectId,
      user_id: userId,
      action, // 'task_created', 'task_moved', 'task_assigned', 'comment_added', 'member_joined'
      metadata,
    });
    console.log(`[Activity Log] Action '${action}' recorded for project ${projectId}`);
  } catch (err) {
    console.error('Failed to record activity log:', err);
  }
}
