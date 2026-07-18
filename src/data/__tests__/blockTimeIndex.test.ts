import { describe, it, expect } from 'vitest';
import { buildBlockTimeIndex, blockTimeAt } from '../blockTimeIndex';

describe('blockTimeIndex (perf#3 lazy timestamps)', () => {
  it('maps block→unix into a height-indexed array', () => {
    const arr = buildBlockTimeIndex([{ block: 0, t: 1231006505 }, { block: 3, t: 1231469665 }], 3);
    expect(arr.length).toBe(4);
    expect(arr[0]).toBe(1231006505);
    expect(arr[3]).toBe(1231469665);
    expect(arr[1]).toBe(0); // unknown slot
  });

  it('ignores out-of-range blocks (never writes past tip)', () => {
    const arr = buildBlockTimeIndex([{ block: 99, t: 5 }], 3);
    expect(arr.length).toBe(4);
    expect(Array.from(arr).every((x) => x === 0)).toBe(true);
  });

  it('blockTimeAt returns undefined before fill (null index) — graceful degrade', () => {
    expect(blockTimeAt(null, 5)).toBeUndefined();
  });

  it('blockTimeAt returns the label after fill, undefined for unknown/out-of-range', () => {
    const arr = buildBlockTimeIndex([{ block: 5, t: 1231006505 }], 10);
    expect(blockTimeAt(arr, 5)).toBe(1231006505); // label present post-fill
    expect(blockTimeAt(arr, 6)).toBeUndefined(); // unknown slot (0)
    expect(blockTimeAt(arr, -1)).toBeUndefined();
    expect(blockTimeAt(arr, 999)).toBeUndefined();
  });
});
