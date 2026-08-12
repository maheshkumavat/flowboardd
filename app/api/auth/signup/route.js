import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '../../../../lib/db';
import { signToken, createAuthCookie } from '../../../../lib/auth';
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

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
      },
    });

    const token = signToken({ userId: user.id, email: user.email, name: user.name });
    const cookieHeader = createAuthCookie(token);

    const res = NextResponse.json({
      message: 'Signup successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        githubUsername: user.githubUsername,
        skillProfile: user.skillProfile ? JSON.parse(user.skillProfile) : {},
      },
    });

    res.headers.append('Set-Cookie', cookieHeader);
    return res;
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Internal server error during signup' }, { status: 500 });
  }
}
