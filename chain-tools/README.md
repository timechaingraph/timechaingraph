# chain-tools

Operator-side data pipeline for **Timechain Graph**. It reads the operator's
own fully-synced **bitcoind** over JSON-RPC, aggregates wallets + bonds +
timestamps, and emits a single static public **Parquet** bundle for distribution
via a CDN we control (Cloudflare R2). The site is all-free / all-public /
donation-funded — there are no tiers.

The browser never talks to any of these tools at runtime — they produce static
artifacts the frontend range-reads as Parquet via self-hosted DuckDB-Wasm. This
is the privacy seam: ingestion happens here, on infra we control, with data
flowing P2P from Bitcoin's own protocol into our node; everything downstream is
read-only. **No third-party indexer (no electrs), no third-party API.**

## Pipeline overview (the v5 map-reduce design)

```
[Bitcoin P2P network]
        │
        ▼
   bitcoind (own full node)         getblock verbosity 3, cookie auth
        │  JSON-RPC
        ▼
1. WALK   ingest/walk_chain_scalable.mjs   (+ lib/{rpc,extract,combiner}.mjs)
        │  aggregates a bounded block-WINDOW in memory, flushes gzipped
        │  partials → out/agg/{wallets,bonds,timestamps}/part-<start>-<end>.jsonl.gz
        ▼  (memory bounded by distinct keys per window; crash-safe/resumable)
2. REDUCE  export/reduce_substrate.py       (DuckDB, out-of-core)
        │  merges all window partials → out/real-substrate-{wallets,bonds,
        │  timestamps,meta}; applies the significance floor (miner OR ≥1 BTC
        ▼  OR ≥100 txs) and keeps significant↔significant bonds (2-pass filter)
3. EXPORT  export/build_bundle.py
        │  carves ONE public parquet (wallets+bonds above --min-btc) +
        ▼  timestamps.parquet + manifest.json → public/data/<version>/
   Cloudflare R2  ──▶  browser (DuckDB-Wasm range reads) ──▶ /graph canvas
```

## Directory layout

```
chain-tools/
├── ingest/
│   ├── walk_chain_scalable.mjs   the combiner walk (bitcoind getblock v3)
│   └── requirements.txt          Python deps (duckdb + pyarrow)
├── lib/
│   ├── rpc.mjs                   bitcoind JSON-RPC client (cookie auth)
│   ├── extract.mjs              pure per-block wallet/bond extraction
│   ├── combiner.mjs            bounded-window aggregation
│   ├── chain.mjs               halving / subsidy / issuance math
│   └── schemas.py              pyarrow WALLETS/BONDS/COINS/ACTIVITY schemas (the contract)
├── export/
│   ├── reduce_substrate.py     DuckDB out-of-core reduce → real-substrate-*
│   └── build_bundle.py         single public Parquet bundle + manifest
├── audit/
│   └── audit_substrate.mjs     validate the reduced substrate on demand
├── vault/                       Obsidian-vault projection (generate*/validate)
└── deploy/
    └── push_to_r2.sh            upload the parquet bundle to R2
```

The output contract (column names + types every consumer reads against) is in
[`CONTRACT.md`](CONTRACT.md); the authoritative pyarrow definitions are in
`lib/schemas.py`.

## Prerequisites (operator)

1. **bitcoind** — own full node, JSON-RPC enabled (cookie auth at
   `127.0.0.1:8332`). No `txindex` required for the walk; **no electrs**.
2. **Python venv** — `python3 -m venv chain-tools/.venv` then
   `chain-tools/.venv/bin/pip install -r chain-tools/ingest/requirements.txt`
   (duckdb + pyarrow).
3. **Node 26+** for the walker.

## Running it

```bash
# 1. Full-chain walk → out/agg/* partials (resumable; raise heap for the long run)
node --max-old-space-size=12288 chain-tools/ingest/walk_chain_scalable.mjs

# 2. Merge window partials → out/real-substrate-* (DuckDB, out-of-core).
#    Full chain (~1.6B addresses) MUST be memory-bounded: single-threaded,
#    chunked reads, hash-bucketed final aggregate (see reduce_substrate.py).
chain-tools/.venv/bin/python chain-tools/export/reduce_substrate.py \
    --threads 1 --batch-files 50 --address-buckets 32 --memory-limit 12GB

# 3. Carve the single public parquet bundle → public/data/<version>/.
#    --min-btc bounds the node count to what the renderer handles (no tiers).
chain-tools/.venv/bin/python chain-tools/export/build_bundle.py \
    --substrate-dir chain-tools/out --output-dir public/data/v0.1.0 --min-btc 1000

# (optional) audit the reduced substrate
node chain-tools/audit/audit_substrate.mjs
```

The substrate is large (hundreds of GB at full chain) and lives on external
storage symlinked in as `chain-tools/out`; only code stays on the internal disk.
Don't run two walks against the same `out/agg`, and don't operate on the store
while the external drive is unmounted.
