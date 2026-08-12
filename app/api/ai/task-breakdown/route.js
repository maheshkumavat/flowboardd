import { NextResponse } from 'next/server';
import { getServerUser } from '../../../../lib/supabase';
import { generateTaskBreakdown } from '../../../../lib/ai/taskBreakdown';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const user = await getServerUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { goal } = body;

    if (!goal || goal.trim() === '') {
      return NextResponse.json({ error: 'Goal description is required' }, { status: 400 });
    }

    const subtasks = await generateTaskBreakdown(goal.trim());
    return NextResponse.json({ subtasks });
  } catch (error) {
    console.error('Task breakdown API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate task breakdown' }, { status: 500 });
  }
}

