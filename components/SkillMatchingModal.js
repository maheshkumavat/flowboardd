'use client';

import React, { useState, useEffect } from 'react';
import RoleBadge from './RoleBadge';

const CATEGORIES = ['All', 'Frontend', 'Backend', 'Database', 'DevOps/Infra', 'Mobile', 'Design/UI'];

const SKILL_CATEGORY_MAP = {
  'Frontend': ['react', 'vue', 'angular', 'svelte', 'next.js', 'typescript', 'javascript', 'html/css', 'html', 'css', 'tailwind', 'frontend', 'ui'],
  'Backend': ['node.js', 'express', 'django', 'ruby on rails', 'ruby', 'python', 'java', 'go', 'rust', 'c#', 'spring boot', 'php', 'typescript', 'backend', 'api'],
  'Database': ['postgresql', 'mongodb', 'mysql', 'redis', 'supabase', 'sql', 'prisma', 'database', 'db', 'plpgsql'],
  'DevOps/Infra': ['docker', 'kubernetes', 'ci/cd', 'aws', 'terraform', 'linux', 'cloudflare', 'devops', 'infra', 'deploy', 'k8s'],
  'Mobile': ['react native', 'swift', 'kotlin', 'flutter', 'ios', 'android', 'mobile'],
  'Design/UI': ['figma', 'design systems', 'ui/ux', 'wireframing', 'design', 'ux']
};

const taskMatchesCategory = (taskSkill, category) => {
  if (!category || category === 'All') return true;
  if (!taskSkill) return false;

  const skillLower = taskSkill.toLowerCase().trim();
  const catLower = category.toLowerCase().trim();

  // Direct exact/substring match
  if (skillLower === catLower || skillLower.includes(catLower) || catLower.includes(skillLower)) {
    return true;
  }

  // Lookup in mapping table
  const mappedSkills = SKILL_CATEGORY_MAP[category] || [];
  return mappedSkills.some((s) => skillLower.includes(s) || s.includes(skillLower));
};

const renderSourceTag = (sourceType) => {
  if (sourceType === 'Self-reported') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FEF9C3] text-[#A16207] text-[10px] font-semibold border border-[#CA8A04]/20" title="Skills self-reported manually in Settings">
        <span className="material-symbols-outlined text-[11px]">edit</span>
        Self-reported
      </span>
    );
  }
  if (sourceType === 'Mixed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F3E8FF] text-[#7E22CE] text-[10px] font-semibold border border-[#7E22CE]/20" title="Skills combined from GitHub and manual entry">
        <span className="material-symbols-outlined text-[11px]">auto_awesome</span>
        Mixed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#EEF2FF] text-[#4F46E5] text-[10px] font-semibold border border-[#4F46E5]/20" title="Skills auto-verified from public GitHub repos">
      <span className="material-symbols-outlined text-[11px]">code</span>
      GitHub-verified
    </span>
  );
};

export default function SkillMatchingModal({
  projectId,
  projectTasks = [],
  singleTask = null,
  requiredSkill = null,
  userRole = 'MEMBER',
  onClose,
  onAssignCandidate,
}) {
  const isAdmin = userRole === 'ADMIN';

  // Determine mode: single task vs multi-task mini hub
  const isSingleTaskMode = Boolean(singleTask || requiredSkill);

  // Selected Category filter for Mini Hub
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTaskId, setSelectedTaskId] = useState(singleTask?.id || null);
  const [candidateSearchQuery, setCandidateSearchQuery] = useState('');

  // Recommendations state: maps taskId or single task to recommendations
  const [taskRecommendations, setTaskRecommendations] = useState({});
  const [unprofiledMap, setUnprofiledMap] = useState({});
  const [loadingMap, setLoadingMap] = useState({});
  const [assigningTaskId, setAssigningTaskId] = useState(null);
  const [error, setError] = useState('');

  // Extract all tasks array if passed as columns array
  const flattenTasks = () => {
    if (!projectTasks || projectTasks.length === 0) return [];
    if (projectTasks[0]?.tasks) {
      return projectTasks.flatMap((col) => col.tasks || []);
    }
    return projectTasks;
  };

  const allTasksList = flattenTasks();
  const unassignedTasks = allTasksList.filter((t) => !t.assigneeId && !t.assignee_id && !t.assignee);
  const tasksToDisplay = unassignedTasks.length > 0 ? unassignedTasks : allTasksList;

  // Filter tasks by selected category using skill category mapping
  const filteredTasks = tasksToDisplay.filter((t) => {
    const req = t.requiredSkill || t.required_skill || '';
    return taskMatchesCategory(req, selectedCategory);
  });

  useEffect(() => {
    if (isSingleTaskMode) {
      const skillToUse = requiredSkill || singleTask?.requiredSkill || singleTask?.required_skill || 'Software Engineering';
      const tId = singleTask?.id || 'single';
      fetchRecommendationsForTask(tId, skillToUse);
    } else {
      if (filteredTasks.length === 0) {
        setSelectedTaskId(null);
      } else {
        const currentlySelectedInFiltered = filteredTasks.find((t) => t.id === selectedTaskId);
        if (!currentlySelectedInFiltered) {
          const firstTask = filteredTasks[0];
          setSelectedTaskId(firstTask.id);
          const skillToUse = firstTask.requiredSkill || firstTask.required_skill || 'Software Engineering';
          fetchRecommendationsForTask(firstTask.id, skillToUse);
        }
      }
    }
  }, [projectId, isSingleTaskMode, selectedCategory, filteredTasks.length]);

  const fetchRecommendationsForTask = async (taskId, skill) => {
    if (taskRecommendations[taskId]) return; // cached

    setLoadingMap((prev) => ({ ...prev, [taskId]: true }));
    setError('');

    try {
      const res = await fetch('/api/ai/recommend-assignees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, requiredSkill: skill }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch recommendations');

      setTaskRecommendations((prev) => ({
        ...prev,
        [taskId]: data.recommendations || [],
      }));
      setUnprofiledMap((prev) => ({
        ...prev,
        [taskId]: data.unprofiledMembers || [],
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMap((prev) => ({ ...prev, [taskId]: false }));
    }
  };

  const handleSelectTaskInHub = (t) => {
    setSelectedTaskId(t.id);
    const skill = t.requiredSkill || t.required_skill || 'Software Engineering';
    fetchRecommendationsForTask(t.id, skill);
  };

  const handleAssignCandidateToTask = async (taskId, candidateUserId) => {
    setAssigningTaskId(taskId);
    try {
      if (onAssignCandidate) {
        await onAssignCandidate(taskId, candidateUserId);
      }
      // Update local task state
      setTaskRecommendations((prev) => {
        const copy = { ...prev };
        delete copy[taskId];
        return copy;
      });
    } catch (err) {
      console.error('Assign candidate error:', err);
    } finally {
      setAssigningTaskId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
      <div className="w-full max-w-4xl bg-white rounded-[10px] p-6 shadow-modal border border-[#E4E4E7] flex flex-col gap-4 max-h-[90vh] overflow-hidden min-h-0">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-2 border-b border-[#E4E4E7] shrink-0">
          <div className="flex items-center gap-2 text-[#4F46E5] font-semibold">
            <span className="material-symbols-outlined text-[20px]">groups</span>
            <div>
              <h2 className="text-[18px] font-semibold text-[#18181B]">
                {isSingleTaskMode ? 'AI Assignee Recommendation' : 'Skill Match Hub'}
              </h2>
              <p className="text-[12px] text-[#52525B] font-normal">
                {isSingleTaskMode
                  ? 'Ranked candidates for this task based on GitHub profiles & tech stack.'
                  : 'Review open board tasks, match candidates by skill category, and assign best fits in one place.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#71717A] hover:text-[#18181B] p-1 rounded-[6px] cursor-pointer transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {error && (
          <div className="p-3 bg-[#FEE2E2] border border-[#FECACA] rounded-[6px] text-[#DC2626] text-[13px] font-medium shrink-0">
            {error}
          </div>
        )}

        {/* SINGLE TASK MODE */}
        {isSingleTaskMode ? (
          <div className="flex flex-col gap-4 overflow-y-auto pr-1 min-h-0">
            <div className="flex items-center justify-between p-3 bg-[#EEF2FF] border border-[#4F46E5]/20 rounded-[8px]">
              <span className="text-[13px] text-[#52525B]">Required Skill Tag:</span>
              <span className="text-[12px] text-[#4F46E5] font-semibold bg-white px-3 py-1 rounded-[6px] border border-[#4F46E5]/30">
                {requiredSkill || singleTask?.requiredSkill || singleTask?.required_skill || 'General Software Engineering'}
              </span>
            </div>

            {loadingMap[singleTask?.id || 'single'] ? (
              <div className="p-8 text-center flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
                <span className="text-[13px] text-[#52525B]">Analyzing candidate skill profiles & match weights...</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 overflow-y-auto min-h-0">
                {isAdmin && (unprofiledMap[singleTask?.id || 'single'] || []).length > 0 && (
                  <div className="p-2.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-[8px] text-[#92400E] text-[11px] flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-medium">
                      <span className="material-symbols-outlined text-[16px] text-[#D97706]">info</span>
                      <span>
                        {unprofiledMap[singleTask?.id || 'single'].length} member{unprofiledMap[singleTask?.id || 'single'].length > 1 ? 's have' : ' has'} no skill profile yet (
                        {unprofiledMap[singleTask?.id || 'single'].map((u) => u.name).join(', ')})
                      </span>
                    </div>
                    <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-[#FCD34D] font-semibold text-[#B45309]">
                      No skill profile yet
                    </span>
                  </div>
                )}

                {((taskRecommendations[singleTask?.id || 'single']) || []).map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => {
                      if (isAdmin && onAssignCandidate) onAssignCandidate(singleTask?.id || 'single', rec.user.id);
                    }}
                    className={`w-full p-4 bg-[#F7F7F8] rounded-[8px] border border-[#E4E4E7] flex items-center justify-between text-left transition-colors ${
                      isAdmin ? 'hover:bg-white hover:border-[#4F46E5] cursor-pointer group' : 'opacity-90'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#4F46E5] text-white font-semibold text-xs flex items-center justify-center shrink-0">
                        {(rec.user.name || 'M').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-[14px] font-semibold text-[#18181B] group-hover:text-[#4F46E5] transition-colors">
                            {rec.user.name}
                          </h4>
                          <RoleBadge role={rec.role || rec.user?.role || 'MEMBER'} />
                        </div>
                        <span className="text-[12px] text-[#52525B]">{rec.user.email}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right flex flex-col items-end gap-1">
                        <span className="text-[14px] text-[#4F46E5] font-semibold block">{rec.matchPercentage}% match</span>
                        {renderSourceTag(rec.sourceType)}
                      </div>
                      {isAdmin && <span className="material-symbols-outlined text-[#71717A] group-hover:text-[#4F46E5] text-[18px]">chevron_right</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* MULTI-TASK MINI HUB MODE */
          <div className="flex-1 flex flex-col gap-4 overflow-hidden min-h-0">
            {/* Category Filter Pills with Clear Filter Button */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 shrink-0">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <span className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider shrink-0 mr-1">Filter Skill:</span>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-[6px] text-[12px] font-medium border transition-colors shrink-0 cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-[#EEF2FF] text-[#4F46E5] border-[#4F46E5]/40 font-semibold'
                        : 'bg-[#F4F4F5] text-[#52525B] hover:bg-[#E4E4E7] border-[#E4E4E7]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {selectedCategory !== 'All' && (
                <button
                  onClick={() => setSelectedCategory('All')}
                  className="px-2.5 py-1 rounded-[6px] text-[11px] bg-[#FEE2E2] text-[#DC2626] hover:bg-[#FEE2E2]/80 border border-[#FECACA] transition-colors shrink-0 cursor-pointer font-medium flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[13px]">clear</span> Clear Filter
                </button>
              )}
            </div>

            {/* Split View: Left = Task List, Right = Candidate Match Panel */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 min-h-0 overflow-hidden">
              
              {/* Left Column: Tasks List */}
              <div className="md:col-span-5 flex flex-col gap-2 overflow-y-auto pr-1 border-r border-[#E4E4E7] min-h-0">
                <div className="flex items-center justify-between pb-1 shrink-0">
                  <span className="text-[13px] text-[#18181B] font-semibold">
                    Tasks ({filteredTasks.length})
                  </span>
                  <span className="text-[11px] text-[#71717A]">
                    {unassignedTasks.length > 0 ? 'Unassigned only' : 'All Board Tasks'}
                  </span>
                </div>

                {filteredTasks.length === 0 ? (
                  <div className="p-4 text-center bg-[#F7F7F8] rounded-[6px] text-[#71717A] text-[13px]">
                    No tasks match category filter.
                  </div>
                ) : (
                  filteredTasks.map((task) => {
                    const isSelected = selectedTaskId === task.id;
                    const reqSkill = task.requiredSkill || task.required_skill || 'General';

                    return (
                      <div
                        key={task.id}
                        onClick={() => handleSelectTaskInHub(task)}
                        className={`p-3 rounded-[8px] border transition-colors cursor-pointer text-left flex flex-col gap-1.5 shrink-0 ${
                          isSelected
                            ? 'bg-[#EEF2FF] border-[#4F46E5]'
                            : 'bg-[#F7F7F8] border-[#E4E4E7] hover:bg-white hover:border-[#D4D4D8]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-[#F4F4F5] text-[#52525B] font-semibold border border-[#E4E4E7]">
                            {task.priority || 'MEDIUM'}
                          </span>
                          <span className="text-[10px] text-[#4F46E5] font-semibold bg-white px-2 py-0.5 rounded border border-[#4F46E5]/20">
                            {reqSkill}
                          </span>
                        </div>
                        <h4 className="text-[13px] text-[#18181B] font-medium line-clamp-1">
                          {task.title}
                        </h4>
                        <div className="flex items-center justify-between text-[11px] text-[#71717A] mt-0.5">
                          <span>Status: <strong>{task.status || 'To Do'}</strong></span>
                          <span>{task.assignee ? `Assigned` : 'Unassigned'}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Right Column: Ranked Candidates Panel */}
              <div className="md:col-span-7 flex flex-col gap-3 overflow-y-auto pr-1 min-h-0">
                {selectedTaskId ? (
                  (() => {
                    const currentTask = allTasksList.find((t) => t.id === selectedTaskId);
                    const rawRecs = taskRecommendations[selectedTaskId] || [];
                    const unprofiled = unprofiledMap[selectedTaskId] || [];
                    const isLoading = loadingMap[selectedTaskId];
                    const reqSkill = currentTask?.requiredSkill || currentTask?.required_skill || 'General Software Engineering';

                    // Sort High to Low by match percentage
                    const sortedRecs = [...rawRecs].sort((a, b) => (b.matchPercentage || b.matchScore || 0) - (a.matchPercentage || a.matchScore || 0));

                    // Live search filter by name or email
                    const filteredRecs = sortedRecs.filter((rec) => {
                      if (!candidateSearchQuery.trim()) return true;
                      const q = candidateSearchQuery.toLowerCase().trim();
                      const name = (rec.user?.name || '').toLowerCase();
                      const email = (rec.user?.email || '').toLowerCase();
                      return name.includes(q) || email.includes(q);
                    });

                    return (
                      <div className="flex flex-col gap-3 min-h-0">
                        <div className="p-3 bg-[#F7F7F8] border border-[#E4E4E7] rounded-[8px] flex items-center justify-between shrink-0">
                          <div>
                            <span className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider block">Candidate Match For Task:</span>
                            <h4 className="text-[14px] text-[#18181B] font-semibold">{currentTask?.title}</h4>
                          </div>
                          <span className="text-[11px] text-[#4F46E5] font-semibold bg-[#EEF2FF] px-2.5 py-1 rounded-[4px] border border-[#4F46E5]/20 shrink-0">
                            {reqSkill}
                          </span>
                        </div>

                        {/* Member Search Bar */}
                        <div className="relative shrink-0">
                          <span className="material-symbols-outlined absolute left-2.5 top-2 text-[#71717A] text-[16px]">
                            search
                          </span>
                          <input
                            type="text"
                            placeholder="Search candidate by name or email..."
                            value={candidateSearchQuery}
                            onChange={(e) => setCandidateSearchQuery(e.target.value)}
                            className="w-full bg-[#F4F4F5] border border-[#E4E4E7] rounded-[6px] pl-8 pr-3 py-1.5 text-[12px] text-[#18181B] outline-none focus:border-[#4F46E5] focus:bg-white transition-colors"
                          />
                        </div>

                        {isAdmin && unprofiled.length > 0 && (
                          <div className="p-2.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-[8px] text-[#92400E] text-[11px] flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-1.5 font-medium">
                              <span className="material-symbols-outlined text-[16px] text-[#D97706]">info</span>
                              <span>
                                {unprofiled.length} member{unprofiled.length > 1 ? 's have' : ' has'} no skill profile yet ({unprofiled.map((u) => u.name).join(', ')})
                              </span>
                            </div>
                            <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-[#FCD34D] font-semibold text-[#B45309]">
                              No skill profile yet
                            </span>
                          </div>
                        )}

                        {isLoading ? (
                          <div className="p-8 text-center flex flex-col items-center gap-2">
                            <div className="w-6 h-6 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
                            <span className="text-[13px] text-[#52525B]">Matching candidate skill profiles...</span>
                          </div>
                        ) : filteredRecs.length === 0 ? (
                          <div className="p-8 text-center bg-[#F7F7F8] rounded-[8px] border border-[#E4E4E7] flex flex-col items-center gap-1.5">
                            <span className="material-symbols-outlined text-[#71717A] text-[28px]">no_accounts</span>
                            <p className="text-[14px] text-[#18181B] font-semibold">
                              {candidateSearchQuery ? 'No Candidates Match Search' : 'No Matching Skill Profiles'}
                            </p>
                            <p className="text-[12px] text-[#52525B]">
                              {candidateSearchQuery
                                ? `No candidates match "${candidateSearchQuery}". Clear search to view all.`
                                : 'Add manual skills in Account Settings or connect GitHub to enable AI candidate ranking.'}
                            </p>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2 overflow-y-auto max-h-[350px] min-h-0 pr-1 pb-4">
                            <p className="text-[12px] text-[#52525B] mb-0.5 shrink-0">
                              {isAdmin ? 'Click "Assign Candidate" to immediately assign candidate to this task:' : 'Ranked Candidate Match:'}
                            </p>
                            {filteredRecs.map((rec) => (
                              <div
                                key={rec.id}
                                className="p-3 bg-[#F7F7F8] rounded-[8px] border border-[#E4E4E7] flex items-center justify-between text-left transition-colors hover:bg-white shrink-0"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-[#4F46E5] text-white font-semibold text-xs flex items-center justify-center shrink-0">
                                    {(rec.user.name || 'M').charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h4 className="text-[13px] text-[#18181B] font-semibold">
                                        {rec.user.name}
                                      </h4>
                                      <RoleBadge role={rec.role || rec.user?.role || 'MEMBER'} />
                                    </div>
                                    <span className="text-[11px] text-[#52525B] block">
                                      {rec.user.email}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  <div className="text-right flex flex-col items-end gap-0.5">
                                    <span className="text-[13px] text-[#4F46E5] font-semibold block">
                                      {rec.matchPercentage}% match
                                    </span>
                                    {renderSourceTag(rec.sourceType)}
                                  </div>
                                  {isAdmin && (
                                    <button
                                      onClick={() => handleAssignCandidateToTask(selectedTaskId, rec.user.id)}
                                      disabled={assigningTaskId === selectedTaskId}
                                      className="bg-[#4F46E5] text-white px-3 py-1.5 rounded-[6px] text-[12px] font-medium hover:bg-[#4338CA] transition-colors cursor-pointer"
                                    >
                                      {assigningTaskId === selectedTaskId ? 'Assigning...' : 'Assign Candidate'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div className="p-8 text-center bg-[#F7F7F8] rounded-[8px] text-[#71717A] text-[13px]">
                    Select a task from the left list to view candidate matches.
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-[#E4E4E7] shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-[6px] text-[13px] font-medium text-[#52525B] hover:bg-[#F4F4F5] cursor-pointer transition-colors"
          >
            Close Panel
          </button>
        </div>

      </div>
    </div>
  );
}
