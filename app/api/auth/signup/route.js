import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit';

export async function POST(req) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`signup-${ip}`, { limit: 10, windowMs: 60000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Please try again in 1 minute.' },
        { status: 429, headers: { 'Retry-After': Math.ceil(rl.resetMs / 1000).toString() } }
      );
    }

    const body = await req.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const typedName = name.trim();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          name: typedName,
          full_name: typedName,
        },
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      message: 'Signup successful',
      user: data.user,
      session: data.session,
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Internal server error during signup' }, { status: 500 });
  }
}
