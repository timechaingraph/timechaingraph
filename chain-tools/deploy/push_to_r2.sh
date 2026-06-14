#!/usr/bin/env bash
# push_to_r2.sh — upload the parquet bundle to Cloudflare R2.
#
# Inputs:
#   $1 = local bundle directory (public/data/<version>/ from build_bundle.py:
#        tiered wallets/bonds/coins parquet + timestamps.parquet + manifest.json)
#   $2 = R2 bucket name
#
# Privacy: this is the only point in the pipeline where data leaves the operator's
# machine. Cloudflare R2 has no per-object query logging in the default tier; the
# bucket should be configured with Public Access only on the parquet path, with
# CORS allowing only the production frontend domain.

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: $0 <local-out-dir> <r2-bucket-name>" >&2
  exit 64
fi

LOCAL_DIR="$1"
BUCKET="$2"

if ! command -v wrangler >/dev/null 2>&1; then
  echo "wrangler CLI not found. Install: npm install -g wrangler" >&2
  exit 1
fi

if [[ ! -d "$LOCAL_DIR" ]]; then
  echo "local dir does not exist: $LOCAL_DIR" >&2
  exit 1
fi

echo "Uploading $LOCAL_DIR → r2://$BUCKET/"

# wallets.parquet — single small file
wrangler r2 object put "$BUCKET/wallets.parquet" \
  --file "$LOCAL_DIR/wallets.parquet"

# activity/epoch-NNNN.parquet — many small files
for f in "$LOCAL_DIR"/activity/epoch-*.parquet; do
  base=$(basename "$f")
  wrangler r2 object put "$BUCKET/activity/$base" --file "$f"
done

# manifest.json + timestamps.parquet — tiny, always present
for f in manifest.json timestamps.parquet; do
  if [[ -f "$LOCAL_DIR/$f" ]]; then
    wrangler r2 object put "$BUCKET/$f" --file "$LOCAL_DIR/$f"
  fi
done

echo "Done."
