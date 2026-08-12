'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { supabase, fetchWithAuth } from '../../../lib/supabase';
import SideNavBar from '../../../components/SideNavBar';
import TopAppBar from '../../../components/TopAppBar';
import NotificationsPanel from '../../../components/NotificationsPanel';
import TaskModal from '../../../components/TaskModal';
import SkillMatchingModal from '../../../components/SkillMatchingModal';
import GitHubConnectModal from '../../../components/GitHubConnectModal';
import MemberProfileModal from '../../../components/MemberProfileModal';
import InviteMemberModal from '../../../components/InviteMemberModal';
import InviteCodeModal from '../../../components/InviteCodeModal';
import ProjectChat from '../../../components/ProjectChat';
import ProjectAnalytics from '../../../components/ProjectAnalytics';
import ActivityFeed from '../../../components/ActivityFeed';

// Stitch Screen Components
import KanbanBoardView from '../../../components/KanbanBoardView';
import TaskListView from '../../../components/TaskListView';
import TaskTimelineView from '../../../components/TaskTimelineView';
import ProjectOverviewView from '../../../components/ProjectOverviewView';
import TeamMembersView from '../../../components/TeamMembersView';
import ProjectSettingsView from '../../../components/ProjectSettingsView';

function ProjectBoardContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.id;
  const isJoinedRedirect = searchParams?.get?.('joined') === 'true';

  const [user, setUser] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterAtRiskOnly, setFilterAtRiskOnly] = useState(false);
  const [showJoinedBanner, setShowJoinedBanner] = useState(isJoinedRedirect);
  const initialTab = searchParams?.get?.('tab') || 'board';
  const [activeTab, setActiveTab] = useState(initialTab); // 'overview' | 'board' | 'list' | 'timeline' | 'members' | 'settings' | 'discussions' | 'analytics' | 'activity'
  const [selectedMemberForModal, setSelectedMemberForModal] = useState(null);
  const [showChatPanel, setShowChatPanel] = useState(false);

  // Modals & Panels state
  const [activeTask, setActiveTask] = useState(null);
  const [showSkillMatching, setShowSkillMatching] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showInviteCodeModal, setShowInviteCodeModal] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [addTaskMode, setAddTaskMode] = useState('single'); // 'single' | 'ai'
  const [showNotifications, setShowNotifications] = useState(false);

  // Notifications & Refresh State
  const [notifications, setNotifications] = useState([]);
  const [realtimeConnected, setRealtimeConnected] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Safety timeout: Never keep workspace blocked behind loading state for more than 2.5s
    const loadingTimeoutId = setTimeout(() => {
      if (isMounted && loading) {
        console.warn('[ProjectBoardContent] 2.5s loading timeout fired; forcing rendering of fetched data');
        setLoading(false);
      }
    }, 2500);

    fetchProjectData();
    fetchNotifications();

    // Clean up any stale pre-existing channels with same topic/name before subscribing
    const channelName = `project-${projectId}`;
    try {
      const activeChannels = supabase.getChannels() || [];
      const staleChannel = activeChannels.find((c) => c.name === channelName || c.topic === `realtime:public:${channelName}`);
      if (staleChannel) {
        supabase.removeChannel(staleChannel);
      }
    } catch (e) {}

    // Supabase Realtime Subscription
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` },
        (payload) => {
          if (!isMounted) return;
          if (payload.eventType === 'INSERT') {
            const newTask = payload.new;
            setProject((prev) => {
              if (!prev) return prev;
              const targetColId = newTask.column_id || newTask.columnId;
              const newCols = prev.columns.map((col) => {
                if (col.id === targetColId || (col.name && newTask.status && col.name.toLowerCase() === newTask.status.toLowerCase())) {
                  const exists = (col.tasks || []).some((t) => t.id === newTask.id);
                  if (exists) return col;
                  const formattedNewTask = {
                    id: newTask.id,
                    projectId: projectId,
                    columnId: col.id,
                    columnName: col.name,
                    title: newTask.title,
                    description: newTask.description,
                    assigneeId: newTask.assignee_id,
                    dueDate: newTask.due_date,
                    priority: newTask.priority || 'MEDIUM',
                    status: col.name,
                    requiredSkill: newTask.required_skill,
                    riskFlag: newTask.risk_flag || false,
                    comments: [],
                  };
                  return { ...col, tasks: [...(col.tasks || []), formattedNewTask] };
                }
                return col;
              });
              return { ...prev, columns: newCols };
            });
          } else if (payload.eventType === 'UPDATE') {
            const rawTask = payload.new;
            setProject((prev) => {
              if (!prev) return prev;
              const targetColId = rawTask.column_id || rawTask.columnId;

              // Find existing task to preserve extra frontend attributes like assignee details
              let existingTask = null;
              (prev.columns || []).forEach((col) => {
                const found = (col.tasks || []).find((t) => t.id === rawTask.id);
                if (found) existingTask = found;
              });

              const mergedTask = {
                ...(existingTask || {}),
                id: rawTask.id,
                projectId: rawTask.project_id || rawTask.projectId || projectId,
                columnId: targetColId,
                title: rawTask.title !== undefined ? rawTask.title : existingTask?.title,
                description: rawTask.description !== undefined ? rawTask.description : existingTask?.description,
                assigneeId: rawTask.assignee_id !== undefined ? rawTask.assignee_id : existingTask?.assigneeId,
                dueDate: rawTask.due_date || rawTask.dueDate || existingTask?.dueDate,
                priority: rawTask.priority || existingTask?.priority || 'MEDIUM',
                status: rawTask.status || existingTask?.status,
                requiredSkill: rawTask.required_skill || rawTask.requiredSkill || existingTask?.requiredSkill,
                riskFlag: rawTask.risk_flag !== undefined ? rawTask.risk_flag : (rawTask.riskFlag !== undefined ? rawTask.riskFlag : existingTask?.riskFlag),
              };

              // Re-parent task cleanly across columns
              const newCols = (prev.columns || []).map((col) => {
                const matchesCol = col.id === targetColId || (col.name && rawTask.status && col.name.toLowerCase() === rawTask.status.toLowerCase());
                const cleanTasks = (col.tasks || []).filter((t) => t.id !== rawTask.id);
                if (matchesCol) {
                  return { ...col, tasks: [...cleanTasks, { ...mergedTask, columnName: col.name, status: col.name }] };
                }
                return { ...col, tasks: cleanTasks };
              });

              return { ...prev, columns: newCols };
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setProject((prev) => {
              if (!prev) return prev;
              const newCols = prev.columns.map((col) => ({
                ...col,
                tasks: (col.tasks || []).filter((t) => t.id !== deletedId),
              }));
              return { ...prev, columns: newCols };
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'join_requests', filter: `project_id=eq.${projectId}` },
        (payload) => {
          if (!isMounted) return;
          console.log('[Realtime] join_requests change detected:', payload.eventType);
          fetchNotifications();
          fetchProjectData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activity_log', filter: `project_id=eq.${projectId}` },
        (payload) => {
          if (!isMounted) return;
          console.log('[Realtime] activity_log change detected:', payload.eventType);
          fetchNotifications();
        }
      )
      .subscribe((status) => {
        if (!isMounted) return;
        if (status === 'SUBSCRIBED') {
          setRealtimeConnected(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setRealtimeConnected(false);
        }
      });

    return () => {
      isMounted = false;
      clearTimeout(loadingTimeoutId);
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const fetchNotifications = async () => {
    try {
      const res = await fetchWithAuth('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {}
  };

  const fetchProjectData = async () => {
    try {
      const userRes = await fetchWithAuth('/api/auth/me');
      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData.user);
      }

      const res = await fetchWithAuth(`/api/projects/${projectId}`);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setLoading(false);
          window.location.href = '/login';
          return;
        }
        throw new Error('Failed to load project board');
      }

      const data = await res.json();
      setProject(data.project);

      if (typeof window !== 'undefined') {
        localStorage.setItem('last_project_id', projectId);
      }
    } catch (err) {
      console.error('Fetch project error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTaskColumn = async (taskId, newColumnId) => {
    try {
      // Optimistic UI update
      setProject((prev) => {
        if (!prev) return prev;
        let movedTask = null;
        const targetCol = prev.columns.find((c) => c.id === newColumnId);
        const targetColName = targetCol ? targetCol.name : '';

        const cleanedCols = prev.columns.map((col) => {
          const t = col.tasks.find((x) => x.id === taskId);
          if (t) movedTask = { ...t, columnId: newColumnId, column_id: newColumnId, columnName: targetColName, status: targetColName };
          return { ...col, tasks: col.tasks.filter((x) => x.id !== taskId) };
        });

        if (!movedTask) return prev;

        const updatedCols = cleanedCols.map((col) => {
          if (col.id === newColumnId) {
            return { ...col, tasks: [...col.tasks, movedTask] };
          }
          return col;
        });

        return { ...prev, columns: updatedCols };
      });

      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columnId: newColumnId }),
      });

      if (!res.ok) {
        fetchProjectData();
      }
    } catch (err) {
      console.error('Update task column error:', err);
      fetchProjectData();
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'Inter, sans-serif' }} className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6 text-[#18181B]">
        <div style={{ backgroundColor: '#FFFFFF', padding: '32px', borderRadius: '10px', border: '1px solid #E4E4E7', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', maxWidth: '380px', width: '100%' }} className="bg-white p-8 rounded-[10px] border border-[#E4E4E7] shadow-modal text-center flex flex-col items-center gap-4 max-w-sm w-full">
          <div style={{ width: '32px', height: '32px', border: '3px solid #4F46E5', borderTopColor: 'transparent', borderRadius: '50%' }} className="w-8 h-8 border-3 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
          <div className="flex flex-col gap-1">
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#18181B', margin: 0 }} className="text-[18px] font-semibold text-[#18181B]">Loading Project Workspace</h3>
            <p style={{ fontSize: '13px', color: '#52525B', margin: '4px 0 0 0' }} className="text-[13px] text-[#52525B]">Syncing project workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6 text-on-surface">
        <div className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant text-center max-w-md w-full flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-[48px] text-error">error</span>
          <h2 className="font-h1 text-h1 font-bold text-on-surface">Project Not Found</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            You may not have permission to view this project or it has been deleted.
          </p>
          <a href="/" className="bg-primary text-on-primary px-4 py-2 rounded-md font-label-md text-label-md hover:bg-primary-container no-underline">
            Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  const currentUserRole = project.userRole || 'MEMBER';
  const isAdmin = currentUserRole === 'ADMIN';
  const canEditTasks = currentUserRole === 'ADMIN' || currentUserRole === 'MEMBER';

  const allProjectTasks = (project.columns || []).flatMap((col) => col.tasks || []);
  const atRiskTasksCount = allProjectTasks.filter((t) => Boolean(t.riskFlag || t.risk_flag)).length;
  const unreadCount = notifications.filter((n) => !n.read).length;

  const renderMainCanvas = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <ProjectOverviewView
            project={project}
            canEditTasks={canEditTasks}
            onSelectTab={(tab) => setActiveTab(tab)}
            onAddTask={(colId) => {
              setAddTaskMode('single');
              setShowAddTaskModal(true);
            }}
          />
        );
      case 'board':
        return (
          <KanbanBoardView
            columns={project.columns}
            canEditTasks={canEditTasks}
            onTaskClick={(t) => setActiveTask(t)}
            onAddTask={(colId) => {
              setAddTaskMode('single');
              setShowAddTaskModal(true);
            }}
            onAiBreakdown={() => {
              setAddTaskMode('ai');
              setShowAddTaskModal(true);
            }}
            onSkillMatch={() => setShowSkillMatching(true)}
            onUpdateTaskColumn={handleUpdateTaskColumn}
            filterAtRiskOnly={filterAtRiskOnly}
            setFilterAtRiskOnly={setFilterAtRiskOnly}
            atRiskCount={atRiskTasksCount}
          />
        );
      case 'list':
        return (
          <TaskListView
            columns={project.columns}
            projectMembers={project.members}
            canEditTasks={canEditTasks}
            onTaskClick={(t) => setActiveTask(t)}
            onAddTask={(colId) => {
              setAddTaskMode('single');
              setShowAddTaskModal(true);
            }}
            onUpdateTaskColumn={handleUpdateTaskColumn}
          />
        );
      case 'timeline':
        return (
          <TaskTimelineView
            columns={project.columns}
            canEditTasks={canEditTasks}
            onTaskClick={(t) => setActiveTask(t)}
            onAddTask={(colId) => {
              setAddTaskMode('single');
              setShowAddTaskModal(true);
            }}
            onRefreshProject={fetchProjectData}
          />
        );
      case 'members':
        return (
          <TeamMembersView
            projectId={projectId}
            members={project.members}
            currentUser={user}
            userRole={currentUserRole}
            onUpdateMembers={(updatedMembers) => {
              setProject((prev) => (prev ? { ...prev, members: updatedMembers } : prev));
            }}
            onOpenInviteModal={() => setShowInviteCodeModal(true)}
            onSelectMemberProfile={(m) => setSelectedMemberForModal(m)}
          />
        );
      case 'settings':
        return (
          <ProjectSettingsView
            projectId={projectId}
            projectName={project.name}
            projectDescription={project.description}
            userRole={currentUserRole}
            onUpdateProject={(updatedProj) => {
              setProject((prev) => (prev ? { ...prev, name: updatedProj.name, description: updatedProj.description } : prev));
            }}
          />
        );
      case 'discussions':
        return (
          <div className="flex-1 p-6 bg-background overflow-hidden min-h-0 flex flex-col">
            <ProjectChat
              projectId={projectId}
              members={project.members || []}
              currentUser={user}
              onSelectUser={(u) => setSelectedMemberForModal(u)}
              isFloating={false}
            />
          </div>
        );
      case 'analytics':
        return (
          <div className="flex-1 p-6 bg-background overflow-y-auto">
            <ProjectAnalytics
              project={project}
              tasks={allProjectTasks}
              members={project.members || []}
            />
          </div>
        );
      case 'activity':
        return (
          <div className="flex-1 p-6 bg-background overflow-y-auto w-full">
            <ActivityFeed projectId={projectId} onClose={() => setActiveTab('board')} isDrawer={false} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex text-on-surface font-body-md">
      {/* Side Navigation Bar */}
      <SideNavBar
        onCreateProject={() => (window.location.href = '/?action=create')}
        activeProjectId={projectId}
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-[240px] h-screen overflow-hidden">
        {/* Clean Top App Bar with User Role Badge */}
        <TopAppBar
          user={user}
          userRole={currentUserRole}
          unreadCount={unreadCount}
          onToggleNotifications={() => setShowNotifications(!showNotifications)}
          onOpenInviteCode={() => setShowInviteCodeModal(true)}
        />

        {/* View Canvas Container */}
        <div className="flex-1 flex overflow-hidden relative">
          {renderMainCanvas()}
        </div>
      </div>

      {/* Floating Persistent Chat Widget */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {showChatPanel ? (
          <ProjectChat
            projectId={projectId}
            members={project.members || []}
            currentUser={user}
            onSelectUser={(u) => setSelectedMemberForModal(u)}
            onClose={() => setShowChatPanel(false)}
            isFloating={true}
          />
        ) : (
          <button
            onClick={() => setShowChatPanel(true)}
            className="bg-primary text-on-primary p-3.5 rounded-full shadow-md hover:scale-105 transition-all flex items-center justify-center gap-2 cursor-pointer border border-surface"
            title="Open Team Chat"
          >
            <span className="material-symbols-outlined text-[24px]">chat</span>
            <span className="font-label-md text-label-md font-bold pr-1">Team Chat</span>
          </button>
        )}
      </div>

      {/* Shareable Invite Code Modal */}
      {showInviteCodeModal && (
        <InviteCodeModal
          projectId={projectId}
          onClose={() => setShowInviteCodeModal(false)}
        />
      )}

      {/* Slide-out Notifications Panel */}
      {showNotifications && (
        <NotificationsPanel
          notifications={notifications}
          onClose={() => setShowNotifications(false)}
          onMarkAllRead={async () => {
            setNotifications([]);
            try {
              await fetchWithAuth('/api/notifications', { method: 'DELETE' });
            } catch (e) {}
          }}
          onNotificationUpdated={fetchNotifications}
        />
      )}

      {/* Task Details Side Panel Drawer */}
      {activeTask && (
        <TaskModal
          task={activeTask}
          projectId={projectId}
          projectMembers={project.members}
          columns={project.columns}
          currentUser={user}
          userRole={currentUserRole}
          onClose={() => setActiveTask(null)}
          onUpdate={(updatedTask) => {
            fetchProjectData();
            setActiveTask(null);
          }}
          onDelete={(deletedTaskId) => {
            fetchProjectData();
            setActiveTask(null);
          }}
        />
      )}

      {/* AI Skill Matching Modal / Mini Hub */}
      {showSkillMatching && (
        <SkillMatchingModal
          projectId={projectId}
          projectTasks={project.columns}
          singleTask={activeTask}
          userRole={currentUserRole}
          onClose={() => setShowSkillMatching(false)}
          onAssignCandidate={async (taskId, candidateUserId) => {
            if (canEditTasks) {
              try {
                const targetId = taskId === 'single' ? activeTask?.id : taskId;
                if (!targetId) return;

                const res = await fetch(`/api/tasks/${targetId}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ assigneeId: candidateUserId }),
                });
                if (res.ok) {
                  fetchProjectData();
                }
              } catch (e) {
                console.error('Assign candidate error:', e);
              }
            }
          }}
        />
      )}

      {/* Unified Add Task Modal Overlay */}
      {showAddTaskModal && canEditTasks && (
        <TaskModal
          task={null}
          projectId={projectId}
          projectMembers={project.members}
          columns={project.columns}
          currentUser={user}
          userRole={currentUserRole}
          initialMode={addTaskMode}
          onClose={() => setShowAddTaskModal(false)}
          onCreated={() => fetchProjectData()}
        />
      )}

      {/* Member Profile Modal */}
      {selectedMemberForModal && (
        <MemberProfileModal
          member={selectedMemberForModal}
          onClose={() => setSelectedMemberForModal(null)}
        />
      )}
    </div>
  );
}

export default function ProjectPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface flex items-center justify-center p-6 text-on-surface">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ProjectBoardContent />
    </Suspense>
  );
}
