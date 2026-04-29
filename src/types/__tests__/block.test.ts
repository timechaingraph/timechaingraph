import { describe, it, expect } from 'vitest';
import { isHalvingBlock, epochFromHeight, isFirstBlockOfEpoch } from '../block';

describe('isHalvingBlock', () => {
  it('is false at genesis', () => {
    // The genesis block is not a halving — by convention halvings happen
    // every 210k blocks AFTER genesis.
    expect(isHalvingBlock(0)).toBe(false);
  });

  it('is true at every multiple of 210,000', () => {
    expect(isHalvingBlock(210_000)).toBe(true);
    expect(isHalvingBlock(420_000)).toBe(true);
    expect(isHalvingBlock(630_000)).toBe(true);
    expect(isHalvingBlock(840_000)).toBe(true);
    expect(isHalvingBlock(1_050_000)).toBe(true);
  });

  it('is false at non-halving heights', () => {
    expect(isHalvingBlock(1)).toBe(false);
    expect(isHalvingBlock(209_999)).toBe(false);
    expect(isHalvingBlock(210_001)).toBe(false);
    expect(isHalvingBlock(500_000)).toBe(false);
    expect(isHalvingBlock(876_500)).toBe(false);
  });

  it('is false at negative heights (defensive)', () => {
    expect(isHalvingBlock(-210_000)).toBe(false);
    expect(isHalvingBlock(-1)).toBe(false);
  });
});

describe('epochFromHeight', () => {
  it('floors height by 2016', () => {
    expect(epochFromHeight(0)).toBe(0);
    expect(epochFromHeight(2015)).toBe(0);
    expect(epochFromHeight(2016)).toBe(1);
    expect(epochFromHeight(4031)).toBe(1);
    expect(epochFromHeight(4032)).toBe(2);
  });

  it('handles large block heights', () => {
    expect(epochFromHeight(840_000)).toBe(Math.floor(840_000 / 2016));
    expect(epochFromHeight(876_500)).toBe(Math.floor(876_500 / 2016));
  });
});

describe('isFirstBlockOfEpoch', () => {
  it('is true at every multiple of 2016', () => {
    expect(isFirstBlockOfEpoch(0)).toBe(true);
    expect(isFirstBlockOfEpoch(2016)).toBe(true);
    expect(isFirstBlockOfEpoch(4032)).toBe(true);
    expect(isFirstBlockOfEpoch(2016 * 100)).toBe(true);
  });

  it('is false off the boundary', () => {
    expect(isFirstBlockOfEpoch(1)).toBe(false);
    expect(isFirstBlockOfEpoch(2015)).toBe(false);
    expect(isFirstBlockOfEpoch(2017)).toBe(false);
  });
});
