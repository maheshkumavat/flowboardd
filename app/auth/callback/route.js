import { NextResponse } from 'next/server';
import { supabaseAdmin, supabase, ensureProfile } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const errorParam = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');
  const intent = requestUrl.searchParams.get('intent') || 'create';

  // 1. Handle OAuth provider errors if passed directly back
  if (errorParam || errorDescription) {
    console.error('[OAuth Callback Error From Provider]:', errorParam, errorDescription);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', errorDescription || errorParam || 'OAuth provider error');
    return NextResponse.redirect(loginUrl);
  }

  // 2. Exchange OAuth PKCE Code for Session
  if (code) {
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) {
        console.error('[OAuth exchangeCodeForSession Error]:', error.message || error);
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('error', error.message || 'Failed to exchange authorization code');
        return NextResponse.redirect(loginUrl);
      }

      if (data?.session && data?.user) {
        const user = data.user;
        const accessToken = data.session.access_token;
        const refreshToken = data.session.refresh_token;

        // Ensure user profile exists in public.profiles table
        const profile = await ensureProfile(user);

        // Branching Logic: New User vs Returning User
        // If profile is missing, has default 'User' name, or missing primary_role -> Onboarding
        // Otherwise -> Home / Dashboard
        const isNewUser = !profile || !profile.primary_role || profile.primary_role === 'Developer' && (!profile.github_username && profile.name === 'User');
        
        let destination = '/';
        if (isNewUser) {
          destination = `/onboarding?intent=${encodeURIComponent(intent)}`;
        }

        const response = NextResponse.redirect(new URL(destination, request.url));

        // Attach sb-access-token and sb-refresh-token HTTP cookies to response
        const isHttps = request.url.startsWith('https:');
        const cookieOptions = `; path=/; max-age=604800; SameSite=Lax${isHttps ? '; Secure' : ''}`;
        
        response.headers.append('Set-Cookie', `sb-access-token=${accessToken}${cookieOptions}`);
        if (refreshToken) {
          response.headers.append('Set-Cookie', `sb-refresh-token=${refreshToken}${cookieOptions}`);
        }

        return response;
      }
    } catch (err) {
      console.error('[OAuth Callback Exception]:', err);
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', err.message || 'Internal error during authentication callback');
      return NextResponse.redirect(loginUrl);
    }
  }

  // 3. Fallback if code was missing
  console.warn('[OAuth Callback Warning]: Code parameter missing in request');
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('error', 'Authorization code missing in callback request');
  return NextResponse.redirect(loginUrl);
}
