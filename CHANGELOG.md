# Changelog

All notable changes to **Timechain Graph** (timechaingraph.com) are documented
in this file. Sister project: timechaingrid.com.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] — OSS publication prep + real-chain ingest

### Added

- **`LICENSE`** (MIT) — Copyright (c) 2026 Timechaingraph team. Permissive
  license chosen over copyleft (the Bitcoin OSS norm among heavy-duty projects
  like mempool.space) to maximize fork-and-host flexibility. Attribution kept
  team-anonymous for privacy posture.
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
- **`chain-tools/ingest/walk_chain.mjs`** — operator-side Bitcoin chain walker.
  Walks blocks via the public Mempool.space API at ~250 ms/request, accumulates
  wallet + bond + per-block activity records into `chain-tools/out/real-substrate.json`,
  and emits per-block sidecars to `vault/activity/`. Resumable (checkpoints
  every 25 blocks); browsers never touch Mempool.space — operator runs the
  walker, output goes to R2, browsers read from there.
- **`real-substrate/v1` schema** — sorted JSON shape for wallets/bonds/block
  timestamps, designed to feed the brain-vault generator and (eventually) the
  parquet bundle the browser will query via DuckDB-Wasm.

### Changed

- **`README.md` overhaul.** Badges (license, CI, site, sister, privacy),
  brain-narrative tagline, accurate v0.1-shipped status, updated tech bullets,
  new "Why this project" section explaining differentiation from existing
  Bitcoin explorers, contributor + security pointers, MIT license link.
- **`chain-tools/lib/chain.mjs`**: bumped `TIP_BLOCK` from `876_000` to
  `947_630` (live tip per Mempool.space) so the snapshot pipeline can extend
  through the present.
- **`chain-tools/vault/generate.mjs`**: removed the `Math.min(TIP_BLOCK, 210_999)`
  cap on `SNAPSHOT_THROUGH_BLOCK` so the generator can produce the full
  ~947k-block range when invoked.
- **`src/components/views/GraphView.tsx`**: `FIXTURE_LATEST_BLOCK` raised to
  `947_630`, matching the snapshot range.
- **`.gitignore`**: extended to exclude `internal session files/`, `/the project spec`, and
  `corp/internal/`. Session/prompt data and operator-internal corporate
  artifacts never enter the public repo.

### Fixed

- **`chain-tools/ingest/walk_chain.mjs::blockTransactions`**: when a block's
  `tx_count` was an exact multiple of 25, requesting the next page returned
  HTTP 404 ("start index out of range") instead of an empty array, causing
  the walker to fail after retry exhaustion. Function now takes
  `expectedCount` from `header.tx_count` and terminates the loop exactly when
  the known count is reached, eliminating the boundary probe entirely.
  Verified on the failing block 67,315 (75 txs).

### Notes

- v0.1 Living Lattice features (PixiJS canvas, physics, scrubber, kiosk,
  211k snapshots, narrative HUD, cursor-anchored zoom) shipped in code prior
  to this release prep. Full feature set is detailed in commits `b09c222`
  through `7262acc`.
- Repo is being prepped for public visibility on GitHub at
  `timechaingraph/timechaingraph`. The `private: true` field in
  `package.json` is retained — it disables `npm publish`, which is correct
  for a deployable site (not a library).

## [0.0.1] - 2026-04-29

### Added — initial scaffold

- **Bootstrapped from sister Grid repo.** Cloned the source tree from
  `$SISTER_REPO/` via `tar` (excluding `.git`, `node_modules`,
  `.next`, `out`). The two repos start byte-identical except for divergence
  files: `src/lib/site-config.ts`, identity files, and the view-specific
  renderer.
- **Site-config divergence.** `src/lib/site-config.ts` declares
  `VIEW = 'graph'`, brand `'GRAPH'`, accent `'gold'`, sister pointer to
  `timechaingrid.com`. The shared layer (NavBar, SiteFooter, root layout,
  domain landing page) reads from this so it stays byte-identical with
  the sister.
- **Routes.** `/`, `/graph`, `/about`, `/pricing`, `/privacy`, `/status`,
  `/api`, `/docs`, `/donate`. Removed `/grid` route (lives in the sister
  repo only).
- **Shared chrome.** `<NavBar>` (cross-domain "View as Grid" link to
  `timechaingrid.com`), `<SiteFooter>` (sister pointer), `<UnderDevelopment>`
  banner.
- **Vitest scaffolding.** 49 tests across `src/lib/{format,proximity,coords}`,
  `src/types/block`, `src/store/timegridStore`. Identical to sister.
- **CI workflow.** `.github/workflows/ci.yml` —
  `lint → typecheck → test → build → privacy-audit`.
- **Privacy-audit script.** `scripts/privacy-audit.sh` fails the build on
  any forbidden third-party domain reference in `out/`.
- **Donation rails placeholder.** `.github/FUNDING.yml`.
- **`internal session files/`.** Child-of-origin agent framework, identical structure to
  the sister, scoped to `timechaingraph`.

### Sibling sync mechanism

After this initial split, shared files (everything except divergence files
listed in the project the project spec) are kept byte-identical via manual `cp`
from the Grid repo. To verify in-sync state:

```bash
diff -r $SISTER_REPO/src/components $REPO/src/components
# (no output = in sync)
```

The first deliberate divergence beyond `site-config.ts` will go in
`src/app/graph/` (the force-directed renderer) versus the sister's
`src/app/grid/` (the stationary-coordinate renderer).

[Unreleased]: https://github.com/timechaingraph/timechaingraph/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/timechaingraph/timechaingraph/releases/tag/v0.0.1
