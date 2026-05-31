import React from 'react';

const HAIR_PATHS = {
  short:    'M12 4C8 4 6 8 6 12v2h12v-2c0-4-2-8-6-8z',
  long:     'M12 4C8 4 5 8 5 14v2h14v-2c0-6-3-10-7-10z',
  ponytail: 'M12 4C9 4 7 7 7 11v1h10v-1c0-4-2-7-5-7z',
  curly:    'M12 4C7 4 5 8 5 13c0 2 1 3 1 3h12s1-1 1-3c0-5-2-9-7-9z',
  bun:      'M12 4C9 4 7 7 7 11v1h10v-1c0-4-2-7-5-7z',
  bald:     'M12 4C10 4 8 6 8 8h8c0-2-2-4-4-4z',
  mohawk:   'M12 2c0 0-3 2-4 6-1 4 0 6 0 6h8s1-2 0-6c-1-4-4-6-4-6z',
  wavy:     'M12 4C7 4 5 8 5 13s1 3 1 3h12s1 0 1-3c0-5-2-9-7-9z',
};

const BODY_COLORS = {
  male:    { body: '#3b82f6', pants: '#1e40af' },
  female:  { body: '#ec4899', pants: '#9d174d' },
  neutral: { body: '#10b981', pants: '#065f46' },
};

export default function VillagerSprite({ gender = 'male', hairStyle = 'short', hairColor = '#1a1a1a', size = 48, showLabel = false, username = '' }) {
  const bodyColors = BODY_COLORS[gender] || BODY_COLORS.male;
  const hairPath = HAIR_PATHS[hairStyle] || HAIR_PATHS.short;
  const scale = size / 48;

  return (
    <div className="inline-flex flex-col items-center gap-1" style={{ width: size }}>
      {/* SVG Character */}
      <svg
        width={size}
        height={size * 1.2}
        viewBox="0 0 24 28"
        style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))' }}
      >
        {/* Legs */}
        <rect x="8" y="21" width="3" height="6" rx="1" fill={bodyColors.pants} />
        <rect x="13" y="21" width="3" height="6" rx="1" fill={bodyColors.pants} />

        {/* Body */}
        <rect x="6" y="12" width="12" height="10" rx="3" fill={bodyColors.body} />

        {/* Arms */}
        <rect x="2" y="13" width="4" height="3" rx="1.5" fill={bodyColors.body} opacity="0.85" />
        <rect x="18" y="13" width="4" height="3" rx="1.5" fill={bodyColors.body} opacity="0.85" />

        {/* Neck */}
        <rect x="10" y="10" width="4" height="2.5" rx="1" fill="#f5d6c6" />

        {/* Head */}
        <circle cx="12" cy="6" r="5.5" fill="#f5d6c6" />

        {/* Eyes */}
        <circle cx="9.5" cy="5.5" r="1" fill="#333" />
        <circle cx="14.5" cy="5.5" r="1" fill="#333" />

        {/* Eye shine */}
        <circle cx="10" cy="5" r="0.35" fill="white" />
        <circle cx="15" cy="5" r="0.35" fill="white" />

        {/* Hair */}
        <path d={hairPath} fill={hairColor} opacity="0.9" />

        {/* Mouth */}
        <path d="M10 7.5 Q12 9, 14 7.5" stroke="#c97b5a" strokeWidth="0.4" fill="none" />
      </svg>

      {showLabel && username && (
        <span className="text-[9px] font-cinzel text-[#e2e8f0] truncate max-w-full text-center opacity-80">
          {username}
        </span>
      )}
    </div>
  );
}
