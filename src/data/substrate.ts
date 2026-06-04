import type { ChainSubstrate } from '@/types/substrate';
import type { Coin } from '@/types/coin';
import type { WalletBond, WalletData } from '@/types/wallet';
import { FREE_TIER_50 } from './__fixtures__/free-tier-50';
import { FREE_TIER_50_BONDS } from './__fixtures__/free-tier-50-bonds';
import { COIN_ROSTER_DEMO } from './__fixtures__/coin-roster';

/**
 * Fixture-backed `ChainSubstrate` implementation for v0.1.
 *
 * Wraps the three existing fixture exports (FREE_TIER_50,
 * FREE_TIER_50_BONDS, COIN_ROSTER_DEMO) with the `ChainSubstrate`
 * interface so consumers can program against the contract rather
 * than the fixture file paths. Implementations precompute address
 * indices at construction so accessors stay O(1) per call.
 *
 * v0.2+: a parallel `R2ChainSubstrate` impl wraps DuckDB-Wasm
 * queries against the parquet bundle served from R2. The interface
 * stays identical; consumers don't change.
 *
 * Tip block is derived from the maximum `lastActiveBlock` in the
 * wallet fixture — the same convention used by GraphView/CoinGridView
 * to seed the scrubber when the store hasn't been seeded yet.
 */

const FIXTURE_TIP_BLOCK = FREE_TIER_50.reduce(
  (max, w) => Math.max(max, w.lastActiveBlock),
  0,
);

class FixtureChainSubstrate implements ChainSubstrate {
  readonly tipBlock = FIXTURE_TIP_BLOCK;
  readonly wallets = FREE_TIER_50;
  readonly bonds = FREE_TIER_50_BONDS;
  readonly coins = COIN_ROSTER_DEMO;

  // Precomputed indices for O(1) accessors.
  private readonly walletIndex = new Map<string, WalletData>();
  private readonly bondIndex = new Map<string, WalletBond[]>();
  private readonly coinOwnerIndex = new Map<string, Coin[]>();

  constructor() {
    for (const w of this.wallets) {
      this.walletIndex.set(w.address, w);
    }
    for (const b of this.bonds) {
      this.appendToList(this.bondIndex, b.fromAddress, b);
      this.appendToList(this.bondIndex, b.toAddress, b);
    }
    for (const c of this.coins) {
      this.appendToList(this.coinOwnerIndex, c.ownerAddress, c);
    }
  }

  private appendToList<T>(map: Map<string, T[]>, key: string, value: T): void {
    const existing = map.get(key);
    if (existing) {
      existing.push(value);
    } else {
      map.set(key, [value]);
    }
  }

  walletByAddress(address: string): WalletData | undefined {
    return this.walletIndex.get(address);
  }

  bondsForAddress(address: string): readonly WalletBond[] {
    return this.bondIndex.get(address) ?? [];
  }

  coinsOwnedBy(address: string): readonly Coin[] {
    return this.coinOwnerIndex.get(address) ?? [];
  }

  // The 50-node fixture carries no real block times; callers fall back to the
  // 10-minute estimate. The R2/parquet substrate returns true times.
  blockTime(): number | undefined {
    return undefined;
  }
}

/**
 * The fixture-backed substrate. Single instance shared across the
 * app; consumers import this directly. When v0.2+ ships an
 * R2-backed implementation, this export becomes a runtime selector
 * (env-var or feature-flag) rather than a const.
 */
export const FIXTURE_SUBSTRATE: ChainSubstrate = new FixtureChainSubstrate();

/**
 * The active substrate the views read. Defaults to the fixture so SSR,
 * unit tests, and GraphView's synchronous module-level reads all work with
 * zero async setup. `loadSubstrate()` swaps in the R2/DuckDB-backed
 * implementation at runtime (client-only); callers then dynamic-import the
 * view so its module-level reads observe the loaded data.
 */
let activeSubstrate: ChainSubstrate = FIXTURE_SUBSTRATE;

export function getActiveSubstrate(): ChainSubstrate {
  return activeSubstrate;
}

/**
 * Load the runtime substrate. R2/DuckDB-backed by default; set
 * NEXT_PUBLIC_USE_R2=0 to force the fixture. Falls back to the fixture if
 * the parquet bundle can't be fetched. MUST be awaited before the view
 * module is imported, so GraphView's module-level wallet/bond reads see the
 * loaded data. The r2-substrate import is dynamic so DuckDB-Wasm never
 * enters the fixture path or SSR.
 */
export async function loadSubstrate(): Promise<ChainSubstrate> {
  const useR2 =
    process.env.NEXT_PUBLIC_USE_R2 !== '0' && process.env.NEXT_PUBLIC_USE_R2 !== 'false';
  if (useR2) {
    try {
      const { R2ChainSubstrate } = await import('./r2-substrate');
      // Same-origin /data/v0.1.0 in dev; in prod the parquet bundle is served
      // from R2 (NEXT_PUBLIC_DATA_BASE_URL, full versioned base e.g.
      // https://data.timechaingraph.com/data/v0.1.0). Tier is overridable too.
      const baseUrl = process.env.NEXT_PUBLIC_DATA_BASE_URL || '/data/v0.1.0';
      const tier = (process.env.NEXT_PUBLIC_TIER || 'free') as 'free' | 'pro' | 'max';
      activeSubstrate = await new R2ChainSubstrate(baseUrl, tier).init();
      return activeSubstrate;
    } catch (err) {
      console.warn('[substrate] R2 load failed; falling back to fixture:', err);
    }
  }
  activeSubstrate = FIXTURE_SUBSTRATE;
  return activeSubstrate;
}
