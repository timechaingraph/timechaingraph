/**
 * Convex hull (Andrew's monotone chain) — O(n log n).
 *
 * Used by the Grid view to outline an empire's territory: the hull
 * of every coin owned by a wallet forms the empire's border. As the
 * user hovers over a coin, the hull of that coin's owner glows on
 * the canvas — even at zoom-out where individual cells are too
 * small to see clearly, the empire boundary stays legible.
 *
 * Operates on integer or float `[x, y]` pairs. Returns the hull
 * vertices in counter-clockwise order, with the first vertex NOT
 * repeated at the end (callers wanting a closed polygon append the
 * first point themselves).
 *
 * Edge cases:
 *   - 0 points → returns []
 *   - 1 point  → returns [point]
 *   - 2 points → returns both points
 *   - All collinear → returns the two endpoints
 */

export type Point2 = [number, number];

function cross(o: Point2, a: Point2, b: Point2): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

export function convexHull(points: readonly Point2[]): Point2[] {
  const n = points.length;
  if (n <= 1) return points.slice() as Point2[];

  // Sort lexicographically by (x, y); duplicates handled by the
  // turn-direction filter below.
  const pts = points.slice().sort((a, b) => {
    if (a[0] !== b[0]) return a[0] - b[0];
    return a[1] - b[1];
  });

  const lower: Point2[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Point2[] = [];
  for (let i = pts.length - 1; i >= 0; i -= 1) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  // Drop the last element of each half — they're each other's
  // first elements (the lex-extreme points).
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}
