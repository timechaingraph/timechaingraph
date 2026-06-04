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

const BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: '/duckdb/duckdb-mvp.wasm',
    mainWorker: '/duckdb/duckdb-browser-mvp.worker.js',
  },
  eh: {
    mainModule: '/duckdb/duckdb-eh.wasm',
    mainWorker: '/duckdb/duckdb-browser-eh.worker.js',
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
