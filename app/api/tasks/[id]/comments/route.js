import { NextResponse } from 'next/server';
import { supabaseAdmin, getServerUser } from '../../../../../lib/supabase';
import { logActivity } from '../../../../../lib/activityLogger';

export async function GET(req, { params }) {
  try {
    const taskId = params.id;
    const { data: comments, error } = await supabaseAdmin
      .from('comments')
      .select('id, content, created_at, user:profiles(id, name, email, github_username)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ comments: comments || [] });
  } catch (error) {
    console.error('Comments GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const taskId = params.id;
    const body = await req.json();
    const { content } = body;

    if (!content || content.trim() === '') {
      return NextResponse.json({ error: 'Comment content cannot be empty' }, { status: 400 });
    }

    const currentUser = await getServerUser(req);
    const userId = currentUser?.id || '00000000-0000-0000-0000-000000000000';

    const { data: comment } = await supabaseAdmin
      .from('comments')
      .insert({
        task_id: taskId,
        user_id: userId,
        content: content.trim(),
      })
      .select('id, content, created_at, user:profiles(id, name, email)')
      .single();

    // Fetch task for title & project_id
    const { data: task } = await supabaseAdmin.from('tasks').select('project_id, title').eq('id', taskId).single();
    if (task) {
      await logActivity({
        projectId: task.project_id,
        userId,
        action: 'comment_added',
        metadata: { taskTitle: task.title, commentContent: content.trim().slice(0, 40) },
      });
    }

    if (!comment) {
      const fallback = {
        id: `c-${Date.now()}`,
        content: content.trim(),
        createdAt: new Date().toISOString(),
        user: { id: userId, name: 'Team Member' },
      };
      return NextResponse.json({ comment: fallback }, { status: 201 });
    }

    return NextResponse.json({
      comment: {
        id: comment.id,
        content: comment.content,
        createdAt: comment.created_at,
        user: comment.user ? { id: comment.user.id, name: comment.user.name, email: comment.user.email } : null,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Comment POST error:', error);
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });
  }
}
