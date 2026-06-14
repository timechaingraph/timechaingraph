/**
 * gen-x-banner.mjs — build a 1500×500 X / Twitter header → x-banner.png (repo root).
 *
 * Privacy-clean: rendered locally with resvg, system fonts only. NOT deployed.
 *
 * The right-side emblem is a STATIC SNAPSHOT of the live landing-page hero —
 * the shared brass frame + contra-rotating corner cogs (HeroFrame) wrapped around
 * the baked force-directed wallet network (HeroVisual / hero-graph-data.ts). We
 * read the same baked geometry the site uses, so the banner and the site match.
 */
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const W = 1500;
const H = 500;
const BG = '#08080c';
const GOLD = '#ffd700';
const BRASS = '#c28840';
const AMBER = '#f5a623'; // hero text colour
const GREY = '#8b8b94';

const BRAND = 'Timechain Graph';
const SUB = 'Bitcoin Visualised';
const DOMAIN = 'timechaingraph.com';

// --- pull the baked hero geometry (same data the site renders) -----------
const ts = readFileSync(join(root, 'src/components/hero-graph-data.ts'), 'utf8');
const NODES = JSON.parse(ts.match(/HERO_NODES[^=]*=\s*(\[[\s\S]*?\]);/)[1]);
const EDGES = JSON.parse(ts.match(/HERO_EDGES[^=]*=\s*(\[[\s\S]*?\]);/)[1]);

// --- hero emblem markup (ported static from HeroFrame + HeroVisual) ------
const SIZE = 440;
const C = SIZE / 2;
const OUTER = 200;
const INNER = 192;
const NOTCHES = [0, 45, 90, 135, 180, 225, 270, 315];
function gearPath(cx, cy, oR, iR, teeth) {
  const step = (Math.PI * 2) / (teeth * 2);
  let d = '';
  for (let i = 0; i < teeth * 2; i++) {
    const r = i % 2 === 0 ? oR : iR;
    const a = i * step;
    d += `${i === 0 ? 'M' : 'L'} ${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)} `;
  }
  return d + 'Z';
}
const notchEls = NOTCHES.map((deg, i) => {
  const rad = (deg * Math.PI) / 180;
  return `<line x1="${(C + Math.cos(rad) * (INNER + 2)).toFixed(1)}" y1="${(C + Math.sin(rad) * (INNER + 2)).toFixed(1)}" x2="${(C + Math.cos(rad) * (OUTER + 4)).toFixed(1)}" y2="${(C + Math.sin(rad) * (OUTER + 4)).toFixed(1)}" stroke="rgba(224,166,86,0.85)" stroke-width="${i % 2 === 0 ? 1.8 : 1.0}"/>`;
}).join('');
const rivetEls = Array.from({ length: 36 }, (_, i) => {
  const rad = (i * 10 * Math.PI) / 180;
  const r = (OUTER + INNER) / 2;
  return `<circle cx="${(C + Math.cos(rad) * r).toFixed(1)}" cy="${(C + Math.sin(rad) * r).toFixed(1)}" r="1" fill="rgba(255,215,0,0.5)"/>`;
}).join('');
const gear1 = `<path d="${gearPath(54, 54, 32, 25, 12)}" fill="url(#gear-fill)" stroke="url(#hero-brass-grad)" stroke-width="2.2" stroke-linejoin="round"/>
  <circle cx="54" cy="54" r="17" fill="none" stroke="rgba(224,166,86,0.55)" stroke-width="1.4"/>
  <circle cx="54" cy="54" r="12" fill="none" stroke="rgba(194,136,64,0.55)" stroke-width="1"/>
  ${[0, 90, 180, 270].map((deg) => { const r = (deg * Math.PI) / 180; return `<line x1="${(54 + Math.cos(r) * 5).toFixed(1)}" y1="${(54 + Math.sin(r) * 5).toFixed(1)}" x2="${(54 + Math.cos(r) * 16).toFixed(1)}" y2="${(54 + Math.sin(r) * 16).toFixed(1)}" stroke="rgba(194,136,64,0.55)" stroke-width="1.2" stroke-linecap="round"/>`; }).join('')}
  <circle cx="54" cy="54" r="5" fill="rgba(140,95,40,0.85)"/><circle cx="53" cy="53" r="1.6" fill="rgba(255,235,150,0.7)"/>`;
const g2 = SIZE - 58;
const gear2 = `<path d="${gearPath(g2, g2, 26, 20, 10)}" fill="url(#gear-fill)" stroke="url(#hero-brass-grad)" stroke-width="2.0" stroke-linejoin="round"/>
  <circle cx="${g2}" cy="${g2}" r="14" fill="none" stroke="rgba(224,166,86,0.55)" stroke-width="1.3"/>
  <circle cx="${g2}" cy="${g2}" r="9" fill="none" stroke="rgba(194,136,64,0.5)" stroke-width="1"/>
  <circle cx="${g2}" cy="${g2}" r="4" fill="rgba(140,95,40,0.85)"/><circle cx="${g2 - 1}" cy="${g2 - 1}" r="1.3" fill="rgba(255,235,150,0.7)"/>`;
const edgeEls = EDGES.map((e) => {
  const a = NODES[e.a];
  const b = NODES[e.b];
  return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="rgba(224,166,86,${e.bb ? 0.42 : 0.34})" stroke-width="${e.bb ? 1.1 : 0.85}"/>`;
}).join('');
const nodeEls = NODES.map((n) => {
  if (n.k === 2) return '';
  const hub = n.k === 1;
  return `<circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="${hub ? 'rgba(232,192,40,0.92)' : 'rgba(224,166,86,0.62)'}"${hub ? ' filter="url(#node-glow)"' : ''}/>`;
}).join('');
const heroInner = `
  <circle cx="${C}" cy="${C}" r="195" fill="url(#hero-bg-glow)"/>
  <circle cx="${C}" cy="${C}" r="${OUTER}" fill="none" stroke="url(#hero-brass-grad)" stroke-width="1.5" stroke-dasharray="3 6" opacity="0.7"/>
  ${notchEls}
  <circle cx="${C}" cy="${C}" r="${INNER}" fill="none" stroke="url(#brass-grad-vertical)" stroke-width="0.8" opacity="0.6"/>
  ${rivetEls}${gear1}${gear2}
  <g>${edgeEls}</g>${nodeEls}
  <circle cx="${C}" cy="${C}" r="24" fill="url(#satoshi-glow-outer)"/>
  <circle cx="${C}" cy="${C}" r="16" fill="url(#satoshi-glow)"/>
  <circle cx="${C}" cy="${C}" r="9" fill="none" stroke="url(#brass-grad)" stroke-width="1.5" opacity="0.95"/>
  <circle cx="${C}" cy="${C}" r="5" fill="rgb(255,215,0)" filter="url(#node-glow)"/>`;

// place the emblem on the right
const SC = 0.96;
const tx = 1248 - C * SC;
const ty = 250 - C * SC;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="hero-bg-glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(255,215,0,0.10)"/><stop offset="40%" stop-color="rgba(194,136,64,0.05)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>
    <radialGradient id="satoshi-glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(255,215,0,0.62)"/><stop offset="60%" stop-color="rgba(255,215,0,0.16)"/><stop offset="100%" stop-color="rgba(255,215,0,0)"/></radialGradient>
    <radialGradient id="satoshi-glow-outer" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(255,215,0,0.16)"/><stop offset="100%" stop-color="rgba(255,215,0,0)"/></radialGradient>
    <linearGradient id="brass-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#8C5E29"/><stop offset="50%" stop-color="#E0A656"/><stop offset="100%" stop-color="#8C5E29"/></linearGradient>
    <linearGradient id="brass-grad-vertical" x1="50%" y1="0%" x2="50%" y2="100%"><stop offset="0%" stop-color="#E0A656"/><stop offset="50%" stop-color="#C28840"/><stop offset="100%" stop-color="#8C5E29"/></linearGradient>
    <linearGradient id="hero-brass-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#D89A4E"/><stop offset="35%" stop-color="#E8C028"/><stop offset="58%" stop-color="#D88E1C"/><stop offset="80%" stop-color="#E8C028"/><stop offset="100%" stop-color="#D89A4E"/></linearGradient>
    <radialGradient id="gear-fill" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(140,95,40,0.38)"/><stop offset="65%" stop-color="rgba(194,136,64,0.16)"/><stop offset="100%" stop-color="rgba(224,166,86,0.04)"/></radialGradient>
    <filter id="node-glow" x="-120%" y="-120%" width="340%" height="340%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <linearGradient id="title" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffe680"/><stop offset="100%" stop-color="${GOLD}"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect x="22" y="22" width="${W - 44}" height="${H - 44}" rx="20" fill="none" stroke="${BRASS}" stroke-opacity="0.34" stroke-width="1.5"/>
  <g transform="translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${SC})">${heroInner}</g>
  <text x="96" y="226" font-family="Georgia, 'Times New Roman', serif" font-size="100" font-weight="700" fill="url(#title)">${BRAND}</text>
  <text x="100" y="298" font-family="Georgia, 'Times New Roman', serif" font-size="42" font-style="italic" fill="${AMBER}">${SUB}</text>
  <text x="690" y="400" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="28" letter-spacing="2" fill="${GREY}">${DOMAIN}</text>
</svg>`;

const png = new Resvg(svg, {
  fitTo: { mode: 'width', value: W },
  font: { loadSystemFonts: true },
  background: BG,
}).render().asPng();

const out = join(root, 'x-banner.png');
writeFileSync(out, png);
console.log(`[gen-x-banner] wrote ${out} (${(png.length / 1024).toFixed(0)} KB, ${W}x${H})`);
