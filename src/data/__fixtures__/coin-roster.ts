import type { Coin } from '@/types/coin';
import { spiralCoord, subsidyAtBlock } from '@/lib/spiral';
import { FREE_TIER_50 } from './free-tier-50';

/**
 * Coin roster — derived from FREE_TIER_50 + Bitcoin's issuance
 * schedule. Every block mints `subsidy(block)` new coins to a miner
 * picked deterministically from the fixture's miner cohort. v0: the
 * coin's current owner is just its minter (no transfers tracked yet).
 *
 * Spiral placement is deterministic, so a coin's grid coordinate is
 * stable forever — the defining property of the Grid view's
 * "real-estate" UX.
 *
 * For demo purposes, only the first 100 blocks are minted (5,000
 * coins). Real data eventually flows from `BitcoinChainAdapter`
 * once the bitcoind pipeline ships.
 */

const SATOSHI_ADDRESS = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';

/**
 * Number of blocks worth of coinbase outputs minted into the demo
 * roster. With 50-BTC subsidy in epoch 0, this gives 50 ×
 * DEMO_BLOCK_COUNT coins.
 *
 * v0.1 staging at 3,000 blocks → 150,000 coins → 750-block Satoshi
 * heartland + 45 contiguous-50-block miner runs spread across the
 * 5 mock miners (9 arcs each forming a ring-bandolier pattern).
 * Reaching the actual first halving (block 210,000 → 10.5M coins)
 * would blow PIXI's naive Graphics-per-cell budget; v0.2+ ships an
 * LOD renderer that lazy-creates cells around the scrubber to
 * unlock the full chain.
 */
export const DEMO_BLOCK_COUNT = 3_000;

const minerAddresses = FREE_TIER_50.filter((w) => w.role === 'miner').map(
  (w) => w.address,
);

if (minerAddresses.length === 0) {
  throw new Error(
    'coin-roster: FREE_TIER_50 must contain at least one miner-role wallet',
  );
}

/**
 * Number of genesis-era blocks attributed to Satoshi (Patoshi
 * cluster mirror — Satoshi mined ~750 of the earliest blocks).
 * Her coins fill the inner spiral around origin.
 */
const SATOSHI_ERA_BLOCKS = 750;

/**
 * Number of blocks each non-Satoshi miner mines in a contiguous
 * run. With DEMO_BLOCK_COUNT=1000 and 5 mock miners sharing the
 * 250 post-Satoshi blocks, each miner gets a 50-block run = 2,500
 * contiguous coins on the global spiral, forming a single tight
 * arc on the next ring(s) past Satoshi's footprint. Per user
 * directive 2026-04-30 ("the miners should cover the outside of
 * the satoshi border at start, and only then move together as
 * they grow"), runs are sized to fill outward layers cleanly.
 */
const MINER_RUN_LENGTH = 50;

/**
 * Pick the miner for a given block deterministically. The first
 * SATOSHI_ERA_BLOCKS belong to Satoshi (origin heartland); blocks
 * past that get assigned in CONTIGUOUS RUNS to each mock miner
 * (Miner1 takes blocks 750-799, Miner2 takes 800-849, etc.) so
 * each miner's coins form a single tight spiral arc rather than
 * scattering across the outer rings.
 */
function pickMinerForBlock(blockHeight: number): string {
  if (blockHeight < SATOSHI_ERA_BLOCKS) return SATOSHI_ADDRESS;
  const minerOffset = blockHeight - SATOSHI_ERA_BLOCKS;
  const minerIdx =
    Math.floor(minerOffset / MINER_RUN_LENGTH) % minerAddresses.length;
  return minerAddresses[minerIdx];
}

/**
 * Mint coins from genesis through `maxBlock` inclusive.
 *
 * Per user directive 2026-04-30: a single global spiral starting at
 * (0, 0), every block's coins land at the next contiguous spiral
 * indices. No separate empire centers, no overlapping placements —
 * each grid cell maps to exactly one coin (== exactly one owner).
 *
 * Visual effect:
 *   - Block 0 (Satoshi): coins fill spiral indices 0..49 — a small
 *     square right at origin.
 *   - Blocks 1..749 (Satoshi): indices 50..37,499 — her coins fill
 *     the inner ~97-radius spiral.
 *   - Blocks 750..799 (Miner1, contiguous run): indices 37,500..39,999
 *     — a tight 2,500-coin arc forming the next ring(s) outside
 *     Satoshi's border.
 *   - Subsequent miners stack outward in the same way.
 *
 * Each coin's `spiralIndex` is the GLOBAL mint counter — equivalent
 * to its position on the single spiral. With this convention the
 * Prolog `spiral_neighbor` rule works trivially (consecutive indices
 * are spatial neighbors).
 *
 * v0.2+ direction (deferred): mobile real estate. When a coin
 * transfers ownership, swap it with a nearby unowned coin in the
 * new owner's neighborhood. The placement primitive here doesn't
 * model that yet — owner === minter throughout v0.1.
 */
export function mintCoinsFromGenesis(maxBlock: number): Coin[] {
  if (maxBlock < 0) return [];
  const coins: Coin[] = [];
  let spiralIndex = 0;

  for (let block = 0; block <= maxBlock; block += 1) {
    const subsidy = subsidyAtBlock(block);
    if (subsidy === 0) break;
    const minter = pickMinerForBlock(block);
    const isHalving = block > 0 && block % 210_000 === 0;

    for (let i = 0; i < subsidy; i += 1) {
      const [gridX, gridY] = spiralCoord(spiralIndex);
      coins.push({
        id: `B${block}I${i}`,
        mintedAtBlock: block,
        mintedIndex: i,
        minterAddress: minter,
        ownerAddress: minter,
        spiralIndex,
        gridX,
        gridY,
        isHalving,
      });
      spiralIndex += 1;
    }
  }

  return coins;
}

/**
 * Demo coin roster — first {@link DEMO_BLOCK_COUNT} blocks. Generated
 * once at module load; deterministic across reloads.
 */
export const COIN_ROSTER_DEMO: Coin[] = mintCoinsFromGenesis(
  DEMO_BLOCK_COUNT - 1,
);
