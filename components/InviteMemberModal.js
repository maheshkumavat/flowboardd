'use client';

import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../lib/supabase';

export default function InviteMemberModal({ projects = [], initialProjectId = null, onClose, onInviteSent }) {
  const [selectedProjectId, setSelectedProjectId] = useState(
    initialProjectId || (projects[0]?.id || '')
  );
  const [activeTab, setActiveTab] = useState('direct'); // 'direct' | 'code'

  // Direct Invite State
  const [inviteIdentifier, setInviteIdentifier] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [directLoading, setDirectLoading] = useState(false);
  const [directError, setDirectError] = useState('');
  const [directSuccess, setDirectSuccess] = useState('');

  // Shareable Code State
  const [inviteCode, setInviteCode] = useState(null);
  const [loadingCode, setLoadingCode] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (selectedProjectId && activeTab === 'code') {
      fetchInviteCode(selectedProjectId);
    }
  }, [selectedProjectId, activeTab]);

  const fetchInviteCode = async (projId) => {
    if (!projId) return;
    setLoadingCode(true);
    setCodeError('');
    try {
      const res = await fetchWithAuth(`/api/projects/${projId}/invite-code`);
      const data = await res.json();
      if (res.ok && data.inviteCode) {
        setInviteCode(data.inviteCode);
      } else {
        setInviteCode(null);
      }
    } catch (err) {
      console.error('Fetch invite code error:', err);
      setCodeError('Failed to fetch active invite code');
    } finally {
      setLoadingCode(false);
    }
  };

  const handleGenerateCode = async () => {
    if (!selectedProjectId) return;
    setLoadingCode(true);
    setCodeError('');
    try {
      const res = await fetchWithAuth(`/api/projects/${selectedProjectId}/invite-code`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.inviteCode) {
        setInviteCode(data.inviteCode);
      } else {
        throw new Error(data.error || 'Failed to generate code');
      }
    } catch (err) {
      console.error('Generate code error:', err);
      setCodeError(err.message || 'Failed to generate invite code');
    } finally {
      setLoadingCode(false);
    }
  };

  const handleRevokeCode = async () => {
    if (!selectedProjectId) return;
    if (!confirm('Revoke this invite code? Nobody will be able to join using this code until a fresh code is generated.')) {
      return;
    }
    setLoadingCode(true);
    setCodeError('');
    try {
      const res = await fetchWithAuth(`/api/projects/${selectedProjectId}/invite-code`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setInviteCode(null);
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to revoke code');
      }
    } catch (err) {
      console.error('Revoke code error:', err);
      setCodeError(err.message || 'Failed to revoke invite code');
    } finally {
      setLoadingCode(false);
    }
  };

  const handleCopyCode = () => {
    if (!inviteCode?.code) return;
    navigator.clipboard.writeText(inviteCode.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendDirectInvite = async (e) => {
    e.preventDefault();
    if (!inviteIdentifier.trim() || !selectedProjectId) return;

    setDirectLoading(true);
    setDirectError('');
    setDirectSuccess('');

    try {
      const isEmail = inviteIdentifier.includes('@');
      const endpoint = isEmail
        ? `/api/projects/${selectedProjectId}/invite-email`
        : `/api/projects/${selectedProjectId}/members`;

      const bodyData = isEmail
        ? { email: inviteIdentifier.trim(), role: inviteRole }
        : { identifier: inviteIdentifier.trim(), role: inviteRole };

      const res = await fetchWithAuth(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send invite');
      }

      setDirectSuccess(data.message || `Invitation sent successfully to ${inviteIdentifier}`);
      setInviteIdentifier('');
      if (onInviteSent) onInviteSent();
    } catch (err) {
      setDirectError(err.message || 'Failed to send invitation');
    } finally {
      setDirectLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
      <div className="w-full max-w-md bg-white rounded-[10px] p-6 shadow-modal border border-[#E4E4E7] flex flex-col gap-4">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-2 border-b border-[#E4E4E7]">
          <div className="flex items-center gap-2 text-[#4F46E5] font-semibold">
            <span className="material-symbols-outlined text-[20px]">person_add</span>
            <h2 className="text-[18px] font-semibold text-[#18181B]">Invite Member</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#71717A] hover:text-[#18181B] p-1 rounded-[6px] cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Project Selector (If multiple projects provided) */}
        {projects.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[#18181B]">Target Project</label>
            <select
              className="w-full bg-white border border-[#E4E4E7] rounded-[6px] p-2.5 text-[13px] text-[#18181B] focus:border-[#4F46E5] outline-none cursor-pointer"
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setDirectSuccess('');
                setDirectError('');
              }}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#E4E4E7]">
          <button
            type="button"
            onClick={() => setActiveTab('direct')}
            className={`flex-1 py-2 text-[13px] text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'direct'
                ? 'border-[#4F46E5] text-[#4F46E5] font-semibold'
                : 'border-transparent text-[#52525B] hover:text-[#18181B]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">mail</span> Direct Invite
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('code')}
            className={`flex-1 py-2 text-[13px] text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'code'
                ? 'border-[#4F46E5] text-[#4F46E5] font-semibold'
                : 'border-transparent text-[#52525B] hover:text-[#18181B]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">key</span> Shareable Code
          </button>
        </div>

        {/* TAB 1: DIRECT INVITE */}
        {activeTab === 'direct' && (
          <form onSubmit={handleSendDirectInvite} className="flex flex-col gap-4">
            {directError && (
              <div className="p-3 bg-[#FEE2E2] border border-[#FECACA] rounded-[6px] text-[#DC2626] text-[13px] font-medium">
                {directError}
              </div>
            )}
            {directSuccess && (
              <div className="p-3 bg-[#EEF2FF] border border-[#4F46E5]/30 rounded-[6px] text-[#4F46E5] text-[13px] font-medium">
                {directSuccess}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-[#18181B]">Email or GitHub Username</label>
              <input
                type="text"
                className="w-full bg-white border border-[#E4E4E7] rounded-[6px] p-2.5 text-[13px] text-[#18181B] placeholder-[#71717A] focus:border-[#4F46E5] outline-none transition-colors"
                placeholder="teammate@example.com or octocat"
                value={inviteIdentifier}
                onChange={(e) => setInviteIdentifier(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-[#18181B]">Project Role</label>
              <select
                className="w-full bg-white border border-[#E4E4E7] rounded-[6px] p-2.5 text-[13px] text-[#18181B] focus:border-[#4F46E5] outline-none cursor-pointer transition-colors"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                <option value="MEMBER">Member (Create/edit tasks, comments)</option>
                <option value="VIEWER">Viewer (Read-only access)</option>
                <option value="ADMIN">Admin (Full project management)</option>
              </select>
            </div>

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
                disabled={directLoading}
                className="bg-[#4F46E5] text-white px-4 py-2 rounded-[6px] text-[13px] font-medium hover:bg-[#4338CA] transition-colors cursor-pointer disabled:opacity-50"
              >
                {directLoading ? 'Sending Invite...' : 'Send Invite'}
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: SHAREABLE INVITE CODE */}
        {activeTab === 'code' && (
          <div className="flex flex-col gap-4">
            <p className="text-[13px] text-[#52525B] font-normal">
              Generate a shareable join code for this project. Anyone with this code can submit a request to join.
            </p>

            {codeError && (
              <div className="p-3 bg-[#FEE2E2] border border-[#FECACA] rounded-[6px] text-[#DC2626] text-[13px] font-medium">
                {codeError}
              </div>
            )}

            {loadingCode ? (
              <div className="p-4 bg-[#F7F7F8] rounded-[6px] text-center text-[#71717A] text-[13px]">
                Loading invite code...
              </div>
            ) : inviteCode ? (
              <div className="p-4 bg-[#EEF2FF] border border-[#4F46E5]/20 rounded-[8px] flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[#4F46E5] font-semibold">Active Invite Code</span>
                  <span className="text-[11px] text-[#71717A]">Expires in 30 days</span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-white border border-[#E4E4E7] rounded-[6px]">
                  <span className="text-[20px] font-mono tracking-widest text-[#4F46E5] font-semibold">
                    {inviteCode.code}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="bg-[#4F46E5] text-white px-3 py-1.5 rounded-[6px] text-[12px] font-medium hover:bg-[#4338CA] transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                <div className="flex justify-between items-center pt-1">
                  <button
                    onClick={handleGenerateCode}
                    disabled={loadingCode}
                    className="text-[#4F46E5] hover:underline text-[12px] cursor-pointer font-medium flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">refresh</span>
                    Regenerate Code
                  </button>

                  <button
                    onClick={handleRevokeCode}
                    disabled={loadingCode}
                    className="text-[#DC2626] hover:underline text-[12px] cursor-pointer font-medium flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">block</span>
                    Revoke Code
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 border border-dashed border-[#E4E4E7] rounded-[8px] text-center flex flex-col items-center gap-2 bg-[#F7F7F8]">
                <span className="material-symbols-outlined text-[32px] text-[#71717A]">vpn_key</span>
                <p className="text-[14px] text-[#18181B] font-semibold">No Active Invite Code</p>
                <p className="text-[12px] text-[#52525B] max-w-xs">
                  Click below to generate a 6-character code that teammates can enter to request joining.
                </p>
                <button
                  onClick={handleGenerateCode}
                  disabled={loadingCode}
                  className="bg-[#4F46E5] text-white px-4 py-2 rounded-[6px] text-[13px] font-medium hover:bg-[#4338CA] transition-colors cursor-pointer mt-1"
                >
                  {loadingCode ? 'Generating...' : 'Generate Shareable Code'}
                </button>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-[#E4E4E7]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-[6px] text-[13px] font-medium text-[#52525B] hover:bg-[#F4F4F5] cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
