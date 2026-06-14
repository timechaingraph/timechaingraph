import { describe, it, expect } from 'vitest';
import {
  computeSwapFrame,
  DEFAULT_SWAP_DURATION_MS,
  noopSwapTargetFinder,
  type SwapPlan,
} from '../coinSwap';
import type { Coin } from '@/types/coin';

function mkCoin(id: string, x: number, y: number): Coin {
  return {
    id,
    mintedAtBlock: 0,
    mintedIndex: 0,
    minterAddress: 'minter',
    ownerAddress: 'owner',
    spiralIndex: 0,
    gridX: x,
    gridY: y,
    isHalving: false,
  };
}

describe('computeSwapFrame', () => {
  const plan: SwapPlan = {
    coinA: mkCoin('A', 0, 0),
    coinB: mkCoin('B', 10, 0),
    durationMs: DEFAULT_SWAP_DURATION_MS,
  };

  it('returns null before the swap begins', () => {
    expect(computeSwapFrame(plan, -1)).toBeNull();
  });

  it('returns null after the swap completes', () => {
    expect(computeSwapFrame(plan, plan.durationMs + 1)).toBeNull();
  });

  it('emits coin A starting at its origin at t=0', () => {
    const f = computeSwapFrame(plan, 0)!;
    expect(f.aPos[0]).toBeCloseTo(0, 5);
    expect(f.aPos[1]).toBeCloseTo(0, 5);
    expect(f.bPos[0]).toBeCloseTo(10, 5);
    expect(f.bPos[1]).toBeCloseTo(0, 5);
    expect(f.progress).toBeCloseTo(0, 5);
  });

  it('emits coin A near its destination at t=duration', () => {
    const f = computeSwapFrame(plan, plan.durationMs)!;
    expect(f.aPos[0]).toBeCloseTo(10, 5);
    expect(f.aPos[1]).toBeCloseTo(0, 5);
    expect(f.bPos[0]).toBeCloseTo(0, 5);
    expect(f.bPos[1]).toBeCloseTo(0, 5);
    expect(f.progress).toBeCloseTo(1, 5);
  });

  it('mid-swap arc lifts coins off the straight line', () => {
    const f = computeSwapFrame(plan, plan.durationMs / 2)!;
    // A and B should be passing each other near the midpoint, with
    // a small perpendicular offset (arc) so they don't collide on a
    // single pixel.
    expect(f.aPos[0]).toBeCloseTo(5, 1);
    expect(Math.abs(f.aPos[1])).toBeGreaterThan(0);
    expect(f.bPos[0]).toBeCloseTo(5, 1);
    expect(Math.abs(f.bPos[1])).toBeGreaterThan(0);
    // A and B perpendicular offsets are mirror-image.
    expect(f.aPos[1]).toBeCloseTo(-f.bPos[1], 5);
  });

  it('eased progress is between 0 and 1 across the swap', () => {
    for (let i = 0; i <= 10; i += 1) {
      const f = computeSwapFrame(plan, (plan.durationMs * i) / 10)!;
      expect(f.progress).toBeGreaterThanOrEqual(0);
      expect(f.progress).toBeLessThanOrEqual(1);
    }
  });
});

describe('noopSwapTargetFinder', () => {
  it('always returns null (default no-swap behavior)', () => {
    expect(noopSwapTargetFinder(mkCoin('X', 1, 2))).toBeNull();
  });
});
