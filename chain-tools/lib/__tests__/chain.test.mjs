import { describe, it, expect } from 'vitest';
import {
  SATS_PER_BTC,
  BLOCKS_PER_EPOCH,
  TARGET_TOTAL_BTC,
  HALVING_BLOCKS,
  TIP_BLOCK,
  GENESIS_MS,
  epochAt,
  subsidyBtcAt,
  cumulativeSupplyBtcAt,
  dateApproxAt,
  isHalvingBlock,
  subsidySatsAt,
} from '../chain.mjs';

describe('chain.mjs constants', () => {
  it('SATS_PER_BTC is 100M as bigint', () => {
    expect(SATS_PER_BTC).toBe(100_000_000n);
  });

  it('BLOCKS_PER_EPOCH is 210k', () => {
    expect(BLOCKS_PER_EPOCH).toBe(210_000);
  });

  it('TARGET_TOTAL_BTC is 21M', () => {
    expect(TARGET_TOTAL_BTC).toBe(21_000_000);
  });

  it('HALVING_BLOCKS contains the v0.1 horizon', () => {
    expect(HALVING_BLOCKS).toEqual([0, 210_000, 420_000, 630_000, 840_000]);
  });

  it('TIP_BLOCK is snapped to a recent live chain tip', () => {
    expect(TIP_BLOCK).toBe(947_630);
  });

  it('GENESIS_MS aligns with 2009-01-03 18:15 UTC', () => {
    expect(GENESIS_MS).toBe(Date.UTC(2009, 0, 3, 18, 15, 0));
  });
});

describe('epochAt', () => {
  it('returns 0 for genesis block', () => {
    expect(epochAt(0)).toBe(0);
  });

  it('returns 0 for the last block of epoch 0', () => {
    expect(epochAt(209_999)).toBe(0);
  });

  it('returns 1 for the first halving block', () => {
    expect(epochAt(210_000)).toBe(1);
  });

  it('returns 2 at block 420,000', () => {
    expect(epochAt(420_000)).toBe(2);
  });

  it('returns 4 at block 840,000 (4th halving)', () => {
    expect(epochAt(840_000)).toBe(4);
  });
});

describe('subsidyBtcAt', () => {
  it('returns 50 BTC at genesis', () => {
    expect(subsidyBtcAt(0)).toBe(50);
  });

  it('returns 50 BTC at the last block of epoch 0', () => {
    expect(subsidyBtcAt(209_999)).toBe(50);
  });

  it('returns 25 BTC at the first halving (block 210,000)', () => {
    expect(subsidyBtcAt(210_000)).toBe(25);
  });

  it('returns 12.5 BTC at the second halving', () => {
    expect(subsidyBtcAt(420_000)).toBe(12.5);
  });

  it('returns 6.25 BTC at the third halving', () => {
    expect(subsidyBtcAt(630_000)).toBe(6.25);
  });

  it('returns 3.125 BTC at the fourth halving', () => {
    expect(subsidyBtcAt(840_000)).toBe(3.125);
  });

  it('returns 0 for negative heights (defensive)', () => {
    expect(subsidyBtcAt(-1)).toBe(0);
  });

  it('returns 0 after 33 halvings (subsidy goes sub-satoshi)', () => {
    const after33 = 33 * BLOCKS_PER_EPOCH;
    expect(subsidyBtcAt(after33)).toBe(0);
  });
});

describe('subsidySatsAt — sat-precise integer issuance', () => {
  it('returns 5_000_000_000n at genesis (50 BTC)', () => {
    expect(subsidySatsAt(0)).toBe(5_000_000_000n);
  });

  it('returns 2_500_000_000n at first halving (25 BTC)', () => {
    expect(subsidySatsAt(210_000)).toBe(2_500_000_000n);
  });

  it('returns 1_250_000_000n at second halving (12.5 BTC)', () => {
    expect(subsidySatsAt(420_000)).toBe(1_250_000_000n);
  });

  it('returns 312_500_000n at fourth halving (3.125 BTC)', () => {
    expect(subsidySatsAt(840_000)).toBe(312_500_000n);
  });

  it('returns 1n at epoch 32 (last sat-positive subsidy)', () => {
    // 50 BTC = 5_000_000_000 sats. After 32 halvings: 5_000_000_000 >> 32 = 1
    expect(subsidySatsAt(32 * BLOCKS_PER_EPOCH)).toBe(1n);
  });

  it('returns 0n after 33 halvings', () => {
    expect(subsidySatsAt(33 * BLOCKS_PER_EPOCH)).toBe(0n);
  });

  it('returns 0n for negative heights (defensive)', () => {
    expect(subsidySatsAt(-1)).toBe(0n);
  });

  it('agrees with subsidyBtcAt × SATS_PER_BTC for the first 4 epochs', () => {
    for (const block of [0, 210_000, 420_000, 630_000, 840_000]) {
      const fromBtc = BigInt(Math.round(subsidyBtcAt(block) * 100_000_000));
      expect(subsidySatsAt(block)).toBe(fromBtc);
    }
  });
});

describe('cumulativeSupplyBtcAt', () => {
  it('returns 50 BTC at block 0', () => {
    expect(cumulativeSupplyBtcAt(0)).toBe(50);
  });

  it('returns 100 BTC at block 1', () => {
    expect(cumulativeSupplyBtcAt(1)).toBe(100);
  });

  it('returns 10,500,000 BTC at end of epoch 0 (block 209,999)', () => {
    expect(cumulativeSupplyBtcAt(209_999)).toBe(10_500_000);
  });

  it('returns 15,750,000 BTC at end of epoch 1 (block 419,999)', () => {
    // 10.5M (epoch 0) + 210k * 25 = 10.5M + 5.25M = 15.75M
    expect(cumulativeSupplyBtcAt(419_999)).toBe(15_750_000);
  });

  it('returns 18,375,000 BTC at end of epoch 2 (block 629,999)', () => {
    // 15.75M + 210k * 12.5 = 15.75M + 2.625M = 18.375M
    expect(cumulativeSupplyBtcAt(629_999)).toBe(18_375_000);
  });

  it('returns 19,687,500 BTC at end of epoch 3 (block 839,999)', () => {
    // 18.375M + 210k * 6.25 = 18.375M + 1.3125M = 19.6875M
    expect(cumulativeSupplyBtcAt(839_999)).toBe(19_687_500);
  });

  it('asymptotes at 21,000,000 BTC across all 33 epochs', () => {
    // Sum to "infinity" — should round to (just under) 21M.
    const farFuture = cumulativeSupplyBtcAt(33 * BLOCKS_PER_EPOCH);
    expect(farFuture).toBeLessThanOrEqual(TARGET_TOTAL_BTC);
    expect(farFuture).toBeGreaterThan(TARGET_TOTAL_BTC - 1);
  });

  it('returns 0 for negative heights (defensive)', () => {
    expect(cumulativeSupplyBtcAt(-1)).toBe(0);
  });
});

describe('isHalvingBlock', () => {
  it('returns false for genesis (block 0 is not a halving)', () => {
    expect(isHalvingBlock(0)).toBe(false);
  });

  it('returns true at block 210,000 (first halving)', () => {
    expect(isHalvingBlock(210_000)).toBe(true);
  });

  it('returns true at block 420,000', () => {
    expect(isHalvingBlock(420_000)).toBe(true);
  });

  it('returns true at block 630,000', () => {
    expect(isHalvingBlock(630_000)).toBe(true);
  });

  it('returns false for non-halving blocks', () => {
    expect(isHalvingBlock(1)).toBe(false);
    expect(isHalvingBlock(105_000)).toBe(false);
    expect(isHalvingBlock(209_999)).toBe(false);
    expect(isHalvingBlock(210_001)).toBe(false);
  });
});

describe('dateApproxAt', () => {
  it('returns 2009-01-03 for genesis', () => {
    expect(dateApproxAt(0)).toBe('2009-01-03');
  });

  it('returns 2009-01-03 for block 1 (10 min later, same day)', () => {
    expect(dateApproxAt(1)).toBe('2009-01-03');
  });

  it('rolls over a day around block 144 (24h × 6 blocks/h)', () => {
    // Block 0 minted at 18:15 UTC; +144 blocks = +24h = 2009-01-04 18:15.
    expect(dateApproxAt(144)).toBe('2009-01-04');
  });

  it('extrapolates TIP_BLOCK to a future date (linear-extrapolation drift)', () => {
    // TIP_BLOCK = 947,630 was actually mined ~2026-05-02 on mainnet,
    // but pure linear extrapolation (10 min/block from 2009-01-03)
    // lands in 2027 because mainnet runs faster than schedule (the
    // chain has a ~9.5 min average block time historically, against
    // the 10 min target). The function's docstring explicitly accepts
    // this drift; the test pins the *function's* output so a refactor
    // that breaks the math fails loudly. If we ever switch to a
    // difficulty-aware approximation, this assertion changes.
    expect(dateApproxAt(TIP_BLOCK)).toBe('2027-01-10');
  });
});
