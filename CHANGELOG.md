# Changelog

All notable changes to **Timechain Graph** (timechaingraph.com) are documented
in this file. Sister project: timechaingrid.com.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] — OSS publication prep + real-chain ingest

### Added

- **`LICENSE`** (MIT) — Copyright (c) 2026 Timechaingraph contributors.
  Permissive license chosen over copyleft (the Bitcoin OSS norm among
  heavy-duty projects like mempool.space) to maximize fork-and-host
  flexibility. Attribution kept anonymous for privacy posture.
- **`CONTRIBUTING.md`** — workflow, testing, privacy rule, what we're looking
  for and what we're not.
- **`SECURITY.md`** — responsible-disclosure process via GitHub private
  security advisories.
- **`.github/ISSUE_TEMPLATE/`** — bug report + feature request templates,
  plus `config.yml` linking to the security advisory flow and live site.
- **`.github/PULL_REQUEST_TEMPLATE.md`** — checklist with privacy-audit
  gate baked in.
- **`package.json` metadata.** Added `license`, `author`, `homepage`,
  `repository`, `bugs`, `keywords` fields. Description rewritten around the
  "brain of Bitcoin" narrative.
- **Operator-side chain walker** (`chain-tools/ingest/`) — walks blocks via
  the public Mempool.space API at ~250 ms/request, accumulates wallet +
  bond + per-block activity records into an LMDB substrate, and emits
  per-block JSON sidecars. Resumable (checkpoints every 25 blocks);
  browsers never touch Mempool.space — the operator runs the walker,
  output goes to a CDN bucket, browsers read from there.
- **`real-substrate/v1` schema** — sorted JSON shape for wallets / bonds /
  block timestamps, designed to feed the snapshot generator and (eventually)
  the parquet bundle the browser will query via DuckDB-Wasm.

### Changed

- **`README.md` overhaul.** Badges (license, CI, site, sister, privacy),
  honest v0.0.1 status, accurate roadmap, updated tech bullets, new "Why
  this project" section explaining differentiation from existing Bitcoin
  explorers, contributor + security pointers, MIT license link. Removed
  third-party-software references and operator-local filesystem paths.
- **Snapshot pipeline tip bumped** from block `876_000` to `947_630`
  (live tip per Mempool.space) so the snapshot range extends through
  the present.
- **`.gitignore`**: extended to exclude local session state and
  operator-internal records so they never enter the public repo.

### Fixed

- **Per-block transaction pagination boundary bug**: when a block's
  `tx_count` was an exact multiple of 25, requesting the next page
  returned HTTP 404 ("start index out of range") instead of an empty
  array, causing the walker to fail after retry exhaustion. The fetch
  function now takes `expectedCount` from `header.tx_count` and
  terminates the loop exactly when the known count is reached,
  eliminating the boundary probe entirely. Verified on the failing
  block 67,315 (75 txs).

### Notes

- v0.1 Living Lattice features (PixiJS canvas, physics, scrubber, kiosk,
  narrative HUD, cursor-anchored zoom) shipped in code prior to this
  release prep, awaiting first real-chain data ingest.
- Repo is being prepped for public visibility on GitHub at
  `timechaingraph/timechaingraph`. The `private: true` field in
  `package.json` is retained — it disables `npm publish`, which is
  correct for a deployable site (not a library).

## [0.0.1] - 2026-04-29

### Added — initial scaffold

- **Bootstrapped from sister Grid repo.** Cloned the source tree from
  the sister project via `tar` (excluding `.git`, `node_modules`,
  `.next`, `out`). The two repos start byte-identical except for
  divergence files: `src/lib/site-config.ts`, identity files, and the
  view-specific renderer.
- **Site-config divergence.** `src/lib/site-config.ts` declares
  `VIEW = 'graph'`, brand `'GRAPH'`, accent `'gold'`, sister pointer to
  `timechaingrid.com`. The shared layer (NavBar, SiteFooter, root
  layout, domain landing page) reads from this so it stays
  byte-identical with the sister.
- **Routes.** `/`, `/graph`, `/about`, `/pricing`, `/privacy`,
  `/status`, `/api`, `/docs`, `/donate`. The `/grid` route lives in the
  sister repo only.
- **Shared chrome.** `<NavBar>` (cross-domain "View as Grid" link to
  `timechaingrid.com`), `<SiteFooter>` (sister pointer),
  `<UnderDevelopment>` banner.
- **Vitest scaffolding.** Tests across `src/lib/{format,proximity,coords}`,
  `src/types/block`, `src/store/timegridStore`. Identical to sister.
- **CI workflow.** `.github/workflows/ci.yml` —
  `lint → typecheck → test → build → privacy-audit`.
- **Privacy-audit script.** `scripts/privacy-audit.sh` fails the build on
  any forbidden third-party domain reference in `out/`.
- **Donation rails placeholder.** `.github/FUNDING.yml`.

[Unreleased]: https://github.com/timechaingraph/timechaingraph/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/timechaingraph/timechaingraph/releases/tag/v0.0.1
