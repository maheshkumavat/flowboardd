import { NextResponse } from 'next/server';
import { supabaseAdmin, getServerUser } from '../../../../lib/supabase';
import { getPendingJoinRequests } from '../../../../lib/invitesStore';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const user = await getServerUser(req);
    if (!user) {
      return NextResponse.json({ pendingRequests: [] });
    }

    // Try DB first
    try {
      const { data, error } = await supabaseAdmin
        .from('join_requests')
        .select('*, project:projects(id, name)')
        .eq('user_id', user.id)
        .eq('status', 'pending');

      if (!error && data && data.length > 0) {
        return NextResponse.json({ pendingRequests: data });
      }
    } catch (e) {}

    // Fallback to store
    const fs = await import('fs');
    const path = await import('path');
    const DATA_DIR = path.join(process.cwd(), '.data');
    const INVITES_FILE = path.join(DATA_DIR, 'invites_store.json');

    if (fs.existsSync(INVITES_FILE)) {
      const raw = fs.readFileSync(INVITES_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      const pendingMem = (parsed?.joinRequests || []).filter(
        (r) => r.user_id === user.id && r.status === 'pending'
      );

      // Attach project names
      const projIds = pendingMem.map((r) => r.project_id);
      let projects = [];
      if (projIds.length > 0) {
        const { data: projs } = await supabaseAdmin
          .from('projects')
          .select('id, name')
          .in('id', projIds);
        projects = projs || [];
      }

      const formatted = pendingMem.map((r) => {
        const proj = projects.find((p) => p.id === r.project_id);
        return {
          ...r,
          project: proj || { id: r.project_id, name: 'Project Workspace' },
        };
      });

      return NextResponse.json({ pendingRequests: formatted });
    }

    return NextResponse.json({ pendingRequests: [] });
  } catch (error) {
    console.error('Fetch user pending requests error:', error);
    return NextResponse.json({ pendingRequests: [] });
  }
}
