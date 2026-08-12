'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import FlowBoardLogo from '../../../components/FlowBoardLogo';

function CallbackContent() {
  const searchParams = useSearchParams();
  const [statusMessage, setStatusMessage] = useState('Completing sign-in...');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isSubscribed = true;

    async function processAuthCallback() {
      try {
        const intent = searchParams.get('intent') || 'create';
        const code = searchParams.get('code');
        const errorParam = searchParams.get('error') || searchParams.get('error_description');

        if (errorParam) {
          console.error('[OAuth Provider Error Callback]:', errorParam);
          if (isSubscribed) {
            setErrorMessage(errorParam);
          }
          setTimeout(() => {
            window.location.href = `/login?error=${encodeURIComponent(errorParam)}`;
          }, 1500);
          return;
        }

        // 1. If code parameter exists, exchange code for session via client SDK (uses browser PKCE verifier)
        if (code) {
          setStatusMessage('Authenticating with provider...');
          const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeErr) {
            console.warn('[OAuth PKCE Exchange Warning]:', exchangeErr.message);
          }
        }

        // 2. Fetch active session
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        const session = sessionData?.session;

        if (sessionErr || !session || !session.user) {
          console.error('[OAuth Session Error]:', sessionErr || 'No active session found');
          if (isSubscribed) {
            setErrorMessage('Unable to retrieve session after authentication.');
          }
          setTimeout(() => {
            window.location.href = '/login?error=Authentication%20session%20could%20not%20be%20established';
          }, 1500);
          return;
        }

        // 3. Set Auth Cookie on client so Next.js Middleware recognizes session on navigation
        const accessToken = session.access_token;
        const refreshToken = session.refresh_token;
        const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
        const cookieOptions = `; path=/; max-age=604800; SameSite=Lax${isHttps ? '; Secure' : ''}`;

        document.cookie = `sb-access-token=${accessToken}${cookieOptions}`;
        if (refreshToken) {
          document.cookie = `sb-refresh-token=${refreshToken}${cookieOptions}`;
        }

        setStatusMessage('Verifying user profile...');

        // 4. Check whether User is NEW or RETURNING in public.profiles table
        const userId = session.user.id;
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, name, primary_role')
          .eq('id', userId)
          .maybeSingle();

        // New User Criteria: Profile doesn't exist yet OR primary_role is not set
        const isNewUser = !profile || !profile.primary_role;

        if (isNewUser) {
          setStatusMessage('Setting up your onboarding...');
          window.location.href = `/onboarding?intent=${encodeURIComponent(intent)}`;
        } else {
          setStatusMessage('Redirecting to dashboard...');
          window.location.href = '/';
        }
      } catch (err) {
        console.error('[OAuth Callback Exception]:', err);
        if (isSubscribed) {
          setErrorMessage(err.message || 'Unexpected error during sign-in.');
        }
        setTimeout(() => {
          window.location.href = `/login?error=${encodeURIComponent(err.message || 'OAuth failure')}`;
        }, 1500);
      }
    }

    processAuthCallback();

    return () => {
      isSubscribed = false;
    };
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
      <div className="w-full max-w-[380px] bg-white rounded-[10px] border border-[#E4E4E7] shadow-modal p-8 flex flex-col items-center text-center">
        <FlowBoardLogo className="w-10 h-10 mb-3" />
        <h2 className="text-[18px] font-semibold text-[#18181B] tracking-tight mb-1">
          FlowBoard
        </h2>

        {errorMessage ? (
          <div className="mt-3 p-3 bg-[#FEE2E2] border border-[#FECACA] rounded-[6px] text-[#DC2626] text-[13px] font-medium w-full">
            {errorMessage}
          </div>
        ) : (
          <div className="flex flex-col items-center mt-4 space-y-3">
            <div className="w-6 h-6 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
            <p className="text-[13px] text-[#52525B]">{statusMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
          <div className="w-6 h-6 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
