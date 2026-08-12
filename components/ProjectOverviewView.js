'use client';

import React from 'react';

export default function ProjectOverviewView({
  project,
  canEditTasks = true,
  onSelectTab,
  onAddTask,
}) {
  const columns = project?.columns || [];
  const members = project?.members || [];
  const skills = project?.suggestedSkills || project?.suggested_skills || [];
  const isAdmin = project?.userRole === 'ADMIN';

  const allTasks = columns.flatMap((c) => c.tasks || []);
  const totalTasks = allTasks.length;

  const isDoneColumn = (colName) => {
    const name = (colName || '').toLowerCase();
    return name.includes('done') || name.includes('complete') || name.includes('finished');
  };

  const isInProgressColumn = (colName) => {
    const name = (colName || '').toLowerCase();
    return name.includes('progress') || name.includes('doing') || name.includes('review');
  };

  let completedTasks = 0;
  let inProgressTasks = 0;

  columns.forEach((c) => {
    const taskCount = (c.tasks || []).length;
    if (isDoneColumn(c.name)) {
      completedTasks += taskCount;
    } else if (isInProgressColumn(c.name)) {
      inProgressTasks += taskCount;
    }
  });

  // Fallback check on individual task properties if columns mismatch
  if (completedTasks === 0 && allTasks.length > 0) {
    completedTasks = allTasks.filter((t) => isDoneColumn(t.status || t.columnName || t.column_name)).length;
  }
  if (inProgressTasks === 0 && allTasks.length > 0) {
    inProgressTasks = allTasks.filter((t) => isInProgressColumn(t.status || t.columnName || t.column_name)).length;
  }

  const riskTasks = allTasks.filter((t) => Boolean(t.riskFlag || t.risk_flag)).length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#FAFAFA] overflow-y-auto p-6 md:p-8 text-[#18181B]">
      <div className="max-w-7xl mx-auto w-full flex flex-col gap-6">
        
        {/* Project Hero Header */}
        <section className="bg-white border border-[#E4E4E7] p-6 rounded-[8px] shadow-card flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex flex-col gap-2 max-w-3xl">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[24px] font-semibold text-[#18181B] tracking-tight">{project?.name}</h1>
              <span className="bg-[#EEF2FF] text-[#4F46E5] text-[11px] px-2.5 py-0.5 rounded-[4px] font-semibold border border-[#4F46E5]/20">
                Active Project
              </span>
            </div>

            <p className="text-[14px] text-[#52525B] font-normal mt-1">
              {project?.description || 'Collaborative team workspace.'}
            </p>

            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="text-[12px] text-[#71717A] self-center mr-1 font-medium">Tech Stack:</span>
                {skills.map((s) => (
                  <span key={s} className="px-2.5 py-0.5 bg-[#F4F4F5] text-[#52525B] text-[11px] rounded-[4px] font-medium border border-[#E4E4E7]">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {isAdmin && (
              <button
                onClick={() => onSelectTab && onSelectTab('settings')}
                className="bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA] px-3.5 py-2 rounded-[6px] text-[13px] font-medium hover:bg-[#FEE2E2]/80 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span> Delete Project
              </button>
            )}

            {canEditTasks && (
              <button
                onClick={() => onAddTask && onAddTask(columns[0]?.id)}
                className="bg-[#4F46E5] text-white px-4 py-2 rounded-[6px] text-[13px] font-medium hover:bg-[#4338CA] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">add</span> Add Task
              </button>
            )}
          </div>
        </section>

        {/* Metrics Bento Grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E4E4E7] rounded-[8px] p-5 flex flex-col justify-between shadow-card">
            <span className="text-[12px] font-medium text-[#71717A] uppercase tracking-wider">Completion Rate</span>
            <div className="flex items-end gap-2 mt-2">
              <span className="text-[24px] font-semibold text-[#18181B]">{completionPercentage}%</span>
            </div>
            <div className="w-full bg-[#F4F4F5] h-2 rounded-full mt-3 overflow-hidden">
              <div className="bg-[#4F46E5] h-full rounded-full transition-all" style={{ width: `${completionPercentage}%` }} />
            </div>
          </div>

          <div className="bg-white border border-[#E4E4E7] rounded-[8px] p-5 flex flex-col justify-between shadow-card">
            <span className="text-[12px] font-medium text-[#71717A] uppercase tracking-wider">Total Tasks</span>
            <span className="text-[24px] font-semibold text-[#18181B] mt-2">{totalTasks}</span>
            <span className="text-[12px] text-[#71717A] mt-1">{columns.length} columns</span>
          </div>

          <div className="bg-white border border-[#E4E4E7] rounded-[8px] p-5 flex flex-col justify-between shadow-card">
            <span className="text-[12px] font-medium text-[#71717A] uppercase tracking-wider">Completed / In Progress</span>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-[24px] font-semibold text-[#18181B]">{completedTasks}</span>
              <span className="text-[14px] text-[#52525B]">/ {inProgressTasks}</span>
            </div>
            <span className="text-[12px] text-[#71717A] mt-1">Active execution</span>
          </div>

          <div className="bg-[#FEE2E2]/40 border border-[#FECACA] rounded-[8px] p-5 flex flex-col justify-between shadow-card">
            <span className="text-[12px] font-semibold text-[#DC2626] uppercase tracking-wider">At Risk Tasks</span>
            <span className="text-[24px] font-semibold text-[#DC2626] mt-2">{riskTasks}</span>
            <span className="text-[12px] text-[#DC2626]/80 mt-1">Deadline alert</span>
          </div>
        </section>

        {/* Quick View Navigation Cards */}
        <section className="flex flex-col gap-3">
          <h3 className="text-[18px] font-semibold text-[#18181B]">Quick View Shortcuts</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div
              onClick={() => onSelectTab && onSelectTab('board')}
              className="bg-white border border-[#E4E4E7] hover:border-[#4F46E5] p-5 rounded-[8px] flex items-center justify-between cursor-pointer transition-colors shadow-card group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[6px] bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">view_kanban</span>
                </div>
                <div>
                  <h4 className="text-[14px] font-semibold text-[#18181B] group-hover:text-[#4F46E5] transition-colors">Kanban Board</h4>
                  <p className="text-[13px] text-[#52525B]">Visual drag-and-drop columns</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-[18px] text-[#71717A] group-hover:text-[#4F46E5] transition-colors">arrow_forward</span>
            </div>

            <div
              onClick={() => onSelectTab && onSelectTab('list')}
              className="bg-white border border-[#E4E4E7] hover:border-[#4F46E5] p-5 rounded-[8px] flex items-center justify-between cursor-pointer transition-colors shadow-card group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[6px] bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">format_list_bulleted</span>
                </div>
                <div>
                  <h4 className="text-[14px] font-semibold text-[#18181B] group-hover:text-[#4F46E5] transition-colors">List View</h4>
                  <p className="text-[13px] text-[#52525B]">Flat sortable task data table</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-[18px] text-[#71717A] group-hover:text-[#4F46E5] transition-colors">arrow_forward</span>
            </div>

            <div
              onClick={() => onSelectTab && onSelectTab('timeline')}
              className="bg-white border border-[#E4E4E7] hover:border-[#4F46E5] p-5 rounded-[8px] flex items-center justify-between cursor-pointer transition-colors shadow-card group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[6px] bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">date_range</span>
                </div>
                <div>
                  <h4 className="text-[14px] font-semibold text-[#18181B] group-hover:text-[#4F46E5] transition-colors">Timeline View</h4>
                  <p className="text-[13px] text-[#52525B]">Chronological Gantt chart</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-[18px] text-[#71717A] group-hover:text-[#4F46E5] transition-colors">arrow_forward</span>
            </div>
          </div>
        </section>

        {/* Team Roster Summary */}
        <section className="bg-white border border-[#E4E4E7] p-6 rounded-[8px] shadow-card flex flex-col gap-4">
          <div className="flex justify-between items-center pb-2 border-b border-[#E4E4E7]">
            <h3 className="text-[16px] font-semibold text-[#18181B]">Team Roster ({members.length})</h3>
            <button
              onClick={() => onSelectTab && onSelectTab('members')}
              className="text-[#4F46E5] text-[13px] hover:underline font-semibold cursor-pointer"
            >
              Manage Team →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {members.slice(0, 6).map((m) => (
              <div key={m.id} className="p-3 bg-[#F7F7F8] border border-[#E4E4E7] rounded-[6px] flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#4F46E5] text-white font-semibold text-xs flex items-center justify-center shrink-0">
                  {(m.user?.name || 'M').charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col truncate">
                  <span className="text-[13px] font-medium text-[#18181B] truncate">
                    {m.user?.name || 'Team Member'}
                  </span>
                  <span className="text-[10px] text-[#71717A] uppercase font-semibold">
                    {m.role || 'MEMBER'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
