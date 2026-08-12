import { supabaseAdmin } from './supabase.js';

/**
 * Join Requests Management (Pure Supabase DB)
 */
export async function createJoinRequest({ projectId, userId, inviteCode, role = 'MEMBER' }) {
  try {
    const { data: existing } = await supabaseAdmin
      .from('join_requests')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      return { request: existing, isDuplicate: true };
    }

    const { data, error } = await supabaseAdmin
      .from('join_requests')
      .insert({
        project_id: projectId,
        user_id: userId,
        invite_code: inviteCode,
        role,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('[InvitesStore] createJoinRequest error:', error.message);
      return { request: null, isDuplicate: false };
    }

    return { request: data, isDuplicate: false };
  } catch (err) {
    console.error('[InvitesStore] createJoinRequest exception:', err);
    return { request: null, isDuplicate: false };
  }
}

export async function getPendingJoinRequests(projectId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('join_requests')
      .select(`
        id,
        project_id,
        user_id,
        invite_code,
        role,
        status,
        created_at,
        user:profiles(id, name, email, avatar_url, role)
      `)
      .eq('project_id', projectId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[InvitesStore] getPendingJoinRequests error:', error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('[InvitesStore] getPendingJoinRequests exception:', err);
    return [];
  }
}

export async function updateJoinRequestStatus(requestId, newStatus) {
  try {
    const { data, error } = await supabaseAdmin
      .from('join_requests')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', requestId)
      .select()
      .single();

    if (error) {
      console.error('[InvitesStore] updateJoinRequestStatus error:', error.message);
      return null;
    }

    return data;
  } catch (err) {
    console.error('[InvitesStore] updateJoinRequestStatus exception:', err);
    return null;
  }
}

/**
 * Tokenized Email Invites Management (Pure Supabase DB)
 */
export async function createEmailInvite({ projectId, email, role = 'MEMBER', token, createdBy }) {
  const expiresAt = new Date(Date.now() + 86400000 * 7).toISOString(); // 7 days

  try {
    const { data, error } = await supabaseAdmin
      .from('project_email_invites')
      .insert({
        project_id: projectId,
        email: email.toLowerCase().trim(),
        role,
        token,
        created_by: createdBy,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      console.error('[InvitesStore] createEmailInvite error:', error.message);
      return null;
    }

    return data;
  } catch (err) {
    console.error('[InvitesStore] createEmailInvite exception:', err);
    return null;
  }
}

export async function getEmailInviteByToken(token) {
  try {
    const { data, error } = await supabaseAdmin
      .from('project_email_invites')
      .select('*, project:projects(id, name)')
      .eq('token', token)
      .single();

    if (error) {
      console.error('[InvitesStore] getEmailInviteByToken error:', error.message);
      return null;
    }

    return data;
  } catch (err) {
    console.error('[InvitesStore] getEmailInviteByToken exception:', err);
    return null;
  }
}

export async function deleteEmailInviteToken(token) {
  try {
    const { error } = await supabaseAdmin.from('project_email_invites').delete().eq('token', token);
    if (error) {
      console.error('[InvitesStore] deleteEmailInviteToken error:', error.message);
    }
  } catch (err) {
    console.error('[InvitesStore] deleteEmailInviteToken exception:', err);
  }
}
