'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import FlowBoardLogo from './FlowBoardLogo';

export default function SideNavBar({ onCreateProject, activeProjectId, activeTab = 'board', onSelectTab }) {
  const pathname = usePathname();

  const isDashboard = pathname === '/';
  const isProjectPage = pathname.startsWith('/projects');
  const isProfile = pathname.startsWith('/profile');

  const getKanbanHref = () => {
    if (isProjectPage) return pathname;
    if (activeProjectId) return `/projects/${activeProjectId}`;
    if (typeof window !== 'undefined') {
      const lastId = localStorage.getItem('last_project_id');
      if (lastId) return `/projects/${lastId}`;
    }
    return '/';
  };

  return (
    <aside className="w-[240px] h-screen fixed left-0 top-0 border-r border-[#E4E4E7] bg-white flex flex-col gap-2 py-4 z-50 hidden md:flex">
      {/* Brand Header */}
      <Link href="/" className="px-4 flex items-center gap-3 mb-2 no-underline">
        <FlowBoardLogo className="w-7 h-7 shrink-0" />
        <div className="flex flex-col justify-center">
          <h1 className="text-[16px] font-semibold text-[#18181B] tracking-tight leading-tight">FlowBoard</h1>
        </div>
      </Link>

      {/* New Project CTA */}
      <div className="px-3 mb-2">
        <button
          onClick={onCreateProject}
          className="w-full bg-[#4F46E5] text-white py-2 px-3 rounded-[6px] text-[13px] font-medium hover:bg-[#4338CA] transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">add</span> New Project
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 flex flex-col gap-4">
        {/* Main Nav */}
        <div className="flex flex-col gap-1">
          <Link
            href="/"
            className={`flex items-center gap-3 px-3 py-2 rounded-[6px] text-[13px] transition-colors no-underline ${
              isDashboard ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold' : 'text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#18181B]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">dashboard</span>
            Dashboard
          </Link>
        </div>

        {/* Project Specific Views (Only visible when inside a project workspace) */}
        {isProjectPage && (
          <div className="flex flex-col gap-1 pt-3 border-t border-[#E4E4E7]">
            <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-[#71717A] mb-1">
              Project Views
            </span>

            <button
              onClick={() => onSelectTab && onSelectTab('overview')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-[6px] text-[13px] transition-colors cursor-pointer text-left ${
                activeTab === 'overview' ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold' : 'text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#18181B]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">info</span>
              Overview
            </button>

            <button
              onClick={() => onSelectTab && onSelectTab('board')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-[6px] text-[13px] transition-colors cursor-pointer text-left ${
                activeTab === 'board' ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold' : 'text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#18181B]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">view_kanban</span>
              Kanban Board
            </button>

            <button
              onClick={() => onSelectTab && onSelectTab('list')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-[6px] text-[13px] transition-colors cursor-pointer text-left ${
                activeTab === 'list' ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold' : 'text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#18181B]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
              List View
            </button>

            <button
              onClick={() => onSelectTab && onSelectTab('timeline')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-[6px] text-[13px] transition-colors cursor-pointer text-left ${
                activeTab === 'timeline' ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold' : 'text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#18181B]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">calendar_today</span>
              Timeline
            </button>

            <button
              onClick={() => onSelectTab && onSelectTab('members')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-[6px] text-[13px] transition-colors cursor-pointer text-left ${
                activeTab === 'members' ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold' : 'text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#18181B]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">group</span>
              Team Members
            </button>

            <button
              onClick={() => onSelectTab && onSelectTab('discussions')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-[6px] text-[13px] transition-colors cursor-pointer text-left ${
                activeTab === 'discussions' ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold' : 'text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#18181B]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">forum</span>
              Discussions
            </button>

            <button
              onClick={() => onSelectTab && onSelectTab('analytics')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-[6px] text-[13px] transition-colors cursor-pointer text-left ${
                activeTab === 'analytics' ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold' : 'text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#18181B]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">bar_chart</span>
              Analytics
            </button>

            <button
              onClick={() => onSelectTab && onSelectTab('activity')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-[6px] text-[13px] transition-colors cursor-pointer text-left ${
                activeTab === 'activity' ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold' : 'text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#18181B]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">history</span>
              Activity Log
            </button>

            <button
              onClick={() => onSelectTab && onSelectTab('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-[6px] text-[13px] transition-colors cursor-pointer text-left ${
                activeTab === 'settings' ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold' : 'text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#18181B]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">settings</span>
              Settings
            </button>
          </div>
        )}

        {/* Account Nav */}
        <div className="flex flex-col gap-1 pt-3 border-t border-[#E4E4E7] mt-auto">
          <Link
            href="/profile"
            className={`flex items-center gap-3 px-3 py-2 rounded-[6px] text-[13px] transition-colors no-underline ${
              isProfile ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold' : 'text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#18181B]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">account_circle</span>
            My Profile
          </Link>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="px-4 pt-2 border-t border-[#E4E4E7]">
        <p className="text-[11px] font-medium text-[#71717A] text-center">FlowBoard v2.0</p>
      </div>
    </aside>
  );
}
