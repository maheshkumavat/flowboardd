'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import FlowBoardLogo from '../../components/FlowBoardLogo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });

      if (resetErr) throw resetErr;

      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to send password reset email');
    } finally {
      setLoading(false);
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
            Reset your password
          </p>
        </div>

        {/* Success Banner */}
        {success ? (
          <div className="mt-5 p-4 bg-[#F0FDF4] border border-[#BBF7D0] rounded-[6px] text-[#166534] text-[13px] font-medium flex flex-col gap-2 text-center">
            <span className="material-symbols-outlined text-[24px] text-[#16A34A] mx-auto">mark_email_read</span>
            <p className="font-semibold text-[14px]">Check your inbox</p>
            <p className="text-[12px] text-[#15803D]">
              We've sent a password reset link to <strong>{email}</strong>.
            </p>
            <Link
              href="/login"
              className="mt-2 inline-block bg-[#16A34A] text-white px-4 py-2 rounded-[6px] font-medium text-[13px] hover:bg-[#15803D] transition-colors no-underline"
            >
              Back to Sign In
            </Link>
          </div>
        ) : (
          <>
            {/* Global Error Banner */}
            {error && (
              <div className="mt-5 p-3 bg-[#FEE2E2] border border-[#FECACA] rounded-[6px] text-[#DC2626] text-[13px] font-medium flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form className="mt-6 flex flex-col space-y-4" onSubmit={handleSubmit}>
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

              <button
                type="submit"
                disabled={loading}
                className="mt-1 h-[42px] w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white font-medium text-[14px] rounded-[6px] transition-colors flex items-center justify-center cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Sending Reset Link...</span>
                  </div>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>

            {/* Footer Back Link */}
            <div className="mt-6 text-center text-[13px] text-[#52525B]">
              Remember your password?{' '}
              <Link href="/login" className="text-[#4F46E5] font-semibold hover:underline">
                Back to Sign In
              </Link>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
