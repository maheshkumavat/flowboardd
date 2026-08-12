'use client';

import React, { useState, useEffect } from 'react';
import SkillMatchingModal from './SkillMatchingModal';
import RoleBadge from './RoleBadge';

const SKILL_CATEGORIES = {
  'Frontend': ['React', 'Vue.js', 'Angular', 'Svelte', 'Next.js', 'TypeScript', 'JavaScript', 'HTML/CSS', 'Tailwind CSS'],
  'Backend': ['Node.js', 'Python', 'Java', 'Go', 'Rust', 'C#', 'Express', 'Django', 'Spring Boot'],
  'Database': ['PostgreSQL', 'MongoDB', 'MySQL', 'Redis', 'Supabase', 'SQL', 'Prisma'],
  'DevOps/Infra': ['Docker', 'Kubernetes', 'AWS', 'CI/CD', 'Terraform', 'Linux'],
  'Mobile': ['React Native', 'Flutter', 'iOS / Swift', 'Android / Kotlin'],
  'Design/UI': ['Figma', 'UI/UX Design', 'Design Systems', 'Wireframing']
};

export default function TaskModal({
  task = null,
  projectId = null,
  projectMembers = [],
  columns = [],
  currentUser = null,
  userRole = 'MEMBER',
  initialMode = 'single',
  onClose,
  onUpdate,
  onDelete,
  onCreated,
}) {
  const isViewer = userRole === 'VIEWER';
  const isCreateMode = !task?.id;

  // Creation tab mode: 'single' | 'ai'
  const [createTabMode, setCreateTabMode] = useState(initialMode || 'single');

  // Single Task State
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [priority, setPriority] = useState(task?.priority || 'MEDIUM');
  const [columnId, setColumnId] = useState(task?.columnId || task?.column_id || (columns[0]?.id || ''));
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId || task?.assignee_id || '');
  const [requiredSkill, setRequiredSkill] = useState(task?.requiredSkill || task?.required_skill || '');
  const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.split('T')[0] : (task?.due_date ? task.due_date.split('T')[0] : ''));

  // AI Task Breakdown State (for creation mode)
  const [goal, setGoal] = useState('');
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [subtasks, setSubtasks] = useState([]);
  const [breakdownError, setBreakdownError] = useState('');
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);

  // Comments state
  const [comments, setComments] = useState(task?.comments || []);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // AI Assignment Flow State
  const [showSkillPrompt, setShowSkillPrompt] = useState(false);
  const [promptSkillInput, setPromptSkillInput] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [task?.id]);

  const fetchComments = async () => {
    if (!task?.id) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch (err) {
      console.error('Failed to load comments:', err);
    }
  };

  const handleSaveSingleTask = async (e) => {
    e.preventDefault();
    if (isViewer) return;
    setSaving(true);

    try {
      if (isCreateMode) {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: projectId || task?.projectId || task?.project_id,
            columnId: columnId || (columns[0]?.id || ''),
            title: title.trim(),
            description: description.trim(),
            priority,
            assigneeId: assigneeId || null,
            requiredSkill: requiredSkill || null,
            dueDate: dueDate || null,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (onCreated) onCreated(data.task);
          onClose();
        }
      } else {
        const res = await fetch(`/api/tasks/${task.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description,
            priority,
            columnId,
            assigneeId: assigneeId || null,
            requiredSkill: requiredSkill || null,
            dueDate: dueDate || null,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (onUpdate) onUpdate(data.task);
          onClose();
        }
      }
    } catch (err) {
      console.error('Failed to save task:', err);
    } finally {
      setSaving(false);
    }
  };

  // AI Task Breakdown Handlers
  const handleGenerateBreakdown = async (e) => {
    e.preventDefault();
    if (!goal.trim()) {
      setBreakdownError('Please enter a high-level goal');
      return;
    }

    setLoadingBreakdown(true);
    setBreakdownError('');

    try {
      const res = await fetch('/api/ai/task-breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goal.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate breakdown');

      setSubtasks(data.subtasks || []);
    } catch (err) {
      setBreakdownError(err.message);
    } finally {
      setLoadingBreakdown(false);
    }
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

  const handleConfirmBatchTasks = async () => {
    if (subtasks.length === 0) {
      setBreakdownError('No subtasks to create');
      return;
    }

    setIsSubmittingBatch(true);
    setBreakdownError('');

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch: true,
          projectId: projectId || task?.projectId || task?.project_id,
          columnId: columnId || (columns[0]?.id || ''),
          tasks: subtasks,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create subtasks');

      if (onCreated) onCreated(data.tasks);
      onClose();
    } catch (err) {
      setBreakdownError(err.message);
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || isViewer || !task?.id) return;

    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setComments([...comments, data.comment]);
        setNewComment('');
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleAssignWithAiClick = () => {
    if (isViewer) return;
    if (!requiredSkill || requiredSkill.trim() === '') {
      setShowSkillPrompt(true);
    } else {
      setShowAiModal(true);
    }
  };

  const handleConfirmPromptSkill = () => {
    if (!promptSkillInput.trim()) return;
    setRequiredSkill(promptSkillInput.trim());
    setShowSkillPrompt(false);
    setShowAiModal(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[2px]">
      <div className="w-full max-w-2xl bg-white h-full border-l border-[#E4E4E7] shadow-modal flex flex-col my-0 animate-slide-in">
        
        {/* Top Drawer Navigation Bar */}
        <div className="px-6 py-4 border-b border-[#E4E4E7] flex justify-between items-center bg-[#F7F7F8] shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-[18px] font-semibold text-[#18181B]">
              {isCreateMode ? 'Create Task' : 'Task Details'}
            </h2>

            {isCreateMode && (
              <div className="flex bg-[#F4F4F5] rounded-[6px] border border-[#E4E4E7] p-0.5 ml-2">
                <button
                  type="button"
                  onClick={() => setCreateTabMode('single')}
                  className={`px-3 py-1 text-[12px] font-medium rounded-[4px] transition-colors cursor-pointer ${
                    createTabMode === 'single' ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold' : 'text-[#52525B] hover:text-[#18181B]'
                  }`}
                >
                  Single Task
                </button>
                <button
                  type="button"
                  onClick={() => setCreateTabMode('ai')}
                  className={`px-3 py-1 text-[12px] font-medium rounded-[4px] transition-colors cursor-pointer flex items-center gap-1 ${
                    createTabMode === 'ai' ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold' : 'text-[#52525B] hover:text-[#18181B]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                  AI Breakdown
                </button>
              </div>
            )}

            {!isCreateMode && (
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                  priority === 'HIGH' || priority === 'URGENT'
                    ? 'bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]'
                    : 'bg-[#F4F4F5] text-[#52525B] border-[#E4E4E7]'
                }`}>
                  {priority} Priority
                </span>
                {task?.riskFlag && (
                  <span className="bg-[#FEE2E2] text-[#DC2626] text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 border border-[#FECACA]">
                    <span className="material-symbols-outlined text-[12px]">warning</span> At Risk
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isViewer && !isCreateMode && onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Delete this task?')) onDelete(task.id);
                }}
                className="text-[#DC2626] hover:bg-[#FEE2E2] p-1.5 rounded-[6px] transition-colors cursor-pointer"
                title="Delete Task"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            )}
            <button onClick={onClose} className="text-[#71717A] hover:text-[#18181B] p-1.5 rounded-[6px] cursor-pointer transition-colors">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">

          {/* AI MULTI-TASK BREAKDOWN MODE */}
          {isCreateMode && createTabMode === 'ai' ? (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-[#EEF2FF] border border-[#4F46E5]/20 rounded-[8px] flex items-center gap-3">
                <span className="material-symbols-outlined text-[#4F46E5] text-[20px]">auto_awesome</span>
                <div>
                  <h3 className="text-[14px] font-semibold text-[#18181B]">AI Task Breakdown</h3>
                  <p className="text-[13px] text-[#52525B]">
                    Describe your feature or objective, and AI will decompose it into subtasks with skills & day estimates.
                  </p>
                </div>
              </div>

              {breakdownError && (
                <div className="p-3 bg-[#FEE2E2] border border-[#FECACA] rounded-[6px] text-[#DC2626] text-[13px] font-medium">
                  {breakdownError}
                </div>
              )}

              {subtasks.length === 0 ? (
                <form onSubmit={handleGenerateBreakdown} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-medium text-[#18181B]">High-Level Feature / Goal</label>
                    <textarea
                      className="w-full bg-white border border-[#E4E4E7] rounded-[6px] p-2.5 text-[14px] text-[#18181B] placeholder-[#71717A] focus:border-[#4F46E5] outline-none resize-none transition-colors"
                      rows={4}
                      placeholder="e.g. Implement user authentication with JWT refresh tokens and OAuth"
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-medium text-[#18181B]">Target Column</label>
                    <select
                      className="w-full bg-white border border-[#E4E4E7] rounded-[6px] p-2.5 text-[14px] text-[#18181B] focus:border-[#4F46E5] outline-none transition-colors cursor-pointer"
                      value={columnId}
                      onChange={(e) => setColumnId(e.target.value)}
                    >
                      {columns.map((col) => (
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
                      disabled={loadingBreakdown}
                      className="bg-[#4F46E5] text-white px-4 py-2 rounded-[6px] text-[13px] font-medium hover:bg-[#4338CA] transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                      {loadingBreakdown ? 'Decomposing Goal...' : 'Break Down with AI'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] text-[#52525B]">
                      AI generated <strong>{subtasks.length}</strong> ready subtasks. Review or edit before creating:
                    </span>
                    <button
                      onClick={handleAddSubtaskRow}
                      className="bg-[#F4F4F5] text-[#18181B] border border-[#E4E4E7] text-[12px] font-medium px-2.5 py-1 rounded-[6px] flex items-center gap-1 cursor-pointer hover:bg-[#E4E4E7] transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span> Add Row
                    </button>
                  </div>

                  <div className="flex flex-col gap-2.5 max-h-96 overflow-y-auto pr-1">
                    {subtasks.map((taskItem, idx) => (
                      <div key={idx} className="p-3 bg-[#F7F7F8] rounded-[6px] border border-[#E4E4E7] flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] text-[#4F46E5] font-semibold w-6">#{idx + 1}</span>
                          <input
                            type="text"
                            className="flex-1 bg-white border border-[#E4E4E7] rounded-[6px] p-1.5 text-[13px] text-[#18181B] font-medium outline-none focus:border-[#4F46E5]"
                            value={taskItem.title}
                            onChange={(e) => handleSubtaskChange(idx, 'title', e.target.value)}
                          />
                          <button
                            onClick={() => handleRemoveSubtask(idx)}
                            className="text-[#DC2626] hover:bg-[#FEE2E2] p-1 rounded-[6px] cursor-pointer transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <select
                            className="bg-white border border-[#E4E4E7] rounded-[6px] p-1.5 text-[12px] text-[#18181B] outline-none cursor-pointer"
                            value={taskItem.requiredSkill || ''}
                            onChange={(e) => handleSubtaskChange(idx, 'requiredSkill', e.target.value)}
                          >
                            <option value="">-- Skill Category --</option>
                            {Object.entries(SKILL_CATEGORIES).map(([cat, skills]) => (
                              <optgroup key={cat} label={cat}>
                                <option value={cat}>Category: {cat}</option>
                                {skills.map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>

                          <select
                            className="bg-white border border-[#E4E4E7] rounded-[6px] p-1.5 text-[12px] text-[#18181B] outline-none cursor-pointer"
                            value={taskItem.priority || 'MEDIUM'}
                            onChange={(e) => handleSubtaskChange(idx, 'priority', e.target.value)}
                          >
                            <option value="LOW">LOW</option>
                            <option value="MEDIUM">MEDIUM</option>
                            <option value="HIGH">HIGH</option>
                          </select>

                          <input
                            type="number"
                            className="bg-white border border-[#E4E4E7] rounded-[6px] p-1.5 text-[12px] text-[#18181B] outline-none"
                            placeholder="Est. Days"
                            value={taskItem.estimatedDays || 2}
                            onChange={(e) => handleSubtaskChange(idx, 'estimatedDays', e.target.value)}
                          />
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
                        onClick={handleConfirmBatchTasks}
                        disabled={isSubmittingBatch}
                        className="bg-[#4F46E5] text-white px-4 py-2 rounded-[6px] text-[13px] font-medium hover:bg-[#4338CA] transition-colors cursor-pointer"
                      >
                        {isSubmittingBatch ? 'Creating Tasks...' : `Confirm & Create All (${subtasks.length})`}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* SINGLE TASK FORM (CREATE OR EDIT) */
            <form onSubmit={handleSaveSingleTask} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[#18181B]">Task Title</label>
                <input
                  type="text"
                  readOnly={isViewer}
                  className="w-full bg-white border border-[#E4E4E7] rounded-[6px] p-2.5 text-[15px] font-semibold text-[#18181B] focus:border-[#4F46E5] outline-none transition-colors"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Build User Authentication API"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[#18181B]">Description</label>
                <textarea
                  readOnly={isViewer}
                  className="w-full bg-white border border-[#E4E4E7] rounded-[6px] p-2.5 text-[14px] text-[#18181B] placeholder-[#71717A] focus:border-[#4F46E5] outline-none resize-none transition-colors"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add task specifications and requirements..."
                />
              </div>

              {/* Task Controls Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-[#F7F7F8] rounded-[8px] border border-[#E4E4E7]">
                
                {/* Column Selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-[#18181B]">Column / Status</label>
                  <select
                    disabled={isViewer}
                    className="bg-white border border-[#E4E4E7] rounded-[6px] p-2 text-[13px] text-[#18181B] outline-none cursor-pointer focus:border-[#4F46E5]"
                    value={columnId}
                    onChange={(e) => setColumnId(e.target.value)}
                  >
                    {columns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Priority Selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-[#18181B]">Priority</label>
                  <select
                    disabled={isViewer}
                    className="bg-white border border-[#E4E4E7] rounded-[6px] p-2 text-[13px] text-[#18181B] outline-none cursor-pointer focus:border-[#4F46E5]"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                  </select>
                </div>

                {/* Granular Multi-Category Skill Selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-[#18181B]">Required Skill / Category</label>
                  <select
                    disabled={isViewer}
                    className="bg-white border border-[#E4E4E7] rounded-[6px] p-2 text-[13px] text-[#18181B] outline-none cursor-pointer focus:border-[#4F46E5]"
                    value={requiredSkill}
                    onChange={(e) => setRequiredSkill(e.target.value)}
                  >
                    <option value="">-- Pick Category or Skill --</option>
                    <optgroup label="Categories">
                      <option value="Frontend">Category: Frontend</option>
                      <option value="Backend">Category: Backend</option>
                      <option value="Database">Category: Database</option>
                      <option value="DevOps/Infra">Category: DevOps/Infra</option>
                      <option value="Mobile">Category: Mobile</option>
                      <option value="Design/UI">Category: Design/UI</option>
                    </optgroup>
                    {Object.entries(SKILL_CATEGORIES).map(([cat, skills]) => (
                      <optgroup key={cat} label={`Sub-skills: ${cat}`}>
                        {skills.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <input
                    type="text"
                    readOnly={isViewer}
                    className="bg-white border border-[#E4E4E7] rounded-[6px] p-1.5 text-[13px] text-[#18181B] outline-none focus:border-[#4F46E5] mt-1"
                    placeholder="Or type custom skill (e.g. OAuth, Redis)"
                    value={requiredSkill}
                    onChange={(e) => setRequiredSkill(e.target.value)}
                  />
                </div>

                {/* Due Date */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-[#18181B]">Due Date</label>
                  <input
                    type="date"
                    readOnly={isViewer}
                    className="bg-white border border-[#E4E4E7] rounded-[6px] p-2 text-[13px] text-[#18181B] outline-none focus:border-[#4F46E5]"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>

              </div>

              {/* Assignee Selection Field */}
              <div className="flex flex-col gap-1.5 p-4 bg-[#F7F7F8] rounded-[8px] border border-[#E4E4E7]">
                <div className="flex justify-between items-center">
                  <label className="text-[13px] font-medium text-[#18181B]">Assignee</label>
                  {!isViewer && (
                    <button
                      type="button"
                      onClick={handleAssignWithAiClick}
                      className="text-[#4F46E5] hover:underline text-[12px] flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <span className="material-symbols-outlined text-[15px]">auto_awesome</span>
                      Assign with AI
                    </button>
                  )}
                </div>

                {/* Inline Skill Prompt */}
                {showSkillPrompt && (
                  <div className="p-2.5 bg-[#EEF2FF] border border-[#4F46E5]/30 rounded-[6px] flex items-center gap-2 my-1">
                    <span className="material-symbols-outlined text-[#4F46E5] text-[16px]">info</span>
                    <input
                      type="text"
                      className="flex-1 bg-white border border-[#E4E4E7] rounded p-1 text-[13px] outline-none"
                      placeholder="Enter skill tag (e.g. React, Node.js)"
                      value={promptSkillInput}
                      onChange={(e) => setPromptSkillInput(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={handleConfirmPromptSkill}
                      className="bg-[#4F46E5] text-white px-2.5 py-1 rounded-[4px] text-[12px] font-medium hover:bg-[#4338CA] cursor-pointer"
                    >
                      Match Candidates
                    </button>
                  </div>
                )}

                <select
                  disabled={isViewer}
                  className="w-full bg-white border border-[#E4E4E7] rounded-[6px] p-2.5 text-[13px] text-[#18181B] outline-none cursor-pointer focus:border-[#4F46E5]"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {projectMembers.map((m) => {
                    const mUserId = m.user?.id || m.id;
                    const isMe = currentUser && mUserId === currentUser.id;
                    const isAdmin = userRole === 'ADMIN';
                    const hasGithub = m.user?.githubUsername || (m.user?.skillProfile && Object.keys(m.user.skillProfile).length > 0);

                    if (!isAdmin && !isMe && mUserId !== (task?.assigneeId || task?.assignee_id)) {
                      return null;
                    }

                    return (
                      <option key={mUserId} value={mUserId}>
                        {m.user?.name || 'Member'} ({m.user?.email}) {hasGithub ? ' (GH ✓)' : ''} {isMe ? ' (You)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {!isViewer && (
                <div className="flex justify-end gap-2 mt-2 pt-3 border-t border-[#E4E4E7]">
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-[#4F46E5] text-white px-4 py-2 rounded-[6px] text-[13px] font-medium hover:bg-[#4338CA] transition-colors cursor-pointer"
                  >
                    {saving ? 'Saving...' : isCreateMode ? 'Create Task' : 'Save Changes'}
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Comments Section (only for existing task) */}
          {!isCreateMode && (
            <div className="border-t border-[#E4E4E7] pt-5 flex flex-col gap-4">
              <h3 className="text-[16px] text-[#18181B] font-semibold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">chat</span>
                Comments ({comments.length})
              </h3>

              <div className="flex flex-col gap-2.5 max-h-48 overflow-y-auto pr-1">
                {comments.length === 0 ? (
                  <p className="text-[13px] text-[#71717A] italic">No comments yet. Start the conversation below.</p>
                ) : (
                  comments.map((c) => {
                    const commenterId = c.user?.id || c.user_id;
                    const memberEntry = projectMembers.find((m) => (m.user?.id || m.userId || m.user_id) === commenterId);
                    const commenterRole = memberEntry?.role || 'MEMBER';

                    return (
                      <div key={c.id} className="p-3 bg-[#F7F7F8] rounded-[6px] border border-[#E4E4E7] flex flex-col gap-1">
                        <div className="flex justify-between items-center text-[12px]">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-[#18181B]">{c.user?.name || 'Team Member'}</span>
                            <RoleBadge role={commenterRole} />
                          </div>
                          <span className="text-[#71717A] text-[11px]">{new Date(c.createdAt || c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-[13px] text-[#18181B] mt-0.5">{c.content}</p>
                      </div>
                    );
                  })
                )}
              </div>

              {!isViewer && (
                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 bg-white border border-[#E4E4E7] rounded-[6px] p-2 text-[13px] text-[#18181B] placeholder-[#71717A] outline-none focus:border-[#4F46E5]"
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={submittingComment}
                    className="bg-[#4F46E5] text-white px-4 py-2 rounded-[6px] text-[13px] font-medium hover:bg-[#4338CA] transition-colors cursor-pointer"
                  >
                    Send
                  </button>
                </form>
              )}
            </div>
          )}

        </div>

      </div>

      {/* AI Candidate Ranking Modal */}
      {showAiModal && (
        <SkillMatchingModal
          projectId={projectId || task?.projectId || task?.project_id}
          singleTask={task}
          requiredSkill={requiredSkill}
          userRole={userRole}
          onClose={() => setShowAiModal(false)}
          onAssignCandidate={(tId, selectedUserId) => {
            setAssigneeId(selectedUserId);
            setShowAiModal(false);
          }}
        />
      )}
    </div>
  );
}
