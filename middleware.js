import { NextResponse } from 'next/server';

/**
 * Edge-Native Lightweight JWT Validator
 * Synchronously checks JWT expiration and claims without heavy Node.js dependencies.
 */
function isTokenValid(token) {
  if (!token || token === 'null' || token === 'undefined') return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const decoded = JSON.parse(jsonPayload);
    if (decoded && decoded.sub && decoded.exp) {
      const isNotExpired = decoded.exp * 1000 > Date.now();
      const isValidAud =
        decoded.aud === 'authenticated' ||
        decoded.role === 'authenticated' ||
        (decoded.iss && decoded.iss.includes('supabase'));
      return isNotExpired && isValidAud;
    }
  } catch (err) {}
  return false;
}


export function middleware(request) {
  const { pathname } = request.nextUrl;

  // 1. Skip static assets, Next.js internals, and public static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/stitch_screens') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    const res = NextResponse.next();
    res.headers.set('X-Frame-Options', 'DENY');
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return res;
  }

  // 2. Extract Auth Cookie
  let token = null;
  const cookieHeader = request.cookies;
  const sbAccess = cookieHeader.get('sb-access-token')?.value;

  if (sbAccess) {
    token = sbAccess;
  } else {
    const allCookies = cookieHeader.getAll();
    const sbAuthCookie = allCookies.find((c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'));
    if (sbAuthCookie?.value) {
      try {
        const parsed = JSON.parse(sbAuthCookie.value);
        token = parsed?.access_token || parsed?.currentSession?.access_token || null;
      } catch (e) {
        token = sbAuthCookie.value;
      }
    }
  }

  const authenticated = isTokenValid(token);

  // Define public auth routes
  const isPublicAuthRoute =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/forgot-password' ||
    pathname === '/account-deleted';

  // 3. Server-Side Protection Rules
  if (!authenticated && !isPublicAuthRoute) {
    // Redirect unauthenticated user accessing protected page server-side to /login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const redirectRes = NextResponse.redirect(loginUrl);
    redirectRes.headers.set('X-Frame-Options', 'DENY');
    redirectRes.headers.set('X-Content-Type-Options', 'nosniff');
    redirectRes.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return redirectRes;
  }

  if (authenticated && (pathname === '/login' || pathname === '/signup')) {
    // Redirect authenticated user visiting /login or /signup to dashboard /
    const homeUrl = new URL('/', request.url);
    const redirectRes = NextResponse.redirect(homeUrl);
    redirectRes.headers.set('X-Frame-Options', 'DENY');
    redirectRes.headers.set('X-Content-Type-Options', 'nosniff');
    redirectRes.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return redirectRes;
  }

  // 4. Continue to page with Security Headers
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
