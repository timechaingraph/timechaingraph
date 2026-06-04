'use client';

/**
 * r2-substrate.ts — a DuckDB-Wasm-backed ChainSubstrate.
 *
 * Fetches the versioned manifest, registers the active tier's parquet over
 * HTTP (DuckDB range-reads the footer + needed row groups; the small Free
 * file is read whole), and materializes rows into the same Map-indexed shape
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

export type Tier = 'free' | 'pro' | 'max';

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

interface TierEntry {
  wallets: { path: string; rows: number };
  bonds: { path: string; rows: number };
}
interface Manifest {
  bundleVersion: string;
  tipBlock: number;
  tiers: Record<string, TierEntry>;
  timestamps?: { path: string; rows: number };
}

export class R2ChainSubstrate implements ChainSubstrate {
  private _wallets: WalletData[] = [];
  private _bonds: WalletBond[] = [];
  private _byAddr = new Map<string, WalletData>();
  private _bondsByAddr = new Map<string, WalletBond[]>();
  private _tipBlock = 0;
  private _blockTime: Uint32Array | null = null; // height → unix seconds (0 = unknown)
  private _ready = false;

  constructor(
    private readonly baseUrl: string = '/data/v0.1.0',
    private readonly tier: Tier = 'free',
  ) {}

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
    const arr = this._blockTime;
    if (!arr || height < 0 || height >= arr.length) return undefined;
    const t = arr[height];
    return t > 0 ? t : undefined;
  }

  async init(): Promise<this> {
    if (this._ready) return this;

    const manifest: Manifest = await fetch(`${this.baseUrl}/manifest.json`).then((r) => {
      if (!r.ok) throw new Error(`manifest fetch failed: ${r.status}`);
      return r.json();
    });
    this._tipBlock = manifest.tipBlock;
    const tier = manifest.tiers[this.tier] ?? manifest.tiers.free;

    const db = await getDuckDB();
    const abs = (p: string) => new URL(`${this.baseUrl}/${p}`, window.location.origin).href;
    await db.registerFileURL('wallets.parquet', abs(tier.wallets.path), DuckDBDataProtocol.HTTP, false);
    await db.registerFileURL('bonds.parquet', abs(tier.bonds.path), DuckDBDataProtocol.HTTP, false);

    const conn = await db.connect();
    try {
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
        const isMiner = Boolean(row.is_miner);
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

      const bres = await conn.query(
        `SELECT from_address, to_address, sats FROM parquet_scan('bonds.parquet')`,
      );
      for (const r of bres) {
        const row = r as unknown as Record<string, number | bigint | string>;
        const b: WalletBond = {
          fromAddress: String(row.from_address),
          toAddress: String(row.to_address),
          sats: BigInt(row.sats as bigint | number),
        };
        this._bonds.push(b);
        this.indexBond(b.fromAddress, b);
        this.indexBond(b.toAddress, b);
      }

      // Timestamps: tier-independent block → unix-seconds, loaded into a
      // height-indexed Uint32Array for O(1) blockTime() (the scrubber spans
      // 0..tip regardless of tier). ~3.8MB at full chain; absent in old bundles.
      if (manifest.timestamps) {
        await db.registerFileURL(
          'timestamps.parquet',
          abs(manifest.timestamps.path),
          DuckDBDataProtocol.HTTP,
          false,
        );
        const tres = await conn.query(
          `SELECT block, t FROM parquet_scan('timestamps.parquet')`,
        );
        const arr = new Uint32Array(this._tipBlock + 1);
        for (const r of tres) {
          const row = r as unknown as Record<string, number | bigint>;
          const b = Number(row.block);
          if (b >= 0 && b < arr.length) arr[b] = Number(row.t);
        }
        this._blockTime = arr;
      }
    } finally {
      await conn.close();
    }

    this._ready = true;
    return this;
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
