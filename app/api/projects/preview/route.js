import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code || !code.trim()) {
      return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
    }

    const cleanCode = code.trim().toUpperCase();

    // 1. Fetch code data from project_invite_codes
    const { data: codeData, error: codeErr } = await supabaseAdmin
      .from('project_invite_codes')
      .select('id, code, expires_at, role, project_id')
      .eq('code', cleanCode)
      .maybeSingle();

    if (codeErr || !codeData) {
      return NextResponse.json({ error: 'Invalid or expired invite code' }, { status: 404 });
    }

    // 2. Check expiration
    if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invite code has been revoked or expired' }, { status: 400 });
    }

    // 3. Fetch project details
    const { data: project, error: projErr } = await supabaseAdmin
      .from('projects')
      .select('id, name, description, owner_id')
      .eq('id', codeData.project_id)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: 'Associated project no longer exists' }, { status: 404 });
    }

    // 4. Fetch Owner profile (Admin name)
    const { data: ownerProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email')
      .eq('id', project.owner_id)
      .maybeSingle();

    const adminName = ownerProfile?.name || ownerProfile?.email?.split('@')[0] || 'Project Admin';

    // 5. Fetch member count from project_members
    const { count: memberCount } = await supabaseAdmin
      .from('project_members')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', project.id);

    return NextResponse.json({
      valid: true,
      project: {
        id: project.id,
        name: project.name,
        description: project.description || '',
        adminName: adminName,
        memberCount: memberCount || 1,
        role: codeData.role || 'MEMBER',
      },
    });
  } catch (error) {
    console.error('Invite preview GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch invite code preview' }, { status: 500 });
  }
}
