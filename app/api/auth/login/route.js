import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit';

export async function POST(req) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`login-${ip}`, { limit: 10, windowMs: 60000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again in 1 minute.' },
        { status: 429, headers: { 'Retry-After': Math.ceil(rl.resetMs / 1000).toString() } }
      );
    }

    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error || !data.user) {
      return NextResponse.json({ error: error?.message || 'Invalid email or password' }, { status: 401 });
    }

    return NextResponse.json({
      message: 'Login successful',
      user: data.user,
      session: data.session,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error during login' }, { status: 500 });
  }
}
