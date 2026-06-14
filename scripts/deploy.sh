#!/usr/bin/env bash
# scripts/deploy.sh — production build + Cloudflare Pages deploy for timechaingraph.
#
# Cloudflare Pages rejects any file > 25MB. The only assets over that are the
# DuckDB .wasm modules (mvp 39MB, eh 34MB) — they're served from our R2 bucket
# and STRIPPED from the upload here. The small DuckDB worker .js files MUST stay
# in the upload — `new Worker(url)` forbids cross-origin scripts, so the worker
# loads same-origin while only the .wasm comes from R2.
#
# The parquet data bundle (public/data/) is now ~12MB — every file < 25MB after
# the tier removal — so it SHIPS SAME-ORIGIN in the upload; no R2 needed for the
# data. (To move it to R2 later: export NEXT_PUBLIC_DATA_BASE_URL and re-add the
# `rm -rf out/data` strip below.)
#
# Point the runtime at R2 for the wasm by exporting this before running
# (otherwise it defaults to same-origin, which only works locally — the stripped
# >25MB wasm won't exist on Pages):
#   export NEXT_PUBLIC_DUCKDB_WASM_BASE="https://data.timechaingraph.com"
#
# One-time R2 bucket + CORS + wasm-upload steps: docs/DEPLOY_r2_hosting.md
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▸ vendor DuckDB-Wasm assets (same-origin worker + wasm into public/)"
node scripts/copy-duckdb-assets.mjs

echo "▸ generate OG share image (public/og.png)"
node scripts/gen-og-image.mjs

echo "▸ clean build"
rm -rf .next out
npx next build

echo "▸ strip the >25MB DuckDB wasm (served from R2; KEEP the worker .js — same-origin)"
rm -f  out/duckdb/*.wasm   # 39/34MB → R2
rm -rf out/blocks          # legacy per-block snapshots, if present
# NOTE: out/data (the ~12MB parquet bundle) is intentionally KEPT — it ships
# same-origin now that the tier removal put every file under the 25MB limit.

echo "▸ guard: any file still over 25MB will be rejected by Pages —"
OVERSIZE=$(find out -type f -size +25M -print)
if [ -n "$OVERSIZE" ]; then
  echo "✗ oversized files remain (add them to the strip above):" >&2
  printf '%s\n' "$OVERSIZE" | sed 's/^/    /' >&2
  exit 1
fi
echo "  none — good."

echo "▸ privacy audit (no third-party domains in the build)"
npm run privacy-audit

echo "▸ deploy to Cloudflare Pages"
npx wrangler pages deploy out --project-name=timechaingraph --branch=main

echo "✓ deployed."
echo "  DUCKDB_WASM_BASE = ${NEXT_PUBLIC_DUCKDB_WASM_BASE:-UNSET → /graph is BROKEN in prod (wasm stripped); set it once R2 is live}"
echo "  DATA_BASE_URL    = ${NEXT_PUBLIC_DATA_BASE_URL:-unset → parquet ships same-origin (OK)}"
echo "  Wasm cutover steps: docs/DEPLOY_r2_hosting.md"
