'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase, fetchWithAuth, getValidAccessToken } from '../lib/supabase';
import SideNavBar from '../components/SideNavBar';
import TopAppBar from '../components/TopAppBar';
import NotificationsPanel from '../components/NotificationsPanel';
import InviteCodeModal from '../components/InviteCodeModal';
import ReactMarkdown from 'react-markdown';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialAction = searchParams?.get?.('action');

  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'owned' | 'shared'

  // Modals State
  const [showCreateModal, setShowCreateModal] = useState(initialAction === 'create');
  const [showJoinModal, setShowJoinModal] = useState(initialAction === 'join');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Create Project Form State
  const [projectName, setProjectName] = useState('');
  const [projectKeyPoints, setProjectKeyPoints] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [descTab, setDescTab] = useState('edit'); // 'edit' | 'preview'
  const descTextareaRef = React.useRef(null);
  const [suggestedSkills, setSuggestedSkills] = useState([]);
  const [newTechInput, setNewTechInput] = useState('');
  const [isAddingTech, setIsAddingTech] = useState(false);
  const [creating, setCreating] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const [projectType, setProjectType] = useState('Web');
  const [complexity, setComplexity] = useState('MVP');
  const [createError, setCreateError] = useState('');

  // Join Code State
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [joinSuccessState, setJoinSuccessState] = useState(null);

  const [notifications, setNotifications] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [toast, setToast] = useState(null); // { type: 'success' | 'info' | 'error', message: string }

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  useEffect(() => {
    let mounted = true;
    const safetyTimeoutId = setTimeout(() => {
      if (mounted) {
        console.warn('[DashboardContent] Safety timeout (2500ms) fired; unblocking loading state');
        setLoading(false);
      }
    }, 2500);

    fetchSessionAndProjects();

    // Subscribe to live join_requests changes on Dashboard
    const joinChannel = supabase
      .channel('dashboard-join-requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'join_requests' },
        () => {
          if (!mounted) return;
          console.log('[Dashboard Realtime] join_requests change detected');
          fetchUserPendingRequests();
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      clearTimeout(safetyTimeoutId);
      supabase.removeChannel(joinChannel);
    };
  }, []);

  const fetchSessionAndProjects = async () => {
    setLoadError(null);
    try {
      const token = await getValidAccessToken();
      if (!token) {
        setLoading(false);
        window.location.href = '/login';
        return;
      }

      const userRes = await fetchWithAuth('/api/auth/me');
      if (userRes.status === 401) {
        setLoading(false);
        window.location.href = '/login';
        return;
      }
      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData.user);
      }

      const projRes = await fetchWithAuth('/api/projects');
      if (projRes.status === 401) {
        setLoading(false);
        window.location.href = '/login';
        return;
      }

      if (!projRes.ok) {
        throw new Error(`Server returned HTTP ${projRes.status}`);
      }

      const projData = await projRes.json();
      setProjects(projData.projects || []);
      setLoadError(null);

      fetchNotifications();
      fetchUserPendingRequests();
    } catch (err) {
      console.error('Dashboard load sequence error:', err);
      setLoadError(err.message || 'Could not load your active projects.');
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetchWithAuth('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {}
  };

  const fetchUserPendingRequests = async () => {
    try {
      const res = await fetchWithAuth('/api/projects/user-pending-requests');
      if (res.ok) {
        const data = await res.json();
        setPendingRequests(data.pendingRequests || []);
      }
    } catch (err) {}
  };

  const handleGenerateAiDescription = async () => {
    if (!projectName.trim()) {
      setCreateError('Please enter a Project Title first to generate an AI description.');
      return;
    }

    setGeneratingDesc(true);
    setCreateError('');

    try {
      const res = await fetchWithAuth('/api/ai/project-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: projectName.trim(),
          keyPoints: projectDesc.trim() || projectKeyPoints.trim(),
          projectType,
          complexity,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate description');

      if (data.description) {
        setProjectDesc(data.description);
        setDescTab('preview');
        setHasGeneratedOnce(true);
      }
      if (Array.isArray(data.suggestedSkills) && data.suggestedSkills.length > 0) {
        setSuggestedSkills(data.suggestedSkills);
      }

      if (data.isFallback) {
        showToast('info', 'Using basic extraction fallback');
      } else {
        showToast('success', 'Tech stack auto-extracted successfully');
      }
    } catch (err) {
      setCreateError(err.message);
      showToast('error', 'AI generation failed. Please try again.');
    } finally {
      setGeneratingDesc(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    setCreating(true);
    setCreateError('');

    try {
      const res = await fetchWithAuth('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName.trim(),
          description: projectDesc.trim(),
          suggestedSkills: suggestedSkills,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create project');

      setShowCreateModal(false);
      setProjectName('');
      setProjectKeyPoints('');
      setProjectDesc('');
      setSuggestedSkills([]);
      router.push(`/projects/${data.project.id}`);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinProject = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    setJoining(true);
    setJoinError('');

    try {
      const res = await fetchWithAuth('/api/projects/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinCode.trim().toUpperCase() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'This invite code is invalid or has expired');

      if (data.alreadyMember && data.projectId) {
        setShowJoinModal(false);
        setJoinCode('');
        router.push(`/projects/${data.projectId}`);
        return;
      }

      setJoinSuccessState({
        projectName: data.projectName || 'Project Workspace',
        message: data.message || `Your request to join "${data.projectName || 'Project Workspace'}" has been sent. You'll be notified once an Admin approves it.`,
      });

      fetchSessionAndProjects();
    } catch (err) {
      setJoinError(err.message);
    } finally {
      setJoining(false);
    }
  };

  const filteredProjects = projects.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (filterMode === 'owned') return p.owner_id === user?.id;
    if (filterMode === 'shared') return p.owner_id !== user?.id;
    return true;
  });

  // Calculate total unique members across all active projects
  const allMembersSet = new Set();
  projects.forEach((p) => {
    if (Array.isArray(p.members) && p.members.length > 0) {
      p.members.forEach((m) => {
        const uId = m.user?.id || m.userId || m.id;
        if (uId) allMembersSet.add(uId);
      });
    }
  });
  const totalMembersCount = allMembersSet.size || projects.reduce((acc, p) => acc + (p.memberCount || (p.members ? p.members.length : 1)), 0);
  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'Inter, sans-[#18181B]' }} className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6 text-[#18181B]">
        <div style={{ backgroundColor: '#FFFFFF', padding: '32px', borderRadius: '10px', border: '1px solid #E4E4E7', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', maxWidth: '380px', width: '100%' }} className="bg-white p-8 rounded-[10px] border border-[#E4E4E7] shadow-modal text-center flex flex-col items-center gap-4 max-w-sm w-full">
          <div style={{ width: '32px', height: '32px', border: '3px solid #4F46E5', borderTopColor: 'transparent', borderRadius: '50%' }} className="w-8 h-8 border-3 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
          <div className="flex flex-col gap-1">
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#18181B', margin: 0 }} className="text-[18px] font-semibold text-[#18181B]">FlowBoard Workspace</h3>
            <p style={{ fontSize: '13px', color: '#52525B', margin: '4px 0 0 0' }} className="text-[13px] text-[#52525B]">Loading active projects...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex text-on-surface font-body-md">
      {/* Side Navigation Bar */}
      <SideNavBar
        onCreateProject={() => setShowCreateModal(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-[240px]">
        {/* Clean Top App Bar */}
        <TopAppBar
          user={user}
          userRole={user?.role || user?.primaryRole || 'Member'}
          unreadCount={unreadCount}
          onToggleNotifications={() => setShowNotifications(!showNotifications)}
        />

        {/* Workspace Canvas */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto flex flex-col gap-6 max-w-7xl w-full mx-auto">

          {loadError && (
            <div className="p-4 bg-error-container/20 border border-error/30 rounded-xl flex items-center justify-between gap-4 text-error font-body-md">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">warning</span>
                <span>{loadError}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchSessionAndProjects()}
                  className="px-3 py-1 bg-error text-on-error rounded-md text-xs font-bold hover:bg-error/90 cursor-pointer"
                >
                  Retry
                </button>
                <button
                  onClick={() => router.push('/login')}
                  className="px-3 py-1 bg-surface-container-high text-on-surface rounded-md text-xs font-bold hover:bg-surface-container-highest cursor-pointer border border-outline-variant/30"
                >
                  Go to Login
                </button>
              </div>
            </div>
          )}
          
          {/* Header Banner */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#E4E4E7] pb-6">
            <div>
              <h1 className="text-[24px] font-semibold text-[#18181B] tracking-tight">FlowBoard Workspace Dashboard</h1>
              <p className="text-[13px] text-[#52525B] mt-1 font-normal">
                Manage high-density collaborative projects, track milestones, and assign tasks with AI.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowInviteModal(true)}
                className="bg-[#EEF2FF] text-[#4F46E5] border border-[#4F46E5]/20 hover:bg-[#EEF2FF]/80 px-3.5 py-2 rounded-[6px] text-[13px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">key</span> Invite Code
              </button>
              <button
                onClick={() => setShowJoinModal(true)}
                className="bg-white border border-[#E4E4E7] text-[#18181B] hover:bg-[#F4F4F5] px-3.5 py-2 rounded-[6px] text-[13px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">group_add</span> Join Workspace
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-[#4F46E5] hover:bg-[#4338CA] text-white px-3.5 py-2 rounded-[6px] text-[13px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-card"
              >
                <span className="material-symbols-outlined text-[18px]">add</span> New Project
              </button>
            </div>
          </div>

          {/* Member Skill Profile Dashboard Nudge */}
          {user && !user.githubUsername && (!user.skillProfile || Object.keys(user.skillProfile).length === 0) && (
            <div className="p-4 bg-[#EEF2FF] border border-[#4F46E5]/30 rounded-xl flex items-center justify-between gap-4 text-[#4F46E5] shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#4F46E5] text-white flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[18px]">psychology</span>
                </div>
                <div>
                  <h4 className="text-[13px] font-semibold text-[#18181B]">Add your skills for AI task matching</h4>
                  <p className="text-[12px] text-[#52525B]">
                    You haven't added manual skills or connected GitHub yet. Add skills in Account Settings so Admins can match you to relevant board tasks!
                  </p>
                </div>
              </div>
              <a
                href="/profile"
                className="bg-[#4F46E5] text-white px-3.5 py-1.5 rounded-[6px] text-[12px] font-medium hover:bg-[#4338CA] transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">edit</span> Add Skills in Settings
              </a>
            </div>
          )}

          {/* Pending Join Requests Alert Banner */}
          {pendingRequests.length > 0 && (
            <div className="flex flex-col gap-3 p-4 bg-[#FEF3C7] border border-[#FDE68A] rounded-[8px]">
              <div className="flex items-center gap-2 text-[#D97706] font-semibold text-[13px]">
                <span className="material-symbols-outlined text-[18px]">hourglass_top</span>
                <h3 className="uppercase tracking-wider">Pending Join Requests ({pendingRequests.length})</h3>
              </div>
              <div className="flex flex-col gap-2">
                {pendingRequests.map((req) => (
                  <div key={req.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-white rounded-[6px] border border-[#FDE68A]">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-[#D97706] animate-pulse" />
                      <p className="text-[13px] text-[#18181B]">
                        Your request to join <strong className="text-[#4F46E5] font-semibold">"{req.project?.name || 'Project Workspace'}"</strong> has been sent. You'll be notified once an Admin approves it.
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 bg-[#FEF3C7] text-[#D97706] text-[11px] rounded font-medium border border-[#FDE68A] shrink-0">
                      Waiting for Admin Approval
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-[#E4E4E7] p-4 rounded-[8px] flex items-center justify-between shadow-card">
              <div>
                <p className="text-[12px] font-medium text-[#71717A] uppercase tracking-wider">Total Projects</p>
                <h3 className="text-[24px] font-semibold text-[#18181B] mt-1">{projects.length}</h3>
              </div>
              <div className="w-10 h-10 rounded-[6px] bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">folder</span>
              </div>
            </div>

            <div
              onClick={() => {
                const lastId = typeof window !== 'undefined' ? localStorage.getItem('last_project_id') : null;
                const targetProject = projects.find((p) => p.id === lastId) || projects[0];
                if (targetProject) {
                  router.push(`/projects/${targetProject.id}?tab=members`);
                } else {
                  setShowCreateModal(true);
                }
              }}
              className="bg-white border border-[#E4E4E7] hover:border-[#4F46E5] p-4 rounded-[8px] flex items-center justify-between shadow-card cursor-pointer transition-colors group"
              title="Click to view Team Members tab"
            >
              <div>
                <p className="text-[12px] font-medium text-[#71717A] uppercase tracking-wider group-hover:text-[#4F46E5] transition-colors">Team Members</p>
                <h3 className="text-[24px] font-semibold text-[#18181B] mt-1">{totalMembersCount}</h3>
              </div>
              <div className="w-10 h-10 rounded-[6px] bg-[#F4F4F5] text-[#52525B] flex items-center justify-center group-hover:bg-[#EEF2FF] group-hover:text-[#4F46E5] transition-colors">
                <span className="material-symbols-outlined text-[20px]">group</span>
              </div>
            </div>

            <div className="bg-white border border-[#E4E4E7] p-4 rounded-[8px] flex items-center justify-between shadow-card">
              <div>
                <p className="text-[12px] font-medium text-[#71717A] uppercase tracking-wider">Pending Requests</p>
                <h3 className="text-[24px] font-semibold text-[#18181B] mt-1">{pendingRequests.length}</h3>
              </div>
              <div className="w-10 h-10 rounded-[6px] bg-[#FEF3C7] text-[#D97706] flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">pending_actions</span>
              </div>
            </div>
          </div>

          {/* Search & Filter Control Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-[#E4E4E7] p-3 rounded-[8px] shadow-card">
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer ${
                  filterMode === 'all' ? 'bg-[#EEF2FF] text-[#4F46E5]' : 'text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#18181B]'
                }`}
              >
                All Projects ({projects.length})
              </button>
              <button
                onClick={() => setFilterMode('owned')}
                className={`px-3 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer ${
                  filterMode === 'owned' ? 'bg-[#EEF2FF] text-[#4F46E5]' : 'text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#18181B]'
                }`}
              >
                Owned by Me
              </button>
              <button
                onClick={() => setFilterMode('shared')}
                className={`px-3 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer ${
                  filterMode === 'shared' ? 'bg-[#EEF2FF] text-[#4F46E5]' : 'text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#18181B]'
                }`}
              >
                Shared
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <span className="material-symbols-outlined absolute left-3 top-2 text-[#71717A] text-[18px]">search</span>
              <input
                type="text"
                className="pl-9 pr-3 py-1.5 bg-[#F7F7F8] border border-[#E4E4E7] rounded-[6px] text-[13px] text-[#18181B] placeholder-[#71717A] outline-none w-full focus:border-[#4F46E5] focus:bg-white transition-colors"
                placeholder="Filter by title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Clean Project Cards Grid */}
          {filteredProjects.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-[8px] border border-[#E4E4E7] flex flex-col items-center gap-3 shadow-card">
              <span className="material-symbols-outlined text-[40px] text-[#71717A]">folder_open</span>
              <h3 className="text-[18px] font-semibold text-[#18181B]">No Projects Found</h3>
              <p className="text-[14px] text-[#52525B] max-w-md">
                Create a new project or join an existing workspace using a shareable invite code.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-2 bg-[#4F46E5] text-white px-4 py-2 rounded-[6px] text-[13px] font-medium hover:bg-[#4338CA] transition-colors cursor-pointer"
              >
                Create New Project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredProjects.map((p) => {
                const skills = p.suggestedSkills || p.suggested_skills || [];
                const members = p.members || [];
                const isOwner = p.owner_id === user?.id;

                return (
                  <div
                    key={p.id}
                    onClick={() => router.push(`/projects/${p.id}`)}
                    className="bg-white border border-[#E4E4E7] rounded-[8px] p-5 flex flex-col justify-between hover:border-[#4F46E5] transition-colors shadow-card cursor-pointer group"
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <h2 className="text-[16px] font-semibold text-[#18181B] group-hover:text-[#4F46E5] transition-colors line-clamp-1">
                          {p.name}
                        </h2>
                        {isOwner && (
                          <span className="bg-[#EEF2FF] text-[#4F46E5] text-[10px] px-2 py-0.5 rounded-[4px] font-semibold uppercase shrink-0 border border-[#4F46E5]/20">
                            Owner
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <div className="text-[13px] text-[#52525B] line-clamp-2 mb-4 leading-normal">
                        {p.description ? (
                          <ReactMarkdown
                            components={{
                              p: ({ node, ...props }) => <span className="mr-1 inline" {...props} />,
                              strong: ({ node, ...props }) => <strong className="font-semibold text-[#18181B]" {...props} />,
                              h1: ({ node, ...props }) => <strong className="font-semibold text-[#18181B] mr-1" {...props} />,
                              h2: ({ node, ...props }) => <strong className="font-semibold text-[#18181B] mr-1" {...props} />,
                              ul: ({ node, ...props }) => <span className="inline" {...props} />,
                              li: ({ node, ...props }) => <span className="mr-1 inline" {...props} />,
                            }}
                          >
                            {p.description}
                          </ReactMarkdown>
                        ) : (
                          'No description provided.'
                        )}
                      </div>

                      {/* Tech Stack Chips */}
                      {skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {skills.slice(0, 4).map((s) => (
                            <span key={s} className="px-2 py-0.5 bg-[#F4F4F5] text-[#52525B] border border-[#E4E4E7] rounded text-[11px] font-medium">
                              {s}
                            </span>
                          ))}
                          {skills.length > 4 && (
                            <span className="px-2 py-0.5 bg-[#F4F4F5] text-[#71717A] border border-[#E4E4E7] rounded text-[11px] font-medium">
                              +{skills.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Footer Progress & Action */}
                    <div className="pt-4 border-t border-[#E4E4E7] flex items-center justify-between mt-2">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/projects/${p.id}?tab=members`);
                        }}
                        className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer p-1 rounded-md"
                        title="View team members"
                      >
                        <div className="flex -space-x-1.5">
                          {members.slice(0, 3).map((m, idx) => (
                            <div
                              key={idx}
                              className="w-6 h-6 rounded-full bg-[#4F46E5] text-white font-semibold text-[10px] flex items-center justify-center border border-white overflow-hidden shrink-0"
                              title={m.user?.name || 'Member'}
                            >
                              {m.user?.avatarUrl ? (
                                <img src={m.user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                              ) : (
                                (m.user?.name || 'M').charAt(0).toUpperCase()
                              )}
                            </div>
                          ))}
                        </div>
                        <span className="text-[12px] text-[#52525B] font-medium hover:text-[#4F46E5]">
                          {members.length || p.memberCount || 1} member{(members.length || p.memberCount || 1) !== 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="bg-[#4F46E5] text-white px-3 py-1.5 rounded-[6px] text-[12px] font-medium group-hover:bg-[#4338CA] transition-colors flex items-center gap-1 cursor-pointer">
                        Open Board <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Shareable Invite Code Modal for Dashboard */}
      {showInviteModal && (
        <InviteCodeModal
          projects={projects}
          onClose={() => setShowInviteModal(false)}
        />
      )}

      {/* Notifications Slide-Out Panel */}
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

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-lg bg-white rounded-[10px] shadow-modal border border-[#E4E4E7] flex flex-col max-h-[85vh] overflow-hidden">
            {/* Modal Header (Sticky Top) */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-[#E4E4E7] bg-white shrink-0">
              <h2 className="text-[18px] text-[#18181B] font-semibold">Create New Project</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#71717A] hover:text-[#18181B] p-1 rounded-[6px] cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="flex flex-col flex-1 overflow-hidden">
              {/* Scrollable Modal Body */}
              <div className="p-6 flex flex-col gap-4 overflow-y-auto flex-1">
                {createError && (
                  <div className="p-3 bg-[#FEE2E2] border border-[#FECACA] rounded-[6px] text-[#DC2626] text-[13px] font-medium">
                    {createError}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-[#18181B]">Project Name *</label>
                  <input
                    type="text"
                    className="w-full bg-white border border-[#E4E4E7] rounded-[6px] p-2.5 text-[14px] text-[#18181B] placeholder-[#71717A] focus:border-[#4F46E5] outline-none transition-colors"
                    placeholder="e.g. NextGen Enterprise Platform"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2">
                      <label className="text-[13px] font-medium text-[#18181B]">AI Description & Tech Stack</label>
                      {/* Dual-mode Toggle: Edit / Preview */}
                      <div className="flex bg-[#F4F4F5] p-0.5 rounded-[6px] border border-[#E4E4E7]">
                        <button
                          type="button"
                          onClick={() => setDescTab('edit')}
                          className={`px-2 py-0.5 text-[11px] font-medium rounded-[4px] transition-colors cursor-pointer ${
                            descTab === 'edit'
                              ? 'bg-white text-[#18181B] shadow-sm font-semibold'
                              : 'text-[#71717A] hover:text-[#18181B]'
                          }`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDescTab('preview')}
                          className={`px-2 py-0.5 text-[11px] font-medium rounded-[4px] transition-colors cursor-pointer ${
                            descTab === 'preview'
                              ? 'bg-white text-[#18181B] shadow-sm font-semibold'
                              : 'text-[#71717A] hover:text-[#18181B]'
                          }`}
                        >
                          Preview
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 relative">
                      {/* Prompt Refinement Filter Icon Button */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowFilterPopover(!showFilterPopover)}
                          className={`p-1 rounded-[4px] border transition-colors cursor-pointer flex items-center justify-center ${
                            showFilterPopover || projectType !== 'Web' || complexity !== 'MVP'
                              ? 'bg-[#EEF2FF] border-[#4F46E5] text-[#4F46E5]'
                              : 'bg-white border-[#E4E4E7] text-[#71717A] hover:text-[#18181B] hover:border-[#A1A1AA]'
                          }`}
                          title="Prompt refinement options (Project Type & Scope)"
                        >
                          <span className="material-symbols-outlined text-[16px]">tune</span>
                        </button>

                        {/* Popover Dropdown */}
                        {showFilterPopover && (
                          <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-[#E4E4E7] rounded-[8px] shadow-lg p-3 z-30 flex flex-col gap-2.5 text-[12px]">
                            <div className="flex justify-between items-center pb-1.5 border-b border-[#E4E4E7]">
                              <span className="font-semibold text-[#18181B] flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px] text-[#4F46E5]">tune</span>
                                Prompt Refinements
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowFilterPopover(false)}
                                className="text-[#71717A] hover:text-[#18181B]"
                              >
                                <span className="material-symbols-outlined text-[14px]">close</span>
                              </button>
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="font-medium text-[#52525B]">Project Type</label>
                              <select
                                value={projectType}
                                onChange={(e) => setProjectType(e.target.value)}
                                className="w-full bg-[#F9FAFB] border border-[#E4E4E7] rounded-[4px] p-1.5 text-[12px] text-[#18181B] focus:border-[#4F46E5] outline-none"
                              >
                                <option value="Web">Web Application</option>
                                <option value="Mobile">Mobile App (iOS/Android)</option>
                                <option value="Full-Stack">Full-Stack System</option>
                                <option value="AI-ML">AI & Machine Learning</option>
                              </select>
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="font-medium text-[#52525B]">Complexity / Scope</label>
                              <select
                                value={complexity}
                                onChange={(e) => setComplexity(e.target.value)}
                                className="w-full bg-[#F9FAFB] border border-[#E4E4E7] rounded-[4px] p-1.5 text-[12px] text-[#18181B] focus:border-[#4F46E5] outline-none"
                              >
                                <option value="Small Prototype">Small Prototype</option>
                                <option value="MVP">MVP (Minimum Viable Product)</option>
                                <option value="Enterprise Application">Enterprise Application</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Stateful Generate / Regenerate Button */}
                      <button
                        type="button"
                        onClick={handleGenerateAiDescription}
                        disabled={generatingDesc}
                        className="bg-[#EEF2FF] hover:bg-[#E0E7FF] text-[#4F46E5] px-2.5 py-1 rounded-[6px] text-[12px] font-semibold flex items-center gap-1.5 border border-[#4F46E5]/30 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {generatingDesc ? (
                          <>
                            <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                            <span>Generating...</span>
                          </>
                        ) : hasGeneratedOnce ? (
                          <>
                            <span className="material-symbols-outlined text-[14px]">refresh</span>
                            <span>↻ Regenerate</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                            <span>✨ Generate with AI</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {descTab === 'edit' ? (
                    <textarea
                      ref={descTextareaRef}
                      className="w-full bg-white border border-[#E4E4E7] rounded-[6px] p-2.5 text-[14px] text-[#18181B] placeholder-[#71717A] focus:border-[#4F46E5] outline-none resize-none transition-colors overflow-y-auto"
                      style={{ minHeight: '90px', maxHeight: '300px' }}
                      placeholder="Project specifications, tech stack, or objectives..."
                      value={projectDesc}
                      maxLength={1000}
                      onChange={(e) => {
                        if (e.target.value.length <= 1000) {
                          setProjectDesc(e.target.value);
                          if (descTextareaRef.current) {
                            descTextareaRef.current.style.height = 'auto';
                            descTextareaRef.current.style.height = `${Math.min(descTextareaRef.current.scrollHeight, 300)}px`;
                          }
                        }
                      }}
                    />
                  ) : (
                    <div className="w-full bg-[#FAFAFA] border border-[#E4E4E7] rounded-[6px] p-3 text-[13px] text-[#18181B] min-h-[90px] max-h-[300px] overflow-y-auto leading-relaxed prose prose-sm max-w-none">
                      {projectDesc.trim() ? (
                        <ReactMarkdown
                          components={{
                            h1: ({ node, ...props }) => <h1 className="text-[15px] font-bold text-[#18181B] mt-2 mb-1" {...props} />,
                            h2: ({ node, ...props }) => <h2 className="text-[14px] font-bold text-[#18181B] mt-2 mb-1" {...props} />,
                            p: ({ node, ...props }) => <p className="mb-2 text-[#3F3F46]" {...props} />,
                            strong: ({ node, ...props }) => <strong className="font-semibold text-[#18181B]" {...props} />,
                            ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2 pl-1 text-[#3F3F46]" {...props} />,
                            li: ({ node, ...props }) => <li className="mb-0.5" {...props} />,
                          }}
                        >
                          {projectDesc}
                        </ReactMarkdown>
                      ) : (
                        <span className="text-[#A1A1AA] italic">No description to preview yet. Enter text or click "Generate with AI".</span>
                      )}
                    </div>
                  )}

                  {/* Character Counter */}
                  <div className="flex justify-between items-center text-[11px] px-0.5 mt-0.5">
                    <span className="text-[#71717A]">
                      {descTab === 'edit' ? 'Supports markdown syntax' : 'Formatted preview output'}
                    </span>
                    <span
                      className={
                        projectDesc.length >= 1000
                          ? 'text-[#DC2626] font-semibold'
                          : projectDesc.length >= 900
                          ? 'text-[#D97706] font-medium'
                          : 'text-[#71717A]'
                      }
                    >
                      {projectDesc.length} / 1000 chars
                    </span>
                  </div>
                </div>

                {/* Editable Tech Stack Section */}
                <div className="flex flex-col gap-1.5 p-3.5 bg-[#F7F7F8] rounded-[6px] border border-[#E4E4E7]">
                  <div className="flex justify-between items-center">
                    <label className="text-[12px] font-medium text-[#52525B]">Extracted Tech Stack</label>
                    <span className="text-[11px] text-[#71717A]">
                      {suggestedSkills.length} tag{suggestedSkills.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {suggestedSkills.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#EEF2FF] text-[#4F46E5] text-[11px] rounded-[4px] font-semibold border border-[#4F46E5]/20 group"
                      >
                        <span>{s}</span>
                        <button
                          type="button"
                          onClick={() => setSuggestedSkills((prev) => prev.filter((item) => item !== s))}
                          className="text-[#4F46E5]/60 hover:text-[#4F46E5] hover:bg-[#4F46E5]/15 rounded p-0.5 transition-colors cursor-pointer"
                          title={`Remove ${s}`}
                        >
                          <span className="material-symbols-outlined text-[13px] leading-none block">close</span>
                        </button>
                      </span>
                    ))}

                    {isAddingTech ? (
                      <div className="inline-flex items-center gap-1 bg-white border border-[#4F46E5] rounded-[4px] px-1.5 py-0.5 shadow-sm">
                        <input
                          type="text"
                          className="w-24 text-[11px] text-[#18181B] bg-transparent outline-none p-0.5"
                          placeholder="Tech name..."
                          value={newTechInput}
                          onChange={(e) => setNewTechInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const trimmed = newTechInput.trim();
                              if (trimmed && !suggestedSkills.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
                                setSuggestedSkills((prev) => [...prev, trimmed]);
                              }
                              setNewTechInput('');
                              setIsAddingTech(false);
                            } else if (e.key === 'Escape') {
                              setIsAddingTech(false);
                              setNewTechInput('');
                            }
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const trimmed = newTechInput.trim();
                            if (trimmed && !suggestedSkills.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
                              setSuggestedSkills((prev) => [...prev, trimmed]);
                            }
                            setNewTechInput('');
                            setIsAddingTech(false);
                          }}
                          className="text-[#4F46E5] hover:bg-[#EEF2FF] rounded p-0.5 transition-colors cursor-pointer"
                          title="Add tag"
                        >
                          <span className="material-symbols-outlined text-[14px] leading-none block">check</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingTech(false);
                            setNewTechInput('');
                          }}
                          className="text-[#71717A] hover:bg-[#F4F4F5] rounded p-0.5 transition-colors cursor-pointer"
                          title="Cancel"
                        >
                          <span className="material-symbols-outlined text-[14px] leading-none block">close</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsAddingTech(true)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-dashed border-[#A1A1AA] hover:border-[#4F46E5] text-[#52525B] hover:text-[#4F46E5] text-[11px] rounded-[4px] font-medium transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[13px] leading-none">add</span>
                        <span>Add Tech</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Sticky Modal Footer */}
              <div className="px-6 py-4 border-t border-[#E4E4E7] bg-[#FAFAFA] shrink-0 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-[6px] text-[13px] font-medium text-[#52525B] hover:bg-[#E4E4E7] cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="bg-[#4F46E5] text-white px-4 py-2 rounded-[6px] text-[13px] font-medium hover:bg-[#4338CA] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Project Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-md bg-white rounded-[10px] p-6 shadow-modal border border-[#E4E4E7] flex flex-col gap-4">
            <div className="flex justify-between items-center pb-2 border-b border-[#E4E4E7]">
              <h2 className="text-[18px] text-[#18181B] font-semibold">
                {joinSuccessState ? 'Request Submitted' : 'Join Project with Code'}
              </h2>
              <button
                onClick={() => {
                  setShowJoinModal(false);
                  setJoinSuccessState(null);
                  setJoinCode('');
                }}
                className="text-[#71717A] hover:text-[#18181B] p-1 rounded-[6px] cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {joinSuccessState ? (
              <div className="flex flex-col items-center text-center gap-4 py-3">
                <div className="w-12 h-12 rounded-full bg-[#F0FDF4] text-[#16A34A] flex items-center justify-center border border-[#BBF7D0]">
                  <span className="material-symbols-outlined text-[28px]">check_circle</span>
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-[16px] text-[#18181B] font-semibold">Request Sent — Waiting for Admin Approval</h3>
                  <p className="text-[13px] text-[#52525B] max-w-sm mt-1">
                    Your request to join <strong className="text-[#18181B] font-semibold">"{joinSuccessState.projectName}"</strong> has been sent. You'll be notified once an Admin approves it.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowJoinModal(false);
                    setJoinSuccessState(null);
                    setJoinCode('');
                  }}
                  className="mt-2 w-full bg-[#4F46E5] text-white py-2 rounded-[6px] text-[13px] font-medium hover:bg-[#4338CA] transition-colors cursor-pointer"
                >
                  Got it
                </button>
              </div>
            ) : (
              <>
                {joinError && (
                  <div className="p-3 bg-[#FEE2E2] border border-[#FECACA] rounded-[6px] text-[#DC2626] text-[13px] font-medium flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">error</span>
                    <span>{joinError}</span>
                  </div>
                )}

                <form onSubmit={handleJoinProject} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-medium text-[#18181B]">Invite Code *</label>
                    <input
                      type="text"
                      className="w-full bg-white border border-[#E4E4E7] rounded-[6px] p-2.5 text-[16px] text-[#18181B] uppercase tracking-widest font-mono text-center focus:border-[#4F46E5] outline-none transition-colors"
                      placeholder="e.g. PROJ-8823"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E4E7]">
                    <button
                      type="button"
                      onClick={() => setShowJoinModal(false)}
                      className="px-4 py-2 rounded-[6px] text-[13px] font-medium text-[#52525B] hover:bg-[#F4F4F5] cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={joining}
                      className="bg-[#4F46E5] text-white px-4 py-2 rounded-[6px] text-[13px] font-medium hover:bg-[#4338CA] transition-colors cursor-pointer"
                    >
                      {joining ? 'Submitting Request...' : 'Join & View Board'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
      {/* Floating Toast Notification */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 p-3.5 rounded-[8px] border shadow-lg flex items-center justify-between gap-3 transition-all ${
          toast.type === 'success'
            ? 'bg-[#EEF2FF] border-[#4F46E5]/40 text-[#4F46E5]'
            : toast.type === 'info'
            ? 'bg-[#F4F4F5] border-[#E4E4E7] text-[#18181B]'
            : 'bg-[#FEE2E2] border-[#FECACA] text-[#DC2626]'
        }`}>
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <span className="material-symbols-outlined text-[18px]">
              {toast.type === 'success' ? 'check_circle' : toast.type === 'info' ? 'info' : 'error'}
            </span>
            {toast.message}
          </div>
          <button onClick={() => setToast(null)} className="p-1 hover:opacity-70 cursor-pointer">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6 text-[#18181B]">
        <div className="w-6 h-6 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
