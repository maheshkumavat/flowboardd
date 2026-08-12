'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import FlowBoardLogo from '../../components/FlowBoardLogo';

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const err = searchParams.get('error');
    if (err) {
      setError(err);
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) throw authError;

      window.location.href = '/';
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider) => {
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '') : (typeof window !== 'undefined' ? window.location.origin : '');
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${siteUrl}/auth/callback`,
        },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      setError(err.message || `${provider} OAuth failed`);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-white rounded-[10px] border border-[#E4E4E7] shadow-modal p-8 flex flex-col my-auto">
        
        {/* Header / Brand Logo */}
        <div className="text-center flex flex-col items-center">
          <FlowBoardLogo className="w-10 h-10 mb-2" />
          <h1 className="text-[20px] font-semibold text-[#18181B] tracking-tight">FlowBoard</h1>
          <p className="text-[14px] text-[#52525B] font-normal mt-1">
            Sign in to your workspace
          </p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mt-5 p-3 bg-[#FEE2E2] border border-[#FECACA] rounded-[6px] text-[#DC2626] text-[13px] font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form className="mt-6 flex flex-col space-y-4" onSubmit={handleSubmit}>
          {/* Email Input */}
          <div className="flex flex-col">
            <label className="text-[13px] font-medium text-[#18181B] mb-1.5" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@example.com"
              required
              className="h-[42px] w-full rounded-[6px] border border-[#E4E4E7] bg-white px-3 text-[#18181B] placeholder-[#71717A] text-[14px] focus:border-[#4F46E5] focus:outline-none transition-colors"
            />
          </div>

          {/* Password Input */}
          <div className="flex flex-col">
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[13px] font-medium text-[#18181B]" htmlFor="password">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-[13px] text-[#4F46E5] hover:text-[#4338CA] font-medium transition-colors no-underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative flex items-center">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="h-[42px] w-full rounded-[6px] border border-[#E4E4E7] bg-white pl-3 pr-10 text-[#18181B] placeholder-[#71717A] text-[14px] focus:border-[#4F46E5] focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-[#71717A] hover:text-[#18181B] transition-colors cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="mt-1 h-[42px] w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white font-medium text-[14px] rounded-[6px] transition-colors flex items-center justify-center cursor-pointer disabled:opacity-60"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Signing in...</span>
              </div>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="mt-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-[#E4E4E7]" />
          <span className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider">OR</span>
          <div className="flex-1 h-px bg-[#E4E4E7]" />
        </div>

        {/* OAuth Social Logins */}
        <div className="mt-5 flex flex-col space-y-2.5">
          {/* Google Button */}
          <button
            type="button"
            onClick={() => handleOAuthLogin('google')}
            className="h-[42px] w-full bg-white hover:bg-[#F4F4F5] border border-[#E4E4E7] text-[#18181B] font-medium text-[13px] rounded-[6px] transition-colors flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Continue with Google</span>
          </button>

          {/* GitHub Button */}
          <button
            type="button"
            onClick={() => handleOAuthLogin('github')}
            className="h-[42px] w-full bg-white hover:bg-[#F4F4F5] border border-[#E4E4E7] text-[#18181B] font-medium text-[13px] rounded-[6px] transition-colors flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0 fill-current text-[#18181B]" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            <span>Continue with GitHub</span>
          </button>
        </div>

        {/* Signup Link Footer */}
        <div className="mt-6 text-center text-[13px] text-[#52525B]">
          Don't have an account yet?{' '}
          <Link href="/signup" className="text-[#4F46E5] font-semibold hover:underline">
            Sign up
          </Link>
        </div>

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center text-[#71717A] text-[14px]">Loading login...</div>}>
      <LoginForm />
    </Suspense>
  );
}
