# Timechain Graph

Force-directed Obsidian-style graph of every economically significant Bitcoin wallet at **[timechaingraph.com](https://timechaingraph.com)**.

Position emerges from transaction frequency. Edges fade across the next ten blocks. Hubs swell with degree centrality. Miners glow red, whales gold, dust grey. Satoshi at the brass-gold center.

Sister project: **[timechaingrid.com](https://timechaingrid.com)** — the same Bitcoin chain at fixed coordinates on a stationary grid. Both fetch from the same Obsidian vault data substrate.

## Status

`v0.0.1` · in development · scaffold mirrored from the Timechain Grid sister repo.

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000
```

## Build & deploy

```bash
npm run build                                            # → out/
npx wrangler pages deploy out --project-name=timechaingraph --branch=main
```

## Tech

- **Framework:** Next.js 16 (App Router, static export to Cloudflare Pages)
- **Rendering:** PixiJS 8 (force-directed canvas, planned for v0.1)
- **State:** Zustand 5
- **Styling:** Tailwind CSS 4 (cyber-steampunk dark palette, system fonts only — no Google Fonts)
- **Testing:** Vitest 4 + React Testing Library
- **Data:** static parquet snapshots fetched from own CDN, queried in-browser via DuckDB-Wasm; underlying source-of-truth is a literal Obsidian vault

## Project layout

```
src/
├── app/                Next.js App Router (layout, page, globals.css, route shells)
├── components/         NavBar, SiteFooter, UnderDevelopment, HeroVisual, LiveStatusBar, ...
├── data/               BitcoinChainAdapter (parquet client)
├── lib/                site-config, format, proximity, coords (pure utilities)
├── store/              timegridStore.ts (Zustand)
└── types/              wallet, block, lattice (typed contracts)

chain-tools/            offline data pipeline (Python + Rust)
├── ingest/             bitcoind/electrs → wallets.parquet, activity.parquet
├── physics/            Rust force-directed sim → keyframes
└── deploy/             push parquet bundle to R2
```

## Sibling architecture

The repo at `$REPO/` is a sibling of `$SISTER_REPO/`. Both share most code byte-for-byte (components, types, utilities, theme); divergence is captured in **`src/lib/site-config.ts`** which encodes brand, domain, sister pointer, and view-specific hero copy. To keep the repos in sync, shared files are copied 1:1 between them; only `site-config.ts`, identity files (package.json, README.md, the project spec, CHANGELOG.md, internal session files/SEED.md), and the view-specific renderer (`<GraphView>` here vs `<GridView>` in the Grid repo) diverge.

## Privacy

Source data flows from Bitcoin's own peer-to-peer protocol into a self-hosted full node. Extraction runs offline on infra we control. Snapshots are distributed from a CDN bucket we control — no per-viewer telemetry, no third-party fonts, no analytics, no tracking. Donations settle in BTC over Lightning, so even support is KYC-free.

## Tiers

All tiers are free. Tier selection is a **data-resolution** UX choice, not a paywall.

| Tier | Visibility threshold | Approx. nodes |
|------|---------------------|---------------|
| Free | > 1,000 BTC ever held · top miners | ~10,000 |
| Pro  | > 10 BTC ever held · midsize miners | ~500,000 |
| Max  | > 1 BTC OR > 100 lifetime txs · all miners | ~1–3M |

## Lineage

Bootstrapped on 2026-04-29 from `$SISTER_REPO/` (the sister Grid repo) via `tar` clone of the source tree, excluding git history and build artifacts. The Grid and Graph repos evolve in parallel from this point; shared files stay byte-identical and are propagated by manual sync.

## License

(TBD — likely MIT or AGPL.)

---

Built on the open Bitcoin protocol. No coin, no token, no funding round.
