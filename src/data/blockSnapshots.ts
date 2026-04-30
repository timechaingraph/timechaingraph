/**
 * blockSnapshots — client for the per-block state JSONs served at
 * `/blocks/...`. Each block has a tiny snapshot file describing what
 * THAT block adds to the lattice (minter address, subsidy, halving
 * flag, the spiral-index range of the new coins). To get the full
 * state at block N, the renderer accumulates blocks 0..N — every
 * coin's grid coordinate is deterministic from its spiral index, so
 * the canvas doesn't need per-coin records.
 *
 * Per-snapshot size: ~200 bytes compact JSON. At 80k blocks total,
 * the entire dataset is ~16 MB — cheap enough to lazy-load per block
 * during playback rather than pre-loading the whole thing on mount.
 *
 * Lookup is via shard math (matching the generator):
 *   shardId = floor(block / SHARD_SIZE)
 *   path    = /blocks/shard-{shardId, 2 digits}/{block, 7 digits}.json
 *
 * This file is the ONLY place that knows the URL layout — the canvas
 * just calls `fetchBlockSnapshot(block)` and gets a typed snapshot
 * back (or null if the fetch fails).
 */

export interface BlockSnapshot {
  schema: 'block-state/v1';
  block: number;
  /** Coinbase-recipient Bitcoin address. */
  minter: string;
  /** Block subsidy in BTC (50 / 25 / 12.5 / …). */
  subsidy: number;
  /** True if this block is the first of a new halving epoch. */
  halving: boolean;
  /** Halving epoch index (0 = pre-first-halving). */
  epoch: number;
  /** Spiral-index of the first new coin minted at this block. */
  newCoinFromIndex: number;
  /** Number of new coins minted at this block (== subsidy in epoch 0). */
  newCoinCount: number;
  /** Total coin count after this block was mined. */
  cumulativeCoinCount: number;
  /** Cumulative BTC issued through this block. */
  cumulativeSupplyBtc: number;
}

export interface BlockSnapshotsIndex {
  schema: 'block-state-index/v1';
  generated: string;
  scope: {
    fromBlock: number;
    throughBlock: number;
    totalBlocks: number;
  };
  shardSize: number;
  shards: Array<{
    id: number;
    fromBlock: number;
    throughBlock: number;
    fileCount: number;
  }>;
}

const INDEX_URL = '/blocks/INDEX.json';

/** Cache of fetched snapshots, keyed by block height. */
const cache = new Map<number, BlockSnapshot>();
let cachedIndex: BlockSnapshotsIndex | null = null;
let indexFetchPromise: Promise<BlockSnapshotsIndex | null> | null = null;

function shardPath(shardId: number, block: number, shardSize: number): string {
  // Guard against shardSize mismatches by computing the shardId from
  // block + shardSize at call time, never trusting a passed-in id.
  const computedShardId = Math.floor(block / shardSize);
  if (shardId !== computedShardId) {
    throw new Error(
      `blockSnapshots: shardId ${shardId} doesn't match block ${block} at shardSize ${shardSize}`,
    );
  }
  const shardName = `shard-${String(shardId).padStart(3, '0')}`;
  const blockPadded = String(block).padStart(7, '0');
  return `/blocks/${shardName}/${blockPadded}.json`;
}

export async function fetchBlockIndex(): Promise<BlockSnapshotsIndex | null> {
  if (cachedIndex) return cachedIndex;
  if (indexFetchPromise) return indexFetchPromise;
  indexFetchPromise = (async () => {
    try {
      const res = await fetch(INDEX_URL, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as BlockSnapshotsIndex;
      cachedIndex = json;
      return json;
    } catch {
      // Network/fetch errors → silent null. The canvas falls back to
      // the in-memory FIXTURE_SUBSTRATE so playback still works
      // without snapshots — this is purely an enrichment layer.
      return null;
    }
  })();
  return indexFetchPromise;
}

/**
 * Fetch the snapshot for a specific block. Returns null on any
 * failure (404, network error, parse error). Cached per block —
 * subsequent calls are O(1).
 *
 * The canvas uses this during playback: each currentBlock change
 * triggers a fetch, the result populates the BlockNarrative HUD
 * card overlaid on the lattice.
 */
export async function fetchBlockSnapshot(
  block: number,
): Promise<BlockSnapshot | null> {
  const cached = cache.get(block);
  if (cached) return cached;

  const index = await fetchBlockIndex();
  if (!index) return null;
  if (block < index.scope.fromBlock || block > index.scope.throughBlock) {
    return null;
  }

  const shardId = Math.floor(block / index.shardSize);
  const url = shardPath(shardId, block, index.shardSize);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const json = (await res.json()) as BlockSnapshot;
    if (json.schema !== 'block-state/v1' || json.block !== block) return null;
    cache.set(block, json);
    return json;
  } catch {
    return null;
  }
}

/**
 * Synchronous accessor — returns the cached snapshot if present,
 * else null. Useful for renderers that need a non-async path.
 */
export function getCachedBlockSnapshot(block: number): BlockSnapshot | null {
  return cache.get(block) ?? null;
}

/**
 * Test-only: drop the in-memory cache so unit tests don't leak
 * state across describe blocks. Not exported in any user-facing
 * surface.
 */
export function __resetSnapshotCacheForTests(): void {
  cache.clear();
  cachedIndex = null;
  indexFetchPromise = null;
}
