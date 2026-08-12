'use client';

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function GitHubConnectModal({ user, onClose }) {
  const [error, setError] = useState('');
  const skillProfile = user?.skillProfile || {};

  const [connecting, setConnecting] = useState(false);

  const handleOAuthConnect = async () => {
    setConnecting(true);
    setError('');
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const redirectUrl = `${origin}/profile?connected=github`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          scopes: 'read:user public_repo',
          redirectTo: redirectUrl,
        },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      setError(err.message || 'GitHub OAuth failed');
      setConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
      <div className="w-full max-w-md bg-white rounded-[10px] p-6 shadow-modal border border-[#E4E4E7] flex flex-col gap-4 text-[#18181B]">
        
        {/* Header */}
        <div className="flex justify-between items-start pb-2 border-b border-[#E4E4E7]">
          <div className="flex items-center gap-2 text-[#4F46E5] font-semibold">
            <span className="material-symbols-outlined text-[20px]">code</span>
            <h2 className="text-[18px] font-semibold text-[#18181B]">
              Connect GitHub Account
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#71717A] hover:text-[#18181B] p-1 rounded-[6px] cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <p className="text-[13px] text-[#52525B]">
          Connect your GitHub account securely via OAuth. FlowBoard analyzes your public repositories and language statistics to generate an AI skill profile for task matching.
        </p>

        {error && (
          <div className="p-3 bg-[#FEE2E2] border border-[#FECACA] rounded-[6px] text-[#DC2626] text-[13px] font-medium">
            {error}
          </div>
        )}

        {/* Secure OAuth-Only Button */}
        <div className="flex flex-col gap-2 my-1">
          <button
            onClick={handleOAuthConnect}
            disabled={connecting}
            type="button"
            className="w-full bg-[#4F46E5] text-white text-[13px] font-medium rounded-[6px] py-2.5 px-4 hover:bg-[#4338CA] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-card disabled:opacity-70"
          >
            {connecting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Connecting to GitHub...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">code</span>
                <span>Connect via GitHub OAuth (read:user, public_repo)</span>
              </>
            )}
          </button>
          <span className="text-[11px] text-[#71717A] text-center">
            Secure OAuth 2.0 authorization via Supabase Auth Callback.
          </span>
        </div>

        {/* Active Profile Skill Weights */}
        {Object.keys(skillProfile).length > 0 && (
          <div className="pt-3 border-t border-[#E4E4E7] flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-[#18181B]">Active AI Skill Weights</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {Object.entries(skillProfile).map(([skill, weight]) => (
                <span key={skill} className="bg-[#EEF2FF] text-[#4F46E5] text-[11px] font-medium px-2.5 py-1 rounded border border-[#4F46E5]/20">
                  {skill}: {Math.round(weight * 100)}%
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-[#E4E4E7]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-[6px] text-[13px] font-medium text-[#52525B] hover:bg-[#F4F4F5] cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
