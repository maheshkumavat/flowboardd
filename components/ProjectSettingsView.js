'use client';

import React, { useState, useEffect } from 'react';
import { supabase, fetchWithAuth } from '../lib/supabase';

export default function ProjectSettingsView({
  projectId,
  projectName = '',
  projectDescription = '',
  userRole = 'MEMBER',
  onUpdateProject,
}) {
  const isAdmin = userRole === 'ADMIN';

  // Form state
  const [name, setName] = useState(projectName);
  const [desc, setDesc] = useState(projectDescription);
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');

  // Invite Code State
  const [inviteCode, setInviteCode] = useState(null);
  const [loadingCode, setLoadingCode] = useState(false);
  const [copied, setCopied] = useState(false);

  // Pending Join Requests State
  const [joinRequests, setJoinRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Delete Project State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmNameInput, setConfirmNameInput] = useState('');
  const [deletingProject, setDeletingProject] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    let mounted = true;
    fetchInviteCode();
    fetchJoinRequests();

    const joinReqChannel = supabase
      .channel(`settings-join-requests-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'join_requests', filter: `project_id=eq.${projectId}` },
        () => {
          if (!mounted) return;
          fetchJoinRequests();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(joinReqChannel);
    };
  }, [projectId]);

  const fetchInviteCode = async () => {
    try {
      const res = await fetchWithAuth(`/api/projects/${projectId}/invite-code`);
      const data = await res.json();
      if (res.ok && data.inviteCode) {
        setInviteCode(data.inviteCode);
      }
    } catch (err) {}
  };

  const fetchJoinRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await fetchWithAuth(`/api/projects/${projectId}/join-requests`);
      const data = await res.json();
      if (res.ok) {
        setJoinRequests(data.requests || []);
      }
    } catch (err) {
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleGenerateCode = async () => {
    setLoadingCode(true);
    try {
      const res = await fetchWithAuth(`/api/projects/${projectId}/invite-code`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.inviteCode) {
        setInviteCode(data.inviteCode);
      }
    } catch (err) {
    } finally {
      setLoadingCode(false);
    }
  };

  const handleRevokeCode = async () => {
    if (!confirm('Revoke this invite code? Nobody will be able to join using this code until a fresh code is generated.')) return;
    setLoadingCode(true);
    try {
      const res = await fetchWithAuth(`/api/projects/${projectId}/invite-code`, { method: 'DELETE' });
      if (res.ok) setInviteCode(null);
    } catch (err) {
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

  const handleAcceptRequest = async (request) => {
    try {
      const res = await fetchWithAuth(`/api/projects/${projectId}/join-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: request.id,
          action: 'accept',
          userId: request.user_id,
          role: request.role || 'MEMBER',
        }),
      });

      if (res.ok) {
        setJoinRequests((prev) => prev.filter((r) => r.id !== request.id));
      }
    } catch (err) {}
  };

  const handleRejectRequest = async (request) => {
    try {
      const res = await fetchWithAuth(`/api/projects/${projectId}/join-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: request.id,
          action: 'reject',
          userId: request.user_id,
        }),
      });

      if (res.ok) {
        setJoinRequests((prev) => prev.filter((r) => r.id !== request.id));
      }
    } catch (err) {}
  };

  const handleSaveInfo = async (e) => {
    e.preventDefault();
    if (!isAdmin || !name.trim()) return;

    setSavingInfo(true);
    setInfoMessage('');

    try {
      const res = await fetchWithAuth(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: desc.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update project settings');

      setInfoMessage('Project settings saved successfully!');
      if (onUpdateProject) onUpdateProject(data.project);
    } catch (err) {
      setInfoMessage(`Error: ${err.message}`);
    } finally {
      setSavingInfo(false);
    }
  };

  const handleDeleteProject = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    if (confirmNameInput.trim() !== (projectName || '').trim()) {
      setDeleteError(`Please type "${projectName}" exactly to confirm deletion.`);
      return;
    }

    setDeletingProject(true);
    setDeleteError('');

    try {
      const res = await fetchWithAuth(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete project');

      window.location.href = '/';
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeletingProject(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#FAFAFA] overflow-y-auto p-6 md:p-8 text-[#18181B]">
      <div className="max-w-4xl mx-auto w-full flex flex-col gap-6">
        
        {/* Header */}
        <div>
          <h1 className="text-[24px] font-semibold text-[#18181B] tracking-tight">Project Settings</h1>
          <p className="text-[13px] text-[#52525B] mt-1 font-normal">
            Manage project details, invite codes, pending requests, and workspace settings.
          </p>
        </div>

        {/* 1. General Project Info Section */}
        <form onSubmit={handleSaveInfo} className="bg-white border border-[#E4E4E7] rounded-[8px] overflow-hidden shadow-card flex flex-col">
          <div className="p-5 border-b border-[#E4E4E7]">
            <h3 className="text-[16px] font-semibold text-[#18181B]">General Information</h3>
            <p className="text-[12px] text-[#71717A] mt-0.5 font-normal">
              Update project title and specifications.
            </p>
          </div>

          {infoMessage && (
            <div className={`mx-5 mt-4 p-3 rounded-[6px] text-[13px] font-medium ${
              infoMessage.startsWith('Error') ? 'bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]' : 'bg-[#EEF2FF] text-[#4F46E5] border border-[#4F46E5]/30'
            }`}>
              {infoMessage}
            </div>
          )}

          <div className="p-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-[#18181B]">Project Name</label>
              <input
                type="text"
                disabled={!isAdmin}
                className="w-full bg-white border border-[#E4E4E7] rounded-[6px] p-2.5 text-[13px] text-[#18181B] focus:border-[#4F46E5] outline-none disabled:bg-[#F4F4F5] transition-colors"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-[#18181B]">Description</label>
              <textarea
                disabled={!isAdmin}
                className="w-full bg-white border border-[#E4E4E7] rounded-[6px] p-2.5 text-[13px] text-[#18181B] focus:border-[#4F46E5] outline-none resize-none disabled:bg-[#F4F4F5] transition-colors"
                rows={3}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
            </div>
          </div>

          {isAdmin && (
            <div className="bg-[#F7F7F8] p-4 border-t border-[#E4E4E7] flex justify-end">
              <button
                type="submit"
                disabled={savingInfo}
                className="bg-[#4F46E5] text-white px-4 py-2 rounded-[6px] text-[13px] font-medium hover:bg-[#4338CA] transition-colors cursor-pointer shadow-card"
              >
                {savingInfo ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          )}
        </form>

        {/* 2. Invite Code Management Section */}
        <div className="bg-white border border-[#E4E4E7] rounded-[8px] p-5 shadow-card flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-[16px] font-semibold text-[#18181B]">Shareable Invite Code</h3>
              <p className="text-[12px] text-[#71717A] mt-0.5 font-normal">
                Team members can join using this code on their dashboard.
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={handleGenerateCode}
                disabled={loadingCode}
                className="bg-[#F4F4F5] border border-[#E4E4E7] text-[#18181B] px-3 py-1.5 rounded-[6px] text-[12px] font-medium hover:bg-[#E4E4E7] transition-colors cursor-pointer"
              >
                {inviteCode ? 'Regenerate Code' : 'Generate Code'}
              </button>
            )}
          </div>

          {inviteCode?.code ? (
            <div className="p-4 bg-[#F7F7F8] rounded-[6px] border border-[#E4E4E7] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[18px] font-semibold tracking-widest text-[#4F46E5] bg-white px-3 py-1 rounded-[4px] border border-[#E4E4E7]">
                  {inviteCode.code}
                </span>
                <span className="text-[12px] text-[#71717A]">Active</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyCode}
                  className="bg-[#4F46E5] text-white px-3 py-1.5 rounded-[6px] text-[12px] font-medium hover:bg-[#4338CA] transition-colors cursor-pointer"
                >
                  {copied ? 'Copied!' : 'Copy Code'}
                </button>
                {isAdmin && (
                  <button
                    onClick={handleRevokeCode}
                    className="text-[#DC2626] hover:bg-[#FEE2E2] px-3 py-1.5 rounded-[6px] text-[12px] font-medium transition-colors cursor-pointer"
                  >
                    Revoke Code
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-[#71717A] italic">
              No active invite code. Click "Generate Code" to create one.
            </p>
          )}
        </div>

        {/* 3. Pending Join Requests Section */}
        <div className="bg-white border border-[#E4E4E7] rounded-[8px] p-5 shadow-card flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-[16px] font-semibold text-[#18181B]">Pending Join Requests ({joinRequests.length})</h3>
              <p className="text-[12px] text-[#71717A] mt-0.5 font-normal">
                Users requesting access via invite code.
              </p>
            </div>
            <button
              onClick={fetchJoinRequests}
              disabled={loadingRequests}
              className="text-[#4F46E5] text-[12px] hover:underline font-medium cursor-pointer"
            >
              Refresh
            </button>
          </div>

          {joinRequests.length === 0 ? (
            <p className="text-[13px] text-[#71717A] italic">No pending join requests.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {joinRequests.map((req) => (
                <div key={req.id} className="p-3 bg-[#F7F7F8] rounded-[6px] border border-[#E4E4E7] flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#4F46E5] text-white font-semibold flex items-center justify-center text-xs">
                      {(req.user?.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-[#18181B]">{req.user?.name || 'User'}</p>
                      <p className="text-[12px] text-[#71717A]">{req.user?.email}</p>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAcceptRequest(req)}
                        className="bg-[#4F46E5] text-white px-3 py-1 rounded-[6px] text-[12px] font-medium hover:bg-[#4338CA] cursor-pointer transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleRejectRequest(req)}
                        className="bg-white border border-[#E4E4E7] text-[#18181B] px-3 py-1 rounded-[6px] text-[12px] font-medium hover:bg-[#FEE2E2] hover:text-[#DC2626] hover:border-[#FECACA] cursor-pointer transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. Danger Zone Section (Admin Only) */}
        {isAdmin && (
          <div className="bg-[#FEE2E2]/30 border border-[#FECACA] rounded-[8px] p-5 shadow-card flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-semibold text-[#DC2626] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">warning</span> Danger Zone: Delete Project
                </h3>
                <p className="text-[12px] text-[#71717A] mt-0.5 font-normal">
                  Permanently delete this project, all tasks, comments, and member associations.
                </p>
              </div>
              {!showDeleteConfirm && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="bg-[#DC2626] text-white px-4 py-2 rounded-[6px] text-[13px] font-medium hover:bg-[#B91C1C] transition-colors cursor-pointer"
                >
                  Delete Project
                </button>
              )}
            </div>

            {showDeleteConfirm && (
              <form onSubmit={handleDeleteProject} className="flex flex-col gap-3 pt-3 border-t border-[#FECACA]">
                <p className="text-[13px] text-[#52525B]">
                  This action is irreversible. Type <strong className="text-[#DC2626]">{projectName}</strong> to confirm:
                </p>

                {deleteError && (
                  <div className="p-2 bg-[#FEE2E2] border border-[#FECACA] text-[#DC2626] text-[12px] font-medium rounded-[6px]">
                    {deleteError}
                  </div>
                )}

                <input
                  type="text"
                  className="bg-white border border-[#FECACA] rounded-[6px] p-2 text-[13px] text-[#18181B] focus:border-[#DC2626] outline-none"
                  placeholder={projectName}
                  value={confirmNameInput}
                  onChange={(e) => setConfirmNameInput(e.target.value)}
                  required
                />

                <div className="flex justify-end gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setConfirmNameInput('');
                      setDeleteError('');
                    }}
                    className="px-3 py-1.5 rounded-[6px] text-[12px] font-medium text-[#52525B] hover:bg-[#F4F4F5] cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={deletingProject || confirmNameInput.trim() !== (projectName || '').trim()}
                    className="bg-[#DC2626] text-white px-4 py-1.5 rounded-[6px] text-[12px] font-medium hover:bg-[#B91C1C] transition-colors cursor-pointer disabled:opacity-40"
                  >
                    {deletingProject ? 'Deleting...' : 'Permanently Delete Project'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
