'use client';

import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../lib/supabase';

export default function TaskTimelineView({
  columns = [],
  canEditTasks = true,
  onTaskClick,
  onAddTask,
  onRefreshProject,
}) {
  const [zoomLevel, setZoomLevel] = useState('Week'); // 'Day' | 'Week' | 'Month'
  const [toastMsg, setToastMsg] = useState('');
  const [toastErr, setToastErr] = useState('');

  // Local drag state for interactive task bars
  // dragState: { taskId, mode: 'move' | 'resize-left' | 'resize-right', initialX, originalStartMs, originalDueMs, currentStartMs, currentDueMs }
  const [dragState, setDragState] = useState(null);

  // Flatten tasks from columns and enrich dates
  const allTasks = columns.flatMap((col) =>
    (col.tasks || []).map((t) => {
      const dueMs = t.dueDate || t.due_date ? new Date(t.dueDate || t.due_date).getTime() : Date.now() + 86400000 * 3;
      
      // Sensible Fallback (Priority 1 requirement #2):
      // If start_date is missing, fallback to task creation date (created_at). If created_at missing, fallback to 3 days prior to due_date.
      let startMs = Date.now();
      if (t.startDate || t.start_date) {
        startMs = new Date(t.startDate || t.start_date).getTime();
      } else if (t.createdAt || t.created_at) {
        startMs = new Date(t.createdAt || t.created_at).getTime();
      } else {
        startMs = dueMs - 86400000 * 3;
      }

      if (startMs > dueMs) startMs = dueMs - 86400000;

      return {
        ...t,
        columnId: col.id,
        columnName: col.name,
        startMs,
        dueMs,
      };
    })
  );

  // Calculate global timeline date boundaries
  const calculateTimelineRange = () => {
    let minMs = Date.now() - 86400000 * 2;
    let maxMs = Date.now() + 86400000 * 14;

    allTasks.forEach((t) => {
      if (t.startMs < minMs) minMs = t.startMs;
      if (t.dueMs > maxMs) maxMs = t.dueMs;
    });

    // Align minMs to midnight
    const minDate = new Date(minMs);
    minDate.setHours(0, 0, 0, 0);

    // Max date + padding
    const maxDate = new Date(maxMs);
    maxDate.setHours(23, 59, 59, 999);
    maxDate.setDate(maxDate.getDate() + 5);

    // Generate daily date objects
    const days = [];
    let curr = new Date(minDate);
    while (curr <= maxDate) {
      days.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }
    return { minDate, days };
  };

  const { minDate, days } = calculateTimelineRange();

  // Pixel Width Per Day based on Zoom Level
  const getDayWidth = () => {
    if (zoomLevel === 'Day') return 60;
    if (zoomLevel === 'Month') return 18;
    return 34; // Week
  };

  const dayWidth = getDayWidth();
  const timelineMinMs = minDate.getTime();

  // Helper: Date to Pixel Offset Formula:
  // msToOffsetPixel(ms) = ((ms - timelineMinMs) / 86400000) * dayWidth
  const msToOffsetPixel = (ms) => {
    const daysDiff = (ms - timelineMinMs) / (1000 * 60 * 60 * 24);
    return daysDiff * dayWidth;
  };

  // Drag Event Handlers for Move and Edge Resize
  const handleMouseDown = (e, task, mode) => {
    if (!canEditTasks) return;
    e.stopPropagation();
    e.preventDefault();

    setDragState({
      taskId: task.id,
      mode,
      initialX: e.clientX,
      originalStartMs: task.startMs,
      originalDueMs: task.dueMs,
      currentStartMs: task.startMs,
      currentDueMs: task.dueMs,
    });
  };

  const handleMouseMove = (e) => {
    if (!dragState) return;

    const deltaX = e.clientX - dragState.initialX;
    const deltaDays = Math.round(deltaX / dayWidth);
    const deltaMs = deltaDays * 86400000;

    let nextStartMs = dragState.originalStartMs;
    let nextDueMs = dragState.originalDueMs;

    if (dragState.mode === 'move') {
      nextStartMs = dragState.originalStartMs + deltaMs;
      nextDueMs = dragState.originalDueMs + deltaMs;
    } else if (dragState.mode === 'resize-left') {
      nextStartMs = Math.min(dragState.originalStartMs + deltaMs, dragState.originalDueMs - 86400000);
    } else if (dragState.mode === 'resize-right') {
      nextDueMs = Math.max(dragState.originalDueMs + deltaMs, dragState.originalStartMs + 86400000);
    }

    setDragState((prev) => ({
      ...prev,
      currentStartMs: nextStartMs,
      currentDueMs: nextDueMs,
    }));
  };

  const handleMouseUp = async () => {
    if (!dragState) return;

    const { taskId, currentStartMs, currentDueMs, originalStartMs, originalDueMs } = dragState;
    setDragState(null);

    // If dates didn't change, skip DB call
    if (currentStartMs === originalStartMs && currentDueMs === originalDueMs) return;

    const startDateIso = new Date(currentStartMs).toISOString().split('T')[0];
    const dueDateIso = new Date(currentDueMs).toISOString().split('T')[0];

    setToastMsg('Saving updated timeline dates...');
    setToastErr('');

    try {
      const res = await fetchWithAuth(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: startDateIso,
          dueDate: dueDateIso,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update task dates');
      }

      setToastMsg(`✓ Dates updated: ${startDateIso} to ${dueDateIso}`);
      if (onRefreshProject) onRefreshProject();
    } catch (err) {
      console.error('Timeline update error:', err);
      setToastErr('Failed to save task dates: ' + err.message);
    } finally {
      setTimeout(() => {
        setToastMsg('');
        setToastErr('');
      }, 4000);
    }
  };

  useEffect(() => {
    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState]);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#FAFAFA] overflow-hidden p-6 gap-4 h-full select-none">
      {/* Toast Banners */}
      {toastMsg && (
        <div className="p-3 bg-[#DCFCE7] border border-[#BBF7D0] text-[#166534] rounded-[8px] text-[13px] font-medium flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#15803D]">check_circle</span>
            <span>{toastMsg}</span>
          </div>
        </div>
      )}
      {toastErr && (
        <div className="p-3 bg-[#FEE2E2] border border-[#FECACA] text-[#DC2626] rounded-[8px] text-[13px] font-medium flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#DC2626]">error</span>
            <span>{toastErr}</span>
          </div>
        </div>
      )}

      {/* Timeline Controls Bar */}
      <div className="flex items-center justify-between bg-white p-3 rounded-[8px] border border-[#E4E4E7] shrink-0 shadow-card">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-[18px] font-semibold text-[#18181B]">Task Timeline (Gantt)</h2>
            <p className="text-[11px] text-[#71717A]">
              Drag task bars to shift dates • Drag edges to adjust start/due duration
            </p>
          </div>
          <div className="flex bg-[#F4F4F5] rounded-[6px] border border-[#E4E4E7] p-0.5 ml-2">
            {['Day', 'Week', 'Month'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setZoomLevel(lvl)}
                className={`px-3 py-1 text-[12px] font-medium rounded-[4px] transition-colors cursor-pointer ${
                  zoomLevel === lvl ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold' : 'text-[#52525B] hover:text-[#18181B]'
                }`}
              >
                {lvl} View
              </button>
            ))}
          </div>
        </div>

        {canEditTasks && (
          <button
            onClick={() => onAddTask && onAddTask(columns[0]?.id)}
            className="bg-[#4F46E5] text-white px-3.5 py-1.5 rounded-[6px] text-[13px] font-medium hover:bg-[#4338CA] transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">add</span> Add Task
          </button>
        )}
      </div>

      {/* Gantt Chart Container */}
      <div className="flex-1 bg-white border border-[#E4E4E7] rounded-[8px] overflow-hidden flex flex-col min-h-0 shadow-card">
        {/* Header Grid */}
        <div className="flex border-b border-[#E4E4E7] bg-[#F7F7F8] shrink-0">
          <div className="w-72 shrink-0 border-r border-[#E4E4E7] p-3 text-[12px] font-semibold text-[#71717A] z-10 bg-[#F7F7F8] flex items-center justify-between">
            <span>Task Name ({allTasks.length})</span>
            <span className="text-[10px] text-[#A1A1AA] font-normal">Status & Priority</span>
          </div>
          
          <div className="flex-1 flex overflow-x-auto text-[11px] text-[#71717A]">
            {days.map((d, idx) => {
              const isToday = new Date().toDateString() === d.toDateString();
              const dayStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });

              return (
                <div
                  key={idx}
                  style={{ width: `${dayWidth}px` }}
                  className={`shrink-0 text-center py-2.5 border-r border-[#E4E4E7] font-medium ${
                    isToday ? 'bg-[#EEF2FF] text-[#4F46E5] font-bold' : 'bg-[#F7F7F8]'
                  }`}
                  title={d.toDateString()}
                >
                  {zoomLevel === 'Month' ? (d.getDate() === 1 ? d.toLocaleDateString('en-US', { month: 'short' }) : d.getDate()) : dayStr}
                </div>
              );
            })}
          </div>
        </div>

        {/* Gantt Body */}
        <div className="flex-1 overflow-auto flex bg-white min-h-0">
          {/* Task List (Left Pane) */}
          <div className="w-72 shrink-0 border-r border-[#E4E4E7] bg-white z-10 flex flex-col">
            {allTasks.length === 0 ? (
              <div className="p-4 text-center text-[#71717A] italic text-[13px]">
                No tasks available.
              </div>
            ) : (
              allTasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => onTaskClick && onTaskClick(t)}
                  className="h-12 border-b border-[#E4E4E7] flex items-center px-3 hover:bg-[#F4F4F5] cursor-pointer transition-colors group shrink-0"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#4F46E5] mr-2">task_alt</span>
                  <div className="flex flex-col truncate">
                    <span className="text-[13px] font-medium text-[#18181B] truncate group-hover:text-[#4F46E5] transition-colors">
                      {t.title}
                    </span>
                    <span className="text-[11px] text-[#71717A]">
                      {t.columnName} • {t.priority || 'MEDIUM'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Timeline Grid (Right Gantt Pane) */}
          <div className="flex-1 relative" style={{ width: `${days.length * dayWidth}px`, minWidth: `${days.length * dayWidth}px` }}>
            {/* Background Grid Vertical Lines */}
            <div className="absolute inset-0 flex pointer-events-none">
              {days.map((d, idx) => {
                const isToday = new Date().toDateString() === d.toDateString();
                return (
                  <div
                    key={idx}
                    style={{ width: `${dayWidth}px` }}
                    className={`border-r border-[#E4E4E7] h-full shrink-0 ${isToday ? 'bg-[#EEF2FF]/30' : ''}`}
                  />
                );
              })}
            </div>

            {/* Gantt Task Duration Bars */}
            <div className="relative w-full">
              {allTasks.map((t) => {
                const isBeingDragged = dragState?.taskId === t.id;
                const startMs = isBeingDragged ? dragState.currentStartMs : t.startMs;
                const dueMs = isBeingDragged ? dragState.currentDueMs : t.dueMs;

                // Date to Pixel Formulas:
                const leftPx = msToOffsetPixel(startMs);
                const durationPx = Math.max(dayWidth, msToOffsetPixel(dueMs) - leftPx + dayWidth);

                const isHigh = t.priority === 'HIGH' || t.priority === 'URGENT';
                const startStr = new Date(startMs).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
                const dueStr = new Date(dueMs).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });

                return (
                  <div key={t.id} className="h-12 border-b border-[#E4E4E7] relative flex items-center shrink-0">
                    <div
                      onMouseDown={(e) => handleMouseDown(e, t, 'move')}
                      style={{ left: `${leftPx}px`, width: `${durationPx}px` }}
                      className={`absolute h-8 rounded-[6px] px-2 flex items-center justify-between border shadow-sm transition-shadow ${
                        canEditTasks ? 'cursor-grab active:cursor-grabbing hover:shadow-md' : 'cursor-pointer'
                      } ${
                        isBeingDragged
                          ? 'bg-[#4F46E5] text-white border-[#3730A3] z-30 shadow-lg scale-[1.01]'
                          : isHigh
                          ? 'bg-[#EEF2FF] text-[#4F46E5] border-[#4F46E5]/40 font-semibold'
                          : 'bg-[#F4F4F5] text-[#18181B] border-[#D4D4D8] font-medium'
                      }`}
                    >
                      {/* Left Edge Resize Handle */}
                      {canEditTasks && (
                        <div
                          onMouseDown={(e) => handleMouseDown(e, t, 'resize-left')}
                          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-[#4F46E5]/40 rounded-l-[6px] flex items-center justify-center group"
                          title="Drag to resize start date"
                        >
                          <div className="w-0.5 h-3 bg-[#71717A] group-hover:bg-[#4F46E5]" />
                        </div>
                      )}

                      {/* Bar Content Label */}
                      <div
                        onClick={() => !isBeingDragged && onTaskClick && onTaskClick(t)}
                        className="flex items-center gap-1.5 truncate px-1 min-w-0"
                      >
                        <span className="text-[11px] truncate">
                          {t.title}
                        </span>
                        <span className="text-[10px] opacity-75 shrink-0">
                          ({startStr} - {dueStr})
                        </span>
                      </div>

                      {/* Assignee Avatar */}
                      {t.assignee && (
                        <div className="w-5 h-5 rounded-full bg-[#4F46E5] text-white font-semibold text-[9px] flex items-center justify-center shrink-0 border border-white ml-1" title={t.assignee.name}>
                          {t.assignee.name.charAt(0).toUpperCase()}
                        </div>
                      )}

                      {/* Right Edge Resize Handle */}
                      {canEditTasks && (
                        <div
                          onMouseDown={(e) => handleMouseDown(e, t, 'resize-right')}
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-[#4F46E5]/40 rounded-r-[6px] flex items-center justify-center group"
                          title="Drag to resize due date"
                        >
                          <div className="w-0.5 h-3 bg-[#71717A] group-hover:bg-[#4F46E5]" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
