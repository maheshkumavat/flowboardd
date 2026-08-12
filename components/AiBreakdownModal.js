'use client';

import React, { useState } from 'react';

const SKILL_CATEGORIES = ['Frontend', 'Backend', 'Database', 'DevOps/Infra', 'Mobile', 'Design/UI', 'General'];

const normalizeCategory = (skill) => {
  if (!skill) return 'Backend';
  const sLower = skill.toLowerCase().trim();
  if (SKILL_CATEGORIES.map((c) => c.toLowerCase()).includes(sLower)) {
    return SKILL_CATEGORIES.find((c) => c.toLowerCase() === sLower);
  }
  if (sLower.includes('react') || sLower.includes('vue') || sLower.includes('angular') || sLower.includes('front') || sLower.includes('ui') || sLower.includes('css') || sLower.includes('html')) return 'Frontend';
  if (sLower.includes('postgres') || sLower.includes('sql') || sLower.includes('mongo') || sLower.includes('db') || sLower.includes('data')) return 'Database';
  if (sLower.includes('docker') || sLower.includes('aws') || sLower.includes('devops') || sLower.includes('ci/cd') || sLower.includes('deploy') || sLower.includes('infra')) return 'DevOps/Infra';
  if (sLower.includes('figma') || sLower.includes('design') || sLower.includes('ux')) return 'Design/UI';
  if (sLower.includes('ios') || sLower.includes('android') || sLower.includes('flutter') || sLower.includes('mobile')) return 'Mobile';
  return 'Backend';
};

export default function AiBreakdownModal({ projectId, columnId, columns, onClose, onCreated }) {
  const [goal, setGoal] = useState('');
  const [targetColumnId, setTargetColumnId] = useState(columnId || (columns && columns[0]?.id) || '');
  const [loading, setLoading] = useState(false);
  const [subtasks, setSubtasks] = useState([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState(null);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!goal.trim()) {
      setError('Please enter a high-level goal');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/ai/task-breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goal.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate breakdown');

      const processed = (data.subtasks || []).map((t) => ({
        ...t,
        requiredSkill: normalizeCategory(t.requiredSkill),
        estimatedDays: parseInt(t.estimatedDays) || 2,
        priority: t.priority || 'MEDIUM',
      }));

      setSubtasks(processed);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleSubtaskChange = (index, field, value) => {
    const updated = [...subtasks];
    updated[index][field] = value;
    setSubtasks(updated);
  };

  const handleRemoveSubtask = (index) => {
    setSubtasks(subtasks.filter((_, i) => i !== index));
  };

  const handleAddSubtaskRow = () => {
    setSubtasks([
      ...subtasks,
      {
        title: 'New Subtask',
        description: '',
        requiredSkill: 'Frontend',
        priority: 'MEDIUM',
        estimatedDays: 2,
      },
    ]);
  };

  // Drag and Drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetIdx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) return;

    const updated = [...subtasks];
    const [draggedItem] = updated.splice(draggedIdx, 1);
    updated.splice(targetIdx, 0, draggedItem);

    setSubtasks(updated);
    setDraggedIdx(null);
  };

  const handleConfirmBatch = async () => {
    if (subtasks.length === 0) {
      setError('No subtasks to create');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch: true,
          projectId,
          columnId: targetColumnId,
          tasks: subtasks,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create subtasks');

      if (onCreated) onCreated(data.tasks);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
      <div className="w-full max-w-xl bg-white rounded-[10px] p-6 shadow-modal border border-[#E4E4E7] flex flex-col gap-4">
        
        {/* Header */}
        <div className="flex justify-between items-start pb-2 border-b border-[#E4E4E7]">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-[#4F46E5] font-semibold">
              <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
              <h2 className="text-[18px] text-[#18181B] font-semibold">AI Task Breakdown</h2>
            </div>
            <p className="text-[13px] text-[#52525B] font-normal">
              Describe what you're trying to build, and AI will break it into ready-to-assign tasks.
            </p>
          </div>
          <button onClick={onClose} className="text-[#71717A] hover:text-[#18181B] p-1 rounded-[6px] cursor-pointer transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {error && (
          <div className="p-3 bg-[#FEE2E2] border border-[#FECACA] rounded-[6px] text-[#DC2626] text-[13px] font-medium">
            {error}
          </div>
        )}

        {subtasks.length === 0 ? (
          <form onSubmit={handleGenerate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-[#18181B]">High-Level Objective / Goal</label>
              <textarea
                className="w-full bg-white border border-[#E4E4E7] rounded-[6px] p-2.5 text-[14px] text-[#18181B] placeholder-[#71717A] focus:border-[#4F46E5] outline-none resize-none transition-colors"
                rows={3}
                placeholder="e.g. Build user authentication with email verification & GitHub OAuth"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-[#18181B]">Target Column</label>
              <select
                className="w-full bg-white border border-[#E4E4E7] rounded-[6px] p-2.5 text-[14px] text-[#18181B] focus:border-[#4F46E5] outline-none transition-colors"
                value={targetColumnId}
                onChange={(e) => setTargetColumnId(e.target.value)}
              >
                {(columns || []).map((col) => (
                  <option key={col.id} value={col.id}>{col.name}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E4E7]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-[6px] text-[13px] font-medium text-[#52525B] hover:bg-[#F4F4F5] cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-[#4F46E5] text-white px-4 py-2 rounded-[6px] text-[13px] font-medium hover:bg-[#4338CA] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                {loading ? 'Decomposing Goal...' : 'Break Down with AI'}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-[13px] text-[#52525B]">
                AI generated <strong>{subtasks.length}</strong> ready subtasks. Reorder, edit, or remove:
              </span>
              <button
                onClick={handleAddSubtaskRow}
                className="bg-[#F4F4F5] text-[#18181B] border border-[#E4E4E7] text-[12px] font-medium px-2.5 py-1 rounded-[6px] flex items-center gap-1 cursor-pointer hover:bg-[#E4E4E7] transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">add</span> Add Item
              </button>
            </div>

            {/* Subtask Input List Column Headers */}
            <div className="grid grid-cols-12 gap-2 text-[11px] font-semibold text-[#71717A] uppercase tracking-wider px-3 pb-1 border-b border-[#E4E4E7]">
              <div className="col-span-5 flex items-center gap-2">
                <span className="w-5"></span>
                <span className="w-6">#</span>
                <span>Subtask Title</span>
              </div>
              <div className="col-span-3">Skill Category</div>
              <div className="col-span-2">Priority</div>
              <div className="col-span-2 text-right pr-2">Est. Days</div>
            </div>

            <div className="flex flex-col gap-2.5 max-h-80 overflow-y-auto pr-1">
              {subtasks.map((task, idx) => (
                <div
                  key={idx}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={() => setDraggedIdx(null)}
                  className={`p-3 bg-[#F7F7F8] rounded-[6px] border flex flex-col gap-2 transition-all ${
                    draggedIdx === idx ? 'opacity-40 border-dashed border-[#4F46E5]' : 'border-[#E4E4E7] hover:border-[#D4D4D8]'
                  }`}
                >
                  {/* Top Row: Drag Handle, Numbering, Title, Delete */}
                  <div className="flex items-center gap-2">
                    <span
                      className="material-symbols-outlined text-[18px] text-[#A1A1AA] cursor-grab active:cursor-grabbing hover:text-[#18181B] shrink-0 select-none"
                      title="Drag to reorder subtask"
                    >
                      drag_indicator
                    </span>
                    <span className="text-[13px] text-[#4F46E5] font-semibold w-6 shrink-0">#{idx + 1}</span>
                    <input
                      type="text"
                      className="flex-1 bg-white border border-[#E4E4E7] rounded-[6px] p-1.5 text-[13px] text-[#18181B] font-medium outline-none focus:border-[#4F46E5]"
                      value={task.title}
                      onChange={(e) => handleSubtaskChange(idx, 'title', e.target.value)}
                    />
                    <button
                      onClick={() => handleRemoveSubtask(idx)}
                      className="text-[#DC2626] hover:bg-[#FEE2E2] p-1 rounded-[6px] cursor-pointer transition-colors shrink-0"
                      title="Remove subtask"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>

                  {/* Bottom Row: Skill Category Dropdown, Priority Dropdown, Est. Days Input */}
                  <div className="grid grid-cols-12 gap-2 pl-12 items-center">
                    {/* Skill Category Dropdown */}
                    <div className="col-span-5 flex flex-col gap-1">
                      <select
                        className="w-full bg-white border border-[#E4E4E7] rounded-[6px] p-1.5 text-[12px] text-[#18181B] font-medium outline-none focus:border-[#4F46E5] cursor-pointer"
                        value={normalizeCategory(task.requiredSkill)}
                        onChange={(e) => handleSubtaskChange(idx, 'requiredSkill', e.target.value)}
                      >
                        {SKILL_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    {/* Priority Dropdown */}
                    <div className="col-span-4 flex flex-col gap-1">
                      <select
                        className="w-full bg-white border border-[#E4E4E7] rounded-[6px] p-1.5 text-[12px] text-[#18181B] font-medium outline-none focus:border-[#4F46E5] cursor-pointer"
                        value={task.priority || 'MEDIUM'}
                        onChange={(e) => handleSubtaskChange(idx, 'priority', e.target.value)}
                      >
                        <option value="LOW">LOW</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="HIGH">HIGH</option>
                      </select>
                    </div>

                    {/* Est. Days Field with 'days' Suffix */}
                    <div className="col-span-3 flex items-center gap-1.5 bg-white border border-[#E4E4E7] rounded-[6px] px-2 py-1 focus-within:border-[#4F46E5]">
                      <input
                        type="number"
                        min={1}
                        max={30}
                        className="w-full bg-transparent text-[12px] text-[#18181B] font-medium outline-none text-right"
                        value={task.estimatedDays || 1}
                        onChange={(e) => handleSubtaskChange(idx, 'estimatedDays', parseInt(e.target.value) || 1)}
                      />
                      <span className="text-[11px] text-[#71717A] font-medium select-none shrink-0">days</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-[#E4E4E7]">
              <button
                onClick={() => setSubtasks([])}
                className="text-[13px] text-[#52525B] hover:text-[#18181B] hover:underline cursor-pointer"
              >
                Re-enter Goal
              </button>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-[6px] text-[13px] font-medium text-[#52525B] hover:bg-[#F4F4F5] cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmBatch}
                  disabled={isSubmitting || subtasks.length === 0}
                  className="bg-[#4F46E5] text-white px-4 py-2 rounded-[6px] text-[13px] font-medium hover:bg-[#4338CA] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting
                    ? 'Creating Tasks...'
                    : subtasks.length > 0
                    ? `Confirm & Create All (${subtasks.length})`
                    : 'No subtasks to create'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
