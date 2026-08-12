import { NextResponse } from 'next/server';
import { supabaseAdmin, getServerUser, checkIsProjectAdmin } from '../../../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  try {
    const projectId = params.id;
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const { data: logs, error } = await supabaseAdmin
      .from('activity_log')
      .select(`
        *,
        user:profiles(id, name, avatar_url)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Fetch activity log error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ activity: logs || [] });
  } catch (error) {
    console.error('Get activity log exception:', error);
    return NextResponse.json({ error: 'Failed to fetch activity log' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const projectId = params.id;
    const user = await getServerUser(req);

    if (!user || !(await checkIsProjectAdmin(projectId, user))) {
      return NextResponse.json({ error: 'Forbidden: Only Admins can clear activity logs' }, { status: 403 });
    }

    // Delete all activity_log entries for this project
    const { error } = await supabaseAdmin
      .from('activity_log')
      .delete()
      .eq('project_id', projectId);

    if (error) {
      console.error('Clear activity log error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Activity log cleared successfully' });
  } catch (error) {
    console.error('Delete activity log exception:', error);
    return NextResponse.json({ error: 'Failed to clear activity log' }, { status: 500 });
  }
}
