import { NextResponse } from 'next/server';
import { supabaseAdmin, getServerUser } from '../../../../../lib/supabase';
import { getProjectMessages, addProjectMessage } from '../../../../../lib/messagesStore';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  try {
    const projectId = params.id;
    const user = await getServerUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try DB first
    try {
      const { data, error } = await supabaseAdmin
        .from('project_messages')
        .select(`
          id,
          project_id,
          user_id,
          content,
          created_at,
          user:profiles(id, name, email, github_username, avatar_url)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        return NextResponse.json({ messages: data });
      }
    } catch (e) {}

    // Fallback to store
    const storeMsgs = getProjectMessages(projectId);
    return NextResponse.json({ messages: storeMsgs });
  } catch (error) {
    console.error('Project messages GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const projectId = params.id;
    const body = await req.json();
    const { content, imageUrl } = body;

    if ((!content || !content.trim()) && !imageUrl) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    }

    const user = await getServerUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const senderName = user.user_metadata?.name || user.email?.split('@')[0] || 'Team Member';
    const senderEmail = user.email || '';

    let messageObj = null;

    // Try DB insert
    try {
      const { data, error } = await supabaseAdmin
        .from('project_messages')
        .insert({
          project_id: projectId,
          user_id: user.id,
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

      if (!error && data) {
        messageObj = data;
      }
    } catch (e) {}

    if (!messageObj) {
      messageObj = addProjectMessage({
        projectId,
        userId: user.id,
        content,
        imageUrl,
        senderName,
        senderEmail,
      });
    }

    return NextResponse.json({ message: messageObj }, { status: 201 });
  } catch (error) {
    console.error('Project messages POST error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
