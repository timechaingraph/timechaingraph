import type { Coin } from '@/types/coin';

/**
 * Coin-swap animation primitive — v0.2 transfer mechanic groundwork.
 *
 * Per user directive 2026-05-01, when a coin transfers ownership in
 * the v0.2+ ingest pipeline, the bought tile should relocate to be
 * adjacent to the new owner's existing territory. To keep the grid
 * collision-free (one cell, one owner), the relocation happens by
 * SWAPPING with a same-sized neighbor that has no empire (or is
 * empire-less / single-node-owner). This file is the algorithm
 * primitive driving that swap visually.
 *
 * Today (v0.1): not invoked. The fixture is owner=minter, no
 * transfers. The primitive sits unused, waiting for the ingest
 * pipeline to call it on every transfer event.
 *
 * Tomorrow (v0.2+): the ingest pipeline emits a stream of
 * `{ from: address, to: address, coinId: string }` transfer events
 * per block. For each event, the renderer:
 *   1. Looks up the destination empire's outermost cell (Cd).
 *   2. Looks up an adjacent unowned cell or empireless coin (Cu).
 *   3. Swaps `coinId`'s grid position with Cu's grid position.
 *   4. Updates ownerAddress on coinId (= the to-address).
 *   5. Animates both cells smoothly trading places over ~600ms.
 *
 * The swap-finder logic (steps 1-2) is the smart part. Plugged in
 * here as a `findSwapTarget` function the ingest pipeline parameterizes.
 */

export interface SwapAnimationFrame {
  coinAId: string;
  coinBId: string;
  /** 0 = swap start, 1 = swap complete. */
  progress: number;
  /** Mid-flight (x, y) for coin A. */
  aPos: [number, number];
  /** Mid-flight (x, y) for coin B. */
  bPos: [number, number];
}

export interface SwapPlan {
  coinA: Coin;
  coinB: Coin;
  durationMs: number;
}

/**
 * Smooth easing function — ease-in-out cubic. Creates the "lift,
 * arc, settle" feeling rather than linear sliding.
 */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Compute a swap-animation frame for the current time `t` in ms
 * since swap start.
 *
 * Cells trace gentle arcs past each other (slight peak above the
 * straight-line interpolation) so the swap reads as motion rather
 * than a teleport. arc-height is 1/8th of the swap distance.
 */
export function computeSwapFrame(
  plan: SwapPlan,
  t: number,
): SwapAnimationFrame | null {
  if (t < 0) return null;
  if (t > plan.durationMs) return null;
  const linear = t / plan.durationMs;
  const eased = easeInOutCubic(linear);
  const dx = plan.coinB.gridX - plan.coinA.gridX;
  const dy = plan.coinB.gridY - plan.coinA.gridY;
  const dist = Math.hypot(dx, dy);
  // Perpendicular offset for the arc — peaks at eased = 0.5.
  const arcHeight = dist / 8;
  const archProgress = Math.sin(linear * Math.PI); // 0..1..0
  // Perpendicular direction (rotate dx,dy by 90°).
  const perpX = -dy / Math.max(dist, 1);
  const perpY = dx / Math.max(dist, 1);
  const aOffsetX = arcHeight * archProgress * perpX;
  const aOffsetY = arcHeight * archProgress * perpY;

  return {
    coinAId: plan.coinA.id,
    coinBId: plan.coinB.id,
    progress: eased,
    aPos: [
      plan.coinA.gridX + dx * eased + aOffsetX,
      plan.coinA.gridY + dy * eased + aOffsetY,
    ],
    bPos: [
      plan.coinB.gridX - dx * eased - aOffsetX,
      plan.coinB.gridY - dy * eased - aOffsetY,
    ],
  };
}

/**
 * Default swap duration: 600ms. Long enough to read as
 * "something happened", short enough that a stream of transfers
 * doesn't feel like the canvas is dragging.
 */
export const DEFAULT_SWAP_DURATION_MS = 600;

/**
 * Run a complete swap animation, calling `onFrame` per
 * requestAnimationFrame tick until the swap completes. Returns a
 * cleanup function that aborts the animation early. Returns the
 * promise that resolves when the animation finishes (or aborts).
 *
 * v0.2 hook: the canvas-side animator wraps this and updates the
 * relevant Graphics positions on each frame. The fixture/renderer
 * layer also needs to commit the swapped grid coordinates at
 * completion (`progress === 1`) so subsequent renders see the new
 * positions.
 */
export function animateSwap(
  plan: SwapPlan,
  onFrame: (frame: SwapAnimationFrame) => void,
): { abort: () => void; promise: Promise<void> } {
  let cancelled = false;
  let rafId: number | null = null;
  const start = performance.now();
  const promise = new Promise<void>((resolve) => {
    function tick(now: number): void {
      if (cancelled) {
        resolve();
        return;
      }
      const t = now - start;
      const frame = computeSwapFrame(plan, t);
      if (!frame) {
        // Past duration — emit final position and resolve.
        onFrame({
          coinAId: plan.coinA.id,
          coinBId: plan.coinB.id,
          progress: 1,
          aPos: [plan.coinB.gridX, plan.coinB.gridY],
          bPos: [plan.coinA.gridX, plan.coinA.gridY],
        });
        resolve();
        return;
      }
      onFrame(frame);
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
  });
  return {
    abort: () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
    },
    promise,
  };
}

/**
 * Find a swap target for a transferred coin — the v0.2 "smart
 * placement" decision. Pluggable so the ingest pipeline can pass
 * its own neighborhood search (e.g., backed by a spatial index
 * over current ownership state).
 *
 * Default heuristic for the fixture phase:
 *   - Prefer an unowned ("empireless") cell adjacent to the
 *     destination's existing territory.
 *   - Fall back to any cell whose owner has the same total coin
 *     count as the destination (peer empires can swap freely).
 *   - Last resort: no swap, just update ownership in place.
 *
 * Returns null when no swap target exists; the renderer should
 * leave the coin in place in that case.
 */
export type SwapTargetFinder = (transferredCoin: Coin) => Coin | null;

export const noopSwapTargetFinder: SwapTargetFinder = () => null;
