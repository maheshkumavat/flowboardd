'use client';

import React from 'react';
import Link from 'next/link';
import FlowBoardLogo from './FlowBoardLogo';

export default function TopAppBar({
  user,
  userRole,
  unreadCount = 0,
  onToggleNotifications,
  onCreateProject,
  onJoinProject,
  onOpenInviteCode,
}) {
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Determine actual display role cleanly from userRole prop, user profile role, or default to Member
  const displayRole = (userRole || user?.role || user?.primaryRole || 'Member').toUpperCase();

  return (
    <header className="h-[64px] bg-white border-b border-[#E4E4E7] px-6 flex items-center justify-between sticky top-0 z-40 w-full flex-shrink-0">
      {/* Search Input */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="relative flex items-center w-full">
          <span className="material-symbols-outlined absolute left-3 text-[#71717A] text-[18px]">search</span>
          <input
            className="pl-9 pr-4 py-1.5 bg-[#F7F7F8] border border-[#E4E4E7] rounded-[6px] text-[13px] text-[#18181B] placeholder-[#71717A] focus:outline-none focus:border-[#4F46E5] focus:bg-white w-full transition-colors"
            placeholder="Search projects, tasks, members..."
            type="text"
          />
        </div>
      </div>

      {/* Brand title on mobile */}
      <div className="flex items-center gap-2 md:hidden">
        <FlowBoardLogo className="w-6 h-6" />
        <h1 className="text-[16px] font-semibold text-[#18181B]">FlowBoard</h1>
      </div>

      {/* Actions & User Avatar */}
      <div className="flex items-center gap-3">
        {onOpenInviteCode && (
          <button
            onClick={onOpenInviteCode}
            className="hidden sm:flex bg-[#EEF2FF] text-[#4F46E5] border border-[#4F46E5]/20 px-3 py-1.5 rounded-[6px] text-[13px] font-medium hover:bg-[#EEF2FF]/80 transition-colors items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">key</span> Invite Code
          </button>
        )}

        {onJoinProject && (
          <button
            onClick={onJoinProject}
            className="hidden sm:flex bg-[#F4F4F5] text-[#18181B] px-3 py-1.5 rounded-[6px] text-[13px] font-medium hover:bg-[#E4E4E7] transition-colors items-center gap-1.5 cursor-pointer border border-[#E4E4E7]"
          >
            <span className="material-symbols-outlined text-[16px]">key</span> Join with Code
          </button>
        )}

        {onCreateProject && (
          <button
            onClick={onCreateProject}
            className="hidden sm:flex bg-[#4F46E5] text-white px-3 py-1.5 rounded-[6px] text-[13px] font-medium hover:bg-[#4338CA] transition-colors items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add</span> Create Project
          </button>
        )}

        {/* Notifications Button */}
        <button
          onClick={onToggleNotifications}
          className="p-2 text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#18181B] transition-colors rounded-[6px] cursor-pointer relative"
          title="Notifications"
        >
          <span className="material-symbols-outlined text-[20px]">notifications</span>
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#4F46E5] rounded-full" />
          )}
        </button>

        {/* User Profile Avatar with Name & Actual Role */}
        {user && (
          <div className="flex items-center gap-2 ml-2 pl-3 border-l border-[#E4E4E7]">
            <Link href="/profile" className="flex items-center gap-2.5 no-underline group">
              <div className="w-8 h-8 rounded-full bg-[#4F46E5] text-white flex items-center justify-center font-semibold text-xs border border-[#E4E4E7] overflow-hidden shrink-0">
                {user.avatarUrl || user.avatar_url ? (
                  <img src={user.avatarUrl || user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  user.name ? user.name.charAt(0).toUpperCase() : 'U'
                )}
              </div>
              <div className="hidden lg:flex flex-col">
                <span className="text-[13px] font-medium text-[#18181B] group-hover:text-[#4F46E5] transition-colors leading-tight">
                  {user.name || user.email?.split('@')[0]}
                </span>
                <span className="text-[10px] text-[#4F46E5] font-semibold uppercase tracking-wider leading-tight">
                  {displayRole}
                </span>
              </div>
            </Link>

            <button
              onClick={handleLogout}
              className="p-1.5 text-[#71717A] hover:bg-[#FEE2E2] hover:text-[#DC2626] transition-colors rounded-[6px] cursor-pointer ml-1"
              title="Log out"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
