'use client';

import React, { useState, useEffect } from 'react';
import { supabase, fetchWithAuth } from '../lib/supabase';
import RoleBadge from './RoleBadge';

export default function MemberSettingsModal({ projectId, projectName = '', members = [], currentUser, onClose, onUpdateMembers, userRole = 'MEMBER' }) {
  const [memberList, setMemberList] = useState(members);
  const [updatingId, setUpdatingId] = useState(null);
  const [inviteCode, setInviteCode] = useState(null);
  const [loadingCode, setLoadingCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentMember = memberList.find((m) => m.user?.id === currentUser?.id || m.userId === currentUser?.id);
  const isAdmin = userRole === 'ADMIN' || currentMember?.role === 'ADMIN';

  // Delete Project Confirmation State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmNameInput, setConfirmNameInput] = useState('');
  const [deletingProject, setDeletingProject] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Pending Join Requests State
  const [joinRequests, setJoinRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [actioningRequestId, setActioningRequestId] = useState(null);

  // Email Invite Form State
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatusMessage, setEmailStatusMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    fetchInviteCode();
    fetchJoinRequests();

    const joinReqChannel = supabase
      .channel(`modal-join-requests-${projectId}`)
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
    } catch (err) {
      console.error('Fetch invite code error:', err);
    }
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
      console.error('Fetch join requests error:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleAcceptRequest = async (request) => {
    setActioningRequestId(request.id);
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
        const newMember = {
          id: `pm-${Date.now()}`,
          role: request.role || 'MEMBER',
          user: request.user || { id: request.user_id, name: 'New Member', email: '' },
        };
        const updated = [...memberList, newMember];
        setMemberList(updated);
        if (onUpdateMembers) onUpdateMembers(updated);
      }
    } catch (err) {
      console.error('Accept request error:', err);
    } finally {
      setActioningRequestId(null);
    }
  };

  const handleRejectRequest = async (request) => {
    setActioningRequestId(request.id);
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
    } catch (err) {
      console.error('Reject request error:', err);
    } finally {
      setActioningRequestId(null);
    }
  };

  const handleRoleChange = async (memberId, newRole) => {
    setUpdatingId(memberId);
    try {
      const res = await fetchWithAuth(`/api/projects/${projectId}/members`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, role: newRole }),
      });

      if (res.ok) {
        const updated = memberList.map((m) => (m.id === memberId ? { ...m, role: newRole } : m));
        setMemberList(updated);
        if (onUpdateMembers) onUpdateMembers(updated);
      }
    } catch (err) {
      console.error('Role update error:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!confirm('Remove this member from the project?')) return;
    setUpdatingId(memberId);
    try {
      const res = await fetchWithAuth(`/api/projects/${projectId}/members?memberId=${memberId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        const updated = memberList.filter((m) => m.id !== memberId);
        setMemberList(updated);
        if (onUpdateMembers) onUpdateMembers(updated);
      }
    } catch (err) {
      console.error('Remove member error:', err);
    } finally {
      setUpdatingId(null);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/30 backdrop-blur-[2px] p-4">
      <div className="w-full max-w-lg bg-surface-container-lowest rounded-2xl p-xl shadow-[0_10px_24px_rgba(0,0,0,0.12)] border border-outline-variant/30 flex flex-col gap-md max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-xs text-primary font-bold">
            <span className="material-symbols-outlined text-[24px]">manage_accounts</span>
            <h2 className="font-headline-md text-headline-md text-on-surface">Project Settings & Members</h2>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface p-1 rounded-full cursor-pointer">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* 1. Pending Join Requests Section */}
        <div className="p-md bg-warning-container/20 border border-warning/30 rounded-xl flex flex-col gap-sm">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-xs text-on-surface font-title-md text-title-md font-bold">
              <span className="material-symbols-outlined text-[20px] text-warning">pending_actions</span>
              <span>Pending Join Requests ({joinRequests.length})</span>
            </div>
            <button
              onClick={fetchJoinRequests}
              disabled={loadingRequests}
              className="text-primary hover:underline font-label-md text-label-md cursor-pointer"
            >
              {loadingRequests ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {loadingRequests ? (
            <div className="p-sm text-center font-body-md text-on-surface-variant">Loading requests...</div>
          ) : joinRequests.length === 0 ? (
            <p className="font-body-md text-body-md text-on-surface-variant text-[13px] italic">
              No pending join requests at this time.
            </p>
          ) : (
            <div className="flex flex-col gap-xs">
              {joinRequests.map((req) => (
                <div key={req.id} className="p-sm bg-surface-container-lowest rounded-lg border border-outline-variant/30 flex items-center justify-between gap-sm">
                  <div className="flex items-center gap-sm">
                    <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-sm">
                      {(req.user?.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-title-md text-title-md font-bold text-on-surface leading-tight">
                        {req.user?.name || 'User'}
                      </p>
                      <p className="font-body-md text-body-md text-on-surface-variant text-[12px]">
                        {req.user?.email || req.user_id}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-xs">
                    <button
                      onClick={() => handleAcceptRequest(req)}
                      disabled={actioningRequestId === req.id}
                      className="bg-primary text-on-primary px-3 py-1 rounded-lg font-label-md text-label-md hover:bg-on-primary-fixed-variant transition-colors cursor-pointer"
                    >
                      {actioningRequestId === req.id ? '...' : 'Accept'}
                    </button>
                    <button
                      onClick={() => handleRejectRequest(req)}
                      disabled={actioningRequestId === req.id}
                      className="bg-surface-container border border-outline-variant text-on-surface px-3 py-1 rounded-lg font-label-md text-label-md hover:bg-error-container hover:text-error transition-colors cursor-pointer"
                    >
                      {actioningRequestId === req.id ? '...' : 'Reject'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Member Management List with Role Change Dropdown */}
        <div className="flex flex-col gap-sm max-h-56 overflow-y-auto pr-1">
          <h4 className="font-title-md text-title-md text-on-surface font-semibold">Project Members ({memberList.length})</h4>
          {memberList.map((m) => {
            const isSelf = m.user?.id === currentUser?.id;
            const hasGh = m.user?.github_username || m.user?.githubUsername || (m.user?.skill_profile && Object.keys(m.user.skill_profile).length > 0);
            return (
              <div key={m.id} className="p-md bg-surface-container-low rounded-xl border border-outline-variant/20 flex items-center justify-between gap-md">
                <div className="flex items-center gap-md">
                  <div className="w-10 h-10 rounded-full bg-primary text-on-primary font-bold flex items-center justify-center relative">
                    {(m.user?.name || 'M').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-xs flex-wrap">
                      <h4 className="font-title-md text-title-md text-on-surface font-semibold">
                        {m.user?.name || 'Team Member'} {isSelf && '(You)'}
                      </h4>
                      <RoleBadge role={m.role} />
                    </div>
                    <span className="font-body-md text-body-md text-on-surface-variant text-[13px]">{m.user?.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-xs">
                  {/* Role promotion / change dropdown (allows setting to ADMIN) */}
                  <select
                    value={m.role || 'MEMBER'}
                    onChange={(e) => handleRoleChange(m.id, e.target.value)}
                    disabled={updatingId === m.id}
                    className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-xs font-label-md text-label-md text-on-surface outline-none cursor-pointer"
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="MEMBER">Member</option>
                    <option value="VIEWER">Viewer</option>
                  </select>

                  {!isSelf && (
                    <button
                      onClick={() => handleRemoveMember(m.id)}
                      disabled={updatingId === m.id}
                      className="p-1 text-error hover:bg-error-container/20 rounded cursor-pointer transition-colors"
                      title="Remove member"
                    >
                      <span className="material-symbols-outlined text-[18px]">person_remove</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* DANGER ZONE: Delete Project Section (Admin Only) */}
        {isAdmin && (
          <div className="p-md bg-error-container/20 border border-error/30 rounded-xl flex flex-col gap-sm mt-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-xs text-error font-title-md text-title-md font-bold">
                <span className="material-symbols-outlined text-[20px]">warning</span>
                <span>Danger Zone: Delete Project</span>
              </div>
              {!showDeleteConfirm && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="bg-error text-on-error px-md py-xs rounded-lg font-title-sm text-sm font-bold hover:bg-error/90 transition-colors cursor-pointer"
                >
                  Delete Project
                </button>
              )}
            </div>

            {showDeleteConfirm && (
              <form onSubmit={handleDeleteProject} className="flex flex-col gap-sm pt-xs border-t border-error/20">
                <p className="font-body-md text-body-md text-on-surface-variant text-[13px]">
                  This will permanently delete <strong>{projectName || 'this project'}</strong>, all tasks, comments, members, and activity history. This action cannot be undone.
                </p>

                {deleteError && (
                  <div className="p-xs bg-error-container/50 border border-error text-error text-[12px] rounded-lg">
                    {deleteError}
                  </div>
                )}

                <div className="flex flex-col gap-xs">
                  <label className="font-label-md text-label-md text-on-surface">
                    Type <strong className="text-error">{projectName}</strong> to confirm:
                  </label>
                  <input
                    type="text"
                    className="bg-surface-container-lowest border border-error/40 rounded-lg p-xs font-body-md text-body-md text-on-surface outline-none focus:ring-2 focus:ring-error/30"
                    placeholder={projectName}
                    value={confirmNameInput}
                    onChange={(e) => setConfirmNameInput(e.target.value)}
                    required
                  />
                </div>

                <div className="flex justify-end gap-xs mt-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setConfirmNameInput('');
                      setDeleteError('');
                    }}
                    className="px-sm py-xs rounded-lg font-label-md text-label-md text-on-surface-variant hover:bg-surface-container cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={deletingProject || confirmNameInput.trim() !== (projectName || '').trim()}
                    className="bg-error text-on-error px-md py-xs rounded-lg font-title-sm text-sm font-bold hover:bg-error/90 transition-colors cursor-pointer disabled:opacity-40"
                  >
                    {deletingProject ? 'Deleting...' : 'Permanently Delete Project'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        <div className="flex justify-end pt-sm border-t border-outline-variant/30">
          <button
            onClick={onClose}
            className="bg-primary text-on-primary px-md py-xs rounded-lg font-title-md text-title-md cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
