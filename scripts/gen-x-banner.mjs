/**
 * gen-x-banner.mjs — build a 1500×500 X / Twitter header → x-banner.png (repo root).
 *
 * Privacy-clean: rendered locally with resvg, system fonts only. NOT deployed —
 * a social asset to upload to the project's X profile. Text is kept well clear of
 * the network motif (right) and of X's bottom-left avatar overlap.
 *
 * Motif = the avatar's balanced crown (orange Satoshi core + yellow-gold node
 * rings) extended rightward into a small cluster, for an artsy, off-balance feel.
 */
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const BRAND = 'Timechain Graph';
const SUB = 'Bitcoin Visualised';
const DOMAIN = 'timechaingraph.com';

const W = 1500;
const H = 500;
const BG = '#08080c';
const GOLD = '#ffd700';
const BRASS = '#c28840';
const MUTED = '#cfcfd6';
const NODE = '#f9c63e'; // yellow-gold (matches avatar)
const SATOSHI = '#f0731a'; // deep Bitcoin-orange core

// --- network motif: balanced crown + rightward cluster -------------------
const mx = 1205;
const my = 248;
const K = 6;
const START = -Math.PI / 2;
const inner = Array.from({ length: K }, (_, i) => {
  const a = START + (i / K) * Math.PI * 2;
  return { x: mx + Math.cos(a) * 80, y: my + Math.sin(a) * 80, rad: i % 2 ? 11 : 12.5, br: i % 2 ? 0.85 : 1 };
});
const outer = Array.from({ length: K }, (_, i) => {
  const a = START + ((i + 0.5) / K) * Math.PI * 2;
  return { x: mx + Math.cos(a) * 110, y: my + Math.sin(a) * 110, rad: i % 2 ? 8.5 : 9.5, br: i % 2 ? 0.55 : 0.72 };
});
const cluster = [
  { x: mx + 168, y: my - 60, rad: 10, br: 0.9 },
  { x: mx + 238, y: my - 24, rad: 7.5, br: 0.6 },
  { x: mx + 200, y: my + 54, rad: 11, br: 0.82 },
  { x: mx + 258, y: my + 36, rad: 7, br: 0.5 },
];
const core = { x: mx, y: my };
const edge = (p, q, w, op) => `<line x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${q.x.toFixed(1)}" y2="${q.y.toFixed(1)}" stroke="${BRASS}" stroke-width="${w}" stroke-opacity="${op}"/>`;

const hexEls = inner.map((n, i) => edge(n, inner[(i + 1) % K], 1.1, 0.16)).join('');
const spokeEls = inner.map((n) => edge(core, n, 2, 0.48)).join('');
const crownEls = outer.map((o, j) => edge(o, inner[j], 1.5, 0.4) + edge(o, inner[(j + 1) % K], 1.5, 0.4)).join('');
const clusterEls = [
  edge(outer[1], cluster[0], 1.5, 0.4),
  edge(inner[1], cluster[0], 1.3, 0.3),
  edge(cluster[0], cluster[1], 1.3, 0.3),
  edge(cluster[0], cluster[2], 1.3, 0.3),
  edge(cluster[1], cluster[3], 1.2, 0.24),
  edge(cluster[2], cluster[3], 1.2, 0.24),
  edge(outer[2], cluster[2], 1.3, 0.3),
].join('');
const dots = [...inner, ...outer, ...cluster]
  .map((n) => `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${n.rad}" fill="${NODE}" fill-opacity="${n.br}"/>`)
  .join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="glow" cx="80%" cy="50%" r="48%">
      <stop offset="0%" stop-color="${SATOSHI}" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="${SATOSHI}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="title" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffe680"/>
      <stop offset="100%" stop-color="${GOLD}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="22" y="22" width="${W - 44}" height="${H - 44}" rx="20" fill="none" stroke="${BRASS}" stroke-opacity="0.34" stroke-width="1.5"/>
  ${hexEls}${crownEls}${clusterEls}${spokeEls}${dots}
  <circle cx="${core.x}" cy="${core.y}" r="34" fill="${SATOSHI}" fill-opacity="0.15"/>
  <circle cx="${core.x}" cy="${core.y}" r="23" fill="${SATOSHI}"/>
  <circle cx="${core.x}" cy="${core.y}" r="31" fill="none" stroke="${BRASS}" stroke-opacity="0.65" stroke-width="2.2"/>
  <text x="96" y="232" font-family="Georgia, 'Times New Roman', serif" font-size="106" font-weight="700" fill="url(#title)">${BRAND}</text>
  <text x="100" y="300" font-family="ui-monospace, Menlo, monospace" font-size="33" letter-spacing="3" fill="${MUTED}">${SUB}</text>
  <text x="1392" y="468" text-anchor="end" font-family="ui-monospace, Menlo, monospace" font-size="24" letter-spacing="2" fill="${GOLD}">${DOMAIN}</text>
</svg>`;

const png = new Resvg(svg, {
  fitTo: { mode: 'width', value: W },
  font: { loadSystemFonts: true },
  background: BG,
}).render().asPng();

const out = join(root, 'x-banner.png');
writeFileSync(out, png);
console.log(`[gen-x-banner] wrote ${out} (${(png.length / 1024).toFixed(0)} KB, ${W}x${H})`);
