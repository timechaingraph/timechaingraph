# Design Spec — Substrate → Live In-Browser Visualization

**Status:** Draft for implementation. **Authored:** 2026-06-03 (overnight, by a research agent grounded in the actual code on `feat/lmdb-substrate`).
**Scope:** End-to-end path from operator-side chain ingest → the live PixiJS canvases on **timechaingraph.com** (force-directed Graph) and **timechaingrid.com** (fixed-coordinate Grid).

> **READ FIRST — reality check.** The LMDB "Path B" pipeline + v5 enrichments described in `the project spec` (`walk_chain_lmdb_v2/_v5.mjs`, `backfill`, `audit_lmdb`, `chain-tools/ops/*`, clusters/fingerprints/protocolPayloads/lightningChannels) **do not exist on this branch.** Build against what's real:
> - **Real working walker:** `chain-tools/ingest/walk_chain.mjs` (JSONL substrate `real-substrate/v2`, mempool.space).
> - **Stable parquet contract:** `chain-tools/lib/schemas.py` (WALLETS/BONDS/COINS/ACTIVITY pyarrow schemas) — THE seam. `from_fixture.py` works and is the schema oracle. `extract_wallets.py` is a skeleton (`write_parquet` works, RPC walk raises NotImplementedError).
> - **TS types already align:** `src/types/{wallet,coin,lattice,block,substrate}.ts`, and `src/components/views/GraphView.tsx` already implements the FULL visual model (edge fade, role colors, mass, pulses, scrubber) against `FIXTURE_SUBSTRATE`.
> - **Decision:** the LMDB rewrite is NOT a prerequisite. Export reads the current JSONL substrate (or fixture). Everything downstream is written against **parquet**, never LMDB/JSONL — when LMDB lands, only the export reader swaps.
> - Real shape (from `out.pre-cutover-backup`, tip 171,193 ≈ 18% height): 3.25M wallets / 7.85M bonds → full-chain projection **~15-20M wallets, ~50-100M bonds** before significance filtering. **Tiering is mandatory.**

---

## 1. EXPORT — substrate → static Parquet bundle

**New job `chain-tools/export/build_bundle.mjs`** (Node 25) + `lib/{read_substrate,tier,parquet_writer,manifest}.mjs`. Streams the JSONL substrate (like `walk_chain.mjs::loadSubstrate`); projects/filters/derives-tiers/partitions/writes-parquet/emits-manifest. Does NOT recompute aggregates (already in substrate).

**Tables (column names/dtypes = `schemas.py` verbatim; one additive column allowed):**
- `wallets.parquet` = WALLETS_SCHEMA + additive `role`: `address`(string,dict) · `first_seen_block`(u32) · `last_active_block`(u32) · `total_received_sats`(u64→bigint) · `tx_count`(u32) · `is_miner`(bool) · **`role`**(string,dict; re-derived 5-role set).
- `bonds.parquet` = BONDS_SCHEMA: `from_address`·`to_address`(string,dict) · `sats`(u64) · `formation_block`(u32). Spring `∝ log(sats)`.
- `coins.parquet` = COINS_SCHEMA (Grid). Substrate has no coins → DERIVE one row per coinbase output via `src/lib/spiral.ts::spiralCoord` + `chain.mjs::subsidyBtcAt` (same as `coin-roster.ts`): `id=B{blk}I{ix}`, `minted_at_block`, `minted_index`, `minter_address`, `owner_address=minter` (v0 invariant), `spiral_index`, `grid_x/grid_y` precomputed, `is_halving`.
- `activity/epoch-NNNN.parquet` = ACTIVITY_SCHEMA, **sharded per difficulty epoch (2016 blocks)**. `spenders`/`recipients` filtered to **Max-tier** addresses at export (else lists explode); render intersects vs loaded tier.

**Tier predicates (nested supersets Free ⊂ Pro ⊂ Max; thresholds from the project spec + `significance_filter.py`):**
```js
const SATS = 100_000_000n;
const inMax  = w => w.is_miner || BigInt(w.total_received_sats) >= 1n*SATS || w.tx_count >= 100;  // significance floor
const inPro  = w => w.is_miner || BigInt(w.total_received_sats) >= 10n*SATS;                       // >=10 BTC
const inFree = w => BigInt(w.total_received_sats) >= 1000n*SATS;                                    // whales + pools
function deriveRole(w){                                  // AUTHORITATIVE for the role column (walker only emits 3)
  if (w.first_seen_block===0 && w.is_miner) return 'satoshi';
  const btc = BigInt(w.total_received_sats)/SATS;
  if (btc>=1000n) return 'whale';        // gold
  if (w.is_miner) return 'miner';        // red
  if (inMax(w))   return 'significant';  // cyan
  return 'dust';                         // grey
}
```
| Tier | Predicate | ~wallets | ~bonds |
|---|---|---|---|
| Free | ≥1000 BTC | 8k–12k | 40k–80k |
| Pro | ≥10 BTC ∪ miner | 300k–600k | 3M–8M |
| Max | significance floor | 10M–18M | 50M–100M |

Bond is in tier T iff BOTH endpoints in T (streaming 2nd pass over a `Set<address>`). Emit `status.json::freeTierNodeCount` from the Free count.

**Partitioning:** wallets by TIER (`wallets/{free,pro,max}.parquet`, load whole slice). bonds by TIER then HALVING epoch (210k) within Pro/Max (`bonds/free.parquet`, `bonds/{pro,max}/epoch-NN.parquet`). activity by DIFFICULTY epoch (2016, ~470 shards, tier-agnostic). coins by HALVING epoch (210k, 5 shards). **zstd-9** large files / snappy tiny Free; **dictionary-encode every address column.**

**Free-tier total payload ≈ 0.5 MB.** (wallets/free ~120KB, bonds/free ~300KB.) Max: wallets ~180MB, bonds ~400MB, coins ~120MB.

**`manifest.json`** (first fetch; generalizes `BlockSnapshotsIndex` + `status.json`): `bundleVersion`, `tipBlock`, `parquetContract` sha, per-tier `{wallets,bonds/bondEpochs}` with path/rows/bytes/sha256, `activity.epochs[]`, `coins.epochs[]`, `halvingBlocks`. `status.json` stays a separate frequently-rewritten sidecar.

**Cadence:** `status.json` every checkpoint (≤60s). Full bundle: on demand → auto per difficulty epoch (~2wk); new immutable prefix `/data/vX.Y.Z/` each export; client pins `bundleVersion`.

---

## 2. DELIVERY — R2 → browser

**Bucket (immutable, versioned), shared by both sites/one bundle:**
```
s3://timechaingraph/data/
├── v0.1.0/   manifest.json · wallets/{free,pro,max}.parquet · bonds/free.parquet ·
│             bonds/{pro,max}/epoch-NN.parquet · activity/epoch-NNNN.parquet · coins/epoch-NN.parquet
└── latest/status.json   (mutable, frequently rewritten)
```
Extend `chain-tools/deploy/push_to_r2.sh` (currently flat) → this tier/epoch tree + manifest.

**Fetch (HTTP range, lazy per-tier):** mount → fetch manifest+status (KB). Register active-tier `wallets/<tier>.parquet` as HTTP-backed (`registerFileURL(name,url,DuckDBDataProtocol.HTTP,false)` → DuckDB Range-requests footer + needed row groups; never whole-file for Pro/Max). Free fetched whole. bonds: free whole; Pro/Max register epoch shards up to scrubber epoch. activity/coins lazily by epoch reached.

**Caching/integrity:** `/data/v0.1.0/*` → `Cache-Control: public, max-age=31536000, immutable`; `manifest.json` max-age 300; `status.json` 30. `sha256` per file in manifest — ENFORCE for the small Free files (fetch+`crypto.subtle.digest` before register), advisory for large. CORS: only `https://timechaingraph.com`, `https://timechaingrid.com`, `http://localhost:3000`; GET+HEAD. **DuckDB `.wasm`+worker served from OUR origin `/duckdb/`, never a CDN** (privacy-audit forbids jsdelivr/unpkg).

**CDN wiring** (`src/lib/cdn.ts`, NEW): `CDN_BASE = process.env.NEXT_PUBLIC_CDN_BASE ?? ''` (''=same-origin /public dev), `BUNDLE_VERSION`, `dataUrl(p)`, `statusUrl()`. Dev: drop bundle in `public/data/v0.1.0/`. Prod: `NEXT_PUBLIC_CDN_BASE=https://data.timechaingraph.com`.

---

## 3. QUERY — DuckDB-Wasm in static Next.js export

Add `@duckdb/duckdb-wasm`. **Do NOT** use `getJsDelivrBundles()` (privacy + audit fail). `scripts/copy-duckdb-assets.mjs` copies wasm/worker → `public/duckdb/` via `pre{dev,build}` hooks. `src/data/duckdb.ts` = lazy client-only singleton (`selectBundle` pointing at `/duckdb/*`, `AsyncDuckDB` in a Worker). `output:'export'` is fine (client-side); gate behind `'use client'` + dynamic import so WASM never enters SSR/prerender (`/graph` is already a client island).

**Views:** `wallets`/`bonds`/`activity`/`coins` over `parquet_scan(...)`. u64→`UBIGINT`→JS `BigInt` (matches `total_received_sats:bigint`).

**Queries:**
- **Q1 nodes** (mount): `SELECT address,role,first_seen_block,last_active_block,total_received_sats,tx_count,is_miner FROM wallets;`
- **Q2 edges for block window** (10-block fade pushed to SQL): join bonds→wallets on both ends, `WHERE formation_block<=:cur AND greatest(wf.last_active_block,wt.last_active_block)>=:cur-:fade` (fade=10). Mirrors `GraphView` lines ~663-687.
- **Q3 degree** (hub sizing): `SELECT address,COUNT(*) degree FROM (from_address UNION ALL to_address) GROUP BY address;`
- **Q4 wallet lookup** (= `ChainSubstrate.walletByAddress/bondsForAddress/coinsOwnedBy`).
- **Q5 per-block activity** (`BlockActivity`). **Q6 Grid coins visible:** `... WHERE minted_at_block<=:cur`.

**Perf:** lazy shard registration + `CREATE OR REPLACE VIEW` union; DuckDB in a **Worker**; Arrow IPC, iterate columns to build `Body[]`; prepared statements for Q2/Q5/Q6; debounce scrubber queries to ~10Hz + interpolate fade client-side.

---

## 4. RENDER — PixiJS 8

`GraphView.tsx` already implements the model; v0.1 = **swap the data source** then scale. Grid renderer is in the sister repo (`GridView`/`placeOnGrid.ts`).

**Graph mapping (already implemented — preserve):** color `ROLE_COLOR` (miner 0xef4444/whale 0xffd700/significant 0x00d4ff/dust 0x64748b/satoshi 0xc28840, `role-visuals.ts`); base radius `ROLE_RADIUS`; **NEW hub radius = ROLE_RADIUS + log1p(degree)*k** (wire Q3); mass `log10(sats+1)*0.3+0.5`; birth alpha 0 until `first_seen_block<=cur`, 0.3 gone-dark; Satoshi pinned at origin + halo; edge spring `*(log10(sats+1)*0.1+0.6)`; **edge alpha = formationRamp × max(0,1−(cur−bondLastActive)/10) × 0.4** (matches spec); pulses on focus/formation.

**Data swap (the v0.1 task):** add `R2ChainSubstrate implements ChainSubstrate` (DuckDB-backed) → `src/data/substrate.ts` becomes `USE_R2 ? new R2ChainSubstrate() : FIXTURE_SUBSTRATE` behind `NEXT_PUBLIC_USE_R2`. `GraphView` one-line change; seed `latestBlock` from `manifest.tipBlock` (replaces hardcoded `FIXTURE_LATEST_BLOCK=947_630`).

**Scaling 10k→1M:** `forceLayout.ts::applyRepulsion` is **O(n²)** — v0.1 ships Free (~10k): run to equilibrium then freeze (`damping=0.86`), simulate only on-screen/recently-moved, **30fps cap**. **Barnes-Hut REQUIRED before Pro.** Render: beyond a few thousand nodes → single **ParticleContainer + instanced tinted sprites**, edges one batched Graphics / line-shader Mesh at Max. LOD: zoomed out hide edges+dust, draw only whale/miner hubs; AABB cull per frame. Max: precomputed **keyframe positions** (`chain-tools/physics/` Rust → `keyframes/*.parquet`, already in CONTRACT.md) instead of live sim. Scrubber already store-wired — on block change fire debounced Q2+Q5.

**Grid (fixed coords, "every coin a tile, every block a new ring"):** coin→cell via precomputed `grid_x/grid_y = spiralCoord(spiral_index)` (Ulam spiral, index 0 = Satoshi's first reward, `src/lib/spiral.ts`). cell→px via `coords.ts::makeCoordMap`, `chainGridSpan = 2*ceil(sqrt(cumulativeCoinCount))` so it expands from Satoshi. Scrubber → Q6 lights tiles with `minted_at_block<=cur`; `is_halving` gets a gold ring. Grid perf easier (no physics): instance ParticleContainer of unit quads tinted by owner role; coarse **heatmap texture** when zoomed out; viewport-AABB tiles when zoomed in; lazy coin registration per halving epoch.

---

## 5. DATA CONTRACT — Parquet ↔ TS ↔ store (types already exist; bind, don't invent)

`wallets.address→address:string`, `first_seen_block→firstSeenBlock:number`, `total_received_sats(u64)→totalReceivedSats:**bigint**`, `is_miner→isMiner:boolean`, additive `role→role:WalletRole`; `bonds.sats(u64)→sats:bigint`, `formation_block→` add to a `GraphBond` extension; `coins.*→Coin.*` 1:1; `activity.*→BlockActivity` (`block_height→height`); `status.json→LatticeStatus`.

**Seam = `ChainSubstrate`** (`src/types/substrate.ts`): NEW `src/data/r2-substrate.ts` `R2ChainSubstrate implements ChainSubstrate` (Map-indexed like Fixture). `substrate.ts` selector. **Every consumer keeps importing the same symbol — zero churn outside the data layer.**

**Store additions** (`timegridStore.ts`): `tier:'free'|'pro'|'max'` + `setTier`; `dataReady:boolean`; `degreeByAddr:Map<string,number>` (Q3); `latestBlock` from `manifest.tipBlock`.

---

## 6. PHASED PLAN

**v0.1 — Free tier, Graph first (shippable):**
- M1 Export(Free): `build_bundle.mjs` reads JSONL/fixture, `inFree`+`deriveRole`, writes wallets/free+bonds/free+manifest+status; validate columns vs `schemas.py` via `from_fixture.py` round-trip. (~0.5MB)
- M2 R2 delivery: extend `push_to_r2.sh` (versioned tier tree + manifest), CORS + immutable headers, `data.timechaingraph.com`.
- M3 DuckDB-Wasm self-hosted: dep + `copy-duckdb-assets.mjs` + `src/data/duckdb.ts`; confirm `build`+`privacy-audit` pass with `/duckdb/`.
- M4 `R2ChainSubstrate` + Q1–Q5; flip `NEXT_PUBLIC_USE_R2`; `substrate.test.ts` green vs both.
- M5 GraphView on real data: source swap + Q3 hub radius + manifest tip; O(n²) physics w/ culling + 30fps.
- M6 status.json → /status + LiveStatus; halving quick-jumps; **v0.1 tag + deploy.**

**v0.1.x — Grid:** M7 derive `coins/epoch-NN`; M8 Grid view swap + lazy per-halving registration + LOD heatmap.
**v0.2 — Pro:** M9 Pro slices + activity shards; **M10 Barnes-Hut** (~500k); M11 ParticleContainer instancing + batched/mesh edges + tier switcher.
**v0.3 — Max:** M12 Max slices + offline keyframe layout (Rust physics → keyframes parquet); M13 coarse LOD heatmap. (aspirational v5 clusters/fingerprints become additive parquet columns consumed only at Max.)

---

## 7. OPEN QUESTIONS / RISKS / DECISIONS

**Decisions before M1:** **D1** source of record = JSONL (SSD paused 850,405 covers all current whales; don't block v0.1 on LMDB) — *confirm authoritative snapshot.* **D2** parquet writer in Node (`@dsnp/parquetjs`/`parquet-wasm`) in build_bundle vs route through Python (keep `from_fixture.py` as CI oracle) — *confirm.* **D3** `data.timechaingraph.com` DNS/CORS = **escalate (DNS change).** **D4** versioning `vMAJOR.MINOR.PATCH`; schema break → parallel-served new prefix.

**Risks:** **R1** Max-tier mobile-Safari OOM (180MB+Arrow) → range-streamed row groups, results in worker, nudge to Pro. **R2** DuckDB-Wasm ~3-4MB first-load → lazy only on /graph+/grid. **R3** O(n²) physics won't hold 60fps even at 10k → freeze/visible-only/30fps; Barnes-Hut before Pro. **R4** u64→`BigInt`; `massOf` does `Number(...)` (safe, sats<MAX_SAFE_INT). **R5** activity-list explosion → Max-filtered at export. **R6** substrate on ejected SSD (IBD paused 850,405) — export needs SSD mounted + walker quiesced. **R7** role drift (walker 3 roles, export 5) → export `deriveRole` authoritative.

**Open:** Q-a keyframes vs live Barnes-Hut at Max (rec: keyframes Max, live Free/Pro). Q-b owner==minter until post-v0.3. Q-c Free loads ALL bonds + fades client-side; only Pro/Max window by epoch.

---

## Appendix — file work index
NEW: `chain-tools/export/build_bundle.mjs`(+lib), `src/lib/cdn.ts`, `src/data/duckdb.ts`, `scripts/copy-duckdb-assets.mjs`, `src/data/r2-substrate.ts`.
CHANGE: `chain-tools/deploy/push_to_r2.sh`, `chain-tools/lib/schemas.py`(additive `role`), `package.json`(duckdb dep+hooks), `src/data/substrate.ts`(selector), `src/data/BitcoinChainAdapter.ts`(stubs→real), `src/store/timegridStore.ts`(tier/dataReady/degreeByAddr), `src/components/views/GraphView.tsx`(swap+hub+tip), `src/lib/forceLayout.ts`(Barnes-Hut, v0.2), `src/types/wallet.ts`(GraphBond.formationBlock).
DO NOT CHANGE (stable seams): `src/types/substrate.ts`, `src/types/{wallet,coin,lattice,block}.ts`, `src/lib/{spiral,coords,role-visuals}.ts`, `schemas.py` column names/dtypes (additive-only).
