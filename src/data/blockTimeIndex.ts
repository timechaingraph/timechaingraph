/**
 * blockTimeIndex.ts — the block→unix-seconds lookup behind the scrubber's
 * wall-clock labels (perf#3). Split out as pure functions so the deferred
 * lazy-fill and the O(1) lookup can be unit-tested without the DuckDB engine.
 */

/** Build a height-indexed Uint32Array (block → unix seconds; 0 = unknown). */
export function buildBlockTimeIndex(
  rows: readonly { block: number; t: number }[],
  tipBlock: number,
): Uint32Array {
  const arr = new Uint32Array(Math.max(0, tipBlock + 1));
  for (const { block, t } of rows) {
    if (block >= 0 && block < arr.length) arr[block] = t >>> 0;
  }
  return arr;
}

/** Unix seconds for a block, or undefined when the index is absent (timestamps
 *  not yet lazy-filled → graceful degrade) or the slot is unknown (0). */
export function blockTimeAt(arr: Uint32Array | null, height: number): number | undefined {
  if (!arr || height < 0 || height >= arr.length) return undefined;
  const t = arr[height];
  return t > 0 ? t : undefined;
}
