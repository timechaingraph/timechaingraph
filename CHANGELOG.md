# Changelog

All notable changes to **Timechain Graph** (timechaingraph.com) are documented
in this file. Sister project: timechaingrid.com.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.0.1]: https://github.com/PLACEHOLDER/timechaingraph/releases/tag/v0.0.1
