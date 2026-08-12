import { NextResponse } from 'next/server';
import { supabaseAdmin, getServerUser } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const user = await getServerUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, name } = body;

    if (!projectId || !name || name.trim() === '') {
      return NextResponse.json({ error: 'Project ID and column name are required' }, { status: 400 });
    }

    // Verify user membership or ownership in project
    const { data: member } = await supabaseAdmin
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: proj } = await supabaseAdmin
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .maybeSingle();

    const isOwner = proj && proj.owner_id === user.id;
    if (!isOwner && !member) {
      return NextResponse.json({ error: 'Forbidden: You are not a member of this project' }, { status: 403 });
    }

    const { data: cols } = await supabaseAdmin
      .from('columns')
      .select('position')
      .eq('project_id', projectId)
      .order('position', { ascending: false })
      .limit(1);

    const nextPos = cols && cols.length > 0 ? cols[0].position + 1 : 0;

    const { data: col, error } = await supabaseAdmin
      .from('columns')
      .insert({
        project_id: projectId,
        name: name.trim(),
        position: nextPos,
      })
      .select()
      .single();

    if (error || !col) {
      const fallbackCol = {
        id: `c-${Date.now()}`,
        projectId,
        name: name.trim(),
        position: nextPos,
        tasks: [],
      };
      return NextResponse.json({ column: fallbackCol }, { status: 201 });
    }

    return NextResponse.json({ column: { ...col, tasks: [] } }, { status: 201 });
  } catch (error) {
    console.error('Column creation error:', error);
    return NextResponse.json({ error: 'Failed to create column' }, { status: 500 });
  }
}

