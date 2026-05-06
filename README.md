# Timechain Graph

> **The brain of Bitcoin.** Every wallet a neuron. Every transaction a synapse.
> Watch the network think — Satoshi at the gold center, miners glowing red,
> whales gold, dust grey, all bound by the bonds they spent.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/timechaingraph/timechaingraph/actions/workflows/ci.yml/badge.svg)](https://github.com/timechaingraph/timechaingraph/actions/workflows/ci.yml)
[![Site](https://img.shields.io/badge/site-timechaingraph.com-gold)](https://timechaingraph.com)
[![Sister](https://img.shields.io/badge/sister-timechaingrid.com-cyan)](https://timechaingrid.com)
[![Privacy](https://img.shields.io/badge/privacy-first-brightgreen.svg)](#privacy)

A force-directed 2D lattice of every economically meaningful Bitcoin wallet,
modeled on Obsidian's vault graph. Position emerges from transaction frequency.
Edges fade across ten blocks. Hubs swell with degree centrality. Privacy-first
by construction — no third-party calls, no analytics, no tracking.

Live at **[timechaingraph.com](https://timechaingraph.com)**. Sister project at
**[timechaingrid.com](https://timechaingrid.com)** — the same Bitcoin chain at
fixed coordinates on a stationary grid.

## Status

`v0.0.1` — **v0.1 Living Lattice features shipped in code:** PixiJS canvas,
Velocity-Verlet physics, drag-to-pin, cursor-anchored zoom, kiosk-mode HUD,
playback scrubber, halving epoch quick-jumps, 211k block-by-block snapshots
(epoch 0 + first halving + first epoch-1 block). 216/216 tests pass; lint,
typecheck, and privacy audit all clean. Roadmap continues with v0.2 (real
Bitcoin chain via DuckDB-Wasm + parquet) and v0.3 (full database, common-input
clustering, wallet-empire highlighting, Tor onion service).

## Run locally

```bash
git clone https://github.com/timechaingraph/timechaingraph.git
cd timechaingraph
npm install
npm run dev          # → http://localhost:3000
```

Open **<http://localhost:3000/graph>** for the canvas. Drag-to-pin a wallet,
scroll-to-zoom (cursor-anchored), keys `1` / `2` / `3` cycle spotlight depth,
`0` clears focus, `ESC` exits focus mode.

## Build & deploy

```bash
npm run build                 # static export → out/
npm run privacy-audit         # confirms no third-party calls in out/
npm run deploy                # Cloudflare Pages (wrangler)
```

Full deploy walkthrough in [DEPLOY.md](DEPLOY.md). Both first-time setup
(Cloudflare Pages + GitHub OAuth) and steady-state `git push origin main`
auto-deploy paths are documented.

## Tech

- **Framework**: Next.js 16 (App Router, Turbopack, `output: 'export'`)
- **Language**: TypeScript 5, React 19
- **Rendering**: PixiJS 8 — force-directed canvas with Velocity-Verlet physics,
  pairwise Coulomb repulsion, Hooke springs per bond, damping
- **State**: Zustand 5
- **Styling**: Tailwind CSS 4 (cyber-steampunk dark palette, system fonts only — no Google Fonts)
- **Testing**: Vitest 4 + React Testing Library (21 test files)
- **Data**: static parquet bundle from a CDN we control (Cloudflare R2),
  queried in-browser via DuckDB-Wasm (planned for v0.2)
- **Vault**: literal Obsidian-format markdown vault generated from the same
  substrate (`chain-tools/vault/generate.mjs` → 715 markdown files with
  1418 fully-resolvable wikilinks)
- **Deploy**: Cloudflare Pages (`timechaingraph` project), custom domain
  `timechaingraph.com`

## Project layout

```
src/
├── app/                  Next.js App Router (layout, /graph kiosk page, route shells)
├── components/
│   ├── views/
│   │   ├── GraphView.tsx     PixiJS force-directed canvas (917 lines)
│   │   ├── GraphPlayBar.tsx  Thin single-row playback control
│   │   └── GraphSidebar.tsx  Compact narrative + block-stats HUD
│   └── ...               NavBar, SiteFooter, WalletInspector, HeroVisual
├── data/                 BitcoinChainAdapter (parquet client; v0.2)
├── lib/
│   ├── site-config.ts    Brand identity (the only file that diverges from sister)
│   ├── forceLayout.ts    Pure-function physics engine
│   └── ...               format, proximity, coords, role-visuals, spiral
├── store/                timegridStore.ts (Zustand)
└── types/                wallet, block, lattice (typed contracts)

chain-tools/              offline data pipeline (Python + Rust + Node)
├── ingest/               bitcoind/electrs → wallets.parquet, activity.parquet
├── physics/              Rust force-directed sim → keyframes (planned)
├── vault/                Obsidian vault generator
└── deploy/               push parquet bundle to R2

public/
└── blocks/               per-block JSON snapshots (gitignored — regenerated)
```

## Why this project

There are dozens of Bitcoin block explorers. Almost all of them call out to
third-party CDNs the moment you load them — Google Fonts, Google Analytics,
custom telemetry. None of them visualize the chain as a *living network*.

Timechain Graph is **observably private** (open the DevTools Network tab and
you will see zero requests to anything but `timechaingraph.com`) and treats
the chain as a graph in the literal mathematical sense — wallets are nodes,
transactions are edges, position emerges from interaction frequency. The
result is something that looks more like Obsidian's vault graph or a brain
imaging plot than a traditional explorer.

The data pipeline is local: source data flows from Bitcoin's own peer-to-peer
network into a self-hosted bitcoind + electrs that this project's operator
provisions. Distribution is via a CDN bucket we control. No KYC, no per-viewer
telemetry, no third-party dependencies at runtime.

## Privacy

**Non-negotiable boundary.** The browser, when serving this site, makes no
third-party requests at runtime. CSS, JS, fonts, and data are all served from
the same origin. The CI workflow (`/.github/workflows/ci.yml`) runs a privacy
audit on every push and fails the build if any of the following domains leak
into the output bundle:

```
fonts.googleapis.com   fonts.gstatic.com    googletagmanager.com
google-analytics.com   doubleclick.net      cdn.jsdelivr.net
unpkg.com              cdnjs.cloudflare.com polyfill.io
```

See [`scripts/privacy-audit.sh`](scripts/privacy-audit.sh) for the full block
list and audit logic.

## Tiers

All tiers are free. Tier selection is a **data-resolution** UX choice, not a
paywall.

| Tier | Visibility threshold | Approx. nodes |
|------|---------------------|---------------|
| Free | > 1,000 BTC ever held · top miners | ~10,000 |
| Pro  | > 10 BTC ever held · midsize miners | ~500,000 |
| Max  | > 1 BTC OR > 100 lifetime txs · all miners | ~1–3M |

## Sibling architecture

This repo (`timechaingraph`) is a sibling of `timechaingrid`. Both share most
code byte-for-byte (components, types, utilities, theme); divergence is
captured in **`src/lib/site-config.ts`**, which encodes brand, domain, sister
pointer, and view-specific hero copy. The sync mechanism is documented in
[`scripts/sync-sibling.sh`](scripts/sync-sibling.sh).

## Contributing

PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow, testing
requirements, and the privacy rule (any new dependency or runtime call must
not leak viewer identity).

## Security

To report a security vulnerability, see [SECURITY.md](SECURITY.md). Do not
open public issues for security problems.

## Lineage

Bootstrapped on 2026-04-29 from `$SISTER_REPO/` (the sister Grid repo)
via `tar` clone of the source tree, excluding git history and build artifacts.
The Grid and Graph repos evolve in parallel from this point; shared files
stay byte-identical and are propagated by manual sync.

## License

[MIT](LICENSE) © 2026 Timechaingraph team.

---

Built on the open Bitcoin protocol. No coin, no token, no funding round.
