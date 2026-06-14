'use client';

/**
 * duckdb.ts — lazy, client-only DuckDB-Wasm singleton.
 *
 * The runtime is served from OUR origin (`/duckdb/*`, vendored by
 * scripts/copy-duckdb-assets.mjs) — never jsdelivr/unpkg, which the privacy
 * audit forbids. DuckDB runs in a Web Worker; this module instantiates it
 * exactly once, on first call, and is only ever imported by client components
 * (so the WASM never enters SSR / static prerender).
 */
import * as duckdb from '@duckdb/duckdb-wasm';

// The big .wasm modules (mvp 39MB, eh 34MB) exceed Cloudflare Pages' 25MB/file
// limit, so in prod they're served from our R2 bucket via
// NEXT_PUBLIC_DUCKDB_WASM_BASE (e.g. https://data.timechaingraph.com). They
// load through fetch/instantiateStreaming, which is fine cross-origin given R2
// CORS. The small worker .js files MUST stay SAME-ORIGIN — `new Worker(url)`
// forbids cross-origin scripts. Empty base ⇒ fully same-origin (/duckdb/*),
// which is the dev default (assets vendored into public/ by copy-duckdb-assets).
const WASM_BASE = process.env.NEXT_PUBLIC_DUCKDB_WASM_BASE ?? '';
const wasmUrl = (file: string) => `${WASM_BASE}/duckdb/${file}`;
const workerUrl = (file: string) => `/duckdb/${file}`; // always same-origin

const BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: wasmUrl('duckdb-mvp.wasm'),
    mainWorker: workerUrl('duckdb-browser-mvp.worker.js'),
  },
  eh: {
    mainModule: wasmUrl('duckdb-eh.wasm'),
    mainWorker: workerUrl('duckdb-browser-eh.worker.js'),
  },
};

let instance: Promise<duckdb.AsyncDuckDB> | null = null;

export function getDuckDB(): Promise<duckdb.AsyncDuckDB> {
  if (instance) return instance;
  instance = (async () => {
    // selectBundle inspects browser WASM features (exception handling) and
    // picks mvp vs eh. Both are same-origin, so no CDN round-trip.
    const bundle = await duckdb.selectBundle(BUNDLES);
    if (!bundle.mainWorker) throw new Error('DuckDB-Wasm: no worker in selected bundle');
    const worker = new Worker(bundle.mainWorker);
    const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    return db;
  })();
  return instance;
}
