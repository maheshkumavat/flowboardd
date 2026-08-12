'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithAuth } from '../lib/supabase';

export default function NotificationsPanel({ notifications = [], onClose, onMarkAllRead, onNotificationUpdated }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('All');
  const [notifList, setNotifList] = useState(notifications);
  const [actioningId, setActioningId] = useState(null);

  React.useEffect(() => {
    setNotifList(notifications);
  }, [notifications]);

  const filtered = notifList.filter((n) => {
    if (activeTab === 'Unread') return !n.read;
    if (activeTab === 'Mentions') return n.type === 'comment' || n.type === 'assign' || n.type === 'task_assigned';
    return true;
  });

  const handleDismissSingleNotification = async (item, e) => {
    if (e) e.stopPropagation();
    setNotifList((prev) => prev.filter((n) => n.id !== item.id));
    try {
      await fetchWithAuth('/api/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: item.id }),
      });
      if (onNotificationUpdated) onNotificationUpdated();
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const handleNotificationClick = async (item) => {
    await handleDismissSingleNotification(item);
  };

  const handleOpenProjectWorkspace = async (item, e) => {
    if (e) e.stopPropagation();
    if (item.projectId) {
      await handleDismissSingleNotification(item);
      if (onClose) onClose();
      router.push(`/projects/${item.projectId}`);
    }
  };

  const handleMarkAllRead = async () => {
    setNotifList([]);
    if (onMarkAllRead) {
      await onMarkAllRead();
    } else {
      try {
        await fetchWithAuth('/api/notifications', { method: 'DELETE' });
        if (onNotificationUpdated) onNotificationUpdated();
      } catch (err) {
        console.error('Failed to delete all notifications:', err);
      }
    }
  };

  const handleJoinRequestAction = async (item, action) => {
    const projId = item.projectId;
    if (!projId) return;
    setActioningId(item.id);

    try {
      const res = await fetchWithAuth(`/api/projects/${projId}/join-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: item.requestId || null,
          action, // 'accept' or 'reject'
          userId: item.requesterId || null,
          role: item.role || 'MEMBER',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || `Failed to ${action} join request.`);
        return;
      }

      await handleDismissSingleNotification(item);
    } catch (err) {
      console.error('Join request notification action error:', err);
      alert(err.message || 'Error executing request action');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <aside className="fixed right-0 top-0 h-full w-96 bg-white shadow-modal z-50 flex flex-col border-l border-[#E4E4E7] transition-transform duration-300">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E4E4E7] bg-[#F7F7F8] shrink-0">
        <h2 className="text-[18px] font-semibold text-[#18181B]">Notifications</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleMarkAllRead}
            className="text-[12px] font-medium text-[#4F46E5] hover:underline transition-colors cursor-pointer"
          >
            Mark all read
          </button>
          <button
            onClick={onClose}
            className="p-1 text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5] rounded-[6px] transition-colors flex items-center justify-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      </div>

      {/* Filters / Tabs */}
      <div className="flex gap-2 px-5 pt-3 pb-2 border-b border-[#E4E4E7] bg-white shrink-0">
        {['All', 'Unread', 'Mentions'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`text-[13px] font-medium pb-1.5 px-2 cursor-pointer transition-colors ${
              activeTab === tab
                ? 'text-[#4F46E5] font-semibold border-b-2 border-[#4F46E5]'
                : 'text-[#52525B] hover:text-[#18181B]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#E4E4E7]">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-[#71717A] text-[13px]">
            No notifications in this view.
          </div>
        ) : (
          filtered.map((item) => {
            const isJoinReq = item.type === 'join_request' || (item.action && item.action.includes('requested to join')) || (item.text && item.text.includes('requested to join'));
            const isPending = !item.status || item.status === 'pending';
            const isApproved = item.status === 'approved' || item.status === 'accepted';
            const isRejected = item.status === 'rejected' || item.status === 'declined';

            return (
              <div
                key={item.id}
                onClick={() => handleNotificationClick(item)}
                className="p-4 hover:bg-[#F4F4F5] transition-colors relative cursor-pointer group"
              >
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#EEF2FF] flex items-center justify-center text-[#4F46E5] border border-[#4F46E5]/20">
                    <span className="material-symbols-outlined text-[16px]">
                      {isJoinReq
                        ? 'person_add'
                        : item.type === 'role_promoted'
                        ? 'verified_user'
                        : item.type === 'comment'
                        ? 'chat_bubble'
                        : item.type === 'assign' || item.type === 'task_assigned'
                        ? 'assignment_ind'
                        : 'task_alt'}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-[13px] text-[#18181B]">
                        <span className="font-semibold text-[#18181B]">{item.author || 'FlowBoard'}</span>{' '}
                        {item.action || 'sent a notification'}
                      </p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[11px] text-[#71717A] mt-0.5">{item.time || 'just now'}</span>
                        <button
                          onClick={(e) => handleDismissSingleNotification(item, e)}
                          title="Dismiss notification"
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-[#a1a1aa] hover:text-[#dc2626] transition-all cursor-pointer rounded"
                        >
                          <span className="material-symbols-outlined text-[15px]">close</span>
                        </button>
                      </div>
                    </div>

                    {/* Notification Text */}
                    <p className="text-[12px] text-[#52525B] mt-1 whitespace-normal">
                      {item.text}
                    </p>

                    {/* Click-to-Open Project CTA Button */}
                    {item.projectId && (!isJoinReq || isApproved) && (
                      <div className="mt-2">
                        <button
                          onClick={(e) => handleOpenProjectWorkspace(item, e)}
                          className="bg-[#EEF2FF] text-[#4F46E5] border border-[#4F46E5]/20 px-2.5 py-1 rounded-[6px] text-[12px] font-medium hover:bg-[#EEF2FF]/80 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          Open Workspace <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                        </button>
                      </div>
                    )}

                    {/* Actionable Join Request Controls */}
                    {isJoinReq && isPending && (
                      <div className="flex items-center gap-2 mt-2 pt-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleJoinRequestAction(item, 'accept')}
                          disabled={actioningId === item.id}
                          className="bg-[#4F46E5] text-white px-3 py-1 rounded-[6px] text-[12px] font-medium hover:bg-[#4338CA] transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">check</span>
                          {actioningId === item.id ? 'Accepting...' : 'Accept'}
                        </button>
                        <button
                          onClick={() => handleJoinRequestAction(item, 'reject')}
                          disabled={actioningId === item.id}
                          className="bg-white border border-[#E4E4E7] text-[#18181B] px-3 py-1 rounded-[6px] text-[12px] font-medium hover:bg-[#FEE2E2] hover:text-[#DC2626] hover:border-[#FECACA] transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">close</span>
                          {actioningId === item.id ? 'Declining...' : 'Decline'}
                        </button>
                      </div>
                    )}

                    {/* Resolved Status Badges */}
                    {isJoinReq && isApproved && (
                      <div className="mt-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-[#EEF2FF] text-[#4F46E5] font-medium border border-[#4F46E5]/20">
                          <span className="material-symbols-outlined text-[12px]">check_circle</span> Accepted
                        </span>
                      </div>
                    )}

                    {isJoinReq && isRejected && (
                      <div className="mt-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-[#FEE2E2] text-[#DC2626] font-medium border border-[#FECACA]">
                          <span className="material-symbols-outlined text-[12px]">cancel</span> Declined
                        </span>
                      </div>
                    )}

                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

