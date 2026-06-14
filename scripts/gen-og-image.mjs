/**
 * gen-og-image.mjs — build a 1200×630 Open Graph share card → public/og.png.
 *
 * Privacy-clean: rendered locally at build time with resvg (no external fonts,
 * no third-party image service). Uses system fonts (Georgia display + monospace)
 * the same way the site does. Run from prebuild + the deploy script.
 *
 * The network motif is the operator-approved brand mark (same language as the
 * X avatar/banner): an orange Satoshi core ringed by two interleaved, evenly
 * spaced rings of yellow-gold nodes — placed lower-right, fully clear of the
 * hero text block so the title is never obstructed.
 *
 * Brand values are Graph's; the Grid sibling ships its own version (different
 * brand / domain / motif). Keep the two in their respective repos.
 */
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const BRAND = 'Timechain Graph';
const SUB = 'of Bitcoin.';
const TAGLINE = 'Bitcoin Visualised · Open Source · Public';
const DOMAIN = 'timechaingraph.com';

const W = 1200;
const H = 630;
const BG = '#08080c';
const GOLD = '#ffd700';
const BRASS = '#c28840';
const FAINT = '#6b6b73';
const SATOSHI = '#f0731a'; // deep Bitcoin-orange core
const NODE = '#f9c63e'; // yellow-gold nodes

// Crown motif — lower-right, clear of the text column (title ends ~x885,y272;
// the crown's leftmost reach stays right/below it).
const mx = 1020;
const my = 398;
const K = 6;
const START = -Math.PI / 2;
const inner = Array.from({ length: K }, (_, i) => {
  const a = START + (i / K) * Math.PI * 2;
  return { x: mx + Math.cos(a) * 85, y: my + Math.sin(a) * 85, rad: i % 2 ? 12 : 13.5, br: i % 2 ? 0.85 : 1 };
});
const outer = Array.from({ length: K }, (_, i) => {
  const a = START + ((i + 0.5) / K) * Math.PI * 2;
  return { x: mx + Math.cos(a) * 118, y: my + Math.sin(a) * 118, rad: i % 2 ? 9 : 10.5, br: i % 2 ? 0.55 : 0.72 };
});
const edge = (p, q, w, op) =>
  `<line x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${q.x.toFixed(1)}" y2="${q.y.toFixed(1)}" stroke="${BRASS}" stroke-width="${w}" stroke-opacity="${op}"/>`;
const core = { x: mx, y: my };
const hexEls = inner.map((n, i) => edge(n, inner[(i + 1) % K], 1.2, 0.18)).join('');
const spokeEls = inner.map((n) => edge(core, n, 2.2, 0.5)).join('');
const crownEls = outer
  .map((o, j) => edge(o, inner[j], 1.6, 0.42) + edge(o, inner[(j + 1) % K], 1.6, 0.42))
  .join('');
const dots = [...inner, ...outer]
  .map((n) => `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${n.rad}" fill="${NODE}" fill-opacity="${n.br}"/>`)
  .join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="glow" cx="84%" cy="62%" r="48%">
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
  <rect x="20" y="20" width="${W - 40}" height="${H - 40}" rx="18" fill="none" stroke="${BRASS}" stroke-opacity="0.34" stroke-width="1.5"/>
  ${hexEls}${crownEls}${spokeEls}${dots}
  <circle cx="${mx}" cy="${my}" r="38" fill="${SATOSHI}" fill-opacity="0.15"/>
  <circle cx="${mx}" cy="${my}" r="26" fill="${SATOSHI}"/>
  <circle cx="${mx}" cy="${my}" r="34" fill="none" stroke="${BRASS}" stroke-opacity="0.65" stroke-width="2.2"/>
  <text x="84" y="246" font-family="Georgia, 'Times New Roman', serif" font-size="92" font-weight="700" fill="url(#title)">${BRAND}</text>
  <text x="84" y="350" font-family="Georgia, 'Times New Roman', serif" font-size="92" font-weight="700" fill="#a1a1aa">${SUB}</text>
  <text x="88" y="430" font-family="ui-monospace, Menlo, monospace" font-size="27" letter-spacing="1.5" fill="${FAINT}">${TAGLINE}</text>
  <text x="88" y="510" font-family="ui-monospace, Menlo, monospace" font-size="26" letter-spacing="2" fill="${GOLD}">${DOMAIN}</text>
</svg>`;

const png = new Resvg(svg, {
  fitTo: { mode: 'width', value: W },
  font: { loadSystemFonts: true },
  background: BG,
}).render().asPng();

const out = join(root, 'public', 'og.png');
writeFileSync(out, png);
// Same card at a clean versioned PATH — X's image fetcher caches failures
// per-URL and mishandles query-stringed image URLs; a fresh path escapes both.
writeFileSync(join(root, 'public', 'og2.png'), png);
console.log(`[gen-og-image] wrote ${out} + og2.png (${(png.length / 1024).toFixed(0)} KB, ${W}x${H})`);
