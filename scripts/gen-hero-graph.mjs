/**
 * gen-hero-graph.mjs — bake the Graph hero emblem's network layout.
 *
 * Runs a deterministic force-directed simulation ONCE and writes the
 * resulting node/edge geometry to src/components/hero-graph-data.ts.
 *
 * Why bake instead of simulate in the component: a force sim is chaotic, and
 * Math.sin/Math.log differ across JS engines (Node/V8 vs Firefox/Safari), so
 * a runtime sim would render different positions on the server than on the
 * client → React hydration mismatch + a visible "jump". Baked geometry is
 * byte-identical everywhere.
 *
 * The emblem reads as an Obsidian-vault graph: a Satoshi core, a ring of
 * secondary hubs, leaf wallets clustered around them via visible edges, no
 * overlaps. The component layers CSS so a subset of leaves fade in/out
 * (scrubbing through chain time) around the persistent hub backbone.
 *
 * Re-run after changing any constant below:  node scripts/gen-hero-graph.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/* Deterministic integer PRNG (mulberry32) — reproducible runs. */
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(0xc0ffee);

const CENTER = 220; // matches SIZE/2 in HeroVisual
const GRAPH_R = 150; // network fits within this radius (inner ring is 192)
const N_HUBS = 6;
const N_LEAVES = 50;
const N = 1 + N_HUBS + N_LEAVES; // 57

/* ---- structure: satoshi (0), hubs (1..6), leaves attach to a center ---- */
const kind = new Array(N);
const center = new Array(N).fill(-1);
kind[0] = 2; // satoshi
for (let h = 1; h <= N_HUBS; h++) {
  kind[h] = 1;
  center[h] = 0;
}
for (let i = 1 + N_HUBS; i < N; i++) {
  kind[i] = 0;
  center[i] = rng() < 0.22 ? 0 : 1 + Math.floor(rng() * N_HUBS); // satoshi gets ~22%
}

/* ---- edges ---- */
const edges = [];
const add = (a, b, bb = false) => {
  if (a !== b) edges.push({ a, b, bb });
};
for (let h = 1; h <= N_HUBS; h++) add(h, 0, true); // hub → satoshi (backbone spokes)
for (let h = 1; h <= N_HUBS; h++) if (rng() < 0.5) add(h, 1 + (h % N_HUBS), true); // hub ring
for (let i = 1 + N_HUBS; i < N; i++) add(i, center[i], false); // leaf → its center
for (let i = 1 + N_HUBS; i < N; i++) {
  if (rng() < 0.22) {
    const t =
      rng() < 0.5
        ? 1 + Math.floor(rng() * N_HUBS) // cross-link to a hub
        : 1 + N_HUBS + Math.floor(rng() * N_LEAVES); // or a sibling leaf
    add(i, t, false);
  }
}

const deg = new Array(N).fill(0);
for (const e of edges) {
  deg[e.a]++;
  deg[e.b]++;
}

/* ---- radii (degree-scaled hubs; Satoshi largest) ---- */
const radius = new Array(N);
for (let i = 0; i < N; i++) {
  if (kind[i] === 2) radius[i] = 9;
  else if (kind[i] === 1) radius[i] = 4.6 + Math.log(1 + deg[i]) * 0.9;
  else radius[i] = 2.0 + Math.log(1 + deg[i]) * 0.6;
}

/* ---- initial positions: satoshi center, hubs on a jittered ring ---- */
const pos = new Array(N);
pos[0] = { x: CENTER, y: CENTER, vx: 0, vy: 0 };
for (let h = 1; h <= N_HUBS; h++) {
  const ang = ((h - 1) / N_HUBS) * Math.PI * 2 + 0.3;
  const rad = 80 + (rng() - 0.5) * 22;
  pos[h] = { x: CENTER + Math.cos(ang) * rad, y: CENTER + Math.sin(ang) * rad, vx: 0, vy: 0 };
}
for (let i = 1 + N_HUBS; i < N; i++) {
  const c = center[i];
  const ang = rng() * Math.PI * 2;
  const rad = 20 + rng() * 30;
  pos[i] = { x: pos[c].x + Math.cos(ang) * rad, y: pos[c].y + Math.sin(ang) * rad, vx: 0, vy: 0 };
}

/* ---- force simulation ---- */
const K_REP = 1600;
const K_SPRING = 0.05;
const REST = 33;
const CENTER_PULL = 0.01;
const DAMP = 0.85;
const VMAX = 12;
for (let it = 0; it < 280; it++) {
  const fx = new Array(N).fill(0);
  const fy = new Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      let dx = pos[i].x - pos[j].x;
      let dy = pos[i].y - pos[j].y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 1) d2 = 1;
      const d = Math.sqrt(d2);
      const f = K_REP / d2;
      const ux = dx / d;
      const uy = dy / d;
      fx[i] += ux * f;
      fy[i] += uy * f;
      fx[j] -= ux * f;
      fy[j] -= uy * f;
    }
  }
  for (const e of edges) {
    let dx = pos[e.b].x - pos[e.a].x;
    let dy = pos[e.b].y - pos[e.a].y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const f = K_SPRING * (d - REST);
    const ux = dx / d;
    const uy = dy / d;
    fx[e.a] += ux * f;
    fy[e.a] += uy * f;
    fx[e.b] -= ux * f;
    fy[e.b] -= uy * f;
  }
  for (let i = 0; i < N; i++) {
    fx[i] += (CENTER - pos[i].x) * CENTER_PULL;
    fy[i] += (CENTER - pos[i].y) * CENTER_PULL;
  }
  for (let i = 1; i < N; i++) {
    pos[i].vx = (pos[i].vx + fx[i]) * DAMP;
    pos[i].vy = (pos[i].vy + fy[i]) * DAMP;
    const v = Math.sqrt(pos[i].vx ** 2 + pos[i].vy ** 2);
    if (v > VMAX) {
      pos[i].vx *= VMAX / v;
      pos[i].vy *= VMAX / v;
    }
    pos[i].x += pos[i].vx;
    pos[i].y += pos[i].vy;
  }
}

/* ---- radial clamp + collision resolution (no overlaps) ---- */
const clampRadial = () => {
  for (let i = 1; i < N; i++) {
    const dx = pos[i].x - CENTER;
    const dy = pos[i].y - CENTER;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > GRAPH_R) {
      pos[i].x = CENTER + (dx / d) * GRAPH_R;
      pos[i].y = CENTER + (dy / d) * GRAPH_R;
    }
  }
};
clampRadial();
for (let it = 0; it < 50; it++) {
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      let dx = pos[j].x - pos[i].x;
      let dy = pos[j].y - pos[i].y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const min = radius[i] + radius[j] + 3.5;
      if (d < min) {
        const push = (min - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        if (i !== 0) {
          pos[i].x -= ux * push;
          pos[i].y -= uy * push;
        }
        if (j !== 0) {
          pos[j].x += ux * push;
          pos[j].y += uy * push;
        }
      }
    }
  }
  clampRadial();
}

/* ---- persistence + scrub timing ---- */
const nodesOut = [];
for (let i = 0; i < N; i++) {
  const persist = kind[i] !== 0 ? 1 : rng() < 0.34 ? 1 : 0; // hubs always; ~34% of leaves
  const d = Math.floor(rng() * 16); // scrub delay bucket
  nodesOut.push({
    x: +pos[i].x.toFixed(1),
    y: +pos[i].y.toFixed(1),
    r: +radius[i].toFixed(2),
    k: kind[i],
    p: persist,
    d,
  });
}
const edgesOut = edges.map((e) => {
  const ap = nodesOut[e.a].p;
  const bp = nodesOut[e.b].p;
  const bb = e.bb || (ap && bp) ? 1 : 0; // backbone (steady) vs scrubbing
  let d = 0;
  if (!ap) d = nodesOut[e.a].d;
  else if (!bp) d = nodesOut[e.b].d;
  return { a: e.a, b: e.b, bb, d };
});

/* ---- emit ---- */
const banner =
  '// AUTO-GENERATED by scripts/gen-hero-graph.mjs — do not edit by hand.\n' +
  '// Deterministic force-directed layout for the Graph hero emblem, baked at\n' +
  '// build time so SSR + client render identical geometry (a live sim would\n' +
  '// diverge across JS engines and trigger hydration mismatch).\n';
const ts =
  banner +
  'export type HeroNode = { x: number; y: number; r: number; k: 0 | 1 | 2; p: 0 | 1; d: number };\n' +
  'export type HeroEdge = { a: number; b: number; bb: 0 | 1; d: number };\n\n' +
  `export const HERO_NODES: HeroNode[] = ${JSON.stringify(nodesOut)};\n\n` +
  `export const HERO_EDGES: HeroEdge[] = ${JSON.stringify(edgesOut)};\n`;

writeFileSync(join(__dirname, '..', 'src', 'components', 'hero-graph-data.ts'), ts);
console.log(
  `hero-graph-data.ts: ${nodesOut.length} nodes (${nodesOut.filter((n) => n.p).length} persistent, ` +
    `${nodesOut.filter((n) => !n.p).length} scrubbing), ${edgesOut.length} edges ` +
    `(${edgesOut.filter((e) => e.bb).length} backbone).`,
);
