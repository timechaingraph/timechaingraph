'use client';

/**
 * r2-substrate.ts — a DuckDB-Wasm-backed ChainSubstrate.
 *
 * Fetches the versioned manifest, registers the dataset's parquet over
 * HTTP (DuckDB range-reads the footer + needed row groups), and
 * materializes rows into the same Map-indexed shape
 * the fixture exposes — so every consumer keeps the synchronous ChainSubstrate
 * contract (readonly arrays + O(1) lookups). Call `await init()` once before
 * use; the view gates on a `dataReady` flag while it resolves.
 *
 * Privacy: parquet is served from our own origin/R2; DuckDB-Wasm from
 * /duckdb/ (see src/data/duckdb.ts) — never a third-party CDN.
 */
import { DuckDBDataProtocol } from '@duckdb/duckdb-wasm';
import type { ChainSubstrate } from '@/types/substrate';
import type { Coin } from '@/types/coin';
import type { WalletBond, WalletData, WalletRole } from '@/types/wallet';
import { getDuckDB } from './duckdb';
import { wasmLoadStage } from './wasmProgress';
import { minersFolded } from './minerFold';
import { buildBlockTimeIndex, blockTimeAt } from './blockTimeIndex';

const BTC = 100_000_000n;

/**
 * Role (for color encoding) derived from the columns the parquet carries —
 * the bundle omits a stored role to keep the schema minimal. Mirrors the
 * WalletRole ladder documented in src/types/wallet.ts.
 */
function deriveRole(firstSeenBlock: number, total: bigint, txCount: number, isMiner: boolean): WalletRole {
  if (firstSeenBlock === 0 && isMiner) return 'satoshi';
  if (isMiner) return 'miner';
  if (total >= 1000n * BTC) return 'whale';
  if (total >= BTC || txCount >= 100) return 'significant';
  return 'dust';
}

interface Manifest {
  bundleVersion: string;
  tipBlock: number;
  wallets: { path: string; rows: number };
  bonds: { path: string; rows: number };
  timestamps?: { path: string; rows: number };
  blockMiners?: { path: string; rows: number };
  minersFolded?: boolean;
}

export class R2ChainSubstrate implements ChainSubstrate {
  private _wallets: WalletData[] = [];
  private _bonds: WalletBond[] = [];
  private _byAddr = new Map<string, WalletData>();
  private _bondsByAddr = new Map<string, WalletBond[]>();
  private _tipBlock = 0;
  private _blockTime: Uint32Array | null = null; // height → unix seconds (0 = unknown)
  private _ready = false;
  private _timestampsLoad: Promise<void> | null = null; // perf#3 lazy fill (post-ready)

  constructor(private readonly baseUrl: string = '/data/v0.1.0') {}

  get tipBlock(): number {
    return this._tipBlock;
  }
  get wallets(): readonly WalletData[] {
    return this._wallets;
  }
  get bonds(): readonly WalletBond[] {
    return this._bonds;
  }
  get coins(): readonly Coin[] {
    return []; // coins (Grid) arrive in a later bundle
  }
  get ready(): boolean {
    return this._ready;
  }

  walletByAddress(address: string): WalletData | undefined {
    return this._byAddr.get(address);
  }
  bondsForAddress(address: string): readonly WalletBond[] {
    return this._bondsByAddr.get(address) ?? [];
  }
  coinsOwnedBy(): readonly Coin[] {
    return [];
  }

  blockTime(height: number): number | undefined {
    return blockTimeAt(this._blockTime, height);
  }

  async init(onProgress?: (stage: string, pct?: number) => void): Promise<this> {
    if (this._ready) return this;

    const manifest: Manifest = await fetch(`${this.baseUrl}/manifest.json`).then((r) => {
      if (!r.ok) throw new Error(`manifest fetch failed: ${r.status}`);
      return r.json();
    });
    this._tipBlock = manifest.tipBlock;
    // perf#2: when the bundle folded the coinbase-proven miner set INTO
    // wallets.is_miner at build time, is_miner is authoritative — skip the
    // separate ~9MB block-miners.parquet fetch. Pre-fold bundles (no flag)
    // keep fetching it and overriding is_miner (unchanged behavior).
    const foldMiners = minersFolded(manifest);
    onProgress?.('Reading chain manifest…');

    onProgress?.('Initialising DuckDB-Wasm…');
    // Report real download+compile progress for the 34MB engine — the longest,
    // previously-silent step. Feeds the determinate bar in GraphCanvas.
    const db = await getDuckDB((p) => {
      const { stage, pct } = wasmLoadStage(p);
      onProgress?.(stage, pct);
    });
    const abs = (p: string) => new URL(`${this.baseUrl}/${p}`, window.location.origin).href;
    await db.registerFileURL('wallets.parquet', abs(manifest.wallets.path), DuckDBDataProtocol.HTTP, false);
    await db.registerFileURL('bonds.parquet', abs(manifest.bonds.path), DuckDBDataProtocol.HTTP, false);
    if (manifest.blockMiners && !foldMiners) {
      await db.registerFileURL('block-miners.parquet', abs(manifest.blockMiners.path), DuckDBDataProtocol.HTTP, false);
    }

    const conn = await db.connect();
    try {
      // Coinbase-proven miner set: block-miners.parquet maps each block to its
      // primary coinbase recipient (the mining pool / solo miner). This is more
      // precise than wallets.parquet's heuristic is_miner flag, which marks ALL
      // coinbase output recipients including downstream pool-payout addresses.
      // perf#2: once the bundle folds this set INTO wallets.is_miner at build
      // time (manifest.minersFolded), is_miner is already authoritative and we
      // skip this fetch+scan entirely. When the file is absent (old bundles),
      // fall back to is_miner.
      let coinbaseMinerSet: Set<string> | null = null;
      if (manifest.blockMiners && !foldMiners) {
        onProgress?.(`Identifying miners (${manifest.blockMiners.rows.toLocaleString()} blocks)…`);
        const mres = await conn.query(
          `SELECT DISTINCT miner FROM parquet_scan('block-miners.parquet') WHERE miner != ''`,
        );
        coinbaseMinerSet = new Set<string>();
        for (const r of mres) {
          coinbaseMinerSet.add(String((r as unknown as Record<string, string>).miner));
        }
      }

      onProgress?.(`Mapping ${manifest.wallets.rows.toLocaleString()} wallets…`);
      const wres = await conn.query(
        `SELECT address, first_seen_block, last_active_block, total_received_sats, tx_count, is_miner
         FROM parquet_scan('wallets.parquet')`,
      );
      for (const r of wres) {
        // Arrow StructRow is dynamically typed; u64 columns come back as BigInt.
        const row = r as unknown as Record<string, number | bigint | string | boolean>;
        const address = String(row.address);
        const total = BigInt(row.total_received_sats as bigint | number);
        const firstSeenBlock = Number(row.first_seen_block);
        const txCount = Number(row.tx_count);
        const isMiner = coinbaseMinerSet
          ? coinbaseMinerSet.has(address)
          : Boolean(row.is_miner);
        const w: WalletData = {
          address,
          role: deriveRole(firstSeenBlock, total, txCount, isMiner),
          firstSeenBlock,
          lastActiveBlock: Number(row.last_active_block),
          totalReceivedSats: total,
          txCount,
          isMiner,
        };
        this._wallets.push(w);
        this._byAddr.set(address, w);
      }

      onProgress?.(`Building ${manifest.bonds.rows.toLocaleString()} bonds…`);
      const bres = await conn.query(
        `SELECT from_address, to_address, sats, formation_block FROM parquet_scan('bonds.parquet')`,
      );
      for (const r of bres) {
        const row = r as unknown as Record<string, number | bigint | string>;
        const b: WalletBond = {
          fromAddress: String(row.from_address),
          toAddress: String(row.to_address),
          sats: BigInt(row.sats as bigint | number),
          formationBlock: Number(row.formation_block),
        };
        this._bonds.push(b);
        this.indexBond(b.fromAddress, b);
        this.indexBond(b.toAddress, b);
      }
    } finally {
      await conn.close();
    }

    // perf#3: resolve ready on wallets+bonds — the ~6.9MB timestamps parquet no
    // longer blocks first paint. Lazy-fill it after paint; blockTime() returns
    // undefined until then and the scrubber degrades to the 10-min estimate.
    this._ready = true;
    if (manifest.timestamps) {
      this._timestampsLoad = this.loadTimestamps(db, abs, manifest.timestamps, onProgress);
    }
    return this;
  }

  /**
   * Lazy block→unix-seconds fill (perf#3), kicked off after init() resolves.
   * A failure here must NEVER break an already-ready substrate: blockTime()
   * then stays undefined and the UI falls back to the 10-min per-block estimate.
   */
  private async loadTimestamps(
    db: Awaited<ReturnType<typeof getDuckDB>>,
    abs: (p: string) => string,
    entry: { path: string; rows: number },
    onProgress?: (stage: string, pct?: number) => void,
  ): Promise<void> {
    try {
      onProgress?.(`Syncing ${entry.rows.toLocaleString()} block timestamps…`);
      await db.registerFileURL('timestamps.parquet', abs(entry.path), DuckDBDataProtocol.HTTP, false);
      const conn = await db.connect();
      try {
        const tres = await conn.query(`SELECT block, t FROM parquet_scan('timestamps.parquet')`);
        const rows: { block: number; t: number }[] = [];
        for (const r of tres) {
          const row = r as unknown as Record<string, number | bigint>;
          rows.push({ block: Number(row.block), t: Number(row.t) });
        }
        this._blockTime = buildBlockTimeIndex(rows, this._tipBlock);
      } finally {
        await conn.close();
      }
    } catch {
      // graceful: leave _blockTime null → estimated dates.
    }
  }

  private indexBond(addr: string, b: WalletBond): void {
    let arr = this._bondsByAddr.get(addr);
    if (!arr) {
      arr = [];
      this._bondsByAddr.set(addr, arr);
    }
    arr.push(b);
  }
}
