/**
 * Coin — the atomic unit of the Timechain Grid 2D real-estate view.
 *
 * Each Bitcoin block mints `subsidy(block)` new coins (50 BTC pre-first-
 * halving, 25 after, 12.5, etc.). On the Grid view, every minted coin
 * occupies one cell of a 2D spiral lattice, expanding outward from the
 * Satoshi origin as the chain grows. Hover a cell → see who owns it
 * now. Click → drill into the 10×10 fractional-ownership subgrid.
 *
 * The Grid is the "Sims real-estate" projection of the chain: every
 * BTC ever issued is a tile of land; halvings are the moments the
 * issuance rate halves; players (wallets) accumulate property as they
 * mine and trade.
 *
 * Companion's Graph view consumes the same `Coin` shape if she ever wants
 * coin-aware annotations (e.g. "this whale wallet owns 5,000 coins"),
 * but the primary geometry there is force-directed wallet-bonds.
 */

import type { WalletRole } from '@/types/wallet';

export interface Coin {
  /**
   * Stable coin identifier: `B<block>I<index>`. e.g. `B0I0` is the
   * first coin in the genesis coinbase, `B0I49` is the last of the 50
   * coins minted at block 0.
   */
  id: string;

  /** Block height where this coin was minted (coinbase output). */
  mintedAtBlock: number;

  /** Index within that block's coinbase outputs. 0 ≤ mintedIndex < subsidy. */
  mintedIndex: number;

  /** Address that received the coinbase output (the miner of that block). */
  minterAddress: string;

  /**
   * Current owner address. v0: equals minterAddress (no transfer
   * history modelled yet). v1+ will track the latest holder via the
   * activity stream.
   */
  ownerAddress: string;

  /**
   * Linear position along the spiral that places coins on the 2D
   * grid. spiralIndex 0 = Satoshi's first reward at (0, 0); subsequent
   * coins ring outward.
   */
  spiralIndex: number;

  /** Computed grid coordinate from `spiralIndex` via `lib/spiral.ts`. */
  gridX: number;

  /** Computed grid coordinate from `spiralIndex` via `lib/spiral.ts`. */
  gridY: number;

  /**
   * True when `mintedAtBlock` is a non-zero multiple of 210,000.
   * Halving-block coins get a gold ring overlay in the renderer to
   * mark the issuance-rate inflection points.
   */
  isHalving: boolean;
}

/**
 * Visual hint for the coin's current colour, derived from owner role.
 * Computed at render time, not stored on the coin (owner can change).
 */
export interface CoinTint {
  role: WalletRole;
}
