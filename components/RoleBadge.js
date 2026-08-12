'use client';

import React from 'react';

export default function RoleBadge({ role = 'MEMBER', className = '' }) {
  const normalizedRole = (role || 'MEMBER').toUpperCase();

  let styleClasses = 'bg-secondary-container/30 text-on-secondary-container border-secondary-container/40';

  if (normalizedRole === 'ADMIN') {
    styleClasses = 'bg-primary/20 text-primary border-primary/30';
  } else if (normalizedRole === 'VIEWER') {
    styleClasses = 'bg-surface-container-high text-on-surface-variant border-outline-variant/30';
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-label-sm text-[10px] uppercase border font-bold ${styleClasses} ${className}`}>
      {normalizedRole}
    </span>
  );
}
