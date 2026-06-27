export function PortraitSilhouette({ kind }: { kind: "m1" | "f1" | "m2" }) {
  const base = (
    <svg viewBox="0 0 120 120" className="block">
      <defs>
        <pattern id={`hatch-${kind}`} patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="3" stroke="oklch(0 0 0 / 0.18)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="120" height="120" fill={`url(#hatch-${kind})`} />
      <rect x="0" y="0" width="120" height="120" fill="none" stroke="black" strokeWidth="3" />
    </svg>
  );

  const silhouette = {
    m1: (
      <g fill="black">
        <ellipse cx="60" cy="46" rx="18" ry="22" />
        <path d="M28 120 V96 Q60 70 92 96 V120 Z" />
      </g>
    ),
    f1: (
      <g fill="black">
        <ellipse cx="60" cy="44" rx="20" ry="22" />
        <path d="M40 56 Q34 70 38 84 L34 96 Q60 76 86 96 L82 84 Q86 70 80 56 Z" />
        <path d="M26 120 V100 Q60 78 94 100 V120 Z" />
      </g>
    ),
    m2: (
      <g fill="black">
        <ellipse cx="60" cy="48" rx="17" ry="20" />
        <path d="M44 30 Q60 22 76 30 Q72 38 60 36 Q48 38 44 30Z" />
        <path d="M30 120 V98 Q60 74 90 98 V120 Z" />
      </g>
    ),
  }[kind];

  return (
    <div className="relative h-32 w-32 overflow-hidden border-2 border-ink bg-surface-dim">
      {base}
      <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full">
        {silhouette}
      </svg>
    </div>
  );
}
