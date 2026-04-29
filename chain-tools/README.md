# chain-tools

Offline data pipeline for `apps/timegrid`. Extracts the wallet + activity + position dataset from a self-hosted Bitcoin Core node and packages it as parquet snapshots for distribution via our own CDN.

The browser never talks to any of these tools at runtime — they produce static artifacts that the frontend loads as parquet from R2 (or equivalent). This is the privacy seam: ingestion happens here, on infra we control, with data flowing P2P from Bitcoin's protocol layer; everything downstream is read-only.

## Pipeline overview

```
┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
│   bitcoind   ├───▶│   electrs    │───▶│ ingest/extract_  │
│ (full node,  │    │ (UTXO index) │    │  wallets.py      │
│  ~600GB)     │    │              │    │                  │
└──────────────┘    └──────────────┘    └────────┬─────────┘
   ▲                                              │
   │ Bitcoin P2P protocol                         ▼
   │                                     ┌─────────────────┐
[Bitcoin Network]                        │ wallets.parquet │
                                         │ activity.parquet│
                                         └────────┬────────┘
                                                  │
                                                  ▼
                                         ┌─────────────────┐
                                         │ physics/        │
                                         │ (Rust force-sim)│
                                         └────────┬────────┘
                                                  │
                                                  ▼
                                         ┌─────────────────┐
                                         │ keyframes/      │
                                         │   N.parquet     │
                                         └────────┬────────┘
                                                  │
                                                  ▼
                                         ┌─────────────────┐
                                         │ deploy/         │
                                         │ push_to_r2.sh   │
                                         └────────┬────────┘
                                                  │
                                                  ▼
                                            CDN bucket
                                            (Cloudflare R2)
```

## Directory layout

```
chain-tools/
├── ingest/                  Python — bitcoind/electrs queries → parquet
│   ├── extract_wallets.py   Build wallets.parquet (one row per significant address)
│   ├── extract_activity.py  Build activity.parquet (per-block events)
│   ├── significance_filter.py  Heuristic: miners + (>1 BTC OR >100 txs)
│   └── requirements.txt     Python deps
├── physics/                 Rust — force-directed sim → keyframes
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs
│       └── spatial_index.rs
└── deploy/
    └── push_to_r2.sh        rsync parquet bundle to R2 bucket
```

## Prerequisites (operator)

1. **bitcoind** — full node with `txindex=1`. ~600GB disk, ~24-48h initial sync.
2. **electrs** — Rust Electrum server on top of bitcoind. ~200GB additional index.
3. **Python 3.11+** with `pip install -r ingest/requirements.txt`.
4. **Rust 1.80+** (`rustup install stable`).
5. **wrangler** (Cloudflare CLI) authenticated to the target account.

See `apps/timegrid/README.md` for how the published parquet bundle is consumed.

## Status

All pipeline scripts are skeletons. The data shape, CLI interface, and intermediate file format are documented in each script's header; implementation lands once a target bitcoind/electrs instance exists.
