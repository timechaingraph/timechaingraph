/**
 * HeroVisual — living network emblem for the Graph landing.
 *
 * Composition (back to front):
 *   1. Background bloom — soft gold/brass radial glow
 *   2. Outer brass ring — slowly rotating, dashed, halving notches at quadrants
 *   3. Inner stationary brass ring — fine accent line + rivet pattern
 *   4. Corner gear motifs — same as before, slow contra-rotation
 *   5. Edge bonds — ~280 connections between nearby wallets, ~12% of which
 *      slowly fade their opacity in/out to suggest the "edges fade across
 *      blocks" project mechanic
 *   6. Wallet nodes — ~380 dots, density-biased toward Satoshi; ~28% pulse
 *      at staggered intervals (neurons firing)
 *   7. Satoshi anchor — multilayer gold core with pulse-satoshi heartbeat
 *
 * Pure SVG + CSS keyframes from globals.css. Zero JS, zero runtime
 * dependencies. Renders crisp at any zoom because all geometry is
 * vector.
 */

const SIZE = 440;
const CENTER = SIZE / 2;
const OUTER_FRAME = 200;
const INNER_FRAME = 192;

// Halving notches at compass quadrants + diagonals (richer than v1)
const HALVING_NOTCHES_DEG = [0, 45, 90, 135, 180, 225, 270, 315];

type Dot = {
  x: number;
  y: number;
  r: number;
  pulse: boolean;
  whale: boolean;
  miner: boolean;
  /** staggered pulse delay index — used by every-pulse animation */
  delayIdx: number;
};

type Bond = { from: number; to: number; alpha: number; fadeIdx: number };

/* Deterministic pseudo-random helpers — no Math.random so SSR matches CSR */
function rand(seed: number, salt: number): number {
  const v = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

function seededDot(seed: number): Dot {
  const angle = rand(seed, 1) * Math.PI * 2;
  const t = rand(seed, 2);
  // Density bias: t^1.65 favors small radii (cluster near Satoshi)
  const r = Math.pow(t, 1.65) * 175 + 6;
  const x = CENTER + Math.cos(angle) * r;
  const y = CENTER + Math.sin(angle) * r;
  const role = rand(seed, 3);
  const whale = role > 0.94;
  const miner = !whale && role > 0.86;
  const dotR = whale ? 3.4 : miner ? 2.4 : 1.5;
  // ~38% of dots pulse — denser flicker reads as a living vault graph
  const pulse = rand(seed, 4) < 0.38;
  const delayIdx = Math.floor(rand(seed, 5) * 14);
  return { x, y, r: dotR, pulse, whale, miner, delayIdx };
}

const N_DOTS = 380;
const DOTS: Dot[] = Array.from({ length: N_DOTS }, (_, i) => seededDot(i + 1));

function buildBonds(dots: Dot[], maxPerNode = 1, maxDist = 30): Bond[] {
  const out: Bond[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < dots.length; i++) {
    let added = 0;
    for (let j = 0; j < dots.length && added < maxPerNode; j++) {
      if (i === j) continue;
      const dx = dots[i].x - dots[j].x;
      const dy = dots[i].y - dots[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > maxDist || dist < 4) continue;
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) continue;
      const skip = rand(i + j, 9);
      if (skip > 0.6) continue;
      seen.add(key);
      const alpha = Math.max(0.08, 0.55 - dist / maxDist);
      // ~every 6th bond breathes (opacity fade, staggered) — synapse activity
      const fadeIdx = (i + j) % 6 === 0 ? (i % 12) : -1;
      out.push({ from: i, to: j, alpha, fadeIdx });
      added++;
    }
  }
  return out;
}

const BONDS = buildBonds(DOTS, 2, 36);

// Obsidian-style hub sizing: each node swells with its degree (connection
// count), so well-linked nodes read as hubs and isolated ones stay small —
// the signature "important nodes are bigger" of a vault graph view.
const degree = new Array<number>(N_DOTS).fill(0);
for (const b of BONDS) {
  degree[b.from]++;
  degree[b.to]++;
}
DOTS.forEach((d, i) => {
  d.r += Math.log(1 + degree[i]) * 0.7;
});

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

export function HeroVisual() {
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width="100%"
      height="100%"
      role="img"
      aria-label="Timechain Graph: a brass-framed living network of Bitcoin wallets — pulsing wallet nodes connected by transaction edges, halving notches on the rotating outer ring, Satoshi at the gold center."
      className="max-w-[460px]"
    >
      <defs>
        <radialGradient id="hero-bg-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255, 215, 0, 0.10)" />
          <stop offset="40%" stopColor="rgba(194, 136, 64, 0.05)" />
          <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
        </radialGradient>
        <radialGradient id="satoshi-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255, 215, 0, 0.65)" />
          <stop offset="60%" stopColor="rgba(255, 215, 0, 0.18)" />
          <stop offset="100%" stopColor="rgba(255, 215, 0, 0)" />
        </radialGradient>
        <radialGradient id="satoshi-glow-outer" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255, 215, 0, 0.18)" />
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
        {/* Hero-matched gradient — same brass-bright → gold → dimmed-amber
            palette as the headline (.hero-gradient), so the emblem's metal
            reads as one piece with the title. */}
        <linearGradient id="hero-brass-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D89A4E" />
          <stop offset="35%" stopColor="#E8C028" />
          <stop offset="58%" stopColor="#D88E1C" />
          <stop offset="80%" stopColor="#E8C028" />
          <stop offset="100%" stopColor="#D89A4E" />
        </linearGradient>
        {/* Gear body fill — a soft radial so each cog reads as a solid brass
            disc with depth (dark hub → warm rim) rather than a hollow outline. */}
        <radialGradient id="gear-fill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(140, 95, 40, 0.38)" />
          <stop offset="65%" stopColor="rgba(194, 136, 64, 0.16)" />
          <stop offset="100%" stopColor="rgba(224, 166, 86, 0.04)" />
        </radialGradient>
        {/* Soft Gaussian bloom — makes whales + the Satoshi core feel lit,
            not flat. Applied only to the few brightest nodes (cheap). */}
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

      {/* Outer slowly-rotating brass ring with dashed pattern + halving notches.
          Rotates clockwise at 60s/rev — slow enough to feel like ambient
          machinery rather than spinning. */}
      <g
        className="gear-spin"
        style={{
          transformOrigin: `${CENTER}px ${CENTER}px`,
          animationDuration: '60s',
        }}
      >
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
        {/* Halving notches — 8 evenly spaced */}
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
      <circle
        cx={CENTER}
        cy={CENTER}
        r={INNER_FRAME}
        fill="none"
        stroke="url(#brass-grad-vertical)"
        strokeWidth={0.8}
        opacity={0.6}
      />

      {/* Rivet ring (between the two brass rings) */}
      {Array.from({ length: 36 }, (_, i) => {
        const rad = (i * 10 * Math.PI) / 180;
        const r = (OUTER_FRAME + INNER_FRAME) / 2;
        return (
          <circle
            key={i}
            cx={CENTER + Math.cos(rad) * r}
            cy={CENTER + Math.sin(rad) * r}
            r={1}
            fill="rgba(255, 215, 0, 0.5)"
          />
        );
      })}

      {/* Corner gears — bolder mechanical detail.
          Each gear gets: an outer toothed body filled with brass, an
          inner contrast ring, a hub circle, four cross-spokes, and a
          center bolt with highlight.
          Both gears + the outer ring share the same 60-second rotation
          period so they read as one synchronized mechanism. */}
      <g
        className="gear-spin-rev"
        style={{ transformOrigin: '54px 54px', animationDuration: '20s' }}
      >
        <path
          d={gearPath(54, 54, 32, 25, 12)}
          fill="url(#gear-fill)"
          stroke="url(#hero-brass-grad)"
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
        <circle cx={54} cy={54} r={17} fill="none" stroke="rgba(224, 166, 86, 0.55)" strokeWidth={1.4} />
        <circle cx={54} cy={54} r={12} fill="none" stroke="rgba(194, 136, 64, 0.55)" strokeWidth={1} />
        {/* Four cross-spokes */}
        {[0, 90, 180, 270].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <line
              key={deg}
              x1={54 + Math.cos(rad) * 5}
              y1={54 + Math.sin(rad) * 5}
              x2={54 + Math.cos(rad) * 16}
              y2={54 + Math.sin(rad) * 16}
              stroke="rgba(194, 136, 64, 0.55)"
              strokeWidth={1.2}
              strokeLinecap="round"
            />
          );
        })}
        {/* Hub bolt with highlight */}
        <circle cx={54} cy={54} r={5} fill="rgba(140, 95, 40, 0.85)" />
        <circle cx={53} cy={53} r={1.6} fill="rgba(255, 235, 150, 0.7)" />
      </g>
      <g
        className="gear-spin-rev"
        style={{ transformOrigin: `${SIZE - 58}px ${SIZE - 58}px`, animationDuration: '20s' }}
      >
        <path
          d={gearPath(SIZE - 58, SIZE - 58, 26, 20, 10)}
          fill="url(#gear-fill)"
          stroke="url(#hero-brass-grad)"
          strokeWidth={2.0}
          strokeLinejoin="round"
        />
        <circle cx={SIZE - 58} cy={SIZE - 58} r={14} fill="none" stroke="rgba(224, 166, 86, 0.55)" strokeWidth={1.3} />
        <circle cx={SIZE - 58} cy={SIZE - 58} r={9} fill="none" stroke="rgba(194, 136, 64, 0.5)" strokeWidth={1} />
        {[45, 135, 225, 315].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const cx = SIZE - 58;
          const cy = SIZE - 58;
          return (
            <line
              key={deg}
              x1={cx + Math.cos(rad) * 4}
              y1={cy + Math.sin(rad) * 4}
              x2={cx + Math.cos(rad) * 13}
              y2={cy + Math.sin(rad) * 13}
              stroke="rgba(224, 166, 86, 0.55)"
              strokeWidth={1.1}
              strokeLinecap="round"
            />
          );
        })}
        <circle cx={SIZE - 58} cy={SIZE - 58} r={4} fill="rgba(140, 95, 40, 0.85)" />
        <circle cx={SIZE - 59} cy={SIZE - 59} r={1.3} fill="rgba(255, 235, 150, 0.7)" />
      </g>

      {/* Bond edges — every ~9th gets a slow opacity fade (synapse activity) */}
      <g>
        {BONDS.map((b, i) => {
          const a = DOTS[b.from];
          const c = DOTS[b.to];
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={c.x}
              y2={c.y}
              stroke={`rgba(224, 166, 86, ${b.alpha})`}
              strokeWidth={0.5}
              style={
                b.fadeIdx >= 0
                  ? {
                      animation: 'drift-fade 6s ease-in-out infinite alternate',
                      animationDelay: `${b.fadeIdx * 0.42}s`,
                    }
                  : undefined
              }
            />
          );
        })}
      </g>

      {/* Wallet dots — pulsing subset staggered across 14 delay buckets */}
      {DOTS.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={d.r}
          filter={d.whale ? 'url(#node-glow)' : undefined}
          fill={
            d.whale
              ? 'rgba(232, 192, 40, 0.95)'
              : d.miner
                ? 'rgba(225, 153, 31, 0.80)'
                : 'rgba(224, 166, 86, 0.55)'
          }
          style={
            d.pulse
              ? {
                  animation: 'pulse-soft 3.2s ease-in-out infinite',
                  transformOrigin: `${d.x}px ${d.y}px`,
                  animationDelay: `${d.delayIdx * 0.24}s`,
                }
              : undefined
          }
        />
      ))}

      {/* Satoshi anchor — outer glow + brass bezel + breathing core */}
      <circle cx={CENTER} cy={CENTER} r={48} fill="url(#satoshi-glow-outer)" />
      <circle cx={CENTER} cy={CENTER} r={32} fill="url(#satoshi-glow)" />
      <circle cx={CENTER} cy={CENTER} r={9} fill="none" stroke="url(#brass-grad)" strokeWidth={1.5} opacity={0.95} />
      <circle
        cx={CENTER}
        cy={CENTER}
        r={4.5}
        fill="rgb(255, 215, 0)"
        filter="url(#node-glow)"
        style={{ animation: 'pulse-satoshi 3.2s ease-in-out infinite' }}
      />
    </svg>
  );
}
