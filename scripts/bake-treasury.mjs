#!/usr/bin/env node
// Operator-side treasury bake script — run BEFORE each deploy.
//
// Usage:
//   torsocks node scripts/bake-treasury.mjs
//
// Requires:
//   TREASURY_ADDRESS env var — the watch-only bc1q... address
//   Tor running on 127.0.0.1:9050 (torsocks wraps the process)
//
// Override the Mempool base URL for local testing (skips Tor):
//   MEMPOOL_BASE=https://mempool.space node scripts/bake-treasury.mjs
//
// Output: public/treasury-status.json (committed alongside the build;
//         CF Pages serves it as a same-origin static asset)
//
// The browser component fetches this file client-side — no runtime
//  third-party call ever leaves the browser. npm run privacy-audit stays green.

import { writeFileSync } from 'node:fs';

const ADDRESS = process.env.TREASURY_ADDRESS;
if (!ADDRESS) {
  console.error('[bake-treasury] TREASURY_ADDRESS env var required');
  process.exit(1);
}

const BASE =
  process.env.MEMPOOL_BASE ??
  'http://mempoolhqx4isw62xs7abwphsq7ldayuidyx2v2oethdhhj6mlo2r6ad.onion';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

console.log(`[bake-treasury] fetching balance for ${ADDRESS} via ${BASE}`);

const [addrData, priceData] = await Promise.all([
  fetchJson(`${BASE}/api/address/${ADDRESS}`),
  fetchJson(`${BASE}/api/v1/prices`),
]);

const funded = addrData.chain_stats.funded_txo_sum;
const spent = addrData.chain_stats.spent_txo_sum;
const balance_sat = funded - spent;

const out = {
  generated_at: new Date().toISOString(),
  balance_sat,
  balance_btc: (balance_sat / 1e8).toFixed(8),
  address_truncated: `${ADDRESS.slice(0, 8)}…${ADDRESS.slice(-6)}`,
  source: 'Mempool.space onion (operator-side, Tor, baked at build time)',
  stale_after_days: 7,
  btc_price_usd: priceData.USD ?? null,
};

writeFileSync('public/treasury-status.json', JSON.stringify(out, null, 2) + '\n');
console.log('[bake-treasury] wrote public/treasury-status.json', out);
