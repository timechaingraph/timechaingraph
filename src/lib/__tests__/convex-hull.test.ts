import { describe, it, expect } from 'vitest';
import { convexHull, type Point2 } from '../convex-hull';

describe('convexHull', () => {
  it('returns [] for the empty input', () => {
    expect(convexHull([])).toEqual([]);
  });

  it('returns the single point for a 1-point input', () => {
    expect(convexHull([[3, 4]])).toEqual([[3, 4]]);
  });

  it('returns both points for a 2-point input', () => {
    const pts: Point2[] = [
      [0, 0],
      [10, 5],
    ];
    expect(convexHull(pts)).toEqual([
      [0, 0],
      [10, 5],
    ]);
  });

  it('returns the corners of a convex 4-point square', () => {
    const pts: Point2[] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    const hull = convexHull(pts);
    expect(hull.length).toBe(4);
    // Hull should contain all four corners (regardless of starting
    // point or rotation order).
    for (const p of pts) {
      expect(hull).toContainEqual(p);
    }
  });

  it('drops interior points', () => {
    const pts: Point2[] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [5, 5], // interior — should NOT appear in hull
      [3, 7], // interior
    ];
    const hull = convexHull(pts);
    expect(hull).not.toContainEqual([5, 5]);
    expect(hull).not.toContainEqual([3, 7]);
    expect(hull.length).toBe(4);
  });

  it('drops collinear edge midpoints', () => {
    // 3 points on a horizontal line — hull is the two endpoints.
    const hull = convexHull([
      [0, 0],
      [5, 0],
      [10, 0],
    ]);
    expect(hull.length).toBe(2);
    expect(hull).toContainEqual([0, 0]);
    expect(hull).toContainEqual([10, 0]);
  });

  it('returns the hull of a 7-point cluster correctly', () => {
    // Outer pentagon + 2 interior points.
    const pts: Point2[] = [
      [0, 4],
      [3, 7],
      [6, 4],
      [5, 0],
      [1, 0],
      [3, 3], // interior
      [3, 5], // interior
    ];
    const hull = convexHull(pts);
    expect(hull.length).toBe(5);
    expect(hull).toContainEqual([0, 4]);
    expect(hull).toContainEqual([3, 7]);
    expect(hull).toContainEqual([6, 4]);
    expect(hull).toContainEqual([5, 0]);
    expect(hull).toContainEqual([1, 0]);
    expect(hull).not.toContainEqual([3, 3]);
    expect(hull).not.toContainEqual([3, 5]);
  });

  it('handles duplicates without infinite-looping', () => {
    const pts: Point2[] = [
      [0, 0],
      [0, 0],
      [10, 10],
      [10, 10],
    ];
    const hull = convexHull(pts);
    expect(hull.length).toBeLessThanOrEqual(2);
  });
});
