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
 * roster. With 50-BTC subsidy this gives 50 × DEMO_BLOCK_COUNT coins.
 *
 * v0.1 staging at 1,000 blocks (50,000 coins) — phase 1 of the
 * "genesis through first-epoch" expansion the user briefed
 * 2026-04-30. Full first epoch (210,000 blocks → 10.5M coins) is
 * the v0.2+ target; the 50k staging keeps the renderer's PIXI
 * Graphics batch within naive-rendering perf budget.
 */
export const DEMO_BLOCK_COUNT = 1_000;

const minerAddresses = FREE_TIER_50.filter((w) => w.role === 'miner').map(
  (w) => w.address,
);

if (minerAddresses.length === 0) {
  throw new Error(
    'coin-roster: FREE_TIER_50 must contain at least one miner-role wallet',
  );
}

/**
 * Number of genesis-era blocks attributed to Satoshi. In real Bitcoin
 * lore Satoshi mined a large fraction of blocks before stepping back
 * around April 2010 (~750 blocks worth ~37,500 BTC, the so-called
 * Patoshi cluster). The fixture mirrors that: Satoshi gets the first
 * SATOSHI_ERA_BLOCKS, mock miners share what comes after.
 *
 * Effect on the visual: Satoshi's coins fill the origin region
 * (cumulative count = SATOSHI_ERA_BLOCKS × 50). With the default 750
 * that's 37,500 coins centered at (0,0), forming the brass-gold
 * heartland of the lattice. The user's "covering origin is satoshi
 * coins" + "satoshi as 1st at all times" directive is satisfied by
 * data, not by a sort-time hack.
 */
const SATOSHI_ERA_BLOCKS = 750;

/**
 * Pick the miner for a given block deterministically. The first
 * SATOSHI_ERA_BLOCKS belong to Satoshi (origin heartland); blocks
 * past that rotate through the fixture's mock miner cohort.
 */
function pickMinerForBlock(blockHeight: number): string {
  if (blockHeight < SATOSHI_ERA_BLOCKS) return SATOSHI_ADDRESS;
  return minerAddresses[blockHeight % minerAddresses.length];
}

/**
 * Mint coins from genesis through `maxBlock` inclusive. Walks the
 * issuance schedule block-by-block, emitting one Coin per coinbase
 * output, placed on the 2D spiral by mint order.
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
