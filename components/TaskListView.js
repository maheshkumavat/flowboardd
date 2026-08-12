'use client';

import React, { useState } from 'react';

const computeTaskRiskBadge = (task) => {
  const isDone = (task.status || '').toLowerCase() === 'done' || 
                 (task.columnName && task.columnName.toLowerCase() === 'done');

  if (isDone) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0] text-[11px] font-semibold" title="Task completed">
        <span className="material-symbols-outlined text-[12px]">check_circle</span>
        Low Risk
      </span>
    );
  }

  const nowMs = Date.now();
  const dueMs = task.dueDate || task.due_date ? new Date(task.dueDate || task.due_date).getTime() : null;

  // 1. Overdue: due date passed and task not done
  if (dueMs && nowMs > dueMs) {
    const overdueDays = Math.max(1, Math.round((nowMs - dueMs) / (1000 * 60 * 60 * 24)));
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA] text-[11px] font-semibold" title={`Overdue by ${overdueDays} day(s)`}>
        <span className="material-symbols-outlined text-[12px]">schedule</span>
        Overdue
      </span>
    );
  }

  // 2. At Risk: due within 48 hours OR task.riskFlag is true
  const isImminent = dueMs && (dueMs - nowMs) <= (48 * 60 * 60 * 1000);
  const isAtRisk = Boolean(isImminent || task.riskFlag || task.risk_flag);

  if (isAtRisk) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] text-[11px] font-semibold" title="Task is approaching deadline or flagged at risk">
        <span className="material-symbols-outlined text-[12px]">warning</span>
        At Risk
      </span>
    );
  }

  // 3. Low Risk default
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0] text-[11px] font-semibold" title="On schedule">
      <span className="material-symbols-outlined text-[12px]">check_circle</span>
      Low Risk
    </span>
  );
};

export default function TaskListView({
  columns = [],
  projectMembers = [],
  canEditTasks = true,
  onTaskClick,
  onAddTask,
  onUpdateTaskColumn,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  // Flatten tasks from columns
  const allTasks = columns.flatMap((col) =>
    (col.tasks || []).map((t) => ({ ...t, columnId: col.id, columnName: col.name }))
  );

  const filteredTasks = allTasks.filter((task) => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) || (task.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (statusFilter !== 'ALL' && task.columnId !== statusFilter) return false;
    if (priorityFilter !== 'ALL' && task.priority !== priorityFilter) return false;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#FAFAFA] overflow-hidden p-6 gap-4">
      {/* List Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-3 rounded-[8px] border border-[#E4E4E7] shrink-0 shadow-card">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative w-64">
            <span className="material-symbols-outlined absolute left-2.5 top-2 text-[#71717A] text-[18px]">search</span>
            <input
              className="w-full pl-9 pr-3 py-1.5 bg-[#F7F7F8] border border-[#E4E4E7] rounded-[6px] text-[13px] text-[#18181B] placeholder-[#71717A] outline-none focus:border-[#4F46E5] focus:bg-white transition-colors"
              placeholder="Search tasks..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#F7F7F8] border border-[#E4E4E7] rounded-[6px] px-3 py-1.5 text-[13px] text-[#18181B] outline-none cursor-pointer focus:border-[#4F46E5] transition-colors"
          >
            <option value="ALL">All Statuses</option>
            {columns.map((col) => (
              <option key={col.id} value={col.id}>{col.name}</option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-[#F7F7F8] border border-[#E4E4E7] rounded-[6px] px-3 py-1.5 text-[13px] text-[#18181B] outline-none cursor-pointer focus:border-[#4F46E5] transition-colors"
          >
            <option value="ALL">All Priorities</option>
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="LOW">Low Priority</option>
          </select>
        </div>

        {canEditTasks && (
          <button
            onClick={() => onAddTask && onAddTask(columns[0]?.id)}
            className="bg-[#4F46E5] text-white px-3.5 py-1.5 rounded-[6px] text-[13px] font-medium hover:bg-[#4338CA] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add</span> New Task
          </button>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-white border border-[#E4E4E7] rounded-[8px] overflow-hidden flex-1 flex flex-col shadow-card">
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="border-b border-[#E4E4E7] bg-[#F7F7F8] text-[12px] font-semibold text-[#71717A]">
                <th className="p-3.5">Task Name</th>
                <th className="p-3.5">Status / Column</th>
                <th className="p-3.5">Priority</th>
                <th className="p-3.5">Required Skill</th>
                <th className="p-3.5">Assignee</th>
                <th className="p-3.5">Due Date</th>
                <th className="p-3.5 text-center">Risk</th>
              </tr>
            </thead>
            <tbody className="text-[13px] text-[#18181B] divide-y divide-[#E4E4E7]">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#71717A] italic text-[14px]">
                    No tasks match your filters.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((t) => {
                  const isHigh = t.priority === 'HIGH' || t.priority === 'URGENT';
                  const skill = t.requiredSkill || t.required_skill;

                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-[#F4F4F5] transition-colors cursor-pointer group"
                      onClick={() => onTaskClick && onTaskClick(t)}
                    >
                      <td className="p-3.5 font-medium text-[#18181B] group-hover:text-[#4F46E5] transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[16px] text-[#4F46E5]">task_alt</span>
                          <span>{t.title}</span>
                        </div>
                      </td>

                      <td className="p-3.5" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={t.columnId}
                          disabled={!canEditTasks}
                          onChange={(e) => onUpdateTaskColumn && onUpdateTaskColumn(t.id, e.target.value)}
                          className="px-2.5 py-1 rounded-[6px] bg-[#F4F4F5] text-[#18181B] text-[12px] font-medium border border-[#E4E4E7] cursor-pointer outline-none focus:border-[#4F46E5]"
                        >
                          {columns.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </td>

                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          isHigh ? 'bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]' : 'bg-[#F4F4F5] text-[#52525B] border-[#E4E4E7]'
                        }`}>
                          {t.priority || 'MEDIUM'}
                        </span>
                      </td>

                      <td className="p-3.5">
                        {skill ? (
                          <span className="px-2 py-0.5 bg-[#EEF2FF] text-[#4F46E5] border border-[#4F46E5]/20 rounded text-[11px] font-medium">
                            {skill}
                          </span>
                        ) : (
                          <span className="text-[#71717A] italic text-[11px]">—</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        {t.assignee ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-[#4F46E5] text-white font-semibold text-[10px] flex items-center justify-center">
                              {t.assignee.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-[13px] text-[#18181B]">{t.assignee.name}</span>
                          </div>
                        ) : (
                          <span className="text-[#71717A] italic text-[12px]">Unassigned</span>
                        )}
                      </td>

                      <td className="p-3.5 text-[#52525B] text-[13px]">
                        {t.dueDate ? new Date(t.dueDate || t.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '—'}
                      </td>

                      <td className="p-3.5 text-center">
                        {computeTaskRiskBadge(t)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
