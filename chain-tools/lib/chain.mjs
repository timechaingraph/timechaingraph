/**
 * chain.mjs — Bitcoin issuance schedule + temporal constants.
 *
 * Single source of truth for both vault generators in this two-repo
 * cooperative system:
 *   - Brain vault (Timechain Graph): wallets + bonds + brain-Prolog
 *   - Coin-real-estate vault (Timechain Grid): coins + subgrids + coin-Prolog
 *
 * Both projections need the same chain invariants (subsidy schedule,
 * halving heights, cumulative supply at any block, approximate
 * wall-clock date). Authoring those constants + math once here keeps
 * the two projections agreeing on Bitcoin's basic shape, no matter
 * how their vault layouts diverge.
 *
 * Module is deliberately `.mjs` (not `.ts`) so both Node generators
 * can `import` it without a TypeScript build step. Treat the API as
 * stable and forward-compatible — any extension lands as new exports
 * rather than renames or signature changes.
 *
 * Mirrored in TypeScript-land by `src/lib/spiral.ts` (sister-authored)
 * which has equivalent `subsidyAtBlock()` for canvas-side use. The
 * two implementations agree by construction; cross-validation tests
 * could be added if the duplication becomes a maintenance concern.
 */

export const SATS_PER_BTC = 100_000_000n;
export const BLOCKS_PER_EPOCH = 210_000;
export const BLOCK_TIME_MIN = 10;
export const TARGET_TOTAL_BTC = 21_000_000;

/**
 * The 4 halving heights for v0.1 (genesis epoch through 4th halving).
 * Adding more is forward-compatible — any consumer should iterate
 * with `epochAt()` rather than indexing this array directly past
 * the v0.1 horizon.
 */
export const HALVING_BLOCKS = Object.freeze([0, 210_000, 420_000, 630_000, 840_000]);

/**
 * Tip-block-of-record for the v0.1 fixture (~April 2026). v0.2+ this
 * becomes dynamic from the operator's bitcoind via `getStatus()`.
 */
export const TIP_BLOCK = 876_000;

/**
 * Genesis block timestamp in UTC milliseconds. Mined approximately
 * 2009-01-03 18:15:05 UTC; the chain's wall-clock origin.
 */
export const GENESIS_MS = Date.UTC(2009, 0, 3, 18, 15, 0);

/**
 * Halving epoch (0-indexed) at the given height. Epoch 0 is genesis
 * → first halving (50 BTC subsidy); epoch 1 is first → second halving
 * (25 BTC); etc.
 */
export function epochAt(height) {
  return Math.floor(height / BLOCKS_PER_EPOCH);
}

/**
 * Block subsidy in BTC at the given height. 50, 25, 12.5, 6.25,
 * 3.125 … the geometric series. After 33 halvings (block ~6.93M)
 * the subsidy rounds to sub-satoshi territory and the chain
 * transitions to fee-only economics — we return 0 from there
 * forward.
 */
export function subsidyBtcAt(height) {
  if (height < 0) return 0;
  const epoch = epochAt(height);
  if (epoch >= 33) return 0;
  return 50 / Math.pow(2, epoch);
}

/**
 * Cumulative BTC issued by (and including) the given block. Sum of
 * full completed epochs plus the partial current epoch up through
 * this block. Asymptotes to TARGET_TOTAL_BTC = 21,000,000.
 *
 * Numerical note: because each epoch's subsidy is exactly halved,
 * the cumulative supply is computed with floating-point arithmetic
 * — the result rounds to within ±1 satoshi of the true integer
 * supply for any height up to ~33 epochs. Don't use this for exact
 * audit purposes; use the sat-precise integer computation in
 * production code.
 */
export function cumulativeSupplyBtcAt(height) {
  if (height < 0) return 0;
  const epoch = epochAt(height);
  let supply = 0;
  for (let e = 0; e < Math.min(epoch, 33); e++) {
    supply += BLOCKS_PER_EPOCH * (50 / Math.pow(2, e));
  }
  if (epoch < 33) {
    const blocksInCurrentEpoch = (height - epoch * BLOCKS_PER_EPOCH) + 1;
    supply += blocksInCurrentEpoch * (50 / Math.pow(2, epoch));
  }
  return supply;
}

/**
 * Approximate UTC date as ISO `YYYY-MM-DD` for the given block
 * height. Linear extrapolation from genesis at BLOCK_TIME_MIN
 * minutes per block. Off by hours-to-days for any specific block
 * due to difficulty adjustments + block-time variance — use for
 * "roughly when did epoch N end" framing, never for precise
 * timestamps.
 */
export function dateApproxAt(height) {
  if (height <= 0) return '2009-01-03';
  const minutesFromGenesis = height * BLOCK_TIME_MIN;
  const ms = GENESIS_MS + minutesFromGenesis * 60_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Is this height a halving block — i.e., the first block of a new
 * epoch? Block 0 is genesis (technically epoch-0 first block); we
 * return false for genesis since the "halving" framing applies to
 * subsidy *halvings*, not the initial subsidy.
 */
export function isHalvingBlock(height) {
  return height > 0 && height % BLOCKS_PER_EPOCH === 0;
}

/**
 * Coinbase reward in satoshis (bigint) — the integer-precise version
 * of `subsidyBtcAt`. Use this for any sat-level computation.
 */
export function subsidySatsAt(height) {
  if (height < 0) return 0n;
  const epoch = epochAt(height);
  if (epoch >= 33) return 0n;
  // 50 BTC = 5_000_000_000 sats; halve `epoch` times via right-shift.
  return 5_000_000_000n >> BigInt(epoch);
}
