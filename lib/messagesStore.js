import { supabaseAdmin } from './supabase.js';

export async function getProjectMessages(projectId) {
  if (!projectId) return [];
  try {
    const { data, error } = await supabaseAdmin
      .from('project_messages')
      .select(`
        id,
        project_id,
        user_id,
        content,
        image_url,
        created_at,
        user:profiles(id, name, email, github_username, avatar_url)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[MessagesStore] getProjectMessages error:', error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('[MessagesStore] getProjectMessages exception:', err);
    return [];
  }
}

export async function addProjectMessage({ projectId, userId, content, imageUrl, senderName, senderEmail }) {
  if (!projectId || !userId || (!content && !imageUrl)) return null;
  try {
    const { data, error } = await supabaseAdmin
      .from('project_messages')
      .insert({
        project_id: projectId,
        user_id: userId,
        content: (content || '').trim(),
        image_url: imageUrl || null,
      })
      .select(`
        id,
        project_id,
        user_id,
        content,
        image_url,
        created_at,
        user:profiles(id, name, email, github_username, avatar_url)
      `)
      .single();

    if (error) {
      console.error('[MessagesStore] addProjectMessage error:', error.message);
      return null;
    }

    return data;
  } catch (err) {
    console.error('[MessagesStore] addProjectMessage exception:', err);
    return null;
  }
}
