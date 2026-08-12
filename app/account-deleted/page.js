'use client';

import React from 'react';
import Link from 'next/link';

export default function AccountDeletedPage() {
  return (
    <div className="min-h-screen bg-surface-container-low flex items-center justify-center p-md">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl p-xl shadow-lg border border-outline-variant/30 text-center flex flex-col gap-lg">
        <div className="w-16 h-16 rounded-full bg-error-container/20 text-error flex items-center justify-center border border-error/30 mx-auto">
          <span className="material-symbols-outlined text-[36px]">delete_forever</span>
        </div>

        <div className="flex flex-col gap-xs">
          <h1 className="font-headline-md text-headline-md font-bold text-on-surface">Account Deleted</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Your FlowBoard account and personal profile data have been permanently removed.
          </p>
        </div>

        <div className="p-md bg-surface-container-low rounded-xl border border-outline-variant/30 text-left font-body-sm text-on-surface-variant flex flex-col gap-xs">
          <p className="font-semibold text-on-surface">What happened to your data:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Your user authentication credentials were deleted.</li>
            <li>Your personal profile record was removed.</li>
            <li>Your single-member workspaces were permanently deleted.</li>
            <li>Shared project records retain historical task activity marked as "Deleted User".</li>
          </ul>
        </div>

        <div className="pt-md border-t border-outline-variant/30 flex flex-col gap-sm">
          <Link
            href="/login"
            className="w-full bg-primary text-on-primary py-md rounded-xl font-title-md text-title-md font-bold hover:bg-on-primary-fixed-variant transition-colors block"
          >
            Return to Login
          </Link>
          <Link
            href="/signup"
            className="w-full bg-surface-container-high text-on-surface py-md rounded-xl font-title-md text-title-md font-semibold hover:bg-surface-container-highest transition-colors block border border-outline-variant/30"
          >
            Create New Account
          </Link>
        </div>
      </div>
    </div>
  );
}
