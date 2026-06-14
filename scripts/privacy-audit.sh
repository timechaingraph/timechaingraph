#!/usr/bin/env bash
# privacy-audit.sh — fail if the static build references a third-party domain
# that would leak viewer identity at runtime.
#
# This is the automated equivalent of opening DevTools → Network on a
# production page and verifying every request resolves to a domain we own.
# Runs against the static export in out/ (or a directory passed as $1).
#
# Exits non-zero if any forbidden domain is referenced.

set -euo pipefail

OUT_DIR="${1:-out}"

FORBIDDEN_DOMAINS=(
  "fonts.googleapis.com"
  "fonts.gstatic.com"
  "googletagmanager.com"
  "google-analytics.com"
  "doubleclick.net"
  "cdn.jsdelivr.net"
  "unpkg.com"
  "cdnjs.cloudflare.com"
  "polyfill.io"
)

if [ ! -d "$OUT_DIR" ]; then
  echo "Build output directory not found: $OUT_DIR" >&2
  echo "Run 'npm run build' first." >&2
  exit 2
fi

violations=0
for domain in "${FORBIDDEN_DOMAINS[@]}"; do
  if matches=$(grep -rl --include='*.html' --include='*.js' --include='*.css' --include='*.json' "$domain" "$OUT_DIR" 2>/dev/null); then
    if [ -n "$matches" ]; then
      echo "Privacy audit: forbidden reference to $domain found in:"
      printf '%s\n' "$matches" | sed 's/^/    /'
      violations=$((violations + 1))
    fi
  fi
done

if [ "$violations" -gt 0 ]; then
  echo
  echo "Privacy audit FAILED ($violations forbidden domain reference(s))"
  exit 1
fi

echo "Privacy audit passed: no forbidden third-party domain references in $OUT_DIR"
