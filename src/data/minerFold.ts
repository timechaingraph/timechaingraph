/**
 * minerFold.ts — the perf#2 "miners folded" manifest flag.
 *
 * When build_bundle.py folds the coinbase-PROVEN miner set (the DISTINCT
 * per-block coinbase recipients) INTO wallets.parquet's is_miner column, it
 * stamps `minersFolded: true` on the manifest. The runtime then reads is_miner
 * directly and SKIPS the separate ~9MB block-miners.parquet fetch (~45% of the
 * critical parquet). Pre-fold bundles omit the flag → the runtime keeps
 * fetching block-miners and overriding is_miner (unchanged behavior).
 *
 * Fail-closed: only an explicit `true` skips the fetch, so the current live
 * bundle (no flag) is untouched until a rebuilt, flagged bundle ships.
 *
 * Kept pure + dependency-free so it unit-tests without the DuckDB-Wasm engine.
 */
export interface MinerFoldManifest {
  minersFolded?: boolean;
}

export function minersFolded(manifest: MinerFoldManifest): boolean {
  return manifest.minersFolded === true;
}
