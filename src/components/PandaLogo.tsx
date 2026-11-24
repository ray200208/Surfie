import React from 'react';

interface PandaLogoProps {
  size?: number;
  className?: string;
}

export const PandaLogo: React.FC<PandaLogoProps> = ({ size = 28, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Surfie Emblem"
    >
      <defs>
        <linearGradient id="ppLogoGrad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#331E6D" />
          <stop offset="100%" stopColor="#1E1B4B" />
        </linearGradient>
        <linearGradient id="ppAccentGrad" x1="6" y1="6" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#D9433B" />
          <stop offset="100%" stopColor="#9B2257" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="10" fill="url(#ppLogoGrad)" />
      {/* Panda Ears */}
      <circle cx="11" cy="11.5" r="4" fill="#1E1B4B" stroke="#FFFFFF" strokeWidth="1.5" />
      <circle cx="25" cy="11.5" r="4" fill="#1E1B4B" stroke="#FFFFFF" strokeWidth="1.5" />
      {/* Panda Face */}
      <circle cx="18" cy="19.5" r="9.5" fill="#FFFFFF" />
      {/* Eye Patches */}
      <ellipse cx="14.2" cy="18.8" rx="2.7" ry="3.2" transform="rotate(-14 14.2 18.8)" fill="#1E1B4B" />
      <ellipse cx="21.8" cy="18.8" rx="2.7" ry="3.2" transform="rotate(14 21.8 18.8)" fill="#1E1B4B" />
      {/* Eyes */}
      <circle cx="14.6" cy="18.3" r="1" fill="#FFFFFF" />
      <circle cx="21.4" cy="18.3" r="1" fill="#FFFFFF" />
      {/* Nose & Pilot Visor Spark */}
      <ellipse cx="18" cy="22.3" rx="1.8" ry="1.2" fill="url(#ppAccentGrad)" />
      <path d="M16 24.5C16.8 25.3 19.2 25.3 20 24.5" stroke="#1E1B4B" strokeWidth="1.3" strokeLinecap="round" />
      {/* Pilot Compass Spark */}
      <circle cx="29.5" cy="6.5" r="3" fill="url(#ppAccentGrad)" />
    </svg>
  );
};
