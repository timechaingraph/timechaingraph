import { describe, it, expect } from 'vitest';
import { getDistance, getConnectionStrength } from '../proximity';

describe('getDistance', () => {
  it('returns 0 for identical points', () => {
    expect(getDistance({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(0);
    expect(getDistance({ x: 5, y: -3 }, { x: 5, y: -3 })).toBe(0);
  });

  it('returns Euclidean distance for orthogonal pairs', () => {
    expect(getDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(getDistance({ x: 0, y: 0 }, { x: 0, y: 7 })).toBe(7);
    expect(getDistance({ x: 0, y: 0 }, { x: -7, y: 0 })).toBe(7);
  });

  it('is symmetric', () => {
    const a = { x: 1, y: 2 };
    const b = { x: 4, y: 6 };
    expect(getDistance(a, b)).toBe(getDistance(b, a));
  });
});

describe('getConnectionStrength', () => {
  it('returns 1 at zero distance', () => {
    expect(getConnectionStrength(0, 10)).toBe(1);
  });

  it('returns 1 for negative distance (defensive clamp)', () => {
    expect(getConnectionStrength(-5, 10)).toBe(1);
  });

  it('linearly fades between 0 and threshold', () => {
    expect(getConnectionStrength(2.5, 10)).toBe(0.75);
    expect(getConnectionStrength(5, 10)).toBe(0.5);
    expect(getConnectionStrength(7.5, 10)).toBe(0.25);
  });

  it('returns 0 at threshold exactly', () => {
    expect(getConnectionStrength(10, 10)).toBe(0);
  });

  it('returns 0 beyond threshold', () => {
    expect(getConnectionStrength(15, 10)).toBe(0);
    expect(getConnectionStrength(1000, 10)).toBe(0);
  });
});
