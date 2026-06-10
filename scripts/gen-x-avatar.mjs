/**
 * gen-x-avatar.mjs — build a 400×400 X / Twitter profile avatar → x-avatar.png.
 *
 * Privacy-clean: rendered locally with resvg, system fonts only. NOT deployed —
 * a social asset to upload to the project's X profile. X circle-crops the avatar,
 * so the motif is centred inside a circle-safe radius; corners are decorative bg.
 *
 * Graph mark = a compact force-directed glyph (gold hub + spokes) matching the
 * banner. The Grid sibling ships its own (spiral-tile glyph).
 */
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const S = 400;
const BG = '#08080c';
const GOLD = '#ffd700';
const BRASS = '#c28840';
const cx = 200;
const cy = 200;

// Compact graph glyph: a central hub + a ring of nodes, readable down to 48px.
const nodes = Array.from({ length: 7 }, (_, i) => {
  const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
  const r = 92 + (i % 3) * 16;
  return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, rad: 10 + (i % 3) * 4 };
});
const edges = nodes
  .map((n) => `<line x1="${cx}" y1="${cy}" x2="${n.x.toFixed(1)}" y2="${n.y.toFixed(1)}" stroke="${BRASS}" stroke-width="2.6" stroke-opacity="0.55"/>`)
  .join('');
const cross = [[0, 2], [2, 4], [4, 6], [6, 1], [1, 3]]
  .map(([i, j]) => `<line x1="${nodes[i].x.toFixed(1)}" y1="${nodes[i].y.toFixed(1)}" x2="${nodes[j].x.toFixed(1)}" y2="${nodes[j].y.toFixed(1)}" stroke="${BRASS}" stroke-width="1.6" stroke-opacity="0.3"/>`)
  .join('');
const dots = nodes
  .map((n) => `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${n.rad}" fill="${GOLD}"/>`)
  .join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="${GOLD}" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="${GOLD}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${S}" height="${S}" fill="${BG}"/>
  <circle cx="${cx}" cy="${cy}" r="200" fill="url(#glow)"/>
  <circle cx="${cx}" cy="${cy}" r="188" fill="none" stroke="${BRASS}" stroke-opacity="0.4" stroke-width="3"/>
  ${edges}${cross}${dots}
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
