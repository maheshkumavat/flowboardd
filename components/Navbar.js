'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Sparkles, Github, LogOut, User as UserIcon, Plus } from 'lucide-react';
import GitHubConnectModal from './GitHubConnectModal';

export default function Navbar({ user, onUserUpdate, onCreateProject }) {
  const [showGitHubModal, setShowGitHubModal] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <>
      <nav className="glass-nav">
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* Brand Logo */}
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
            }}>
              <Sparkles size={20} color="#fff" />
            </div>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.5px', color: '#fff' }}>
              Collab<span style={{ color: '#8b5cf6' }}>Flow</span>
            </span>
          </Link>

          {/* User Controls */}
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              
              {onCreateProject && (
                <button className="btn btn-primary btn-sm" onClick={onCreateProject}>
                  <Plus size={16} />
                  <span>New Project</span>
                </button>
              )}

              {/* GitHub Connect Button */}
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => setShowGitHubModal(true)}
                style={{
                  borderColor: user.githubUsername ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.15)',
                  color: user.githubUsername ? '#10b981' : '#f3f4f6',
                }}
              >
                <Github size={16} />
                <span>{user.githubUsername ? `@${user.githubUsername}` : 'Connect GitHub'}</span>
              </button>

              {/* User Profile Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700 }}>
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user.name}</span>
              </div>

              {/* Logout */}
              <button className="btn btn-secondary btn-sm" onClick={handleLogout} title="Log out">
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </nav>

      {showGitHubModal && (
        <GitHubConnectModal
          user={user}
          onClose={() => setShowGitHubModal(false)}
          onSuccess={(updatedUser) => {
            if (onUserUpdate) onUserUpdate(updatedUser);
            setShowGitHubModal(false);
          }}
        />
      )}
    </>
  );
}
