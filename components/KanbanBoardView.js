'use client';

import React, { useState, useCallback } from 'react';

export default function KanbanBoardView({
  columns = [],
  canEditTasks = true,
  onTaskClick,
  onAddTask,
  onAiBreakdown,
  onSkillMatch,
  onUpdateTaskColumn,
  filterAtRiskOnly,
  setFilterAtRiskOnly,
  atRiskCount = 0,
}) {
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverColumnId, setDragOverColumnId] = useState(null);

  const handleDragStart = useCallback((e, taskId) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(taskId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedTaskId(null);
    setDragOverColumnId(null);
  }, []);

  const handleDragOver = useCallback((e, colId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumnId((prev) => (prev !== colId ? colId : prev));
  }, []);

  const handleDragLeave = useCallback((e, colId) => {
    setDragOverColumnId((prev) => (prev === colId ? null : prev));
  }, []);

  const handleDrop = useCallback((e, targetColumnId) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    setDragOverColumnId(null);
    setDraggedTaskId(null);


    if (taskId && onUpdateTaskColumn) {
      onUpdateTaskColumn(taskId, targetColumnId);
    }
  }, [draggedTaskId, onUpdateTaskColumn]);

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#F7F7F8] h-full">
      {/* Sub-Header Toolbar */}
      <div className="px-6 py-3 border-b border-[#E4E4E7] bg-white flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setFilterAtRiskOnly(!filterAtRiskOnly)}
            className={`px-3 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer border ${
              filterAtRiskOnly
                ? 'bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]'
                : 'bg-[#F4F4F5] text-[#52525B] hover:bg-[#E4E4E7] border-[#E4E4E7]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px] text-[#DC2626]">warning</span>
            At Risk ({atRiskCount})
          </button>

          <button
            onClick={onSkillMatch}
            className="bg-white text-[#18181B] px-3 py-1.5 rounded-[6px] text-[13px] font-medium hover:bg-[#F4F4F5] transition-colors flex items-center gap-1.5 cursor-pointer border border-[#E4E4E7]"
          >
            <span className="material-symbols-outlined text-[16px] text-[#4F46E5]">groups</span>
            Skill Match Hub
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          {canEditTasks && (
            <>
              <button
                onClick={onAiBreakdown}
                className="bg-[#EEF2FF] text-[#4F46E5] border border-[#4F46E5]/20 px-3 py-1.5 rounded-[6px] text-[13px] font-medium hover:bg-[#EEF2FF]/80 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                AI Breakdown
              </button>
              <button
                onClick={() => onAddTask && onAddTask(columns[0]?.id)}
                className="bg-[#4F46E5] text-white px-3 py-1.5 rounded-[6px] text-[13px] font-medium hover:bg-[#4338CA] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">add</span> Add Task
              </button>
            </>
          )}
        </div>
      </div>

      {/* Board Columns Canvas */}
      <div className="flex-1 p-4 md:p-6 overflow-hidden min-h-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 h-full items-start min-h-0">
          {columns.map((col) => {
            const tasks = (col.tasks || []).filter((t) => {
              if (filterAtRiskOnly) return Boolean(t.riskFlag || t.risk_flag);
              return true;
            });

            const isColumnDragOver = dragOverColumnId === col.id;

            return (
              <div
                key={col.id}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={(e) => handleDragLeave(e, col.id)}
                onDrop={(e) => handleDrop(e, col.id)}
                className={`flex-1 min-w-0 max-h-full h-full rounded-[10px] border transition-all duration-200 flex flex-col min-h-0 ${
                  isColumnDragOver
                    ? 'bg-[#EEF2FF]/70 border-[#4F46E5] border-2 shadow-lg scale-[1.002] ring-4 ring-[#4F46E5]/10'
                    : 'bg-[#F4F4F5] border-[#E4E4E7] shadow-card'
                }`}
              >
                {/* Column Header */}
                <div className={`p-3 border-b flex items-center justify-between rounded-t-[10px] shrink-0 transition-colors ${
                  isColumnDragOver ? 'bg-[#EEF2FF] border-[#4F46E5]/30' : 'bg-white border-[#E4E4E7]'
                }`}>
                  <div className="flex items-center gap-2 truncate">
                    <h3 className="text-[14px] font-semibold text-[#18181B] truncate">{col.name}</h3>
                    <span className="px-2 py-0.5 rounded-full bg-[#F4F4F5] text-[#52525B] border border-[#E4E4E7] text-[11px] font-semibold shrink-0">
                      {tasks.length}
                    </span>
                  </div>
                  {canEditTasks && (
                    <button
                      onClick={() => onAddTask && onAddTask(col.id)}
                      className="p-1 text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#18181B] rounded cursor-pointer shrink-0 transition-colors"
                      title="Add task to column"
                    >
                      <span className="material-symbols-outlined text-[18px]">add</span>
                    </button>
                  )}
                </div>

                {/* Task Cards Vertical Scroll Area */}
                <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0">
                  {tasks.length === 0 ? (
                    <div className={`p-6 border border-dashed rounded-[8px] text-center text-[13px] italic transition-all duration-200 ${
                      isColumnDragOver ? 'border-[#4F46E5] text-[#4F46E5] font-semibold bg-white shadow-sm' : 'border-[#E4E4E7] text-[#71717A]'
                    }`}>
                      {isColumnDragOver ? '✨ Drop Task Here' : 'No tasks in column'}
                    </div>
                  ) : (
                    tasks.map((task) => {
                      const isHighPriority = task.priority === 'HIGH' || task.priority === 'URGENT';
                      const isRisk = Boolean(task.riskFlag || task.risk_flag);
                      const skill = task.requiredSkill || task.required_skill;
                      const isBeingDragged = draggedTaskId === task.id;

                      return (
                        <div
                          key={task.id}
                          draggable={canEditTasks}
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          onDragEnd={handleDragEnd}
                          onClick={() => onTaskClick && onTaskClick(task)}
                          className={`bg-white p-3.5 rounded-[8px] border transition-all duration-200 ease-out cursor-grab active:cursor-grabbing flex flex-col gap-2 shrink-0 group ${
                            isBeingDragged
                              ? 'opacity-30 border-[#4F46E5] border-dashed scale-[0.98] shadow-inner'
                              : 'border-[#E4E4E7] hover:border-[#4F46E5] hover:-translate-y-0.5 hover:shadow-md shadow-card'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                              isHighPriority
                                ? 'bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]'
                                : 'bg-[#F4F4F5] text-[#52525B] border-[#E4E4E7]'
                            }`}>
                              {task.priority || 'MEDIUM'}
                            </span>

                            {isRisk && (
                              <span className="bg-[#FEE2E2] text-[#DC2626] px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 border border-[#FECACA]">
                                <span className="material-symbols-outlined text-[12px]">warning</span> At Risk
                              </span>
                            )}
                          </div>

                          <h4 className="text-[14px] font-medium text-[#18181B] group-hover:text-[#4F46E5] transition-colors line-clamp-2">
                            {task.title}
                          </h4>

                          {skill && (
                            <div>
                              <span className="px-2 py-0.5 bg-[#EEF2FF] text-[#4F46E5] border border-[#4F46E5]/20 text-[11px] rounded font-medium">
                                {skill}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-2.5 border-t border-[#E4E4E7] mt-1">
                            <div className="flex items-center gap-2 text-[#71717A] text-[12px]">
                              {task.dueDate && (
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[14px]">event</span>
                                  {new Date(task.dueDate || task.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                              {Array.isArray(task.comments) && task.comments.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[14px]">chat</span>
                                  {task.comments.length}
                                </span>
                              )}
                            </div>

                            {task.assignee ? (
                              <div className="w-6 h-6 rounded-full bg-[#4F46E5] text-white font-semibold text-[10px] flex items-center justify-center border border-white shrink-0" title={task.assignee.name}>
                                {task.assignee.name.charAt(0).toUpperCase()}
                              </div>
                            ) : (
                              <span className="text-[11px] text-[#71717A] italic">Unassigned</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
