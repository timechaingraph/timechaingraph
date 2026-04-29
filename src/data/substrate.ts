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
}

/**
 * The fixture-backed substrate. Single instance shared across the
 * app; consumers import this directly. When v0.2+ ships an
 * R2-backed implementation, this export becomes a runtime selector
 * (env-var or feature-flag) rather than a const.
 */
export const FIXTURE_SUBSTRATE: ChainSubstrate = new FixtureChainSubstrate();
