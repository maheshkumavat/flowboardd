'use client';

import React, { useState, useEffect } from 'react';
import { supabase, fetchWithAuth } from '../lib/supabase';
import RoleBadge from './RoleBadge';

export default function ActivityFeed({ projectId, onClose, isDrawer = true }) {
  const [logs, setLogs] = useState([]);
  const [memberRoles, setMemberRoles] = useState({});
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    fetchActivityLogs();
    fetchMemberRoles();

    // Clean up any stale pre-existing channels with same topic/name before subscribing
    const channelName = `activity-${projectId}`;
    try {
      const activeChannels = supabase.getChannels() || [];
      const staleChannel = activeChannels.find((c) => c.name === channelName || c.topic === `realtime:public:${channelName}`);
      if (staleChannel) {
        supabase.removeChannel(staleChannel);
      }
    } catch (e) {}

    // Realtime subscription for activity logs
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log', filter: `project_id=eq.${projectId}` },
        (payload) => {
          setLogs((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const handleClearLogs = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 4000);
      return;
    }

    setClearing(true);
    try {
      const res = await fetchWithAuth(`/api/projects/${projectId}/activity`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setLogs([]);
        setConfirmClear(false);
      } else {
        alert('Failed to clear activity logs');
      }
    } catch (err) {
      console.error('Clear logs error:', err);
    } finally {
      setClearing(false);
    }
  };

  const fetchMemberRoles = async () => {
    try {
      const { data } = await supabase
        .from('project_members')
        .select('user_id, role, user:profiles(id, name, email)')
        .eq('project_id', projectId);

      if (data) {
        const mapping = {};
        data.forEach((m) => {
          mapping[m.user_id] = m.role;
        });
        setMemberRoles(mapping);
      }
    } catch (e) {}
  };

  const fetchActivityLogs = async () => {
    try {
      // 1. Fetch raw logs from database
      const { data: dbLogs } = await supabase
        .from('activity_log')
        .select(`
          id,
          action,
          metadata,
          created_at,
          user:profiles(id, name, email)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(30);

      // 2. Fetch project members to synthesize join activity if logs are sparse
      const { data: projMembers } = await supabase
        .from('project_members')
        .select('id, user_id, role, joined_at, user:profiles(id, name, email)')
        .eq('project_id', projectId);

      let combinedLogs = dbLogs || [];

      // Add member join events for all project members if not present
      if (projMembers && projMembers.length > 0) {
        projMembers.forEach((m) => {
          const u = m.user || {};
          const exists = combinedLogs.some((l) => (l.user?.id || l.user_id) === m.user_id && l.action === 'member_joined');
          if (!exists) {
            combinedLogs.push({
              id: `synth-join-${m.id}`,
              action: 'member_joined',
              created_at: m.joined_at || new Date().toISOString(),
              user: u,
              metadata: {
                userName: u.name || u.email?.split('@')[0] || 'Team Member',
                role: m.role || 'MEMBER',
                method: m.role === 'ADMIN' ? 'Owner / Admin' : 'approved join request',
              },
            });
          }
        });
      }

      // Sort descending by created_at
      combinedLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setLogs(combinedLogs);
    } catch (err) {
      console.error('Failed to fetch activity logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderActionText = (log) => {
    const userName = log.user?.name || log.metadata?.userName || 'A team member';
    const userId = log.user?.id || log.user_id;
    const role = (userId && memberRoles[userId]) || log.metadata?.role || 'MEMBER';
    const meta = log.metadata || {};

    const userSpan = (
      <span className="inline-flex items-center gap-1 font-bold text-on-surface">
        {userName}
        <RoleBadge role={role} />
      </span>
    );

    switch (log.action) {
      case 'task_created':
        return (
          <span>
            {userSpan} created task{' '}
            <span className="text-primary font-bold">"{meta.taskTitle || 'New Task'}"</span>
          </span>
        );
      case 'task_moved':
        return (
          <span>
            {userSpan} moved{' '}
            <span className="text-primary font-bold">"{meta.taskTitle}"</span> to{' '}
            <span className="font-bold">{meta.toColumn || 'new column'}</span>
          </span>
        );
      case 'task_assigned':
        return (
          <span>
            {userSpan} assigned{' '}
            <span className="text-primary font-bold">"{meta.taskTitle}"</span> to{' '}
            <strong className="font-semibold">{meta.assigneeName || 'a member'}</strong>
          </span>
        );
      case 'comment_added':
        return (
          <span>
            {userSpan} commented on{' '}
            <span className="text-primary font-bold">"{meta.taskTitle || 'a task'}"</span>
          </span>
        );
      case 'member_joined':
        return (
          <span>
            {userSpan} joined the project{' '}
            <span className="text-on-surface-variant font-medium">({meta.method || 'approved_join_request'})</span>
          </span>
        );
      default:
        return (
          <span>
            {userSpan} updated the workspace
          </span>
        );
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'task_created': return 'add_task';
      case 'task_moved': return 'swap_horiz';
      case 'task_assigned': return 'assignment_ind';
      case 'comment_added': return 'chat_bubble';
      case 'member_joined': return 'person_add';
      default: return 'history';
    }
  };

  const containerClasses = isDrawer
    ? 'fixed right-0 top-0 h-full w-96 bg-white shadow-modal z-50 flex flex-col border-l border-[#E4E4E7] transition-transform duration-300'
    : 'w-full max-w-4xl mx-auto bg-white border border-[#E4E4E7] rounded-[8px] shadow-card flex flex-col overflow-hidden';

  return (
    <div className={containerClasses}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E4E4E7] bg-[#F7F7F8] shrink-0">
        <div className="flex items-center gap-2 text-[#4F46E5] font-semibold">
          <span className="material-symbols-outlined text-[20px]">history</span>
          <h2 className="text-[18px] font-semibold text-[#18181B]">Activity Feed</h2>
        </div>
        <div className="flex items-center gap-2">
          {logs.length > 0 && (
            <button
              onClick={handleClearLogs}
              disabled={clearing}
              className={`px-3 py-1.5 rounded-[6px] text-[12px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                confirmClear
                  ? 'bg-[#DC2626] text-white hover:bg-[#B91C1C]'
                  : 'bg-[#FEE2E2] text-[#DC2626] hover:bg-[#FEE2E2]/80 border border-[#FECACA]'
              }`}
              title="Clear all activity history"
            >
              <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
              {clearing ? 'Clearing...' : confirmClear ? 'Confirm Clear' : 'Clear Feed'}
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5] rounded-[6px] transition-colors flex items-center justify-center cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Feed List */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
        {loading ? (
          <div className="p-8 text-center text-[#71717A] text-[13px]">
            Loading activity history...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-[#71717A] text-[13px]">
            No activity recorded yet. Create or move tasks to see live feed.
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="p-3 rounded-[6px] bg-[#F7F7F8] border border-[#E4E4E7] flex gap-3 items-start hover:bg-white transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center shrink-0 mt-0.5 border border-[#4F46E5]/20">
                <span className="material-symbols-outlined text-[16px]">{getActionIcon(log.action)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-[#18181B] leading-snug">
                  {renderActionText(log)}
                </div>
                <span className="text-[11px] text-[#71717A] mt-1 block">
                  {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                  {new Date(log.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
