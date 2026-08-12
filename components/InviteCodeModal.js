'use client';

import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../lib/supabase';

export default function InviteCodeModal({ projectId: initialProjectId, projects = [], onClose }) {
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId || (projects[0]?.id || ''));
  const [inviteCode, setInviteCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (selectedProjectId) {
      fetchInviteCode(selectedProjectId);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (!inviteCode?.expires_at) {
      setTimeLeft(0);
      return;
    }

    const calcTimeLeft = () => {
      const expiry = new Date(inviteCode.expires_at).getTime();
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((expiry - now) / 1000));
      setTimeLeft(diffSec);

      if (diffSec === 0 && selectedProjectId) {
        fetchInviteCode(selectedProjectId);
      }
    };

    calcTimeLeft();
    const interval = setInterval(calcTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [inviteCode, selectedProjectId]);

  const formatCountdown = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const fetchInviteCode = async (projId) => {
    setLoading(true);
    setError('');
    try {
      let res = await fetchWithAuth(`/api/projects/${projId}/invite-code`);
      let data = await res.json();
      if (res.ok && data.inviteCode) {
        setInviteCode(data.inviteCode);
      } else {
        res = await fetchWithAuth(`/api/projects/${projId}/invite-code`, { method: 'POST' });
        data = await res.json();
        if (res.ok && data.inviteCode) {
          setInviteCode(data.inviteCode);
        } else {
          setError(data.error || 'Failed to fetch invite code');
        }
      }
    } catch (err) {
      setError('Could not load invite code.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateCode = async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetchWithAuth(`/api/projects/${selectedProjectId}/invite-code`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.inviteCode) {
        setInviteCode(data.inviteCode);
      } else {
        setError(data.error || 'Failed to regenerate invite code');
      }
    } catch (err) {
      setError('Failed to regenerate invite code.');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeCode = async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetchWithAuth(`/api/projects/${selectedProjectId}/invite-code`, { method: 'DELETE' });
      if (res.ok) {
        setInviteCode(null);
        setTimeLeft(0);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to revoke invite code');
      }
    } catch (err) {
      setError('Failed to revoke code.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!inviteCode?.code) return;
    navigator.clipboard.writeText(inviteCode.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
      <div className="w-full max-w-md bg-white rounded-[10px] p-6 shadow-modal border border-[#E4E4E7] flex flex-col gap-4">
        <div className="flex justify-between items-center border-b border-[#E4E4E7] pb-3">
          <div className="flex items-center gap-2 text-[#4F46E5] font-semibold">
            <span className="material-symbols-outlined text-[20px]">key</span>
            <h2 className="text-[18px] font-semibold text-[#18181B]">Project Invite Code</h2>
          </div>
          <button onClick={onClose} className="text-[#71717A] hover:text-[#18181B] p-1 rounded-[6px] cursor-pointer transition-colors">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* If multiple projects exist & initialProjectId was not passed, render Project Selector */}
        {projects.length > 0 && !initialProjectId && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[#18181B]">Select Project *</label>
            <select
              className="w-full bg-white border border-[#E4E4E7] rounded-[6px] p-2.5 text-[13px] text-[#18181B] focus:border-[#4F46E5] outline-none cursor-pointer"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {!selectedProjectId ? (
          <div className="p-6 text-center text-[#71717A] text-[13px]">
            Please select a project to view its invite code.
          </div>
        ) : loading ? (
          <div className="p-8 text-center flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
            <p className="text-[13px] text-[#52525B]">Generating shareable code for project...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-[#FEE2E2] border border-[#FECACA] text-[#DC2626] rounded-[6px] text-[13px] font-medium flex flex-col gap-2">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => fetchInviteCode(selectedProjectId)}
              className="self-start px-3 py-1 bg-[#DC2626] text-white rounded-[6px] text-[12px] font-medium hover:bg-[#B91C1C] cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : !inviteCode?.code ? (
          <div className="p-6 text-center flex flex-col items-center gap-2.5 bg-[#F7F7F8] rounded-[8px] border border-[#E4E4E7]">
            <span className="material-symbols-outlined text-[32px] text-[#71717A]">key_off</span>
            <p className="text-[13px] text-[#52525B]">No active invite code for this project.</p>
            <button
              type="button"
              onClick={handleRegenerateCode}
              className="px-4 py-2 bg-[#4F46E5] text-white rounded-[6px] text-[13px] font-medium hover:bg-[#4338CA] transition-colors cursor-pointer"
            >
              Generate Code
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-[13px] text-[#52525B]">
              Share this invite code with teammates. For security, this code <strong>auto-rotates every 5 minutes</strong>.
            </p>

            <div className="p-4 bg-[#EEF2FF] rounded-[8px] border border-[#4F46E5]/20 flex flex-col items-center gap-2">
              <span className="font-mono text-[22px] font-semibold tracking-widest text-[#4F46E5] bg-white px-4 py-2 rounded-[6px] border border-[#4F46E5]/30 select-all">
                {inviteCode.code}
              </span>
              <div className="flex items-center gap-1.5 text-[#D97706] text-[12px] font-medium mt-1">
                <span className="material-symbols-outlined text-[15px]">schedule</span>
                <span>Refreshes in {formatCountdown(timeLeft)} (5-min security rotation)</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E4E4E7]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRegenerateCode}
                  className="px-3 py-1.5 rounded-[6px] text-[12px] font-medium bg-[#F4F4F5] text-[#18181B] hover:bg-[#E4E4E7] transition-colors cursor-pointer border border-[#E4E4E7] flex items-center gap-1"
                  title="Generate a new 5-minute code immediately"
                >
                  <span className="material-symbols-outlined text-[14px]">refresh</span>
                  Regenerate
                </button>
                <button
                  type="button"
                  onClick={handleRevokeCode}
                  className="px-3 py-1.5 rounded-[6px] text-[12px] font-medium text-[#DC2626] hover:bg-[#FEE2E2] transition-colors cursor-pointer flex items-center gap-1"
                  title="Revoke active code"
                >
                  <span className="material-symbols-outlined text-[14px]">block</span>
                  Revoke
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-[6px] text-[13px] font-medium text-[#52525B] hover:bg-[#F4F4F5] cursor-pointer transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  disabled={!inviteCode?.code}
                  className="bg-[#4F46E5] text-white px-4 py-2 rounded-[6px] text-[13px] font-medium hover:bg-[#4338CA] transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  {copied ? 'Copied!' : 'Copy Code'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
