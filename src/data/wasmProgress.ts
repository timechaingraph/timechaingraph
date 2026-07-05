/**
 * Pure helpers for DuckDB-Wasm instantiation progress → a human load stage.
 * Kept separate from duckdb.ts so it carries no @duckdb/duckdb-wasm import and
 * stays trivially unit-testable.
 */
export interface WasmProgress {
  bytesLoaded: number;
  bytesTotal: number;
}

/**
 * Format instantiate() progress into a load-stage string + a clamped 0–100
 * percent. Guards bytesTotal === 0 (the callback can fire before the total is
 * known) so the UI never shows NaN%.
 */
export function wasmLoadStage(p: WasmProgress): { stage: string; pct: number } {
  const pct =
    p.bytesTotal > 0
      ? Math.max(0, Math.min(100, Math.round((p.bytesLoaded / p.bytesTotal) * 100)))
      : 0;
  return { stage: `Loading query engine — ${pct}%…`, pct };
}
