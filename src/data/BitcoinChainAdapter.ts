import type { ChainAdapter, LatticeStatus } from '@/types/lattice';
import type { WalletNode, BlockActivity } from '@/types/wallet';
import type { BitcoinBlock } from '@/types/block';

/**
 * BitcoinChainAdapter — single point of contact between the viewer
 * and the chain-data CDN. Reads parquet snapshots and a status
 * sidecar JSON from a CDN we own (Cloudflare R2 in production,
 * `/public/` during local dev). Never makes per-block RPC calls or
 * hits centralized APIs at runtime — privacy posture is verified by
 * the CI privacy-audit step.
 *
 * Rollout:
 *   v0.1  — `getStatus()` fetches a static `status.json` (this commit)
 *   v0.2  — `getNodes()` fetches `wallets.parquet` via DuckDB-Wasm
 *   v0.2+ — `getActivity()` + `getBlock()` fetch shards by epoch
 *
 * `cdnBase` is the URL prefix for all CDN reads. Pass an empty string
 * (default) to read from the current origin (`/status.json`); pass
 * something like `https://data.timechaingrid.com` once the R2 bucket
 * is bound. Recommend wiring through `NEXT_PUBLIC_CDN_BASE` env var
 * at the call site.
 */
export class BitcoinChainAdapter implements ChainAdapter<WalletNode> {
  constructor(private readonly cdnBase: string = '') {}

  /**
   * Resolve a CDN path against the configured base. Trailing slash on
   * `cdnBase` and leading slash on `path` are both tolerated.
   */
  private url(path: string): string {
    const base = this.cdnBase.replace(/\/$/, '');
    const suffix = path.startsWith('/') ? path : `/${path}`;
    return `${base}${suffix}`;
  }

  async getStatus(): Promise<LatticeStatus> {
    try {
      const response = await fetch(this.url('/status.json'), {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return { currentBlock: 0 };
      const raw = (await response.json()) as Record<string, unknown>;
      return parseStatus(raw);
    } catch {
      // Network or parse failure — return safe default. The viewer
      // keeps working from any fixture in scope; the privacy posture
      // is preserved (no fallback to a third-party API).
      return { currentBlock: 0 };
    }
  }

  async getNodes(): Promise<WalletNode[]> {
    // TODO v0.2: fetch wallets.parquet, parse via DuckDB-Wasm
    return [];
  }

  async getActivity(_height: number): Promise<BlockActivity | null> {
    // TODO v0.2+: fetch activity.parquet shard for the epoch containing this block
    return null;
  }

  async getBlock(_height: number): Promise<BitcoinBlock | null> {
    // TODO v0.2+: fetch block-metadata.parquet shard
    return null;
  }
}

/**
 * Defensive parse of the status.json payload into a typed
 * `LatticeStatus`. Coerces numbers, drops anything unexpected. The
 * sidecar JSON is operator-controlled so we don't need full schema
 * validation, but we do want to survive a malformed write.
 */
function parseStatus(raw: Record<string, unknown>): LatticeStatus {
  const status: LatticeStatus = {
    currentBlock: typeof raw.currentBlock === 'number' ? raw.currentBlock : 0,
  };
  if (typeof raw.lastBlockTime === 'number') {
    status.lastBlockTime = raw.lastBlockTime;
  }
  if (typeof raw.nextBlockEtaMs === 'number') {
    status.nextBlockEtaMs = raw.nextBlockEtaMs;
  }
  return status;
}
