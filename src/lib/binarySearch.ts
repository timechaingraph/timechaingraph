/**
 * binarySearch.ts — lower/upper bound over an ascending-sorted number[].
 * Used to slice the graph's per-frame edge-fade window (perf#7) instead of
 * scanning every link each frame. Pure + dependency-free for unit testing.
 */

/** First index i where arr[i] >= target (arr ascending). arr.length if none. */
export function lowerBound(arr: readonly number[], target: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** First index i where arr[i] > target (arr ascending). arr.length if none. */
export function upperBound(arr: readonly number[], target: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
