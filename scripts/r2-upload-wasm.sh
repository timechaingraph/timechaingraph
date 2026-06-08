#!/usr/bin/env bash
# scripts/r2-upload-wasm.sh — upload the >25MB DuckDB-Wasm modules to our
# Cloudflare R2 bucket so prod /graph can fetch them cross-origin (Cloudflare
# Pages can't host files > 25MB). The small worker .js stays same-origin in the
# Pages upload — it is NOT uploaded here.
#
# Prereqs (operator, one-time — needs Cloudflare auth):
#   1. npx wrangler login
#   2. npx wrangler r2 bucket create "$BUCKET"
#   3. Make the bucket public at your wasm base (custom domain
#      data.timechaingraph.com recommended, or enable the r2.dev subdomain).
# Then run this. Idempotent — safe to re-run after a @duckdb/duckdb-wasm bump.
#
# Override the bucket name:  BUCKET=my-bucket ./scripts/r2-upload-wasm.sh
set -euo pipefail
cd "$(dirname "$0")/.."

BUCKET="${BUCKET:-timechaingraph-data}"
WASM_DIR="public/duckdb"
CORS_RULES="r2-cors.json"

# Ensure the vendored wasm is present (copy from node_modules if missing).
if [ ! -f "$WASM_DIR/duckdb-eh.wasm" ] || [ ! -f "$WASM_DIR/duckdb-mvp.wasm" ]; then
  echo "▸ wasm not vendored yet — running copy-duckdb-assets.mjs"
  node scripts/copy-duckdb-assets.mjs
fi

echo "▸ R2 bucket: $BUCKET"
echo "▸ uploading DuckDB wasm to ${BUCKET}/duckdb/ …"
for f in duckdb-mvp.wasm duckdb-eh.wasm; do
  echo "  → $f ($(du -h "$WASM_DIR/$f" | cut -f1))"
  npx wrangler r2 object put "${BUCKET}/duckdb/${f}" \
    --file "${WASM_DIR}/${f}" \
    --content-type "application/wasm"
done

echo "▸ applying CORS (${CORS_RULES})"
npx wrangler r2 bucket cors put "$BUCKET" --rules "./${CORS_RULES}"

echo "✓ wasm uploaded + CORS applied to '${BUCKET}'."
cat <<EOF

Next:
  1. Confirm the bucket is publicly served at your wasm base, e.g.
       https://data.timechaingraph.com/duckdb/duckdb-eh.wasm  (200)
  2. Deploy with the runtime pointed at it:
       export NEXT_PUBLIC_DUCKDB_WASM_BASE="https://data.timechaingraph.com"
       npm run deploy
  3. Verify on /graph (DevTools → Network): duckdb-*.wasm from the R2 domain,
     *.worker.js + *.parquet from the page origin, privacy-audit green.
EOF
