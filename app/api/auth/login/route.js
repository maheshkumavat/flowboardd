import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '../../../../lib/db';
import { signToken, createAuthCookie } from '../../../../lib/auth';
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

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = signToken({ userId: user.id, email: user.email, name: user.name });
    const cookieHeader = createAuthCookie(token);

    let parsedSkills = {};
    if (user.skillProfile) {
      try {
        parsedSkills = JSON.parse(user.skillProfile);
      } catch (e) {}
    }

    const res = NextResponse.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        githubUsername: user.githubUsername,
        skillProfile: parsedSkills,
      },
    });

    res.headers.append('Set-Cookie', cookieHeader);
    return res;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error during login' }, { status: 500 });
  }
}
