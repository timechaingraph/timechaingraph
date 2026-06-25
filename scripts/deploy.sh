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

echo "▸ guard: build's DuckDB wasm must match the copy served from R2"
# Why: the >25MB wasm is stripped from the upload and served from R2, decoupled
# from the build. If the build's @duckdb/duckdb-wasm version != the .wasm on R2,
# the browser throws "function signature mismatch" — and this slips past every
# other gate (none load wasm in a real browser). This guard is that missing gate.
WASM_BASE="${NEXT_PUBLIC_DUCKDB_WASM_BASE:-}"
if [ -z "$WASM_BASE" ] && [ -f .env.production ]; then
  WASM_BASE=$(grep -E '^NEXT_PUBLIC_DUCKDB_WASM_BASE=' .env.production 2>/dev/null | head -1 | cut -d= -f2- | sed 's/^"//;s/"$//' | tr -d '\r ' || true)
fi
if [ -z "$WASM_BASE" ]; then
  echo "✗ NEXT_PUBLIC_DUCKDB_WASM_BASE unset (shell + .env.production). The >25MB wasm is" >&2
  echo "  stripped from the upload → runtime fetches /duckdb/duckdb-eh.wasm same-origin → 404" >&2
  echo "  → graph hangs at 'Initialising DuckDB-Wasm…'. Set it (e.g. https://data.timechaingraph.com)." >&2
  exit 1
fi
LOCAL_WASM=$(wc -c < public/duckdb/duckdb-eh.wasm | tr -d ' ')
R2_WASM=$(curl -fsSI "$WASM_BASE/duckdb/duckdb-eh.wasm" 2>/dev/null | grep -i '^content-length:' | tr -dc '0-9' || true)
if [ "$LOCAL_WASM" != "$R2_WASM" ]; then
  echo "✗ DuckDB wasm MISMATCH — build=$LOCAL_WASM B vs R2=${R2_WASM:-unreachable} B ($WASM_BASE)." >&2
  echo "  Runtime fetches the R2 copy; mismatched against this build's JS glue → in-browser" >&2
  echo "  'function signature mismatch'. Re-upload the matching .wasm to R2, or align the" >&2
  echo "  @duckdb/duckdb-wasm pin (keep it EXACT, no caret). See docs/DEPLOY_r2_hosting.md." >&2
  exit 1
fi
echo "  wasm match ✓ (build = R2 = $LOCAL_WASM B @ $WASM_BASE)"

echo "▸ deploy to Cloudflare Pages"
npx wrangler pages deploy out --project-name=timechaingraph --branch=main

echo "✓ deployed."
echo "  DUCKDB_WASM_BASE = ${NEXT_PUBLIC_DUCKDB_WASM_BASE:-UNSET → /graph is BROKEN in prod (wasm stripped); set it once R2 is live}"
echo "  DATA_BASE_URL    = ${NEXT_PUBLIC_DATA_BASE_URL:-unset → parquet ships same-origin (OK)}"
echo "  Wasm cutover steps: docs/DEPLOY_r2_hosting.md"
