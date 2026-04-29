import { describe, it, expect } from 'vitest';
import {
  spiralCoord,
  subsidyAtBlock,
  cumulativeSubsidy,
} from '../spiral';

describe('spiralCoord', () => {
  it('places index 0 at the origin', () => {
    expect(spiralCoord(0)).toEqual([0, 0]);
  });

  it('places ring-1 coins around the origin', () => {
    // east, then counter-clockwise around ring 1.
    expect(spiralCoord(1)).toEqual([1, 0]);
    expect(spiralCoord(2)).toEqual([1, 1]);
    expect(spiralCoord(3)).toEqual([0, 1]);
    expect(spiralCoord(4)).toEqual([-1, 1]);
    expect(spiralCoord(5)).toEqual([-1, 0]);
    expect(spiralCoord(6)).toEqual([-1, -1]);
    expect(spiralCoord(7)).toEqual([0, -1]);
    expect(spiralCoord(8)).toEqual([1, -1]);
  });

  it('starts ring 2 from the east at (2, -1)', () => {
    expect(spiralCoord(9)).toEqual([2, -1]);
  });

  it('produces unique positions for the first 1000 indices', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const [x, y] = spiralCoord(i);
      const key = `${x},${y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('keeps positions within Chebyshev radius √n of the origin', () => {
    for (let i = 0; i < 200; i++) {
      const [x, y] = spiralCoord(i);
      const cheby = Math.max(Math.abs(x), Math.abs(y));
      // ring k contains (2k+1)² total cells, so cheby ≤ ceil((√(n+1)-1)/2).
      const expectedMax = Math.ceil((Math.sqrt(i + 1) - 1) / 2);
      expect(cheby).toBeLessThanOrEqual(expectedMax);
    }
  });

  it('throws on negative or non-integer input', () => {
    expect(() => spiralCoord(-1)).toThrow();
    expect(() => spiralCoord(1.5)).toThrow();
  });
});

describe('subsidyAtBlock', () => {
  it('is 50 BTC before the first halving', () => {
    expect(subsidyAtBlock(0)).toBe(50);
    expect(subsidyAtBlock(1)).toBe(50);
    expect(subsidyAtBlock(209_999)).toBe(50);
  });

  it('halves at every 210,000-block boundary', () => {
    expect(subsidyAtBlock(210_000)).toBe(25);
    expect(subsidyAtBlock(420_000)).toBe(12);
    expect(subsidyAtBlock(630_000)).toBe(6);
    expect(subsidyAtBlock(840_000)).toBe(3);
    expect(subsidyAtBlock(1_050_000)).toBe(1);
  });

  it('returns 0 once the issuance schedule is exhausted', () => {
    // After 33 halvings, the subsidy is below 1 satoshi.
    expect(subsidyAtBlock(33 * 210_000)).toBe(0);
    expect(subsidyAtBlock(50_000_000)).toBe(0);
  });

  it('returns 0 for negative heights', () => {
    expect(subsidyAtBlock(-1)).toBe(0);
  });
});

describe('cumulativeSubsidy', () => {
  it('is 50 at block 0 (one block × 50 BTC)', () => {
    expect(cumulativeSubsidy(0)).toBe(50);
  });

  it('grows linearly within an epoch', () => {
    expect(cumulativeSubsidy(99)).toBe(100 * 50);
    expect(cumulativeSubsidy(999)).toBe(1000 * 50);
  });

  it('reflects the first halving', () => {
    // Through block 209,999: 210k blocks × 50 BTC = 10,500,000 BTC.
    expect(cumulativeSubsidy(209_999)).toBe(10_500_000);
    // Block 210,000 is the first halving — adds 25 BTC.
    expect(cumulativeSubsidy(210_000)).toBe(10_500_025);
  });

  it('matches a hand-computed value through the second halving', () => {
    // Through 419,999: 210k × 50 + 210k × 25 = 10,500,000 + 5,250,000 = 15,750,000.
    expect(cumulativeSubsidy(419_999)).toBe(15_750_000);
  });
});
