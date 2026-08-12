'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { fetchWithAuth } from '../../../lib/supabase';

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!token) {
      setError('No invite token provided.');
      setLoading(false);
      return;
    }
    processToken();
  }, [token]);

  const processToken = async () => {
    try {
      const res = await fetchWithAuth(`/api/invite/accept?token=${encodeURIComponent(token)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to process invite link');
      }

      if (data.joined && data.projectId) {
        setSuccess(`Joined ${data.projectName || 'project'} successfully! Redirecting...`);
        setTimeout(() => {
          window.location.href = `/projects/${data.projectId}?joined=true`;
        }, 1500);
      } else if (data.requiresAuth) {
        // Save token to localStorage and redirect to signup
        localStorage.setItem('pending_invite_token', token);
        window.location.href = `/signup?inviteToken=${encodeURIComponent(token)}`;
      } else {
        setError(data.error || 'Invalid invite link.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-container-low flex items-center justify-center p-md">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-xl p-xl shadow-lg border border-outline-variant/30 text-center flex flex-col gap-md">
        <h2 className="font-headline-md text-headline-md font-bold text-primary">FlowBoard Invite</h2>

        {loading && (
          <div className="py-lg flex flex-col items-center gap-sm">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="font-body-md text-body-md text-on-surface-variant">Processing invitation link...</p>
          </div>
        )}

        {error && (
          <div className="p-md bg-error-container/40 border border-error/30 rounded-lg text-error flex flex-col gap-xs">
            <span className="material-symbols-outlined text-[32px] mx-auto text-error">error</span>
            <p className="font-title-md text-title-md font-semibold">{error}</p>
            <Link href="/" className="mt-sm text-primary font-semibold hover:underline">
              Return to Home
            </Link>
          </div>
        )}

        {success && (
          <div className="p-md bg-primary-container/30 border border-primary/30 rounded-lg text-primary flex flex-col gap-xs">
            <span className="material-symbols-outlined text-[32px] mx-auto text-primary">check_circle</span>
            <p className="font-title-md text-title-md font-semibold">{success}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AcceptInviteContent />
    </Suspense>
  );
}
