'use client';

import React, { useState } from 'react';
import { fetchWithAuth } from '../lib/supabase';
import RoleBadge from './RoleBadge';

export default function TeamMembersView({
  projectId,
  members = [],
  currentUser,
  userRole = 'MEMBER',
  onUpdateMembers,
  onOpenInviteModal,
  onSelectMemberProfile,
}) {
  const isAdmin = userRole === 'ADMIN';
  const [updatingId, setUpdatingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // In-app floating toast state (no browser alert boxes)
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message: string }
  const [memberToRemove, setMemberToRemove] = useState(null);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleRoleChange = async (memberId, newRole) => {
    if (!isAdmin) {
      showToast('error', 'Only Admins can change member roles.');
      return;
    }

    setUpdatingId(memberId);
    try {
      const res = await fetchWithAuth(`/api/projects/${projectId}/members`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, role: newRole }),
      });

      const data = await res.json();

      if (res.ok) {
        const updated = members.map((m) => (m.id === memberId ? { ...m, role: newRole } : m));
        if (onUpdateMembers) onUpdateMembers(updated);
        showToast('success', `Member role updated to ${newRole}. Notification sent to user!`);
      } else {
        showToast('error', data.error || 'Failed to update member role');
      }
    } catch (err) {
      console.error('Role update error:', err);
      showToast('error', 'Could not update member role.');
    } finally {
      setUpdatingId(null);
    }
  };

  const confirmRemoveMember = async () => {
    if (!memberToRemove) return;
    const memberId = memberToRemove.id;
    setUpdatingId(memberId);
    try {
      const res = await fetchWithAuth(`/api/projects/${projectId}/members?memberId=${memberId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        const updated = members.filter((m) => m.id !== memberId);
        if (onUpdateMembers) onUpdateMembers(updated);
        showToast('success', 'Member removed from project.');
      } else {
        const data = await res.json();
        showToast('error', data.error || 'Failed to remove member');
      }
    } catch (err) {
      console.error('Remove member error:', err);
      showToast('error', 'Could not remove member.');
    } finally {
      setUpdatingId(null);
      setMemberToRemove(null);
    }
  };

  const filteredMembers = members.filter((m) => {
    const name = m.user?.name || '';
    const email = m.user?.email || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase()) || email.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#FAFAFA] overflow-y-auto p-6 md:p-8 relative text-[#18181B]">
      <div className="max-w-7xl mx-auto w-full flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-[24px] font-semibold text-[#18181B] tracking-tight">Team Members</h1>
            <p className="text-[13px] text-[#52525B] mt-1 font-normal">
              Manage team access, promote members to Admin, and view member GitHub skill profiles.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <span className="material-symbols-outlined absolute left-2.5 top-2 text-[#71717A] text-[18px]">search</span>
              <input
                type="text"
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#E4E4E7] rounded-[6px] text-[13px] text-[#18181B] placeholder-[#71717A] outline-none focus:border-[#4F46E5] transition-colors"
                placeholder="Search member..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {isAdmin && (
              <button
                onClick={onOpenInviteModal}
                className="bg-[#4F46E5] text-white px-4 py-2 rounded-[6px] text-[13px] font-medium hover:bg-[#4338CA] transition-colors flex items-center gap-1.5 cursor-pointer shadow-card"
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span> Invite Member
              </button>
            )}
          </div>
        </div>

        {/* Floating Screen Toast Notification Banner */}
        {toast && (
          <div className={`p-3.5 rounded-[8px] border shadow-card flex items-center justify-between gap-3 transition-colors ${
            toast.type === 'success'
              ? 'bg-[#EEF2FF] border-[#4F46E5]/30 text-[#4F46E5]'
              : 'bg-[#FEE2E2] border-[#FECACA] text-[#DC2626]'
          }`}>
            <div className="flex items-center gap-2 text-[13px] font-medium">
              <span className="material-symbols-outlined text-[18px]">
                {toast.type === 'success' ? 'check_circle' : 'error'}
              </span>
              {toast.message}
            </div>
            <button onClick={() => setToast(null)} className="p-1 hover:opacity-70 cursor-pointer">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        {/* Members Table */}
        <div className="bg-white border border-[#E4E4E7] rounded-[8px] overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-[#F7F7F8] border-b border-[#E4E4E7] text-[12px] font-semibold text-[#71717A]">
                  <th className="py-3.5 px-4">Member</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">GitHub Sync</th>
                  <th className="py-3.5 px-4">Skill Profile</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-[13px] text-[#18181B] divide-y divide-[#E4E4E7]">
                {filteredMembers.map((m) => {
                  const isSelf = m.user?.id === currentUser?.id || (currentUser?.email && m.user?.email === currentUser.email);
                  const ghUsername = m.user?.githubUsername || m.user?.github_username || null;
                  const hasGithub = Boolean(ghUsername || (m.user?.skillProfile && Object.keys(m.user.skillProfile).length > 0) || (m.user?.skill_profile && Object.keys(m.user.skill_profile).length > 0));
                  const memberName = (m.user?.name && m.user.name !== 'Team Member' && m.user.name !== 'Member' ? m.user.name : null) || (m.user?.email ? m.user.email.split('@')[0] : 'Member');

                  return (
                    <tr key={m.id} className="hover:bg-[#F4F4F5] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#4F46E5] text-white font-semibold text-xs flex items-center justify-center border border-[#E4E4E7] overflow-hidden shrink-0">
                            {m.user?.avatarUrl || m.user?.avatar_url ? (
                              <img src={m.user.avatarUrl || m.user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                              memberName.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-[#18181B] text-[14px]">
                                {memberName} {isSelf && '(You)'}
                              </span>
                              {m.user?.primaryRole && (
                                <span className="px-2 py-0.5 rounded text-[#4F46E5] bg-[#EEF2FF] text-[11px] font-semibold border border-[#4F46E5]/20">
                                  {m.user.primaryRole}
                                </span>
                              )}
                            </div>
                            <span className="text-[#71717A] text-[12px]">{m.user?.email}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {isAdmin ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={m.role || 'MEMBER'}
                              disabled={updatingId === m.id}
                              onChange={(e) => handleRoleChange(m.id, e.target.value)}
                              className="bg-white border border-[#E4E4E7] rounded-[6px] p-1.5 text-[12px] font-medium text-[#18181B] outline-none cursor-pointer focus:border-[#4F46E5]"
                            >
                              <option value="ADMIN">Admin</option>
                              <option value="MEMBER">Member</option>
                              <option value="VIEWER">Viewer</option>
                            </select>
                            {updatingId === m.id && (
                              <span className="w-3.5 h-3.5 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
                            )}
                          </div>
                        ) : (
                          <RoleBadge role={m.role} />
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-medium border ${
                          hasGithub
                            ? 'bg-[#EEF2FF] text-[#4F46E5] border-[#4F46E5]/20'
                            : 'bg-[#F4F4F5] text-[#52525B] border-[#E4E4E7]'
                        }`}>
                          <span className="material-symbols-outlined text-[13px]">code</span>
                          {ghUsername ? `@${ghUsername}` : (hasGithub ? 'GitHub Connected' : 'Not Connected')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => onSelectMemberProfile && onSelectMemberProfile(m.user || m)}
                          className="text-[#4F46E5] text-[13px] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[15px]">badge</span> View Skill Breakdown
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {isAdmin && !isSelf && (
                          <button
                            onClick={() => setMemberToRemove(m)}
                            disabled={updatingId === m.id}
                            className="p-1.5 text-[#DC2626] hover:bg-[#FEE2E2] rounded-[6px] cursor-pointer transition-colors"
                            title="Remove member"
                          >
                            <span className="material-symbols-outlined text-[18px]">person_remove</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Remove Member Confirmation Modal Overlay */}
      {memberToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-md bg-white rounded-[10px] p-6 shadow-modal border border-[#E4E4E7] flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-[#E4E4E7] pb-3">
              <span className="material-symbols-outlined text-[#DC2626] text-[20px]">warning</span>
              <h2 className="text-[18px] font-semibold text-[#18181B]">Remove Member</h2>
            </div>
            <p className="text-[14px] text-[#52525B]">
              Are you sure you want to remove <strong>{memberToRemove.user?.name || memberToRemove.user?.email}</strong> from this project?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setMemberToRemove(null)}
                className="px-4 py-2 rounded-[6px] text-[13px] font-medium text-[#52525B] hover:bg-[#F4F4F5] cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemoveMember}
                className="bg-[#DC2626] text-white px-4 py-2 rounded-[6px] text-[13px] font-medium hover:bg-[#B91C1C] transition-colors cursor-pointer"
              >
                Remove Member
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
