/**
 * HeroFrame — the shared brass machinery around both landing emblems.
 *
 * SHARED, byte-identical across the Graph and Grid repos. It owns everything
 * the two emblems have in common so they sit at the exact same size and
 * position and share one rotating outer ring driven by the corner cogs:
 *   - background bloom
 *   - outer slowly-rotating dashed ring with 8 halving notches (60s/rev, CW)
 *   - inner stationary ring + 36-rivet band
 *   - two corner gears, teeth tangent to the ring, contra-rotating (20s)
 *   - the full <defs> palette (gradients + node-glow) the inner art reuses
 *
 * The view-specific inner art is passed as `children` and rendered last
 * (on top), inside the inner ring:
 *   - Graph → the Obsidian-style force-directed wallet network (HeroVisual)
 *   - Grid  → the coin-tile lattice with a ₿ core (HeroVisual)
 *
 * Pure SVG + CSS keyframes (globals.css). Zero runtime JS, zero deps.
 */
import type { ReactNode } from 'react';

const SIZE = 440;
const CENTER = SIZE / 2;
const OUTER_FRAME = 200;
const INNER_FRAME = 192;

const HALVING_NOTCHES_DEG = [0, 45, 90, 135, 180, 225, 270, 315];

function gearPath(cx: number, cy: number, outerR: number, innerR: number, teeth: number): string {
  const step = (Math.PI * 2) / (teeth * 2);
  let d = '';
  for (let i = 0; i < teeth * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = i * step;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    d += i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)} ` : `L ${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return d + 'Z';
}

export function HeroFrame({ ariaLabel, children }: { ariaLabel: string; children: ReactNode }) {
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width="100%"
      height="100%"
      role="img"
      aria-label={ariaLabel}
      className="max-w-[460px]"
    >
      <defs>
        <radialGradient id="hero-bg-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255, 215, 0, 0.10)" />
          <stop offset="40%" stopColor="rgba(194, 136, 64, 0.05)" />
          <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
        </radialGradient>
        <radialGradient id="satoshi-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255, 215, 0, 0.62)" />
          <stop offset="60%" stopColor="rgba(255, 215, 0, 0.16)" />
          <stop offset="100%" stopColor="rgba(255, 215, 0, 0)" />
        </radialGradient>
        <radialGradient id="satoshi-glow-outer" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255, 215, 0, 0.16)" />
          <stop offset="100%" stopColor="rgba(255, 215, 0, 0)" />
        </radialGradient>
        <linearGradient id="brass-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8C5E29" />
          <stop offset="50%" stopColor="#E0A656" />
          <stop offset="100%" stopColor="#8C5E29" />
        </linearGradient>
        <linearGradient id="brass-grad-vertical" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#E0A656" />
          <stop offset="50%" stopColor="#C28840" />
          <stop offset="100%" stopColor="#8C5E29" />
        </linearGradient>
        {/* Hero-matched gradient — same brass→gold→amber ramp as the headline
            (.hero-gradient) so the emblem's metal reads as one piece with the title. */}
        <linearGradient id="hero-brass-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D89A4E" />
          <stop offset="35%" stopColor="#E8C028" />
          <stop offset="58%" stopColor="#D88E1C" />
          <stop offset="80%" stopColor="#E8C028" />
          <stop offset="100%" stopColor="#D89A4E" />
        </linearGradient>
        <radialGradient id="gear-fill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(140, 95, 40, 0.38)" />
          <stop offset="65%" stopColor="rgba(194, 136, 64, 0.16)" />
          <stop offset="100%" stopColor="rgba(224, 166, 86, 0.04)" />
        </radialGradient>
        <filter id="node-glow" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background bloom */}
      <circle cx={CENTER} cy={CENTER} r={195} fill="url(#hero-bg-glow)" />

      {/* Outer slowly-rotating brass ring + halving notches (60s/rev, clockwise). */}
      <g className="gear-spin" style={{ transformOrigin: `${CENTER}px ${CENTER}px`, animationDuration: '60s' }}>
        <circle
          cx={CENTER}
          cy={CENTER}
          r={OUTER_FRAME}
          fill="none"
          stroke="url(#hero-brass-grad)"
          strokeWidth={1.5}
          strokeDasharray="3 6"
          opacity={0.7}
        />
        {HALVING_NOTCHES_DEG.map((deg, i) => {
          const rad = (deg * Math.PI) / 180;
          const r1 = INNER_FRAME + 2;
          const r2 = OUTER_FRAME + 4;
          return (
            <line
              key={i}
              x1={CENTER + Math.cos(rad) * r1}
              y1={CENTER + Math.sin(rad) * r1}
              x2={CENTER + Math.cos(rad) * r2}
              y2={CENTER + Math.sin(rad) * r2}
              stroke="rgba(224, 166, 86, 0.85)"
              strokeWidth={i % 2 === 0 ? 1.8 : 1.0}
            />
          );
        })}
      </g>

      {/* Inner stationary brass ring */}
      <circle cx={CENTER} cy={CENTER} r={INNER_FRAME} fill="none" stroke="url(#brass-grad-vertical)" strokeWidth={0.8} opacity={0.6} />

      {/* Rivet band */}
      {Array.from({ length: 36 }, (_, i) => {
        const rad = (i * 10 * Math.PI) / 180;
        const r = (OUTER_FRAME + INNER_FRAME) / 2;
        return <circle key={i} cx={CENTER + Math.cos(rad) * r} cy={CENTER + Math.sin(rad) * r} r={1} fill="rgba(255, 215, 0, 0.5)" />;
      })}

      {/* Corner gears — teeth tangent to the outer ring so they appear to drive it (20s, contra-rotating). */}
      <g className="gear-spin-rev" style={{ transformOrigin: '54px 54px', animationDuration: '20s' }}>
        <path d={gearPath(54, 54, 32, 25, 12)} fill="url(#gear-fill)" stroke="url(#hero-brass-grad)" strokeWidth={2.2} strokeLinejoin="round" />
        <circle cx={54} cy={54} r={17} fill="none" stroke="rgba(224, 166, 86, 0.55)" strokeWidth={1.4} />
        <circle cx={54} cy={54} r={12} fill="none" stroke="rgba(194, 136, 64, 0.55)" strokeWidth={1} />
        {[0, 90, 180, 270].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <line key={deg} x1={54 + Math.cos(rad) * 5} y1={54 + Math.sin(rad) * 5} x2={54 + Math.cos(rad) * 16} y2={54 + Math.sin(rad) * 16} stroke="rgba(194, 136, 64, 0.55)" strokeWidth={1.2} strokeLinecap="round" />
          );
        })}
        <circle cx={54} cy={54} r={5} fill="rgba(140, 95, 40, 0.85)" />
        <circle cx={53} cy={53} r={1.6} fill="rgba(255, 235, 150, 0.7)" />
      </g>
      <g className="gear-spin-rev" style={{ transformOrigin: `${SIZE - 58}px ${SIZE - 58}px`, animationDuration: '20s' }}>
        <path d={gearPath(SIZE - 58, SIZE - 58, 26, 20, 10)} fill="url(#gear-fill)" stroke="url(#hero-brass-grad)" strokeWidth={2.0} strokeLinejoin="round" />
        <circle cx={SIZE - 58} cy={SIZE - 58} r={14} fill="none" stroke="rgba(224, 166, 86, 0.55)" strokeWidth={1.3} />
        <circle cx={SIZE - 58} cy={SIZE - 58} r={9} fill="none" stroke="rgba(194, 136, 64, 0.5)" strokeWidth={1} />
        {[45, 135, 225, 315].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const cx = SIZE - 58;
          const cy = SIZE - 58;
          return (
            <line key={deg} x1={cx + Math.cos(rad) * 4} y1={cy + Math.sin(rad) * 4} x2={cx + Math.cos(rad) * 13} y2={cy + Math.sin(rad) * 13} stroke="rgba(224, 166, 86, 0.55)" strokeWidth={1.1} strokeLinecap="round" />
          );
        })}
        <circle cx={SIZE - 58} cy={SIZE - 58} r={4} fill="rgba(140, 95, 40, 0.85)" />
        <circle cx={SIZE - 59} cy={SIZE - 59} r={1.3} fill="rgba(255, 235, 150, 0.7)" />
      </g>

      {/* View-specific inner art (Graph network / Grid tile-lattice), drawn last. */}
      {children}
    </svg>
  );
}
