/**
 * gen-x-banner.mjs — build a 1500×500 X / Twitter header → x-banner.png (repo root).
 *
 * Privacy-clean: rendered locally with resvg, system fonts only (same pipeline as
 * gen-og-image.mjs). NOT part of the deployed site — it's a social asset to upload
 * to the project's X profile. Layout keeps all text clear of X's bottom-left avatar
 * overlap and the responsive bottom crop.
 *
 * Brand values are Graph's; the Grid sibling ships its own (different motif/domain).
 */
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const BRAND = 'Timechain Graph';
const TAGLINE = 'the living network of Bitcoin';
const SUBTAG = 'Bitcoin Visualised · privacy-first · no tracking · open source';
const DOMAIN = 'timechaingraph.com';

const W = 1500;
const H = 500;
const BG = '#08080c';
const GOLD = '#ffd700';
const BRASS = '#c28840';
const MUTED = '#d4d4dc';
const FAINT = '#7a7a83';

// Force-directed network motif on the right — a main hub + two spoke rings plus a
// satellite cluster, with a few cross-links for texture. Deterministic (trig by
// index, no RNG) so the banner is reproducible.
const hub = { x: 1180, y: 250 };
const ring = Array.from({ length: 11 }, (_, i) => {
  const a = (i / 11) * Math.PI * 2 + 0.4;
  const r = 95 + (i % 3) * 34;
  return { x: hub.x + Math.cos(a) * r, y: hub.y + Math.sin(a) * r, rad: 4 + (i % 3) * 2.5 };
});
const sat = { x: 1330, y: 150 };
const satRing = Array.from({ length: 5 }, (_, i) => {
  const a = (i / 5) * Math.PI * 2;
  return { x: sat.x + Math.cos(a) * 42, y: sat.y + Math.sin(a) * 42, rad: 3 };
});
const allNodes = [...ring, ...satRing];
const edges = ring
  .map((s) => `<line x1="${hub.x}" y1="${hub.y}" x2="${s.x.toFixed(1)}" y2="${s.y.toFixed(1)}" stroke="${BRASS}" stroke-width="1.3" stroke-opacity="0.38"/>`)
  .join('');
const satEdges = satRing
  .map((s) => `<line x1="${sat.x}" y1="${sat.y}" x2="${s.x.toFixed(1)}" y2="${s.y.toFixed(1)}" stroke="${BRASS}" stroke-width="1" stroke-opacity="0.3"/>`)
  .join('') + `<line x1="${hub.x}" y1="${hub.y}" x2="${sat.x}" y2="${sat.y}" stroke="${BRASS}" stroke-width="1.2" stroke-opacity="0.3"/>`;
const cross = [[0, 3], [3, 6], [6, 9], [1, 7], [4, 10]]
  .map(([i, j]) => `<line x1="${ring[i].x.toFixed(1)}" y1="${ring[i].y.toFixed(1)}" x2="${ring[j].x.toFixed(1)}" y2="${ring[j].y.toFixed(1)}" stroke="${BRASS}" stroke-width="1" stroke-opacity="0.18"/>`)
  .join('');
const dots = allNodes
  .map((s) => `<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="${s.rad}" fill="${GOLD}" fill-opacity="0.88"/>`)
  .join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="glow" cx="76%" cy="42%" r="52%">
      <stop offset="0%" stop-color="${GOLD}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${GOLD}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="title" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffe680"/>
      <stop offset="100%" stop-color="${GOLD}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="22" y="22" width="${W - 44}" height="${H - 44}" rx="20" fill="none" stroke="${BRASS}" stroke-opacity="0.34" stroke-width="1.5"/>
  ${edges}${satEdges}${cross}${dots}
  <circle cx="${hub.x}" cy="${hub.y}" r="15" fill="${GOLD}"/>
  <circle cx="${hub.x}" cy="${hub.y}" r="26" fill="none" stroke="${GOLD}" stroke-opacity="0.4" stroke-width="1.6"/>
  <circle cx="${sat.x}" cy="${sat.y}" r="8" fill="${GOLD}"/>
  <text x="96" y="215" font-family="Georgia, 'Times New Roman', serif" font-size="104" font-weight="700" fill="url(#title)">${BRAND}</text>
  <text x="100" y="285" font-family="Georgia, 'Times New Roman', serif" font-size="40" font-style="italic" fill="${MUTED}">${TAGLINE}</text>
  <text x="102" y="338" font-family="ui-monospace, Menlo, monospace" font-size="22" letter-spacing="1.2" fill="${FAINT}">${SUBTAG}</text>
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
