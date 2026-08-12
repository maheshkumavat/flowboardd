'use client';

import React, { useState, useEffect } from 'react';
import { supabase, fetchWithAuth } from '../lib/supabase';

export default function DeleteAccountModal({ user, onClose }) {
  const [loadingCheck, setLoadingCheck] = useState(true);
  const [checkData, setCheckData] = useState(null);
  const [checkError, setCheckError] = useState('');

  const [confirmInput, setConfirmInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    runDeletePreCheck();
  }, []);

  const runDeletePreCheck = async () => {
    setLoadingCheck(true);
    setCheckError('');
    try {
      const res = await fetchWithAuth('/api/auth/delete-account');
      const data = await res.json();
      if (res.ok) {
        setCheckData(data);
      } else {
        setCheckError(data.error || 'Failed to evaluate account deletion status');
      }
    } catch (err) {
      setCheckError('Could not load account pre-check data.');
    } finally {
      setLoadingCheck(false);
    }
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    if (!checkData?.canDelete) return;

    const trimmed = confirmInput.trim();
    if (trimmed !== user?.email && trimmed !== 'DELETE') {
      setDeleteError(`Please type "${user?.email}" or "DELETE" to confirm.`);
      return;
    }

    setDeleting(true);
    setDeleteError('');

    try {
      const res = await fetchWithAuth('/api/auth/delete-account', {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error || 'Failed to delete account.');
        setDeleting(false);
        return;
      }

      await supabase.auth.signOut();
      window.location.href = '/account-deleted';
    } catch (err) {
      setDeleteError(err.message || 'Error occurred during account deletion.');
      setDeleting(false);
    }
  };

  const isConfirmed = confirmInput.trim() === user?.email || confirmInput.trim() === 'DELETE';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
      <div className="w-full max-w-lg bg-white rounded-[10px] p-6 shadow-modal border border-[#E4E4E7] flex flex-col gap-4 text-[#18181B]">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-[#E4E4E7] pb-3">
          <div className="flex items-center gap-2 text-[#DC2626]">
            <span className="material-symbols-outlined text-[22px]">delete_forever</span>
            <h2 className="text-[18px] font-semibold text-[#18181B]">Delete Account Permanently</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#71717A] hover:text-[#18181B] p-1 rounded-[6px] cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {loadingCheck ? (
          <div className="p-8 text-center flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-[#DC2626] border-t-transparent rounded-full animate-spin" />
            <p className="text-[13px] text-[#52525B]">Evaluating account dependencies & projects...</p>
          </div>
        ) : checkError ? (
          <div className="p-4 bg-[#FEE2E2] border border-[#FECACA] text-[#DC2626] rounded-[6px] text-[13px] font-medium">
            {checkError}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-[13px] text-[#52525B]">
              Permanent deletion will remove your authentication credentials and profile row. This action is <strong>irreversible</strong>.
            </p>

            {/* BLOCKING WARNING: Sole Admin with other members */}
            {!checkData?.canDelete && checkData?.blockingProjects?.length > 0 && (
              <div className="p-4 bg-[#FEE2E2] border border-[#FECACA] rounded-[6px] text-[#DC2626] flex flex-col gap-2">
                <div className="flex items-center gap-2 font-semibold text-[14px]">
                  <span className="material-symbols-outlined text-[18px]">block</span>
                  <span>Deletion Blocked — Action Required</span>
                </div>
                <p className="text-[13px] text-[#18181B]">
                  You are the <strong>sole Admin</strong> of the following project(s) with active team members:
                </p>
                <ul className="list-disc list-inside font-semibold text-[#DC2626] text-[12px] space-y-0.5">
                  {checkData.blockingProjects.map((p) => (
                    <li key={p.id}>
                      <strong>{p.name}</strong> ({p.memberCount} total members)
                    </li>
                  ))}
                </ul>
                <p className="text-[12px] text-[#52525B] mt-1">
                  To proceed, you must either:
                  <br />
                  1. <strong>Promote another member to Admin</strong> in project settings, OR
                  <br />
                  2. <strong>Delete the project(s)</strong> first.
                </p>
              </div>
            )}

            {/* AUTO-DELETE NOTICE: Sole member projects */}
            {checkData?.canDelete && checkData?.autoDeleteProjects?.length > 0 && (
              <div className="p-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-[6px] text-[#D97706] text-[12px] flex flex-col gap-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <span className="material-symbols-outlined text-[16px]">warning</span>
                  <span>Single-Member Project(s) Will Be Deleted:</span>
                </div>
                <ul className="list-disc list-inside font-medium">
                  {checkData.autoDeleteProjects.map((p) => (
                    <li key={p.id}>{p.name}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* MEMBER ONLY SUMMARY */}
            {checkData?.canDelete && checkData?.memberOnlyProjects?.length > 0 && (
              <div className="p-3 bg-[#F7F7F8] rounded-[6px] border border-[#E4E4E7] text-[12px] text-[#52525B]">
                You will be removed from <strong>{checkData.memberOnlyProjects.length} shared project(s)</strong>. Existing tasks and historical comments will remain intact marked as "Deleted User".
              </div>
            )}

            {deleteError && (
              <div className="p-3 bg-[#FEE2E2] border border-[#FECACA] text-[#DC2626] rounded-[6px] text-[12px] font-medium">
                {deleteError}
              </div>
            )}

            {/* FORM */}
            <form onSubmit={handleDeleteAccount} className="flex flex-col gap-4 pt-1">
              {checkData?.canDelete ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-[#18181B]">
                    Type your email (<span className="font-mono text-[#DC2626] font-semibold">{user?.email}</span>) or <span className="font-mono font-semibold text-[#DC2626]">DELETE</span> to confirm:
                  </label>
                  <input
                    type="text"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder={user?.email}
                    className="w-full bg-white border border-[#FECACA] rounded-[6px] p-2.5 text-[13px] text-[#18181B] outline-none focus:border-[#DC2626]"
                    required
                  />
                </div>
              ) : null}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E4E7]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-[6px] text-[13px] font-medium text-[#52525B] hover:bg-[#F4F4F5] cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!checkData?.canDelete || !isConfirmed || deleting}
                  className="bg-[#DC2626] text-white px-4 py-2 rounded-[6px] text-[13px] font-medium hover:bg-[#B91C1C] transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                  {deleting ? 'Deleting Account...' : 'Permanently Delete Account'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
