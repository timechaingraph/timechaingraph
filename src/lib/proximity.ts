import type { GridPosition } from '@/types/lattice';

/** Euclidean distance between two grid positions. */
export function getDistance(a: GridPosition, b: GridPosition): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Linear-fadeoff connection strength: 1.0 at distance 0,
 * 0.0 at distance >= threshold, linear in between.
 */
export function getConnectionStrength(distance: number, threshold: number): number {
  if (distance >= threshold) return 0;
  if (distance <= 0) return 1;
  return 1 - distance / threshold;
}
