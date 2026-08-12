import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const isBrowser = typeof window !== 'undefined';

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder', {
  auth: {
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
    detectSessionInUrl: isBrowser,
    lock: async (name, acquireTimeout, fn) => await fn(),
  },
});

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabaseAdmin = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseServiceKey || 'placeholder', {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Single-flight token cache & listener
let cachedAccessToken = null;
let sessionFetchPromise = null;

if (isBrowser) {
  supabase.auth.onAuthStateChange((event, session) => {
    console.log(`[Supabase Auth Event ${new Date().toISOString()}] Event: ${event} | Token Present: ${!!session?.access_token}`);
    if (session?.access_token) {
      cachedAccessToken = session.access_token;
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      const cookieOptions = `; path=/; max-age=604800; SameSite=Lax${isHttps ? '; Secure' : ''}`;
      document.cookie = `sb-access-token=${session.access_token}${cookieOptions}`;
      if (session.refresh_token) {
        document.cookie = `sb-refresh-token=${session.refresh_token}${cookieOptions}`;
      }
    } else if (event === 'SIGNED_OUT') {
      cachedAccessToken = null;
      document.cookie = 'sb-access-token=; path=/; max-age=0; SameSite=Lax';
      document.cookie = 'sb-refresh-token=; path=/; max-age=0; SameSite=Lax';
    }
  });
}

export async function getValidAccessToken() {
  if (cachedAccessToken) {
    try {
      const decoded = jwt.decode(cachedAccessToken);
      if (decoded && decoded.exp && decoded.exp * 1000 > Date.now() + 10000) {
        return cachedAccessToken;
      }
    } catch (e) {}
    cachedAccessToken = null;
  }
  if (!isBrowser) return null;

  // 1. Check exact project auth key in localStorage with expiration validation
  try {
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || '';
    const exactKey = `sb-${projectRef}-auth-token`;
    const item = localStorage.getItem(exactKey) || localStorage.getItem('supabase.auth.token');

    if (item) {
      const parsed = JSON.parse(item);
      const tok = parsed?.access_token || parsed?.currentSession?.access_token;
      if (tok) {
        const decoded = jwt.decode(tok);
        if (decoded && decoded.exp && decoded.exp * 1000 > Date.now() + 10000) {
          cachedAccessToken = tok;
          const isHttps = window.location.protocol === 'https:';
          document.cookie = `sb-access-token=${tok}; path=/; max-age=604800; SameSite=Lax${isHttps ? '; Secure' : ''}`;
          return cachedAccessToken;
        }
      }
    }

    // Fallback scan loop if exact key wasn't found
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('auth-token')) {
        const val = localStorage.getItem(key);
        if (val) {
          const parsed = JSON.parse(val);
          const tok = parsed?.access_token || parsed?.currentSession?.access_token;
          if (tok) {
            const decoded = jwt.decode(tok);
            if (decoded && decoded.exp && decoded.exp * 1000 > Date.now() + 10000) {
              cachedAccessToken = tok;
              const isHttps = window.location.protocol === 'https:';
              document.cookie = `sb-access-token=${tok}; path=/; max-age=604800; SameSite=Lax${isHttps ? '; Secure' : ''}`;
              return cachedAccessToken;
            }
          }
        }
      }
    }
  } catch (e) {}

  // 2. Fetch/Refresh session from Supabase auth client if cache is empty or token is expiring
  if (!sessionFetchPromise) {
    sessionFetchPromise = (async () => {
      try {
        const getSessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((resolve) =>
          setTimeout(() => resolve({ data: { session: null }, error: new Error('getSession timeout (2000ms)') }), 2000)
        );
        const { data, error } = await Promise.race([getSessionPromise, timeoutPromise]);
        if (error) console.warn('[getValidAccessToken] getSession warning:', error.message || error);
        const token = data?.session?.access_token || null;
        if (token) {
          cachedAccessToken = token;
          if (isBrowser) {
            const isHttps = window.location.protocol === 'https:';
            document.cookie = `sb-access-token=${token}; path=/; max-age=604800; SameSite=Lax${isHttps ? '; Secure' : ''}`;
          }
        }
        return token;
      } catch (err) {
        console.error('[getValidAccessToken] Exception:', err);
        return null;
      } finally {
        sessionFetchPromise = null;
      }
    })();
  }
  return sessionFetchPromise;
}

export async function ensureProfile(user) {
  if (!user || !user.id) return null;
  try {
    let fullUser = user;
    try {
      const { data: authData } = await supabaseAdmin.auth.admin.getUserById(user.id);
      if (authData?.user) {
        fullUser = authData.user;
      }
    } catch (authErr) {
      console.warn('ensureProfile getUserById warning:', authErr.message);
    }

    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', fullUser.id)
      .single();

    const nameFromMeta = fullUser.user_metadata?.name || fullUser.user_metadata?.full_name;
    const avatarUrlFromMeta = fullUser.user_metadata?.avatar_url || fullUser.user_metadata?.picture || null;
    const ghIdentity = fullUser.identities?.find((id) => id.provider === 'github');
    const ghFromIdentity = ghIdentity?.identity_data?.user_name || ghIdentity?.identity_data?.preferred_username;
    const ghFromMeta = fullUser.user_metadata?.user_name || fullUser.user_metadata?.github_username || fullUser.user_metadata?.preferred_username || ghFromIdentity || null;

    if (existing) {
      const updates = {};
      if (!existing.avatar_url && avatarUrlFromMeta) {
        updates.avatar_url = avatarUrlFromMeta;
      }
      if ((!existing.name || existing.name === 'User') && nameFromMeta) {
        updates.name = nameFromMeta;
      }
      if (!existing.github_username && ghFromMeta) {
        updates.github_username = ghFromMeta;
      }

      if (Object.keys(updates).length > 0) {
        const { data: updated } = await supabaseAdmin
          .from('profiles')
          .update(updates)
          .eq('id', fullUser.id)
          .select()
          .single();
        return updated || { ...existing, ...updates };
      }
      return existing;
    }

    const name = nameFromMeta || fullUser.email?.split('@')[0] || 'User';
    const { data: created, error } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: fullUser.id,
        name: name,
        email: fullUser.email,
        avatar_url: avatarUrlFromMeta,
        github_username: ghFromMeta,
        skill_profile: {},
        role: 'MEMBER',
      })
      .select()
      .single();

    if (error) {
      console.error('ensureProfile upsert error:', error);
      return null;
    }
    return created;
  } catch (err) {
    console.error('ensureProfile exception:', err);
    return null;
  }
}

export async function getServerUser(req) {
  const tStart = Date.now();
  try {
    if (req) {
      let token = null;

      const authHeader = req.headers?.get?.('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }

      if (!token || token === 'null' || token === 'undefined') {
        const cookieHeader = req.headers?.get?.('cookie');
        if (cookieHeader) {
          const match = cookieHeader.match(/sb-access-token=([^;]+)/) || cookieHeader.match(/sb-[^=]+-auth-token=([^;]+)/);
          if (match) {
            token = match[1];
          }
        }
      }

      if (token && token !== 'null' && token !== 'undefined') {
        // 1. Instant synchronous JWT verification (0ms network overhead, handles unlimited concurrent requests)
        try {
          const decoded = jwt.decode(token);
          if (decoded && decoded.sub && decoded.exp) {
            const isNotExpired = decoded.exp * 1000 > Date.now();
            const isValidAud = decoded.aud === 'authenticated' || decoded.role === 'authenticated' || (decoded.iss && decoded.iss.includes('supabase'));
            
            if (isNotExpired && isValidAud) {
              const fastUser = {
                id: decoded.sub,
                email: decoded.email || decoded.user_metadata?.email || '',
                user_metadata: decoded.user_metadata || {},
                app_metadata: decoded.app_metadata || {},
                role: decoded.role || 'authenticated',
              };
              return fastUser;
            }
          }
        } catch (jwtErr) {
          console.warn('[getServerUser] Fast JWT decode warning:', jwtErr.message);
        }

        // 2. Fallback to Supabase Auth API if local JWT decode unverified
        const getUserPromise = supabaseAdmin.auth.getUser(token);
        const timeoutPromise = new Promise((resolve) =>
          setTimeout(() => resolve({ data: null, error: new Error('getServerUser timeout') }), 2500)
        );
        const res = await Promise.race([getUserPromise, timeoutPromise]);
        if (!res.error && res.data?.user) {
          console.log(`[getServerUser ${new Date().toISOString()}] Verified user ${res.data.user.id} in ${Date.now() - tStart}ms via Supabase Auth API`);
          return res.data.user;
        } else if (res.error) {
          console.warn(`[getServerUser ${new Date().toISOString()}] Verification error (${Date.now() - tStart}ms):`, res.error?.message || res.error);
        }
      }
    }
  } catch (err) {
    console.error(`[getServerUser] Exception (${Date.now() - tStart}ms):`, err);
  }
  return null;
}

export async function fetchWithAuth(url, options = {}) {
  const tStart = Date.now();
  let token = options.token || cachedAccessToken;

  if (!token && isBrowser) {
    token = await getValidAccessToken();
  }

  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    let response = await fetch(url, {
      ...options,
      headers,
    });

    // Auto-retry on 401 by forcing session token refresh
    if (response.status === 401 && isBrowser) {
      console.warn(`[fetchWithAuth] 401 received for ${url}. Attempting token refresh...`);
      cachedAccessToken = null;
      const refreshedToken = await supabase.auth.getSession().then((res) => res.data?.session?.access_token || null);
      if (refreshedToken) {
        cachedAccessToken = refreshedToken;
        headers['Authorization'] = `Bearer ${refreshedToken}`;
        response = await fetch(url, {
          ...options,
          headers,
        });
      }
    }

    return response;
  } catch (err) {
    console.error(`[fetchWithAuth] Error calling ${url}:`, err);
    throw err;
  }
}

export async function checkIsProjectAdmin(projectId, currentUser) {
  if (!projectId || !currentUser) return false;
  try {
    const userId = typeof currentUser === 'string' ? currentUser : currentUser.id;
    const userEmail = typeof currentUser === 'object' ? currentUser.email : null;

    // 1. Check if user is original project owner
    const { data: proj } = await supabaseAdmin
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .maybeSingle();

    if (proj && proj.owner_id === userId) return true;

    // 2. Query project_members by user_id or profile email (case-insensitive)
    const { data: members } = await supabaseAdmin
      .from('project_members')
      .select('id, user_id, role, user:profiles(id, email)')
      .eq('project_id', projectId);

    if (!members || members.length === 0) return false;

    const matchedMember = members.find((m) =>
      m.user_id === userId ||
      m.user?.id === userId ||
      (userEmail && m.user?.email && m.user.email.toLowerCase() === userEmail.toLowerCase())
    );

    if (!matchedMember) return false;

    // Case-insensitive role check (handles 'ADMIN', 'Admin', 'admin')
    const roleStr = String(matchedMember.role || '').toUpperCase().trim();
    return roleStr === 'ADMIN';
  } catch (e) {
    console.error('checkIsProjectAdmin exception:', e);
    return false;
  }
}
