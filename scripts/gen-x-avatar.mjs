/**
 * gen-x-avatar.mjs — build a 400×400 X / Twitter profile avatar → x-avatar.png.
 *
 * Privacy-clean: rendered locally with resvg, system fonts only. NOT deployed.
 * X circle-crops the avatar, so the motif sits inside a circle-safe radius.
 *
 * A balanced, symmetric force-graph "crown": an ORANGE Satoshi core ringed by two
 * interleaved rings of yellow-gold nodes (evenly spaced, varied brightness). The
 * topology is intentional, not a random web — a few spokes to the core, a zigzag
 * crown linking the rings, and a faint inner hexagon. Fully deterministic.
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
const NODE = '#f9c63e'; // yellow-gold outer nodes

const K = 6; // 6 inner + 6 outer = 12 nodes, evenly spaced every 30°
const START = -Math.PI / 2;
// Inner ring (closer, larger, brighter) and outer ring (offset 30°, smaller, dimmer).
const inner = Array.from({ length: K }, (_, i) => {
  const a = START + (i / K) * Math.PI * 2;
  return { x: cx + Math.cos(a) * 102, y: cy + Math.sin(a) * 102, rad: i % 2 ? 12 : 13.5, bright: i % 2 ? 0.85 : 1 };
});
const outer = Array.from({ length: K }, (_, i) => {
  const a = START + ((i + 0.5) / K) * Math.PI * 2;
  return { x: cx + Math.cos(a) * 140, y: cy + Math.sin(a) * 140, rad: i % 2 ? 9 : 10.5, bright: i % 2 ? 0.55 : 0.72 };
});

const edge = (p, q, w, op) => `<line x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${q.x.toFixed(1)}" y2="${q.y.toFixed(1)}" stroke="${BRASS}" stroke-width="${w}" stroke-opacity="${op}"/>`;
const core = { x: cx, y: cy };

// faint inner hexagon → spokes to core → zigzag crown linking the two rings
const hexEls = inner.map((n, i) => edge(n, inner[(i + 1) % K], 1.2, 0.18)).join('');
const spokeEls = inner.map((n) => edge(core, n, 2.2, 0.5)).join('');
const crownEls = outer
  .map((o, j) => edge(o, inner[j], 1.6, 0.42) + edge(o, inner[(j + 1) % K], 1.6, 0.42))
  .join('');

const dots = [...inner, ...outer]
  .map((n) => `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${n.rad}" fill="${NODE}" fill-opacity="${n.bright}"/>`)
  .join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="58%">
      <stop offset="0%" stop-color="${SATOSHI}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${SATOSHI}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${S}" height="${S}" fill="${BG}"/>
  <circle cx="${cx}" cy="${cy}" r="200" fill="url(#glow)"/>
  <circle cx="${cx}" cy="${cy}" r="188" fill="none" stroke="${BRASS}" stroke-opacity="0.4" stroke-width="3"/>
  ${hexEls}${crownEls}${spokeEls}${dots}
  <!-- orange Satoshi core: soft halo → body → brass ring -->
  <circle cx="${cx}" cy="${cy}" r="36" fill="${SATOSHI}" fill-opacity="0.15"/>
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
