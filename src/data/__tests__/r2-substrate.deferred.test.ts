import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// perf#3: init() must resolve on wallets+bonds and NOT block on the timestamps
// fetch, which is lazy-filled after first paint. We mock the DuckDB layer so we
// can drive init() deterministically and control the timestamps query.
const h = vi.hoisted(() => ({
  state: { tsThrows: false, tsRows: [] as { block: number; t: number }[], registered: [] as string[] },
}));

vi.mock('@duckdb/duckdb-wasm', () => ({ DuckDBDataProtocol: { HTTP: 'http' } }));
vi.mock('../duckdb', () => {
  const conn = {
    query: async (sql: string) => {
      if (sql.includes('wallets.parquet')) {
        return [{ address: 'W', first_seen_block: 1, last_active_block: 2, total_received_sats: 5n, tx_count: 1, is_miner: false }];
      }
      if (sql.includes('bonds.parquet')) return [];
      if (sql.includes('timestamps.parquet')) {
        if (h.state.tsThrows) throw new Error('timestamps fetch failed');
        return h.state.tsRows;
      }
      return [];
    },
    close: async () => {},
  };
  const db = {
    registerFileURL: async (name: string) => { h.state.registered.push(name); },
    connect: async () => conn,
  };
  return { getDuckDB: async () => db };
});

import { R2ChainSubstrate } from '../r2-substrate';

const manifest = {
  bundleVersion: 'vX',
  tipBlock: 10,
  wallets: { path: 'wallets.parquet', rows: 1 },
  bonds: { path: 'bonds.parquet', rows: 0 },
  timestamps: { path: 'timestamps.parquet', rows: 1 },
};

beforeEach(() => {
  h.state.tsThrows = false;
  h.state.tsRows = [];
  h.state.registered = [];
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => manifest })));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('R2ChainSubstrate — perf#3 deferred timestamps', () => {
  it('resolves ready without depending on the timestamps fetch (survives its failure)', async () => {
    h.state.tsThrows = true;
    const sub = new R2ChainSubstrate('/data/vX');
    await sub.init();
    expect(sub.ready).toBe(true); // ready despite the timestamps fetch throwing
    // the fire-and-forget fill is caught internally → resolves, never rejects
    await (sub as unknown as { _timestampsLoad: Promise<void> })._timestampsLoad;
    expect(sub.blockTime(5)).toBeUndefined(); // graceful degrade → estimated dates
  });

  it('lazy-fills timestamps after init — labels appear post-fill', async () => {
    h.state.tsRows = [{ block: 5, t: 1231006505 }];
    const sub = new R2ChainSubstrate('/data/vX');
    await sub.init();
    expect(sub.ready).toBe(true);
    await (sub as unknown as { _timestampsLoad: Promise<void> })._timestampsLoad;
    expect(sub.blockTime(5)).toBe(1231006505); // label present after the lazy fill
  });
});
