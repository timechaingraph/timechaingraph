/**
 * Logo — Bitcoin digital real estate emblem.
 *
 * A 5×5 brass-bordered grid with the center cell glowing gold (Satoshi
 * origin). Surrounding cells fade outward in two rings, suggesting the
 * "expanding 2D real estate" growth model: blocks open new tiles in
 * concentric rings around the genesis center.
 *
 * Pure SVG, inline (no external file fetch), inherits color from
 * surrounding text via currentColor where possible. Renders at any
 * size via the `size` prop; the viewBox is square.
 *
 * Used in NavBar (sm), favicon-style usage (20px), and as a hero
 * accent on the landing page (lg). Keeps the brass-and-gold project
 * aesthetic, no external dependencies.
 */

interface LogoProps {
  /** Square edge length in CSS pixels. */
  size?: number;
  /** Optional accent override — defaults to brand brass + gold. */
  accent?: 'brass' | 'cyan' | 'gold';
  /** Optional aria-label override. */
  label?: string;
}

const RING_FILLS = [
  'rgba(248, 213, 104, 0.95)', // ring 0 — Satoshi gold
  'rgba(193, 136, 64, 0.78)', // ring 1 — bright brass
  'rgba(140, 95, 40, 0.55)', // ring 2 — darker brass
];

export function Logo({ size = 28, accent = 'brass', label = "Timechain Grid logo" }: LogoProps) {
  const accentStroke =
    accent === 'cyan'
      ? 'var(--color-accent-cyan)'
      : accent === 'gold'
        ? 'var(--color-gold)'
        : 'var(--color-brass-bright)';

  // 5×5 grid in a 100x100 viewBox; cells are 16x16 with 2px gap, centered
  // so the middle cell sits at (50,50). Outer frame at 0..100.
  const cells: Array<{ x: number; y: number; ring: number }> = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const dx = col - 2;
      const dy = row - 2;
      const ring = Math.max(Math.abs(dx), Math.abs(dy)); // Chebyshev distance
      cells.push({
        x: 10 + col * 18,
        y: 10 + row * 18,
        ring,
      });
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={label}
      style={{ flexShrink: 0 }}
    >
      {/* Outer brass frame */}
      <rect
        x="2"
        y="2"
        width="96"
        height="96"
        rx="8"
        fill="none"
        stroke={accentStroke}
        strokeWidth="2.5"
        opacity="0.9"
      />

      {/* Inner ring suggesting outward growth — radial gradient from gold center */}
      <defs>
        <radialGradient id="logo-glow" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="rgba(255, 215, 102, 0.55)" />
          <stop offset="60%" stopColor="rgba(193, 136, 64, 0.18)" />
          <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="44" fill="url(#logo-glow)" />

      {/* Cells — Satoshi center is brightest, outward rings fade */}
      {cells.map((c, i) => (
        <rect
          key={i}
          x={c.x}
          y={c.y}
          width="14"
          height="14"
          rx="2"
          fill={RING_FILLS[c.ring]}
          opacity={c.ring === 0 ? 1 : c.ring === 1 ? 0.85 : 0.6}
        />
      ))}

      {/* Halo ring around Satoshi center for emphasis */}
      <rect
        x="44"
        y="44"
        width="14"
        height="14"
        rx="2"
        fill="none"
        stroke="rgba(255, 235, 150, 0.95)"
        strokeWidth="1.5"
      />
    </svg>
  );
}
