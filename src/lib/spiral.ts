/**
 * Ulam-style square spiral — places integer indices on a 2D lattice
 * in concentric rings around the origin.
 *
 *   spiralCoord(0)  → (0, 0)            // origin
 *   spiralCoord(1)  → (1, 0)            // ring 1, east
 *   spiralCoord(2)  → (1, 1)            // ring 1
 *   spiralCoord(3)  → (0, 1)            // ring 1, north
 *   ...
 *   spiralCoord(8)  → (1, -1)           // ring 1 closes
 *   spiralCoord(9)  → (2, -1)           // ring 2 begins
 *
 * Used to assign 2D positions to Bitcoin coins as they're minted
 * block-by-block: coin index 0 is Satoshi's first coinbase output,
 * placed at the origin; subsequent coins ring outward in mint order.
 *
 * Pure, deterministic, allocation-free. Same input → same output,
 * forever. This stability is the whole point of the Grid view: the
 * "real estate" coordinate of a given coin never changes.
 */

/**
 * Map a non-negative integer index to its 2D spiral coordinate.
 */
export function spiralCoord(n: number): [number, number] {
  if (n < 0 || !Number.isInteger(n)) {
    throw new RangeError(`spiralCoord: n must be a non-negative integer, got ${n}`);
  }
  if (n === 0) return [0, 0];

  // Find ring k such that the index falls within (2k-1)^2 < n+1 ≤ (2k+1)^2.
  // k is the Chebyshev distance from origin.
  const k = Math.ceil((Math.sqrt(n + 1) - 1) / 2);

  // Number of cells in inner rings 0..k-1 = (2k-1)^2.
  const innerCount = (2 * k - 1) * (2 * k - 1);
  // 0-based offset within the current ring; ring k has 8k cells.
  const ringIndex = n - innerCount;
  const sideLength = 2 * k;

  const side = Math.floor(ringIndex / sideLength);
  const stepInSide = ringIndex % sideLength;

  switch (side) {
    case 0: // east edge: from (k, -k+1) going up to (k, k)
      return [k, -k + 1 + stepInSide];
    case 1: // north edge: from (k-1, k) going left to (-k, k)
      return [k - 1 - stepInSide, k];
    case 2: // west edge: from (-k, k-1) going down to (-k, -k)
      return [-k, k - 1 - stepInSide];
    case 3: // south edge: from (-k+1, -k) going right to (k, -k)
      return [-k + 1 + stepInSide, -k];
    default:
      // Unreachable: ringIndex < 8k, so side ∈ {0,1,2,3}.
      throw new Error(`spiralCoord: unreachable side=${side} for n=${n}`);
  }
}

/**
 * Compute the Bitcoin coinbase subsidy at a given block height,
 * in whole BTC. Halves every 210,000 blocks; reaches 0 around block
 * 6.93M (33 halvings, after which no further coins are issued).
 */
export function subsidyAtBlock(blockHeight: number): number {
  if (blockHeight < 0) return 0;
  const halvings = Math.floor(blockHeight / 210_000);
  if (halvings >= 33) return 0;
  // Initial subsidy 50 BTC, halved `halvings` times. Bitwise shift is
  // safe here because halvings ≤ 32 by the guard above.
  return 50 >>> halvings;
}

/**
 * Total cumulative coins minted from genesis through `blockHeight`
 * inclusive. Useful for picking a coin's spiral index given its
 * `(block, withinBlockIndex)` coordinates.
 */
export function cumulativeSubsidy(blockHeight: number): number {
  if (blockHeight < 0) return 0;
  let total = 0;
  let cursor = 0;
  let halving = 0;
  while (cursor <= blockHeight) {
    const subsidy = halving < 33 ? 50 >>> halving : 0;
    if (subsidy === 0) break;
    const epochEnd = (halving + 1) * 210_000 - 1;
    const blocksInEpoch = Math.min(blockHeight, epochEnd) - cursor + 1;
    total += subsidy * blocksInEpoch;
    cursor = epochEnd + 1;
    halving += 1;
  }
  return total;
}
