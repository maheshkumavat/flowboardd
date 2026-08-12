import { NextResponse } from 'next/server';
import { supabaseAdmin, getServerUser, checkIsProjectAdmin } from '../../../../../lib/supabase';

export const dynamic = 'force-dynamic';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

function generateRandomCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function createFiveMinInviteCode(projectId, userId) {
  await supabaseAdmin.from('project_invite_codes').delete().eq('project_id', projectId);

  const newCode = generateRandomCode(6);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + FIVE_MINUTES_MS);

  const { data: codeData, error } = await supabaseAdmin
    .from('project_invite_codes')
    .insert({
      project_id: projectId,
      code: newCode,
      role: 'MEMBER',
      created_by: userId,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error || !codeData) {
    console.error('Failed to create 5-min invite code:', error);
    return null;
  }
  return codeData;
}

// Fetch active invite code (Admin or Project Members)
// Auto-regenerates a fresh 5-min code for Admins if current code has expired
export async function GET(req, { params }) {
  try {
    const projectId = params.id;
    const user = await getServerUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: codeData } = await supabaseAdmin
      .from('project_invite_codes')
      .select('*')
      .eq('project_id', projectId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Lazy auto-regeneration on read: If no active non-expired code exists and user is Admin, create a fresh 5-min code
    if (!codeData) {
      const isAdmin = await checkIsProjectAdmin(projectId, user);
      if (isAdmin) {
        const freshCode = await createFiveMinInviteCode(projectId, user.id);
        return NextResponse.json({ inviteCode: freshCode });
      }
    }

    return NextResponse.json({ inviteCode: codeData || null });
  } catch (error) {
    console.error('Invite code GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch invite code' }, { status: 500 });
  }
}

// Generate or Regenerate invite code manually (Admin only)
export async function POST(req, { params }) {
  try {
    const projectId = params.id;
    const user = await getServerUser(req);

    const isAdmin = await checkIsProjectAdmin(projectId, user);
    if (!user || !isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Only Admins can generate invite codes' }, { status: 403 });
    }

    const freshCode = await createFiveMinInviteCode(projectId, user.id);

    if (!freshCode) {
      return NextResponse.json({ error: 'Failed to save invite code to database' }, { status: 500 });
    }

    return NextResponse.json({ inviteCode: freshCode }, { status: 201 });
  } catch (error) {
    console.error('Invite code POST error:', error);
    return NextResponse.json({ error: 'Failed to generate invite code' }, { status: 500 });
  }
}

// Revoke current invite code (Admin only)
export async function DELETE(req, { params }) {
  try {
    const projectId = params.id;
    const user = await getServerUser(req);

    if (!user || !(await checkIsProjectAdmin(projectId, user))) {
      return NextResponse.json({ error: 'Forbidden: Only Admins can revoke invite codes' }, { status: 403 });
    }

    await supabaseAdmin.from('project_invite_codes').delete().eq('project_id', projectId);
    return NextResponse.json({ message: 'Invite code revoked successfully' });
  } catch (error) {
    console.error('Invite code DELETE error:', error);
    return NextResponse.json({ error: 'Failed to revoke invite code' }, { status: 500 });
  }
}

