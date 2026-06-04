import { VIEW } from '@/lib/site-config';

/**
 * Logo — view-aware brand mark. Mirrors the per-repo `icon.svg`:
 *
 *   - Graph view (gold accent): circular brass annulus with halving
 *     notches at the compass quadrants; five peripheral nodes
 *     connected to a central gold ₿ node, plus inter-peripheral
 *     edges — a force-directed network silhouette.
 *
 *   - Grid view (brass accent): square brass frame with corner
 *     rivets; 3×3 tile arrangement around a central gold ₿ tile,
 *     with brass-toned satellite tiles — a spiral-real-estate
 *     silhouette.
 *
 * Pure SVG, no external font (uses system serif for the ₿ glyph).
 * Both variants share the brass linear gradient + dark `#08080C`
 * background so they read as a single visual family.
 */

interface LogoProps {
  /** Square edge length in CSS pixels. Defaults to 32. */
  size?: number;
  /** Optional aria label override. */
  label?: string;
}

export function Logo({ size = 32, label }: LogoProps) {
  return VIEW === 'graph' ? (
    <GraphLogo size={size} label={label ?? 'Timechain Graph logo'} />
  ) : (
    <GridLogo size={size} label={label ?? 'Timechain Grid logo'} />
  );
}

function GraphLogo({ size, label }: { size: number; label: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={label}
      style={{ flexShrink: 0 }}
    >
      <defs>
        <radialGradient id="logo-graph-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255, 215, 0, 0.32)" />
          <stop offset="60%" stopColor="rgba(255, 215, 0, 0.10)" />
          <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
        </radialGradient>
        <linearGradient id="logo-graph-brass" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E0A656" />
          <stop offset="50%" stopColor="#C28840" />
          <stop offset="100%" stopColor="#8C5E29" />
        </linearGradient>
      </defs>

      <circle cx="50" cy="50" r="49" fill="#08080C" />
      <circle cx="50" cy="50" r="47" fill="none" stroke="url(#logo-graph-brass)" strokeWidth="2.8" />

      {/* Halving notches at compass quadrants */}
      <rect x="49" y="1" width="2" height="5" fill="#E0A656" />
      <rect x="49" y="94" width="2" height="5" fill="#E0A656" />
      <rect x="1" y="49" width="5" height="2" fill="#E0A656" />
      <rect x="94" y="49" width="5" height="2" fill="#E0A656" />

      {/* Diagonal accent rivets */}
      <circle cx="22.5" cy="22.5" r="1.4" fill="#8C5E29" />
      <circle cx="77.5" cy="22.5" r="1.4" fill="#8C5E29" />
      <circle cx="22.5" cy="77.5" r="1.4" fill="#8C5E29" />
      <circle cx="77.5" cy="77.5" r="1.4" fill="#8C5E29" />

      {/* Gold glow under nodes */}
      <circle cx="50" cy="50" r="42" fill="url(#logo-graph-glow)" />

      {/* Edges (under nodes for proper layering) */}
      <g stroke="#C28840" strokeLinecap="round" fill="none">
        <line x1="50" y1="50" x2="28" y2="30" strokeWidth="1.5" opacity="0.75" />
        <line x1="50" y1="50" x2="72" y2="28" strokeWidth="1.5" opacity="0.75" />
        <line x1="50" y1="50" x2="78" y2="58" strokeWidth="1.5" opacity="0.75" />
        <line x1="50" y1="50" x2="55" y2="78" strokeWidth="1.5" opacity="0.75" />
        <line x1="50" y1="50" x2="22" y2="62" strokeWidth="1.5" opacity="0.75" />
        <line x1="28" y1="30" x2="72" y2="28" strokeWidth="0.8" opacity="0.45" />
        <line x1="22" y1="62" x2="55" y2="78" strokeWidth="0.8" opacity="0.45" />
        <line x1="78" y1="58" x2="55" y2="78" strokeWidth="0.8" opacity="0.45" />
      </g>

      {/* Peripheral nodes */}
      <g fill="#E0A656" stroke="#FFD700" strokeWidth="0.8">
        <circle cx="28" cy="30" r="4" />
        <circle cx="72" cy="28" r="4" />
        <circle cx="78" cy="58" r="4.2" />
        <circle cx="55" cy="78" r="3.8" />
        <circle cx="22" cy="62" r="4" />
      </g>

      {/* Center Satoshi node with Bitcoin glyph */}
      <circle cx="50" cy="50" r="11" fill="#FFD700" />
      <text
        x="50"
        y="56"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="14"
        fontWeight="bold"
        fill="#08080C"
      >
        ₿
      </text>
      <path
        d="M 43 46 A 8 8 0 0 1 57 46"
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GridLogo({ size, label }: { size: number; label: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={label}
      style={{ flexShrink: 0 }}
    >
      <defs>
        <radialGradient id="logo-grid-glow" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="rgba(255, 215, 0, 0.30)" />
          <stop offset="55%" stopColor="rgba(255, 215, 0, 0.10)" />
          <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
        </radialGradient>
        <linearGradient id="logo-grid-brass" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E0A656" />
          <stop offset="50%" stopColor="#C28840" />
          <stop offset="100%" stopColor="#8C5E29" />
        </linearGradient>
      </defs>

      <rect x="2" y="2" width="96" height="96" rx="11" fill="#08080C" />
      <rect x="3" y="3" width="94" height="94" rx="10" fill="none" stroke="url(#logo-grid-brass)" strokeWidth="2.5" />
      <rect x="8" y="8" width="84" height="84" rx="7" fill="url(#logo-grid-glow)" />

      {/* Corner rivets */}
      <circle cx="10" cy="10" r="1.8" fill="#8C5E29" />
      <circle cx="90" cy="10" r="1.8" fill="#8C5E29" />
      <circle cx="10" cy="90" r="1.8" fill="#8C5E29" />
      <circle cx="90" cy="90" r="1.8" fill="#8C5E29" />

      {/* 3×3 tile arrangement */}
      <rect x="20" y="20" width="18" height="18" rx="2" fill="#8C5E29" opacity="0.85" />
      <rect x="41" y="20" width="18" height="18" rx="2" fill="#C28840" />
      <rect x="62" y="20" width="18" height="18" rx="2" fill="#8C5E29" opacity="0.85" />
      <rect x="20" y="41" width="18" height="18" rx="2" fill="#C28840" />
      <rect x="41" y="41" width="18" height="18" rx="2" fill="#FFD700" />
      <text
        x="50"
        y="56"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="16"
        fontWeight="bold"
        fill="#08080C"
      >
        ₿
      </text>
      <rect x="62" y="41" width="18" height="18" rx="2" fill="#C28840" />
      <rect x="20" y="62" width="18" height="18" rx="2" fill="#8C5E29" opacity="0.85" />
      <rect x="41" y="62" width="18" height="18" rx="2" fill="#C28840" />
      <rect x="62" y="62" width="18" height="18" rx="2" fill="#8C5E29" opacity="0.85" />
      <rect x="42" y="42" width="16" height="3" rx="1.5" fill="rgba(255,255,255,0.25)" />
    </svg>
  );
}
