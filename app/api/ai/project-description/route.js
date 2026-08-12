import { NextResponse } from 'next/server';
import { getServerUser } from '../../../../lib/supabase';
import { generateProjectDescription } from '../../../../lib/ai/projectDescriptionGenerator';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const user = await getServerUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, keyPoints, projectType, complexity } = body;

    if (!title || title.trim() === '') {
      return NextResponse.json({ error: 'Project title is required to generate a description' }, { status: 400 });
    }

    const { description, suggestedSkills, isFallback } = await generateProjectDescription({ title, keyPoints, projectType, complexity });
    return NextResponse.json({ description, suggestedSkills, isFallback: Boolean(isFallback) });
  } catch (error) {
    console.error('Project description AI error:', error);
    return NextResponse.json({ error: 'Failed to generate project description' }, { status: 500 });
  }
}

