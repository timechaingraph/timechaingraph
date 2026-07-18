import { describe, it, expect } from 'vitest';
import { lowerBound, upperBound } from '../binarySearch';

describe('binarySearch bounds (perf#7 fade-window slice)', () => {
  it('empty array → 0 for both bounds', () => {
    expect(lowerBound([], 5)).toBe(0);
    expect(upperBound([], 5)).toBe(0);
  });

  it('target below all → 0; above all → length', () => {
    const a = [10, 20, 30];
    expect(lowerBound(a, 5)).toBe(0);
    expect(upperBound(a, 5)).toBe(0);
    expect(lowerBound(a, 99)).toBe(3);
    expect(upperBound(a, 99)).toBe(3);
  });

  it('exact + duplicate boundaries: lowerBound = first match, upperBound = after last', () => {
    const a = [1, 5, 5, 5, 9];
    expect(lowerBound(a, 5)).toBe(1);
    expect(upperBound(a, 5)).toBe(4);
    expect(a.slice(lowerBound(a, 5), upperBound(a, 5))).toEqual([5, 5, 5]);
  });

  it('window entirely between elements → empty slice', () => {
    const a = [10, 20, 30];
    const lo = lowerBound(a, 21);
    const hi = upperBound(a, 29);
    expect(lo).toBe(2);
    expect(hi).toBe(2);
    expect(hi - lo).toBe(0);
  });

  it('single element', () => {
    expect(lowerBound([7], 7)).toBe(0);
    expect(upperBound([7], 7)).toBe(1);
    expect(lowerBound([7], 8)).toBe(1);
  });

  it('models the fade window [currentBlock - FADE + 1, currentBlock]', () => {
    // sorted formation blocks; FADE = 3, currentBlock = 10 → window [8, 10]
    const fb = [1, 7, 8, 9, 10, 10, 11, 20];
    const lo = lowerBound(fb, 10 - 3 + 1); // >= 8
    const hi = upperBound(fb, 10); // > 10
    expect(fb.slice(lo, hi)).toEqual([8, 9, 10, 10]); // 7 (too old), 11/20 (future) excluded
  });
});
