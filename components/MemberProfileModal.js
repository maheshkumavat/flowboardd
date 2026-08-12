'use client';

import React from 'react';
import RoleBadge from './RoleBadge';

const CATEGORIES = ['Frontend', 'Backend', 'Database', 'DevOps/Infra', 'Mobile', 'Design/UI'];

function mapSkillToCategory(skillName) {
  const sLower = skillName.toLowerCase();
  if (sLower.includes('react native') || sLower.includes('flutter') || sLower.includes('swift') || sLower.includes('kotlin') || sLower.includes('ios') || sLower.includes('android')) return 'Mobile';
  if (sLower.includes('figma') || sLower.includes('ui/ux') || sLower.includes('design') || sLower.includes('wireframe')) return 'Design/UI';
  if (sLower.includes('react') || sLower.includes('vue') || sLower.includes('angular') || sLower.includes('svelte') || sLower.includes('next') || sLower.includes('html') || sLower.includes('css') || sLower.includes('tailwind') || sLower.includes('frontend')) return 'Frontend';
  if (sLower.includes('postgres') || sLower.includes('mongo') || sLower.includes('mysql') || sLower.includes('redis') || sLower.includes('sql') || sLower.includes('supabase') || sLower.includes('database')) return 'Database';
  if (sLower.includes('docker') || sLower.includes('k8s') || sLower.includes('kubernetes') || sLower.includes('aws') || sLower.includes('devops') || sLower.includes('ci/cd') || sLower.includes('terraform') || sLower.includes('linux')) return 'DevOps/Infra';
  return 'Backend';
}

function processSkillProfile(profile) {
  const categorized = {
    'Frontend': [],
    'Backend': [],
    'Database': [],
    'DevOps/Infra': [],
    'Mobile': [],
    'Design/UI': [],
  };

  if (!profile || typeof profile !== 'object') return categorized;

  Object.entries(profile).forEach(([key, val]) => {
    if (CATEGORIES.includes(key) && typeof val === 'object' && val !== null) {
      Object.entries(val).forEach(([subSkill, w]) => {
        const numW = typeof w === 'number' ? w : parseFloat(w) || 0.5;
        categorized[key].push({ skill: subSkill, weight: numW });
      });
    } else if (typeof val === 'number' || typeof val === 'string') {
      const cat = mapSkillToCategory(key);
      const numW = typeof val === 'number' ? val : parseFloat(val) || 0.5;
      categorized[cat].push({ skill: key, weight: numW });
    }
  });

  return categorized;
}

export default function MemberProfileModal({ member, onClose }) {
  if (!member) return null;

  const user = member.user || member;
  const name = user.name || user.email?.split('@')[0] || 'Team Member';
  const email = user.email || '';
  const role = member.role || 'MEMBER';
  const githubUsername = user.githubUsername || user.github_username || null;
  const rawSkillProfile = user.skillProfile || user.skill_profile || {};
  
  const categorizedSkills = processSkillProfile(rawSkillProfile);
  const hasSkills = Object.values(categorizedSkills).some((list) => list.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/30 backdrop-blur-[2px] p-4">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl p-xl shadow-[0_10px_24px_rgba(0,0,0,0.12)] border border-outline-variant/30 flex flex-col gap-md max-h-[85vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-md">
            <div className="w-14 h-14 rounded-full bg-primary/10 text-primary font-bold text-xl flex items-center justify-center border border-primary/30 overflow-hidden shrink-0">
              {user.avatarUrl || user.avatar_url ? (
                <img src={user.avatarUrl || user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                name.substring(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <div className="flex items-center gap-xs flex-wrap">
                <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                  {name}
                </h2>
                <RoleBadge role={role} />
              </div>
              {(user.primaryRole || user.primary_role) && (
                <span className="inline-block mt-0.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-[11px] font-bold border border-primary/20">
                  {user.primaryRole || user.primary_role}
                </span>
              )}
              {email && (
                <p className="font-body-md text-body-md text-on-surface-variant text-[13px] mt-0.5">
                  {email}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface p-1 rounded-full cursor-pointer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Project Role Badge */}
        <div className="flex items-center justify-between p-sm bg-surface-container-low rounded-xl border border-outline-variant/20">
          <span className="font-title-md text-title-md text-on-surface font-semibold">Project Role</span>
          <RoleBadge role={role} />
        </div>

        {/* GitHub Connection Info */}
        <div className="flex flex-col gap-xs pt-xs">
          <span className="font-title-md text-title-md text-on-surface font-semibold flex items-center gap-xs">
            <span className="material-symbols-outlined text-[18px]">code</span>
            GitHub Account
          </span>
          {githubUsername ? (
            <div className="flex items-center gap-xs text-primary font-body-md">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              <a
                href={`https://github.com/${githubUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline font-semibold"
              >
                @{githubUsername}
              </a>
            </div>
          ) : (
            <p className="font-body-md text-body-md text-on-surface-variant italic">
              No GitHub account connected.
            </p>
          )}
        </div>

        {/* Granular Multi-Category AI Skill Profile */}
        <div className="flex flex-col gap-sm pt-xs border-t border-outline-variant/30">
          <span className="font-title-md text-title-md text-on-surface font-semibold flex items-center justify-between">
            <span>Granular Skill Profile</span>
            <span className="text-[11px] font-normal text-outline">Categorized from GitHub</span>
          </span>

          {hasSkills ? (
            <div className="flex flex-col gap-xs">
              {CATEGORIES.map((cat) => {
                const items = categorizedSkills[cat] || [];
                if (items.length === 0) return null;

                return (
                  <div key={cat} className="p-xs bg-surface-container-low rounded-lg border border-outline-variant/20">
                    <span className="font-label-sm text-[11px] text-primary font-bold uppercase tracking-wider block mb-1">
                      {cat}
                    </span>
                    <div className="flex flex-wrap gap-xs">
                      {items.map(({ skill, weight }) => (
                        <span
                          key={skill}
                          className="bg-surface-container-lowest text-on-surface font-label-md text-label-md px-2.5 py-0.5 rounded-md border border-outline-variant/30 flex items-center gap-1"
                        >
                          <span className="font-semibold">{skill}</span>
                          <span className="text-[11px] text-primary font-bold">
                            {Math.round(weight * 100)}%
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="font-body-md text-body-md text-on-surface-variant italic">
              No skill profile generated yet.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-md border-t border-outline-variant/30">
          <button
            onClick={onClose}
            className="px-md py-xs rounded-lg font-title-md text-title-md text-on-surface-variant hover:bg-surface-container cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

