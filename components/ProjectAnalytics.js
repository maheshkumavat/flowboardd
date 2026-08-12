'use client';

import React, { useState, useEffect } from 'react';
import { supabase, fetchWithAuth } from '../lib/supabase';

export default function ProjectAnalytics({ project, tasks = [], members = [] }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivityLogs();

    if (!project?.id) return;

    const channelName = `analytics-activity-${project.id}`;
    try {
      const activeChannels = supabase.getChannels() || [];
      const staleChannel = activeChannels.find((c) => c.name === channelName || c.topic === `realtime:public:${channelName}`);
      if (staleChannel) {
        supabase.removeChannel(staleChannel);
      }
    } catch (e) {}

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log', filter: `project_id=eq.${project.id}` },
        () => {
          fetchActivityLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [project?.id]);

  const fetchActivityLogs = async () => {
    if (!project?.id) return;
    try {
      const res = await fetchWithAuth(`/api/projects/${project.id}/activity?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activity || []);
      }
    } catch (err) {
      console.error('Failed to fetch activity logs for analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  // 1. Task Status Breakdown Data
  const columns = project?.columns || [];
  const totalTasksCount = tasks.length;
  
  const statusColors = [
    '#6366f1', // Indigo
    '#0ea5e9', // Sky Blue
    '#f59e0b', // Amber
    '#10b981', // Emerald
    '#8b5cf6', // Purple
  ];

  const statusStats = columns.map((col, idx) => {
    const colTasks = (col.tasks && col.tasks.length > 0)
      ? col.tasks
      : tasks.filter((t) => t.column_id === col.id || t.columnId === col.id || (t.status && t.status.toLowerCase() === col.name.toLowerCase()));
    const percent = totalTasksCount > 0 ? Math.round((colTasks.length / totalTasksCount) * 100) : 0;
    return {
      id: col.id,
      name: col.name,
      count: colTasks.length,
      percent,
      color: statusColors[idx % statusColors.length],
    };
  });

  // Calculate Donut Chart Segments
  let cumulativePercent = 0;
  const donutSegments = statusStats.map((stat) => {
    const startAngle = cumulativePercent * 3.6;
    cumulativePercent += stat.percent;
    return {
      ...stat,
      startAngle,
      strokeDasharray: `${stat.percent} ${100 - stat.percent}`,
    };
  });

  // 2. Workload per Member Data
  const memberWorkload = members.map((m) => {
    const userObj = m.user || m;
    const userId = userObj.id || m.user_id;
    const userName = userObj.name || userObj.email?.split('@')[0] || 'Member';
    const assignedTasks = tasks.filter((t) => t.assignee_id === userId || t.assigneeId === userId);
    return {
      id: userId,
      name: userName,
      role: m.role || 'MEMBER',
      count: assignedTasks.length,
    };
  });

  const unassignedCount = tasks.filter((t) => !t.assignee_id && !t.assigneeId).length;
  const maxMemberTasks = Math.max(1, ...memberWorkload.map((m) => m.count), unassignedCount);

  // 3. At Risk Tasks Data
  const atRiskTasks = tasks.filter((t) => t.riskFlag || t.risk_flag);

  // 4. Activity Volume over last 7 days Data
  const now = new Date();
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  const activityCountsByDay = last7Days.map((dateStr) => {
    const count = activities.filter((act) => {
      const actDate = new Date(act.created_at || act.timestamp).toISOString().split('T')[0];
      return actDate === dateStr;
    }).length;

    const displayDay = new Date(dateStr).toLocaleDateString([], { weekday: 'short' });
    return { date: dateStr, label: displayDay, count };
  });

  const maxActivityCount = Math.max(1, ...activityCountsByDay.map((d) => d.count));

  return (
    <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-[#FAFAFA] flex flex-col gap-6 text-[#18181B]">
      
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-5 rounded-[8px] border border-[#E4E4E7] shadow-card">
        <div>
          <h2 className="text-[20px] font-semibold text-[#18181B]">
            Project Analytics & Insights
          </h2>
          <p className="text-[13px] text-[#52525B] mt-0.5 font-normal">
            Live velocity, workload distribution, and task metrics for <span className="font-semibold text-[#4F46E5]">{project?.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-[#EEF2FF] rounded-[6px] border border-[#4F46E5]/20 text-center">
            <span className="text-[20px] font-semibold text-[#4F46E5] block leading-none">{totalTasksCount}</span>
            <span className="text-[11px] text-[#71717A] font-medium">Total Tasks</span>
          </div>
          <div className="px-4 py-2 bg-[#FEE2E2] rounded-[6px] border border-[#FECACA] text-center">
            <span className="text-[20px] font-semibold text-[#DC2626] block leading-none">{atRiskTasks.length}</span>
            <span className="text-[11px] text-[#DC2626] font-medium">At-Risk Tasks</span>
          </div>
        </div>
      </div>

      {/* Grid Layout for Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Chart 1: Task Status Breakdown (Donut Chart) */}
        <div className="bg-white p-6 rounded-[8px] border border-[#E4E4E7] shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold text-[#18181B] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#4F46E5] text-[18px]">pie_chart</span>
              Task Status Distribution
            </h3>
            <span className="text-[12px] text-[#52525B] bg-[#F4F4F5] px-2.5 py-1 rounded-[4px] font-medium border border-[#E4E4E7]">
              {totalTasksCount} Tasks Total
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2">
            {/* SVG Donut Chart */}
            <div className="relative w-44 h-44 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                {/* Background circle */}
                <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#E4E4E7" strokeWidth="3.8" />
                {/* Donut Segments */}
                {totalTasksCount > 0 ? (
                  donutSegments.map((seg, idx) => {
                    let prevPercent = 0;
                    for (let i = 0; i < idx; i++) prevPercent += donutSegments[i].percent;
                    return (
                      <circle
                        key={seg.id}
                        cx="18"
                        cy="18"
                        r="15.9155"
                        fill="none"
                        stroke={seg.color}
                        strokeWidth="4"
                        strokeDasharray={`${seg.percent} ${100 - seg.percent}`}
                        strokeDashoffset={-prevPercent}
                        className="transition-all duration-500 hover:opacity-80"
                      />
                    );
                  })
                ) : (
                  <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#D4D4D8" strokeWidth="3" />
                )}
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-[22px] font-semibold text-[#18181B]">
                  {totalTasksCount}
                </span>
                <span className="text-[11px] text-[#71717A] font-medium">Tasks</span>
              </div>
            </div>

            {/* Legend & Stats List */}
            <div className="flex flex-col gap-2 flex-1 w-full max-w-xs">
              {statusStats.map((stat) => (
                <div key={stat.id} className="flex items-center justify-between p-2 px-3 rounded-[6px] bg-[#F7F7F8] border border-[#E4E4E7]">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: stat.color }} />
                    <span className="text-[13px] font-medium text-[#18181B]">{stat.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[12px]">
                    <span className="text-[#52525B]">{stat.count} tasks</span>
                    <span className="font-semibold text-[#4F46E5] w-8 text-right">{stat.percent}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chart 2: Workload Distribution per Member (Bar Chart) */}
        <div className="bg-white p-6 rounded-[8px] border border-[#E4E4E7] shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold text-[#18181B] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#4F46E5] text-[18px]">bar_chart</span>
              Team Workload Allocation
            </h3>
            <span className="text-[12px] text-[#52525B] bg-[#F4F4F5] px-2.5 py-1 rounded-[4px] font-medium border border-[#E4E4E7]">
              {members.length} Members
            </span>
          </div>

          <div className="flex flex-col gap-3 py-1">
            {memberWorkload.map((m) => {
              const widthPct = Math.round((m.count / maxMemberTasks) * 100);
              return (
                <div key={m.id} className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[13px] font-medium text-[#18181B]">
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#4F46E5] text-white text-[10px] font-semibold flex items-center justify-center">
                        {m.name.charAt(0).toUpperCase()}
                      </span>
                      {m.name} <span className="font-normal text-[11px] text-[#71717A]">({m.role})</span>
                    </span>
                    <span className="font-semibold text-[#4F46E5] text-[12px]">{m.count} tasks</span>
                  </div>
                  <div className="w-full bg-[#F4F4F5] h-2.5 rounded-full overflow-hidden p-0.5 border border-[#E4E4E7]">
                    <div
                      className="bg-[#4F46E5] h-full rounded-full transition-all duration-700"
                      style={{ width: `${Math.max(5, widthPct)}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Unassigned row */}
            {unassignedCount > 0 && (
              <div className="flex flex-col gap-1 pt-2 border-t border-dashed border-[#E4E4E7]">
                <div className="flex justify-between items-center text-[12px] font-medium text-[#71717A]">
                  <span className="flex items-center gap-1.5 text-[#71717A]">
                    <span className="material-symbols-outlined text-[15px]">help_outline</span>
                    Unassigned Tasks
                  </span>
                  <span className="font-semibold text-[#71717A]">{unassignedCount} tasks</span>
                </div>
                <div className="w-full bg-[#F4F4F5] h-2.5 rounded-full overflow-hidden p-0.5 border border-[#E4E4E7]">
                  <div
                    className="bg-[#D4D4D8] h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.max(5, Math.round((unassignedCount / maxMemberTasks) * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chart 3: 7-Day Activity Volume (Vertical Bar Chart) */}
        <div className="bg-white p-6 rounded-[8px] border border-[#E4E4E7] shadow-card col-span-1 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold text-[#18181B] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#4F46E5] text-[18px]">show_chart</span>
              Activity Trend (Last 7 Days)
            </h3>
            <span className="text-[12px] text-[#52525B] bg-[#F4F4F5] px-2.5 py-1 rounded-[4px] font-medium border border-[#E4E4E7]">
              {activities.length} Total Events Logged
            </span>
          </div>

          {/* Bar Chart Container */}
          <div className="h-44 w-full pt-4 pb-2 flex items-end justify-between gap-4 px-4 bg-[#F7F7F8] rounded-[6px] border border-[#E4E4E7]">
            {activityCountsByDay.map((day) => {
              const heightPct = Math.round((day.count / maxActivityCount) * 100);
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer">
                  {/* Tooltip */}
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-[#18181B] text-white text-[11px] font-medium py-0.5 px-2 rounded-[4px] mb-1 shadow-card">
                    {day.count} events
                  </span>
                  
                  {/* Bar */}
                  <div className="w-full max-w-[36px] bg-white rounded-t-[4px] border border-[#E4E4E7] overflow-hidden flex items-end h-full p-0.5">
                    <div
                      className="w-full bg-[#4F46E5] rounded-t-[2px] transition-all duration-500 group-hover:bg-[#4338CA]"
                      style={{ height: `${Math.max(8, heightPct)}%` }}
                    />
                  </div>

                  {/* Day Label */}
                  <span className="text-[11px] font-medium text-[#71717A] mt-2">
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
