#!/usr/bin/env bash
# scripts/deploy.sh — production build + Cloudflare Pages deploy for timechaingraph.
#
# Cloudflare Pages rejects any file > 25MB. The big DuckDB .wasm modules
# (mvp 39MB, eh 34MB) and the parquet data bundle are served from our R2
# bucket instead, and STRIPPED from the upload here. The small DuckDB worker
# .js files MUST stay in the upload — `new Worker(url)` forbids cross-origin
# scripts, so the worker loads same-origin while only the .wasm comes from R2.
#
# Point the runtime at R2 by exporting these before running (otherwise they
# default to same-origin, which only works locally — the >25MB files won't
# exist on Pages):
#   export NEXT_PUBLIC_DUCKDB_WASM_BASE="https://data.timechaingraph.com"
#   export NEXT_PUBLIC_DATA_BASE_URL="https://data.timechaingraph.com/data/v0.1.0"
#
# One-time R2 bucket + CORS + upload steps: docs/DEPLOY_r2_hosting.md
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▸ vendor DuckDB-Wasm assets (same-origin worker + wasm into public/)"
node scripts/copy-duckdb-assets.mjs

echo "▸ generate OG share image (public/og.png)"
node scripts/gen-og-image.mjs

echo "▸ clean build"
rm -rf .next out
npx next build

echo "▸ strip files served from R2 (over CF Pages' 25MB/file limit)"
rm -f  out/duckdb/*.wasm   # 39/34MB → R2; KEEP the worker .js (loads same-origin)
rm -rf out/data           # parquet bundle → R2
rm -rf out/blocks         # legacy per-block snapshots, if present

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
echo "  DUCKDB_WASM_BASE = ${NEXT_PUBLIC_DUCKDB_WASM_BASE:-unset, same-origin}"
echo "  DATA_BASE_URL    = ${NEXT_PUBLIC_DATA_BASE_URL:-unset, same-origin}"
echo "  (unset = same-origin; the >25MB wasm/parquet are stripped, so set these to the R2 base before deploying once R2 is live — see docs/DEPLOY_r2_hosting.md)"
