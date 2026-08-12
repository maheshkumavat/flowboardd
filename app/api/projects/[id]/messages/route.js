import { NextResponse } from 'next/server';
import { getServerUser } from '../../../../../lib/supabase';
import { getProjectMessages, addProjectMessage } from '../../../../../lib/messagesStore';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  try {
    const projectId = params.id;
    const user = await getServerUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const messages = await getProjectMessages(projectId);
    return NextResponse.json({ messages });
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

    const messageObj = await addProjectMessage({
      projectId,
      userId: user.id,
      content,
      imageUrl,
      senderName,
      senderEmail,
    });

    if (!messageObj) {
      return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
    }

    return NextResponse.json({ message: messageObj }, { status: 201 });
  } catch (error) {
    console.error('Project messages POST error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
