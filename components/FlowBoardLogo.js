import React from 'react';

export default function FlowBoardLogo({ className = "w-8 h-8", ...props }) {
  return (
    <svg
      width="200"
      height="200"
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect x="0" y="0" width="200" height="200" rx="44" fill="#4f46e5" />
      <rect x="40" y="112" width="26" height="48" rx="9" fill="#ffffff" opacity="0.55" />
      <rect x="87" y="82" width="26" height="78" rx="9" fill="#ffffff" opacity="0.8" />
      <rect x="134" y="56" width="26" height="104" rx="9" fill="#ffffff" />
      <path
        d="M53,108 C75,90 90,74 100,68 C112,60 130,54 147,50"
        fill="none"
        stroke="#ffffff"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <circle cx="147" cy="50" r="7" fill="#ffffff" />
    </svg>
  );
}
