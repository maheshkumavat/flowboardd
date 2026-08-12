import { NextResponse } from 'next/server';
import { supabaseAdmin, getServerUser } from '../../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const user = await getServerUser(req);
    if (!user) {
      return NextResponse.json({ pendingRequests: [] });
    }

    const { data, error } = await supabaseAdmin
      .from('join_requests')
      .select('*, project:projects(id, name)')
      .eq('user_id', user.id)
      .eq('status', 'pending');

    if (error) {
      console.error('Fetch user pending requests error:', error.message);
      return NextResponse.json({ pendingRequests: [] });
    }

    return NextResponse.json({ pendingRequests: data || [] });
  } catch (error) {
    console.error('Fetch user pending requests exception:', error);
    return NextResponse.json({ pendingRequests: [] });
  }
}
