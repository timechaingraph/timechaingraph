import type { ChainAdapter, LatticeStatus } from '@/types/lattice';
import type { WalletNode, BlockActivity } from '@/types/wallet';
import type { BitcoinBlock } from '@/types/block';

/**
 * Fetches wallet/activity data from the offline-extracted parquet snapshots
 * served from our own CDN (Cloudflare R2 or equivalent). Never makes
 * per-block RPC calls or hits centralized APIs at runtime.
 *
 * Stub implementation. Subsequent commits implement parquet fetching via
 * DuckDB-Wasm and wire keyframe interpolation through a Web Worker.
 */
export class BitcoinChainAdapter implements ChainAdapter<WalletNode> {
  constructor(private readonly cdnBase: string) {}

  async getNodes(): Promise<WalletNode[]> {
    // TODO: fetch wallets.parquet, parse via DuckDB-Wasm
    return [];
  }

  async getStatus(): Promise<LatticeStatus> {
    // TODO: fetch /status.json from CDN
    return { currentBlock: 0 };
  }

  async getActivity(_height: number): Promise<BlockActivity | null> {
    // TODO: fetch activity.parquet shard for the epoch containing this block
    return null;
  }

  async getBlock(_height: number): Promise<BitcoinBlock | null> {
    // TODO: fetch block-metadata.parquet shard
    return null;
  }
}
