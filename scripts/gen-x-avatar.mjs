/**
 * gen-x-avatar.mjs — build a 400×400 X / Twitter profile avatar → x-avatar.png.
 *
 * Privacy-clean: rendered locally with resvg, system fonts only. NOT deployed.
 * X circle-crops the avatar, so the motif sits inside a circle-safe radius.
 *
 * A clean force-graph glyph: a gold Satoshi core + a ring of degree-sized nodes
 * with a few cross-links — readable down to timeline size. WARM palette only
 * (gold / amber / Bitcoin-orange) to match the live graph.
 */
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const S = 400;
const cx = 200;
const cy = 200;
const BG = '#08080c';
const BRASS = '#c28840';
const GOLD = '#ffd700';
const AMBER = '#f5a623';
const ORANGE = '#f7931a'; // Bitcoin orange

// Ring of nodes around the core. Radius + size vary by tier for an organic feel.
const COUNT = 10;
const nodes = Array.from({ length: COUNT }, (_, i) => {
  const a = (i / COUNT) * Math.PI * 2 - Math.PI / 2;
  const r = 92 + (i % 3) * 20; // 92 / 112 / 132
  const rad = 10 + (i % 3) * 4; // 10 / 14 / 18
  return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, rad };
});

// Size → warmth: big = gold (whale), mid = amber, small = orange.
const colorFor = (rad) => (rad >= 18 ? GOLD : rad >= 14 ? AMBER : ORANGE);

// Spokes (core → each node).
const spokes = nodes
  .map((n) => `<line x1="${cx}" y1="${cy}" x2="${n.x.toFixed(1)}" y2="${n.y.toFixed(1)}" stroke="${BRASS}" stroke-width="2.4" stroke-opacity="0.5"/>`)
  .join('');
// A couple of cross-links only — keep it sparse.
const cross = [[1, 5], [3, 8]]
  .map(([i, j]) => `<line x1="${nodes[i].x.toFixed(1)}" y1="${nodes[i].y.toFixed(1)}" x2="${nodes[j].x.toFixed(1)}" y2="${nodes[j].y.toFixed(1)}" stroke="${BRASS}" stroke-width="1.5" stroke-opacity="0.28"/>`)
  .join('');
const dots = nodes
  .map((n) => `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${n.rad}" fill="${colorFor(n.rad)}"/>`)
  .join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="${GOLD}" stop-opacity="0.13"/>
      <stop offset="100%" stop-color="${GOLD}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${S}" height="${S}" fill="${BG}"/>
  <circle cx="${cx}" cy="${cy}" r="200" fill="url(#glow)"/>
  <circle cx="${cx}" cy="${cy}" r="188" fill="none" stroke="${BRASS}" stroke-opacity="0.4" stroke-width="3"/>
  ${spokes}${cross}${dots}
  <circle cx="${cx}" cy="${cy}" r="40" fill="none" stroke="${GOLD}" stroke-opacity="0.4" stroke-width="2.4"/>
  <circle cx="${cx}" cy="${cy}" r="26" fill="${GOLD}"/>
</svg>`;

const png = new Resvg(svg, {
  fitTo: { mode: 'width', value: S },
  font: { loadSystemFonts: true },
  background: BG,
}).render().asPng();

const out = join(root, 'x-avatar.png');
writeFileSync(out, png);
console.log(`[gen-x-avatar] wrote ${out} (${(png.length / 1024).toFixed(0)} KB, ${S}x${S})`);
