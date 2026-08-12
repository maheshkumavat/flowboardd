import { NextResponse } from 'next/server';
import { createLogoutCookie } from '../../../../lib/auth';

/**
 * Logout Handler
 * Clears legacy auth cookie and Supabase session cookies (sb-access-token, sb-refresh-token).
 */
export async function POST() {
  const legacyCookie = createLogoutCookie();
  const res = NextResponse.json({ message: 'Logged out successfully' });
  res.headers.append('Set-Cookie', legacyCookie);

  // Clear Supabase session cookies
  res.cookies.set('sb-access-token', '', { maxAge: 0, path: '/' });
  res.cookies.set('sb-refresh-token', '', { maxAge: 0, path: '/' });

  return res;
}

