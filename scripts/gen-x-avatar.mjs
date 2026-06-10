/**
 * gen-x-avatar.mjs — build a 400×400 X / Twitter profile avatar → x-avatar.png.
 *
 * Privacy-clean: rendered locally with resvg, system fonts only. NOT deployed.
 * X circle-crops the avatar, so the motif sits inside a circle-safe radius.
 *
 * A simple, artsy force-graph glyph: a single ORANGE Satoshi core surrounded by
 * twelve AMBER nodes (same hue, varied brightness), organically placed. The
 * topology is a real graph — only a few nodes link to the core; the rest link to
 * each other via broken ring-arcs + a few chords. Deterministic seed.
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
const SATOSHI = '#f0731a'; // deep Bitcoin-orange core
const AMBER = '#f5a623'; // outer nodes (brightness varies via opacity)

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(50318);

// Twelve nodes on an organically-jittered ring.
const COUNT = 12;
const nodes = Array.from({ length: COUNT }, (_, i) => {
  const a = (i / COUNT) * Math.PI * 2 - Math.PI / 2 + (rand() - 0.5) * 0.36;
  const r = 100 + (rand() - 0.5) * 36;
  const rad = 9 + rand() * 5.5;
  const bright = 0.5 + rand() * 0.5; // brightness/dimness, same amber hue
  return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, rad, bright };
});

// Topology: only a few spokes to the core; the rest is node-to-node web.
const spokeIdx = [0, 3, 6, 9];
const arcs = [];
for (let i = 0; i < COUNT; i++) if (i % 4 !== 3) arcs.push([i, (i + 1) % COUNT]); // broken ring
const chords = [[1, 7], [4, 10], [2, 8]];

const spokeEls = spokeIdx
  .map((i) => `<line x1="${cx}" y1="${cy}" x2="${nodes[i].x.toFixed(1)}" y2="${nodes[i].y.toFixed(1)}" stroke="${BRASS}" stroke-width="2.2" stroke-opacity="0.5"/>`)
  .join('');
const arcEls = arcs
  .map(([i, j]) => `<line x1="${nodes[i].x.toFixed(1)}" y1="${nodes[i].y.toFixed(1)}" x2="${nodes[j].x.toFixed(1)}" y2="${nodes[j].y.toFixed(1)}" stroke="${BRASS}" stroke-width="1.6" stroke-opacity="0.4"/>`)
  .join('');
const chordEls = chords
  .map(([i, j]) => `<line x1="${nodes[i].x.toFixed(1)}" y1="${nodes[i].y.toFixed(1)}" x2="${nodes[j].x.toFixed(1)}" y2="${nodes[j].y.toFixed(1)}" stroke="${BRASS}" stroke-width="1.3" stroke-opacity="0.24"/>`)
  .join('');
const dots = nodes
  .map((n) => `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${n.rad.toFixed(1)}" fill="${AMBER}" fill-opacity="${n.bright.toFixed(2)}"/>`)
  .join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="${SATOSHI}" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="${SATOSHI}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${S}" height="${S}" fill="${BG}"/>
  <circle cx="${cx}" cy="${cy}" r="200" fill="url(#glow)"/>
  <circle cx="${cx}" cy="${cy}" r="188" fill="none" stroke="${BRASS}" stroke-opacity="0.4" stroke-width="3"/>
  ${arcEls}${chordEls}${spokeEls}${dots}
  <!-- orange Satoshi core: soft halo → body → brass ring -->
  <circle cx="${cx}" cy="${cy}" r="36" fill="${SATOSHI}" fill-opacity="0.14"/>
  <circle cx="${cx}" cy="${cy}" r="25" fill="${SATOSHI}"/>
  <circle cx="${cx}" cy="${cy}" r="33" fill="none" stroke="${BRASS}" stroke-opacity="0.65" stroke-width="2.2"/>
</svg>`;

const png = new Resvg(svg, {
  fitTo: { mode: 'width', value: S },
  font: { loadSystemFonts: true },
  background: BG,
}).render().asPng();

const out = join(root, 'x-avatar.png');
writeFileSync(out, png);
console.log(`[gen-x-avatar] wrote ${out} (${(png.length / 1024).toFixed(0)} KB, ${S}x${S})`);
