import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchBlockIndex,
  fetchBlockSnapshot,
  getCachedBlockSnapshot,
  __resetSnapshotCacheForTests,
} from '../blockSnapshots';

const REAL_FETCH = global.fetch;

beforeEach(() => {
  __resetSnapshotCacheForTests();
  global.fetch = vi.fn();
});

afterEach(() => {
  global.fetch = REAL_FETCH;
});

const MOCK_INDEX = {
  schema: 'block-state-index/v1',
  generated: '2026-04-30T00:00:00Z',
  scope: { fromBlock: 0, throughBlock: 999, totalBlocks: 1000 },
  shardSize: 1000,
  shards: [{ id: 0, fromBlock: 0, throughBlock: 999, fileCount: 1000 }],
};

const MOCK_SNAPSHOT_42 = {
  schema: 'block-state/v1',
  block: 42,
  minter: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
  subsidy: 50,
  halving: false,
  epoch: 0,
  newCoinFromIndex: 2100,
  newCoinCount: 50,
  cumulativeCoinCount: 2150,
  cumulativeSupplyBtc: 2150,
};

describe('blockSnapshots client', () => {
  it('fetches and caches the INDEX', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => MOCK_INDEX,
    });
    const a = await fetchBlockIndex();
    const b = await fetchBlockIndex();
    expect(a).toEqual(MOCK_INDEX);
    expect(b).toEqual(MOCK_INDEX);
    // Single fetch — second call hits cache.
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns null INDEX on fetch failure', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
    });
    expect(await fetchBlockIndex()).toBeNull();
  });

  it('returns null INDEX on network throw', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('offline'),
    );
    expect(await fetchBlockIndex()).toBeNull();
  });

  it('fetches a block snapshot via the index-derived shard path', async () => {
    let callCount = 0;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string) => {
        callCount += 1;
        if (callCount === 1 && url === '/blocks/INDEX.json') {
          return { ok: true, json: async () => MOCK_INDEX } as Response;
        }
        if (url === '/blocks/shard-000/0000042.json') {
          return { ok: true, json: async () => MOCK_SNAPSHOT_42 } as Response;
        }
        return { ok: false } as Response;
      },
    );
    const snap = await fetchBlockSnapshot(42);
    expect(snap).toEqual(MOCK_SNAPSHOT_42);
  });

  it('returns null for blocks outside the index scope', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => MOCK_INDEX,
    });
    expect(await fetchBlockSnapshot(99_999)).toBeNull();
  });

  it('rejects schema or block-mismatched payloads', async () => {
    let callCount = 0;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      async () => {
        callCount += 1;
        if (callCount === 1) {
          return { ok: true, json: async () => MOCK_INDEX } as Response;
        }
        // Payload claims to be block 999 but we asked for block 42.
        return {
          ok: true,
          json: async () => ({ ...MOCK_SNAPSHOT_42, block: 999 }),
        } as Response;
      },
    );
    expect(await fetchBlockSnapshot(42)).toBeNull();
  });

  it('caches per-block fetches', async () => {
    let callCount = 0;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string) => {
        callCount += 1;
        if (url === '/blocks/INDEX.json') {
          return { ok: true, json: async () => MOCK_INDEX } as Response;
        }
        return { ok: true, json: async () => MOCK_SNAPSHOT_42 } as Response;
      },
    );
    await fetchBlockSnapshot(42);
    await fetchBlockSnapshot(42);
    // Index + 1 snapshot fetch — second snapshot hits cache.
    expect(callCount).toBe(2);
  });

  it('exposes cached snapshots synchronously after a fetch', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string) => {
        if (url === '/blocks/INDEX.json') {
          return { ok: true, json: async () => MOCK_INDEX } as Response;
        }
        return { ok: true, json: async () => MOCK_SNAPSHOT_42 } as Response;
      },
    );
    expect(getCachedBlockSnapshot(42)).toBeNull();
    await fetchBlockSnapshot(42);
    expect(getCachedBlockSnapshot(42)).toEqual(MOCK_SNAPSHOT_42);
  });
});
