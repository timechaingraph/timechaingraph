/**
 * HeroVisual — Obsidian-style force-directed wallet graph, brass-framed.
 *
 * Organic node placement (density-biased toward origin), visible transaction
 * bonds between nearby pairs, brass annulus with halving notches and rivet
 * pattern, slow gear motifs in opposing corners. Pure SVG + CSS, no JS deps.
 */

const SIZE = 440;
const CENTER = SIZE / 2;
const OUTER_FRAME = 200;
const INNER_FRAME = 192;

// Halving notches at fixed positions on the brass annulus
const HALVING_NOTCHES = [0, 72, 144, 216, 288];

type Dot = {
  x: number;
  y: number;
  r: number;
  pulse: boolean;
  whale: boolean;
  miner: boolean;
};

type Bond = { from: number; to: number; alpha: number };

// Density-biased polar distribution: clusters near origin, sparse at edges.
function seededDot(seed: number): Dot {
  const a = Math.sin(seed * 12.9898) * 43758.5453;
  const b = Math.sin(seed * 78.233 + 9.0) * 43758.5453;
  const c = Math.sin(seed * 31.71 + 4.0) * 43758.5453;
  const d = Math.sin(seed * 47.13 + 3.0) * 43758.5453;
  const angle = (a - Math.floor(a)) * Math.PI * 2;
  const t = b - Math.floor(b);
  // Square-ish bias toward center: t^1.6 maps [0,1] uniformly but favors small values
  const r = Math.pow(t, 1.65) * 175 + 6;
  const x = CENTER + Math.cos(angle) * r;
  const y = CENTER + Math.sin(angle) * r;
  const cFrac = c - Math.floor(c);
  const dFrac = d - Math.floor(d);
  const whale = cFrac > 0.94;
  const miner = !whale && cFrac > 0.86;
  const dotR = whale ? 3.4 : miner ? 2.4 : 1.5;
  const pulse = dFrac < 0.07;
  return { x, y, r: dotR, pulse, whale, miner };
}

const N_DOTS = 280;
const DOTS: Dot[] = Array.from({ length: N_DOTS }, (_, i) => seededDot(i + 1));

// Build bonds: for each dot, find a few nearby neighbors, connect with weighted
// edges. Deterministic by index.
function buildBonds(dots: Dot[], maxPerNode = 1, maxDist = 32): Bond[] {
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
      // Deterministic skip pattern keeps the bond density visually balanced.
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) continue;
      const skip = Math.sin((i + j) * 9.31) * 43758.5453;
      if ((skip - Math.floor(skip)) > 0.32) continue;
      seen.add(key);
      const alpha = Math.max(0.08, 0.55 - dist / maxDist);
      out.push({ from: i, to: j, alpha });
      added++;
    }
  }
  return out;
}

const BONDS = buildBonds(DOTS, 1, 30);

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
      aria-label="Timechain Grid lattice preview: a brass-framed graph of Bitcoin wallets, organically positioned around a glowing Satoshi anchor with visible transaction bonds and rotating gear motifs."
      className="max-w-[460px]"
    >
      <defs>
        <radialGradient id="hero-bg-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(0, 212, 255, 0.08)" />
          <stop offset="55%" stopColor="rgba(0, 212, 255, 0.025)" />
          <stop offset="100%" stopColor="rgba(0, 212, 255, 0)" />
        </radialGradient>
        <radialGradient id="satoshi-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255, 215, 0, 0.55)" />
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
      </defs>

      {/* Background bloom */}
      <circle cx={CENTER} cy={CENTER} r={195} fill="url(#hero-bg-glow)" />

      {/* Brass annulus (outer + inner edge) */}
      <circle cx={CENTER} cy={CENTER} r={OUTER_FRAME} fill="none" stroke="url(#brass-grad)" strokeWidth={1.5} opacity={0.85} />
      <circle cx={CENTER} cy={CENTER} r={INNER_FRAME} fill="none" stroke="url(#brass-grad-vertical)" strokeWidth={0.8} opacity={0.7} />

      {/* Halving notches */}
      {HALVING_NOTCHES.map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const r1 = INNER_FRAME - 2;
        const r2 = OUTER_FRAME + 2;
        return (
          <line
            key={i}
            x1={CENTER + Math.cos(rad) * r1}
            y1={CENTER + Math.sin(rad) * r1}
            x2={CENTER + Math.cos(rad) * r2}
            y2={CENTER + Math.sin(rad) * r2}
            stroke="rgba(224, 166, 86, 0.85)"
            strokeWidth={1.6}
          />
        );
      })}

      {/* Rivet ring */}
      {Array.from({ length: 36 }, (_, i) => {
        const rad = (i * 10 * Math.PI) / 180;
        const r = (OUTER_FRAME + INNER_FRAME) / 2;
        return (
          <circle
            key={i}
            cx={CENTER + Math.cos(rad) * r}
            cy={CENTER + Math.sin(rad) * r}
            r={1}
            fill="rgba(255, 215, 0, 0.55)"
          />
        );
      })}

      {/* Corner gears */}
      <g className="gear-spin" style={{ transformOrigin: '60px 60px' }}>
        <path d={gearPath(60, 60, 28, 22, 12)} fill="none" stroke="rgba(194, 136, 64, 0.4)" strokeWidth={1.2} />
        <circle cx={60} cy={60} r={10} fill="none" stroke="rgba(194, 136, 64, 0.35)" strokeWidth={1} />
        <circle cx={60} cy={60} r={3.5} fill="rgba(194, 136, 64, 0.3)" />
      </g>
      <g className="gear-spin-rev" style={{ transformOrigin: `${SIZE - 60}px ${SIZE - 60}px` }}>
        <path d={gearPath(SIZE - 60, SIZE - 60, 22, 17, 10)} fill="none" stroke="rgba(0, 212, 255, 0.32)" strokeWidth={1} />
        <circle cx={SIZE - 60} cy={SIZE - 60} r={8} fill="none" stroke="rgba(0, 212, 255, 0.26)" strokeWidth={1} />
        <circle cx={SIZE - 60} cy={SIZE - 60} r={3} fill="rgba(0, 212, 255, 0.22)" />
      </g>

      {/* Bond edges (rendered first, behind nodes) */}
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
              stroke={`rgba(0, 212, 255, ${b.alpha})`}
              strokeWidth={0.5}
            />
          );
        })}
      </g>

      {/* Wallet dots (organic placement, no fixed rings) */}
      {DOTS.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={d.r}
          fill={
            d.whale
              ? 'rgba(255, 215, 0, 0.85)'
              : d.miner
                ? 'rgba(245, 166, 35, 0.7)'
                : 'rgba(0, 212, 255, 0.55)'
          }
          style={
            d.pulse
              ? {
                  animation: 'pulse-soft 2.6s ease-in-out infinite',
                  transformOrigin: `${d.x}px ${d.y}px`,
                  animationDelay: `${(i % 7) * 0.28}s`,
                }
              : undefined
          }
        />
      ))}

      {/* Satoshi anchor (brass-bezeled gold core) */}
      <circle cx={CENTER} cy={CENTER} r={32} fill="url(#satoshi-glow)" />
      <circle cx={CENTER} cy={CENTER} r={9} fill="none" stroke="url(#brass-grad)" strokeWidth={1.4} opacity={0.9} />
      <circle
        cx={CENTER}
        cy={CENTER}
        r={4}
        fill="rgb(255, 215, 0)"
        style={{ animation: 'pulse-satoshi 3.2s ease-in-out infinite' }}
      />
    </svg>
  );
}
