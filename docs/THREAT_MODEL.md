# Threat Model & Privacy Posture — Timechain Graph

This document states, in checkable terms, what Timechain Graph does and does not
do with respect to viewer privacy. The whole project exists to be **observably
private** — these claims are meant to be verified, not trusted.

## Overriding priorities (in order)

1. **The viewer reveals nothing to third parties.** Loading the site must make
   zero network requests to any origin other than the site's own.
2. **No per-viewer data is ever collected** — no analytics, no telemetry, no
   cookies, no fingerprinting, no logs tied to an individual.
3. Everything else (features, performance, aesthetics) is subordinate to the
   two priorities above.

## What a viewer reveals

- **To this site's origin:** ordinary HTTP requests for static assets (HTML, JS,
  CSS, fonts, the Parquet data bundle, DuckDB-Wasm). These are served from
  infrastructure the operator controls (Cloudflare Pages + Cloudflare R2).
- **To any third party:** nothing. There are no third-party scripts, fonts,
  analytics, tag managers, CDNs, or trackers. This is enforced in CI (see below).

## Data flow

```
Bitcoin P2P network
        │  (the operator's own fully-synced node)
        ▼
   self-hosted bitcoind  ──JSON-RPC (getblock v3)──▶  operator-side pipeline
                                                       (chain-tools/: walk →
                                                        DuckDB reduce → Parquet)
        │
        ▼
   public Parquet bundle  ──▶  Cloudflare R2 (operator-controlled CDN)
        │
        ▼
   viewer's browser  ──range-reads via self-hosted DuckDB-Wasm──▶  render
```

The operator-side pipeline (`chain-tools/`) never runs in the browser. The
browser only ever fetches static, pre-built artifacts from the operator's own
origin. No third-party block explorer or indexer is involved at any stage.

## Non-goals — what we deliberately do NOT do

- No Google Fonts or any external font CDN (system fonts only).
- No Google Analytics, no analytics of any kind.
- No CDN-hosted libraries we do not control (DuckDB-Wasm is self-hosted/vendored).
- No per-viewer telemetry, error-reporting beacons, or "phone-home" dependencies.
- No cookies or local storage used for tracking.
- No KYC anywhere; donations are self-custodial on-chain Bitcoin.

## How the claim is enforced

- **CI privacy audit.** Every push and pull request runs
  `scripts/privacy-audit.sh`, which scans the built `out/` bundle for any
  reference to a forbidden third-party domain (Google Fonts/Analytics, common
  CDNs, trackers) and fails the build if one is found. The privacy boundary is
  therefore a required, visible green check — not just a promise.
- **Observability.** Open the browser DevTools Network tab on the live site:
  every request should target the site's own origin. Any deviation is a bug —
  report it via [SECURITY.md](../SECURITY.md), not a public issue.

## Trust assumptions

- You trust the operator's origin (Cloudflare Pages/R2) to serve unmodified
  assets, as with any website.
- You trust that the published Parquet bundle was built from the public Bitcoin
  chain by the documented pipeline. The bundle is static and can be inspected.
- The data shown is public blockchain information; it contains no private or
  personal data beyond what is already on the public ledger.

## Out of scope

- Network-level adversaries who can observe that you connected to this site at
  all (use Tor if that matters to you — a Tor onion service is on the roadmap).
- The privacy of on-chain Bitcoin activity itself, which is a property of the
  Bitcoin protocol, not of this viewer.

## Reporting

Privacy or security problems — especially any third-party request leaking into
the viewer — should be reported privately per [SECURITY.md](../SECURITY.md).
