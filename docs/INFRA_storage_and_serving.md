# Storage & serving architecture

How the data gets from Bitcoin's chain to a viewer's browser, what it costs in
storage, and how new blocks are appended. Companion to `DEPLOY_r2_hosting.md`
(the concrete R2 upload/deploy runbook) and `../chain-tools/CONTRACT.md`
(the parquet output contract).

## Two planes (the key mental model)

The SSD/laptop and the live site are **separate planes**. The viewer's browser
never touches the operator's SSD or bitcoind.

```
OPERATOR PLANE ("kitchen" — SSD + laptop/box)     SERVING PLANE ("restaurant" — Cloudflare)
  bitcoind full node (~870 GB)                       R2 bucket: parquet bundle + DuckDB-Wasm .wasm
    → walk_chain_scalable → reduce_substrate         Pages: static site shell
    → build_bundle → tiered parquet  ── upload ──►    browser HTTP-range-reads parquet,
  online only to BUILD / UPDATE the bundle           queries it in-browser; serves all viewers 24/7
```

## Storage — is 2 TB enough?

**Yes, for ~1-2 years, *if* intermediates are pruned after each rebuild.**

| On the SSD | Size | Keep? |
|---|---|---|
| bitcoind full node + txindex | ~870 GB | the bulk; grows ~5-7 GB/week (~300 GB/yr) |
| `chain-tools/out/agg/` window partials | ~88 GB mid-walk → ~250-350 GB full chain | **transient — delete after build_bundle** |
| reduced `real-substrate-*.jsonl` | ~30-60 GB full chain | **transient** |
| parquet bundle (`public/data/<v>/`) | 139 MB (171k stand-in) → a few GB (full Max) | small; uploaded to R2 |

- **Peak during a full rebuild** ≈ bitcoind + agg + reduced ≈ ~1.2 TB → fits 1.8 TiB.
- **Steady state** after pruning agg ≈ ~900 GB.
- Only real growth vector is **bitcoind (~300 GB/yr)** → ~2 yr runway from ~870 GB.
- **Get a 4 TB** if: keeping multiple bundle versions + agg at once, wanting 3-4 yr
  bitcoind headroom, or adding a second chain. Not needed now.
- **Reclaim ~800 GB later:** once the schema is stable + history is built, run a
  *pruned* bitcoind for the live tail — but then you can't re-walk history without
  a fresh IBD, so not while iterating on the schema.

## Serving — how the data reaches the domains

Browser fetches **static files only**: the tiered parquet bundle + DuckDB-Wasm
runtime from **Cloudflare R2**, the site shell from **Cloudflare Pages**. It then
queries the parquet **in-browser** via DuckDB-Wasm using **HTTP range reads**
(pulls the footer + only the needed row-groups, not the whole file). No backend,
no per-viewer query server — that's the privacy posture.

**The SSD does NOT serve viewers and does NOT need to stay plugged in.** Build →
upload to R2 once → unplug; Cloudflare keeps serving. The SSD/laptop matters only
when building/updating the bundle (or running bitcoind to ingest).

> Max-tier caveat: a multi-GB Max parquet serves fine from R2 (range-read), but
> the current browser code materializes the whole tier into memory — fine for
> Free/Pro (MB-scale), Max needs **query-on-demand + render culling/LOD** first.
> Free + Pro work end-to-end today.

## New blocks — the timechaincalendar-style live tail

The bundle is a static snapshot at a `tipBlock`; new blocks aren't visible until
it's refreshed. The walker is **resumable**, so catching up to the tip is cheap
(~144 new blocks/day). Options, increasing in 24/7-ness:

1. **Periodic re-export (simplest):** cron on the operator box: resume-walk →
   re-reduce → re-build → upload changed files to R2. Per-epoch / daily / hourly.
   Runs when the box is on.
2. **Hybrid (recommended live edge):** keep the big historical bundle static
   (rebuilt occasionally) + a tiny **"tip feed"** (last ~N blocks) updated every
   block by a lightweight watcher; the browser merges static + live delta.
3. **True continuous tail:** move the operator pipeline onto an **always-on box**
   (cheap VPS / home server with bitcoind) running the update cron 24/7. A real
   continuous tail needs bitcoind synced *somewhere* always-on.

Incremental-update optimization (later): merge only new partials into the existing
reduced substrate + re-export only changed tiers, instead of a full re-reduce.
