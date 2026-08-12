import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from './supabase.js';

const DATA_DIR = path.join(process.cwd(), '.data');
const INVITES_FILE = path.join(DATA_DIR, 'invites_store.json');

function ensureStoreFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(INVITES_FILE)) {
    fs.writeFileSync(INVITES_FILE, JSON.stringify({ joinRequests: [], emailInvites: [] }, null, 2));
  }
}

function readDataFromFile() {
  ensureStoreFile();
  try {
    const raw = fs.readFileSync(INVITES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      joinRequests: parsed?.joinRequests || [],
      emailInvites: parsed?.emailInvites || [],
    };
  } catch (err) {
    console.error('Failed to read invites store file:', err);
    return { joinRequests: [], emailInvites: [] };
  }
}

function writeDataToFile(data) {
  ensureStoreFile();
  try {
    fs.writeFileSync(INVITES_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Failed to write invites store file:', err);
  }
}

/**
 * Join Requests Management
 */
export async function createJoinRequest({ projectId, userId, inviteCode, role = 'MEMBER' }) {
  // Try DB First
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

    if (!error && data) {
      return { request: data, isDuplicate: false };
    }
  } catch (err) {
    console.warn('[InvitesStore] DB join_requests fallback active:', err.message);
  }

  // File-based Persistent Fallback
  const store = readDataFromFile();
  const existingMem = store.joinRequests.find(
    (r) => r.project_id === projectId && r.user_id === userId && r.status === 'pending'
  );
  if (existingMem) return { request: existingMem, isDuplicate: true };

  const reqObj = {
    id: `jr-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    project_id: projectId,
    user_id: userId,
    invite_code: inviteCode,
    role,
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  store.joinRequests.push(reqObj);
  writeDataToFile(store);
  return { request: reqObj, isDuplicate: false };
}

export async function getPendingJoinRequests(projectId) {
  let pending = [];

  // Try DB First
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

    if (!error && data) {
      return data;
    }
  } catch (err) {
    console.warn('[InvitesStore] DB fetch join_requests fallback active:', err.message);
  }

  // File-based Fallback
  const store = readDataFromFile();
  pending = store.joinRequests.filter(
    (r) => r.project_id === projectId && r.status === 'pending'
  );

  // Fetch profiles for requester users from Supabase profiles table
  const userIds = pending.map((r) => r.user_id);
  let profiles = [];
  if (userIds.length > 0) {
    const { data: profs } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, avatar_url, role')
      .in('id', userIds);
    profiles = profs || [];
  }

  return pending.map((r) => {
    const prof = profiles.find((p) => p.id === r.user_id);
    return {
      ...r,
      user: prof || { id: r.user_id, name: 'User', email: 'user@example.com' },
    };
  });
}

export async function updateJoinRequestStatus(requestId, newStatus) {
  // Try DB First
  try {
    const { data, error } = await supabaseAdmin
      .from('join_requests')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', requestId)
      .select()
      .single();

    if (!error && data) return data;
  } catch (err) {
    console.warn('[InvitesStore] DB update join_requests fallback active:', err.message);
  }

  // File-based Fallback
  const store = readDataFromFile();
  const req = store.joinRequests.find((r) => r.id === requestId);
  if (req) {
    req.status = newStatus;
    req.updated_at = new Date().toISOString();
    writeDataToFile(store);
    return req;
  }
  return null;
}

/**
 * Tokenized Email Invites Management
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

    if (!error && data) return data;
  } catch (err) {
    console.warn('[InvitesStore] DB insert project_email_invites fallback active:', err.message);
  }

  const store = readDataFromFile();
  const inviteObj = {
    id: `pei-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    project_id: projectId,
    email: email.toLowerCase().trim(),
    role,
    token,
    created_by: createdBy,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
  };

  store.emailInvites.push(inviteObj);
  writeDataToFile(store);
  return inviteObj;
}

export async function getEmailInviteByToken(token) {
  try {
    const { data, error } = await supabaseAdmin
      .from('project_email_invites')
      .select('*, project:projects(id, name)')
      .eq('token', token)
      .single();

    if (!error && data) return data;
  } catch (err) {
    console.warn('[InvitesStore] DB fetch project_email_invites fallback active:', err.message);
  }

  const store = readDataFromFile();
  const invite = store.emailInvites.find((i) => i.token === token);
  if (!invite) return null;

  const { data: proj } = await supabaseAdmin
    .from('projects')
    .select('id, name')
    .eq('id', invite.project_id)
    .single();

  return {
    ...invite,
    project: proj || { id: invite.project_id, name: 'Project' },
  };
}

export async function deleteEmailInviteToken(token) {
  try {
    await supabaseAdmin.from('project_email_invites').delete().eq('token', token);
  } catch (err) {
    console.warn('[InvitesStore] DB delete project_email_invites fallback active:', err.message);
  }

  const store = readDataFromFile();
  const index = store.emailInvites.findIndex((i) => i.token === token);
  if (index !== -1) {
    store.emailInvites.splice(index, 1);
    writeDataToFile(store);
  }
}
