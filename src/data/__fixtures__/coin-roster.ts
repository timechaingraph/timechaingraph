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
 * Pick the miner for a given block deterministically. Block 0 is
 * always Satoshi (the genesis coinbase recipient by convention);
 * later blocks rotate through the fixture's miners by block height
 * mod miner-count.
 */
function pickMinerForBlock(blockHeight: number): string {
  if (blockHeight === 0) return SATOSHI_ADDRESS;
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
