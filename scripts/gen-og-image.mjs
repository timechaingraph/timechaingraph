/**
 * gen-og-image.mjs — build a 1200×630 Open Graph share card → public/og.png.
 *
 * Privacy-clean: rendered locally at build time with resvg (no external fonts,
 * no third-party image service). Uses system fonts (Georgia display + monospace)
 * the same way the site does. Run from prebuild + the deploy script.
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
const TAGLINE = 'Bitcoin Visualised · public · privacy-first';
const DOMAIN = 'timechaingraph.com';

const W = 1200;
const H = 630;
const BG = '#08080c';
const GOLD = '#ffd700';
const BRASS = '#c28840';
const MUTED = '#a1a1aa';
const FAINT = '#6b6b73';

// Hub-and-spoke network motif in the lower-right — evokes the force-directed
// graph. Positioned clear of the title (which ends ~x900 on its first line).
const hub = { x: 985, y: 378 };
const spokes = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2 + 0.3;
  const r = 100 + (i % 3) * 26;
  return { x: hub.x + Math.cos(a) * r, y: hub.y + Math.sin(a) * r, rad: 4 + (i % 3) * 2 };
});
const edges = spokes
  .map((s) => `<line x1="${hub.x}" y1="${hub.y}" x2="${s.x.toFixed(1)}" y2="${s.y.toFixed(1)}" stroke="${BRASS}" stroke-width="1.2" stroke-opacity="0.35"/>`)
  .join('');
// a couple of spoke-to-spoke links for texture
const cross = [[0, 2], [2, 5], [5, 7], [1, 4]]
  .map(([i, j]) => `<line x1="${spokes[i].x.toFixed(1)}" y1="${spokes[i].y.toFixed(1)}" x2="${spokes[j].x.toFixed(1)}" y2="${spokes[j].y.toFixed(1)}" stroke="${BRASS}" stroke-width="1" stroke-opacity="0.2"/>`)
  .join('');
const dots = spokes
  .map((s) => `<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="${s.rad}" fill="${GOLD}" fill-opacity="0.85"/>`)
  .join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="glow" cx="78%" cy="36%" r="55%">
      <stop offset="0%" stop-color="${GOLD}" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="${GOLD}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="title" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffe680"/>
      <stop offset="100%" stop-color="${GOLD}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="20" y="20" width="${W - 40}" height="${H - 40}" rx="18" fill="none" stroke="${BRASS}" stroke-opacity="0.34" stroke-width="1.5"/>
  ${edges}${cross}${dots}
  <circle cx="${hub.x}" cy="${hub.y}" r="13" fill="${GOLD}"/>
  <circle cx="${hub.x}" cy="${hub.y}" r="22" fill="none" stroke="${GOLD}" stroke-opacity="0.4" stroke-width="1.5"/>
  <text x="84" y="246" font-family="Georgia, 'Times New Roman', serif" font-size="92" font-weight="700" fill="url(#title)">${BRAND}</text>
  <text x="84" y="350" font-family="Georgia, 'Times New Roman', serif" font-size="92" font-weight="700" fill="${MUTED}">${SUB}</text>
  <text x="88" y="430" font-family="ui-monospace, Menlo, monospace" font-size="27" letter-spacing="1.5" fill="${FAINT}">${TAGLINE}</text>
  <text x="88" y="560" font-family="ui-monospace, Menlo, monospace" font-size="26" letter-spacing="2" fill="${GOLD}">${DOMAIN}</text>
</svg>`;

const png = new Resvg(svg, {
  fitTo: { mode: 'width', value: W },
  font: { loadSystemFonts: true },
  background: BG,
}).render().asPng();

const out = join(root, 'public', 'og.png');
writeFileSync(out, png);
console.log(`[gen-og-image] wrote ${out} (${(png.length / 1024).toFixed(0)} KB, ${W}x${H})`);
