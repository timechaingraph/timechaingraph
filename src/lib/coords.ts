import type { GridPosition } from '@/types/lattice';

/**
 * Coordinate mapping between an integer "chain grid" (the on-chain coordinate
 * space, e.g. agentic-chain's 6481x6481 lattice or a Bitcoin wallet placement
 * grid) and a continuous "visual grid" rendered by PixiJS.
 *
 * Both apps in this monorepo use the same defaults:
 *   Chain grid:    -3240 to 3240   (6481 × 6481, span = 6480)
 *   Visual grid:   -4000 to 4000   (8000-unit visual canvas)
 *
 * Apps that need a different grid pass custom min/span via {@link makeCoordMap}.
 */

/** Default chain grid lower bound (inclusive). */
export const DEFAULT_CHAIN_GRID_MIN = -3240;

/** Default chain grid upper bound (inclusive). */
export const DEFAULT_CHAIN_GRID_MAX = 3240;

/** Default chain grid span (max - min). */
export const DEFAULT_CHAIN_GRID_SPAN = DEFAULT_CHAIN_GRID_MAX - DEFAULT_CHAIN_GRID_MIN;

/** Default visual grid half-extent (origin to edge). */
export const DEFAULT_VISUAL_HALF = 4000;

/** Default visual grid span (full extent edge-to-edge). */
export const DEFAULT_VISUAL_SPAN = DEFAULT_VISUAL_HALF * 2;

export interface CoordMapConfig {
  chainGridMin?: number;
  chainGridSpan?: number;
  visualHalf?: number;
}

export interface CoordMap {
  /** Convert blockchain coordinate → visual position. */
  chainToVisual(chainX: number, chainY: number): GridPosition;
  /** Convert visual position → nearest blockchain coordinate. */
  visualToChain(vx: number, vy: number): { x: number; y: number };
}

export function makeCoordMap(config: CoordMapConfig = {}): CoordMap {
  const chainMin = config.chainGridMin ?? DEFAULT_CHAIN_GRID_MIN;
  const chainSpan = config.chainGridSpan ?? DEFAULT_CHAIN_GRID_SPAN;
  const visualHalf = config.visualHalf ?? DEFAULT_VISUAL_HALF;
  const visualSpan = visualHalf * 2;

  return {
    chainToVisual(chainX, chainY) {
      return {
        x: ((chainX - chainMin) / chainSpan) * visualSpan - visualHalf,
        y: ((chainY - chainMin) / chainSpan) * visualSpan - visualHalf,
      };
    },
    visualToChain(vx, vy) {
      return {
        x: Math.round(((vx + visualHalf) / visualSpan) * chainSpan + chainMin),
        y: Math.round(((vy + visualHalf) / visualSpan) * chainSpan + chainMin),
      };
    },
  };
}

const defaultMap = makeCoordMap();

/** Default chainToVisual using the canonical 6481×6481 → 8000 visual grid. */
export const chainToVisual = defaultMap.chainToVisual;

/** Default visualToChain using the canonical 6481×6481 → 8000 visual grid. */
export const visualToChain = defaultMap.visualToChain;
