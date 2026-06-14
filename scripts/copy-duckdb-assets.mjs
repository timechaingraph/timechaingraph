/**
 * copy-duckdb-assets.mjs — vendor DuckDB-Wasm into public/duckdb/.
 *
 * The browser must load the DuckDB-Wasm runtime (wasm + worker) from OUR OWN
 * origin, never a CDN — `getJsDelivrBundles()` would pull from jsdelivr, which
 * the privacy audit forbids (leaks viewer IP to a third party). So we copy the
 * runtime out of node_modules into public/duckdb/ at build time and point
 * selectBundle() at /duckdb/* (see src/data/duckdb.ts).
 *
 * Wired to pre{dev,build} in package.json so it always runs before a build.
 * public/duckdb/ is gitignored (regenerated from the pinned dependency).
 *
 * We ship the MVP + EH bundles (selectBundle picks per browser WASM features).
 * The COI/pthread bundle needs cross-origin-isolation headers we don't set in
 * the static export, so it's intentionally excluded for v0.1.
 */
import { mkdirSync, copyFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const src = join(root, 'node_modules', '@duckdb', 'duckdb-wasm', 'dist');
const dst = join(root, 'public', 'duckdb');

const FILES = [
  'duckdb-mvp.wasm',
  'duckdb-browser-mvp.worker.js',
  'duckdb-eh.wasm',
  'duckdb-browser-eh.worker.js',
];

if (!existsSync(src)) {
  console.error(`[copy-duckdb-assets] @duckdb/duckdb-wasm not found at ${src} — run npm install`);
  process.exit(1);
}
mkdirSync(dst, { recursive: true });

let total = 0;
for (const f of FILES) {
  const from = join(src, f);
  if (!existsSync(from)) {
    console.error(`[copy-duckdb-assets] missing ${from}`);
    process.exit(1);
  }
  copyFileSync(from, join(dst, f));
  const mb = statSync(from).size / 1e6;
  total += mb;
  console.log(`  ${f.padEnd(34)} ${mb.toFixed(1)} MB`);
}
console.log(`[copy-duckdb-assets] ${FILES.length} files → public/duckdb/ (${total.toFixed(1)} MB total)`);
