import { NextResponse } from 'next/server';
import { getServerUser } from '../../../lib/supabase';
import { getNotificationsForUser, deleteNotifications } from '../../../lib/notificationsStore';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const user = await getServerUser(req);
    if (!user) {
      return NextResponse.json({ notifications: [] });
    }

    const notifs = await getNotificationsForUser(user.id);
    return NextResponse.json({ notifications: notifs });
  } catch (error) {
    console.error('Fetch notifications error:', error);
    return NextResponse.json({ notifications: [] });
  }
}

export async function POST(req) {
  try {
    const user = await getServerUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { notificationId } = body;

    await deleteNotifications(user.id, notificationId || null);

    return NextResponse.json({ message: 'Notifications deleted successfully' });
  } catch (error) {
    console.error('Delete notifications error:', error);
    return NextResponse.json({ error: 'Failed to delete notifications' }, { status: 500 });
  }
}

export async function DELETE(req) {
  return POST(req);
}

export async function PATCH(req) {
  return POST(req);
}
