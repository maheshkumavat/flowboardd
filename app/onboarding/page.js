'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import FlowBoardLogo from '../../components/FlowBoardLogo';

function OnboardingContent() {
  const searchParams = useSearchParams();
  const intent = searchParams.get('intent') || 'create';

  const [name, setName] = useState('');
  const [primaryRole, setPrimaryRole] = useState('Developer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSession();
  }, []);

  const fetchSession = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (user) {
      setName(user.user_metadata?.name || user.email?.split('@')[0] || '');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;

      if (user) {
        await supabase
          .from('profiles')
          .update({
            name: name.trim() || user.email.split('@')[0],
            primary_role: primaryRole,
          })
          .eq('id', user.id);
      }

      window.location.href = `/?action=${intent}`;
    } catch (err) {
      setError(err.message || 'Failed to save onboarding settings');
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { id: 'Developer', label: 'Developer', icon: 'code' },
    { id: 'Designer', label: 'Designer', icon: 'palette' },
    { id: 'Product Manager', label: 'Product Manager', icon: 'auto_awesome_motion' },
    { id: 'Other', label: 'Other', icon: 'person' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#FAFAFA] text-[#18181B]">
      <div className="w-full max-w-[420px] bg-white rounded-[10px] p-8 shadow-modal border border-[#E4E4E7] flex flex-col my-auto">
        
        {/* Header */}
        <div className="text-center flex flex-col items-center">
          <FlowBoardLogo className="w-10 h-10 mb-2" />
          <h1 className="text-[20px] font-semibold text-[#18181B] tracking-tight">Welcome to FlowBoard</h1>
          <p className="text-[14px] text-[#52525B] font-normal mt-1">Set up your profile in seconds</p>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-[#FEE2E2] border border-[#FECACA] rounded-[6px] text-[#DC2626] text-[13px] font-medium">
            {error}
          </div>
        )}

        {/* Form */}
        <form className="mt-6 flex flex-col space-y-4" onSubmit={handleSubmit}>
          <div className="flex flex-col">
            <label className="text-[13px] font-medium text-[#18181B] mb-1.5" htmlFor="name">Your Name</label>
            <input
              className="h-[42px] w-full rounded-[6px] border border-[#E4E4E7] bg-white px-3 text-[#18181B] placeholder-[#71717A] text-[14px] focus:border-[#4F46E5] focus:outline-none transition-colors"
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Chen"
              required
            />
          </div>

          <div className="flex flex-col">
            <label className="text-[13px] font-medium text-[#18181B] mb-2">What's your primary role?</label>
            <div className="grid grid-cols-2 gap-2.5">
              {roles.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setPrimaryRole(r.id)}
                  className={`p-3 rounded-[6px] border transition-colors flex items-center gap-2 text-left cursor-pointer ${
                    primaryRole === r.id
                      ? 'bg-[#EEF2FF] border-[#4F46E5] text-[#4F46E5] font-semibold'
                      : 'bg-white border-[#E4E4E7] text-[#18181B] hover:bg-[#F4F4F5]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{r.icon}</span>
                  <span className="text-[13px]">{r.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button
              className="h-[42px] w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white font-medium text-[14px] rounded-[6px] transition-colors flex items-center justify-center cursor-pointer disabled:opacity-60"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save & Continue'}
            </button>

            <div className="text-center mt-1">
              <Link href={`/?action=${intent}`} className="text-[13px] text-[#71717A] hover:text-[#4F46E5] hover:underline transition-colors no-underline">
                Skip for now
              </Link>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  );
}
