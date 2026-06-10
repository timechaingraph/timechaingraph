/**
 * gen-x-avatar.mjs — build a 400×400 X / Twitter profile avatar → x-avatar.png.
 *
 * Privacy-clean: rendered locally with resvg, system fonts only. NOT deployed.
 * X circle-crops the avatar, so the network is kept inside a circle-safe radius.
 *
 * The mark is a cutout of the actual force-directed graph: a SCALE-FREE network
 * (Barabási–Albert preferential attachment → a few high-degree hubs + many
 * leaves, like the real Bitcoin wallet graph), organically branched from a
 * laser-hot Satoshi center, degree-sized nodes, real palette (gold whales /
 * cyan significant / amber / grey dust) — with ⚡ Lightning arcs glowing out of
 * the core (Bitcoin-maxi energy). Deterministic via a fixed seed.
 *
 * Glow is done with layered strokes (wide-soft → mid → bright core) rather than
 * SVG filters, so it renders identically under resvg.
 */
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const S = 400;
const cx = 200;
const cy = 200;
const SAFE = 166;
const BG = '#08080c';
const BRASS = '#c28840';
const GOLD = '#ffd700';
const AMBER = '#f5a623';
const CYAN = '#35c5e0';
const GREY = '#6a6a76';
const ELECTRIC = '#eaffff';

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(7423190);

// --- grow a scale-free graph (preferential attachment) -------------------
const N = 24;
const nodes = [{ x: cx, y: cy, deg: 0 }];
const links = [];
const BRANCHES = 6; // evenly-spread primary branches off the core → balanced
for (let i = 1; i < N; i++) {
  let p, ang, dist;
  if (i <= BRANCHES) {
    p = 0;
    ang = ((i - 1) / BRANCHES) * Math.PI * 2 + (rand() - 0.5) * 0.5;
    dist = 54 + rand() * 22;
  } else {
    // preferential attachment for the rest
    let total = 0;
    for (const n of nodes) total += n.deg + 1;
    let r = rand() * total;
    p = 0;
    for (let k = 0; k < nodes.length; k++) {
      r -= nodes[k].deg + 1;
      if (r <= 0) { p = k; break; }
    }
    const par0 = nodes[p];
    const outward = p === 0 ? rand() * Math.PI * 2 : Math.atan2(par0.y - cy, par0.x - cx);
    ang = outward + (rand() - 0.5) * 1.5;
    dist = 36 + rand() * 40;
  }
  const par = nodes[p];
  let x = par.x + Math.cos(ang) * dist;
  let y = par.y + Math.sin(ang) * dist;
  const rr = Math.hypot(x - cx, y - cy);
  if (rr > SAFE) { x = cx + ((x - cx) / rr) * SAFE; y = cy + ((y - cy) / rr) * SAFE; }
  nodes.push({ x, y, deg: 0 });
  par.deg++;
  nodes[nodes.length - 1].deg++;
  links.push([p, nodes.length - 1, 0.42]);
}
for (let i = 1; i < nodes.length; i++) {
  for (let j = i + 1; j < nodes.length; j++) {
    if (Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) < 40 && rand() < 0.28) {
      links.push([i, j, 0.22]);
      nodes[i].deg++;
      nodes[j].deg++;
    }
  }
}

// Recenter the cloud's centroid on the canvas center, re-pin the core, clamp.
{
  const mx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length;
  const my = nodes.reduce((s, n) => s + n.y, 0) / nodes.length;
  for (const n of nodes) {
    n.x += cx - mx;
    n.y += cy - my;
    const rr = Math.hypot(n.x - cx, n.y - cy);
    if (rr > SAFE) { n.x = cx + ((n.x - cx) / rr) * SAFE; n.y = cy + ((n.y - cy) / rr) * SAFE; }
  }
  nodes[0].x = cx;
  nodes[0].y = cy;
}

function colorFor(i, deg) {
  if (i === 0) return GOLD;
  if (deg >= 5) return GOLD;
  if (deg >= 3) return CYAN;
  return i % 2 ? AMBER : GREY;
}

const edgeEls = links
  .map(([a, b, op]) => `<line x1="${nodes[a].x.toFixed(1)}" y1="${nodes[a].y.toFixed(1)}" x2="${nodes[b].x.toFixed(1)}" y2="${nodes[b].y.toFixed(1)}" stroke="${BRASS}" stroke-width="${(1.2 + op).toFixed(1)}" stroke-opacity="${op}"/>`)
  .join('');
const dotEls = nodes
  .map((n, i) => {
    const rad = i === 0 ? 22 : Math.min(15, 4.5 + Math.sqrt(n.deg) * 3.6);
    return `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${rad.toFixed(1)}" fill="${colorFor(i, n.deg)}"/>`;
  })
  .join('');

// --- ⚡ lightning arcs from the core to 3 spread-out outer nodes ----------
// pick the farthest node in each of 3 angular sectors for good spread
function boltTargets() {
  const sectors = [[], [], []];
  for (let i = 1; i < nodes.length; i++) {
    const a = (Math.atan2(nodes[i].y - cy, nodes[i].x - cx) + Math.PI) / (Math.PI * 2);
    sectors[Math.min(2, Math.floor(a * 3))].push(i);
  }
  return sectors
    .map((s) => s.sort((p, q) => Math.hypot(nodes[q].x - cx, nodes[q].y - cy) - Math.hypot(nodes[p].x - cx, nodes[p].y - cy))[0])
    .filter((v) => v !== undefined);
}
function boltPath(tx, ty) {
  const segs = 5;
  const dx = tx - cx;
  const dy = ty - cy;
  const len = Math.hypot(dx, dy) || 1;
  const ox = -dy / len;
  const oy = dx / len;
  const pts = [[cx, cy]];
  for (let s = 1; s < segs; s++) {
    const t = s / segs;
    const off = (rand() - 0.5) * 22 * Math.sin(t * Math.PI); // max jag mid-bolt
    pts.push([cx + dx * t + ox * off, cy + dy * t + oy * off]);
  }
  pts.push([tx, ty]);
  return pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
}
const bolts = boltTargets()
  .map((i) => {
    const pts = boltPath(nodes[i].x, nodes[i].y);
    // layered glow: wide-soft → mid → bright core
    return `<polyline points="${pts}" fill="none" stroke="${CYAN}" stroke-width="9" stroke-opacity="0.16" stroke-linecap="round" stroke-linejoin="round"/>
    <polyline points="${pts}" fill="none" stroke="${CYAN}" stroke-width="4.5" stroke-opacity="0.45" stroke-linecap="round" stroke-linejoin="round"/>
    <polyline points="${pts}" fill="none" stroke="${ELECTRIC}" stroke-width="1.8" stroke-opacity="0.95" stroke-linecap="round" stroke-linejoin="round"/>`;
  })
  .join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="62%">
      <stop offset="0%" stop-color="${GOLD}" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="${GOLD}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${S}" height="${S}" fill="${BG}"/>
  <circle cx="${cx}" cy="${cy}" r="200" fill="url(#glow)"/>
  <circle cx="${cx}" cy="${cy}" r="188" fill="none" stroke="${BRASS}" stroke-opacity="0.4" stroke-width="3"/>
  ${edgeEls}${dotEls}
  ${bolts}
  <!-- laser-hot Satoshi core: gold halo → gold body → white-hot center -->
  <circle cx="${cx}" cy="${cy}" r="40" fill="${GOLD}" fill-opacity="0.12"/>
  <circle cx="${cx}" cy="${cy}" r="30" fill="${GOLD}" fill-opacity="0.22"/>
  <circle cx="${cx}" cy="${cy}" r="22" fill="${GOLD}"/>
  <circle cx="${cx}" cy="${cy}" r="9" fill="${ELECTRIC}"/>
  <circle cx="${cx}" cy="${cy}" r="33" fill="none" stroke="${BRASS}" stroke-opacity="0.7" stroke-width="2.4"/>
</svg>`;

const png = new Resvg(svg, {
  fitTo: { mode: 'width', value: S },
  font: { loadSystemFonts: true },
  background: BG,
}).render().asPng();

const out = join(root, 'x-avatar.png');
writeFileSync(out, png);
console.log(`[gen-x-avatar] wrote ${out} (${(png.length / 1024).toFixed(0)} KB, ${S}x${S})`);
