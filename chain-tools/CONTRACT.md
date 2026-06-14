# Chain-tools Output Contract

The shape of the parquet bundles + sidecar JSON that the operator's
chain-tools pipeline produces. Authored centrally here so all
downstream consumers (brain-vault generator, coin-real-estate vault
generator, browser-side BitcoinChainAdapter, SWI-Prolog server) read
against the same column names + types.

## Lifecycle

```
                                                  +-- vault/wallets/*.md
                                                  |   vault/bonds/*.md
                                                  +-- (Brain Vault)
                                                  |
bitcoind  +-- chain-tools  --+ R2 +--+
                                                  |
                                                  +-- vault/coins/*.md
                                                  |   vault/subgrids/*.md
                                                  +-- (Coin-Real-Estate Vault)
                                                  |
                                                  +-- browser → DuckDB-Wasm
                                                      → BitcoinChainAdapter
                                                      → /graph + /grid canvases
```

The same parquet bundles serve every reader. The contract is the
pyarrow schemas declared in `chain-tools/lib/schemas.py`; all
consumers MUST read against those names + types.

## Output bundle layout

When the operator runs the full pipeline against bitcoind, the single
public bundle lands under `public/data/<version>/`:

```
public/data/<version>/
├── wallets.parquet              # WALLETS_SCHEMA (above the public floor)
├── bonds.parquet                # BONDS_SCHEMA (both endpoints in the set)
├── coins.parquet                # COINS_SCHEMA (full chain)
├── timestamps.parquet           # block height → unix time (scrubber dates)
├── activity/
│   ├── epoch-0000.parquet       # ACTIVITY_SCHEMA, blocks [0, 2016)
│   ├── epoch-0001.parquet       # blocks [2016, 4032)
│   └── ...
└── manifest.json                # paths, row counts, tip block, schema version
```

`build_bundle.py` carves one public dataset (no tiers — `--min-btc` bounds the
node count); the browser reads it directly.

`deploy/push_to_r2.sh` uploads the entire `out/` tree to a versioned
R2 prefix (e.g., `s3://timechaingraph/data/v0.2.5/`); the browser
fetches via the public R2 URL, no per-viewer auth.

## Schema summary

Authoritative pyarrow definitions in `chain-tools/lib/schemas.py`.
Brief field reference:

### WALLETS_SCHEMA — `wallets.parquet`

| Column                | Type    | Doc                                                |
|-----------------------|---------|----------------------------------------------------|
| `address`             | string  | P2PKH/P2SH/SegWit/Taproot Bitcoin address          |
| `first_seen_block`    | uint32  | Block height of first appearance as tx output      |
| `last_active_block`   | uint32  | Block height of most recent appearance             |
| `total_received_sats` | uint64  | Lifetime cumulative satoshis received              |
| `tx_count`            | uint32  | Lifetime distinct tx references                    |
| `is_miner`            | bool    | Has ever received a coinbase output                |

Filtered by the significance floor in `reduce_substrate.py`: miners +
(>1 BTC ever received OR >100 lifetime txs).

### BONDS_SCHEMA — `bonds.parquet`

| Column            | Type    | Doc                                              |
|-------------------|---------|--------------------------------------------------|
| `from_address`    | string  | Sender side of the bond                          |
| `to_address`      | string  | Recipient side                                   |
| `sats`            | uint64  | Aggregate satoshis transferred across all txs    |
| `formation_block` | uint32  | First transaction's block height                 |

Bonds are aggregated per (from, to) directed pair across the full
chain. Both vault generators read these — brain consumes them as
synapse-notes; coin-real-estate consumes them as transfer history.

### COINS_SCHEMA — `coins.parquet`

| Column             | Type    | Doc                                              |
|--------------------|---------|--------------------------------------------------|
| `id`               | string  | "B<block>I<index>" — `B0I0` is genesis output 0  |
| `minted_at_block`  | uint32  | Block height of mint                             |
| `minted_index`     | uint32  | Position within coinbase outputs (0-indexed)     |
| `minter_address`   | string  | Coinbase recipient at mint time                  |
| `owner_address`    | string  | Current owner at snapshot tipBlock (= minter v0) |
| `spiral_index`     | uint32  | Ulam-spiral coord index                          |
| `grid_x`           | int32   | Spiral X coordinate                              |
| `grid_y`           | int32   | Spiral Y coordinate                              |
| `is_halving`       | bool    | True if minted in a halving block                |

Sister's coin-real-estate vault is the primary consumer; the brain
vault uses `coinsOwnedBy(address)` for the WalletInspector's "Coins
owned" line.

### ACTIVITY_SCHEMA — `activity/epoch-NNNN.parquet`

| Column           | Type                              | Doc                       |
|------------------|-----------------------------------|---------------------------|
| `block_height`   | uint32                            |                           |
| `block_hash`     | string                            |                           |
| `block_time`     | uint64                            | Unix seconds              |
| `tx_count`       | uint32                            |                           |
| `fee_sats`       | uint64                            | Total fees this block     |
| `miners`         | list<string>                      | Coinbase recipients       |
| `spenders`       | list<string>                      | Significant tx-input addrs |
| `recipients`     | list<string>                      | Significant tx-output addrs |
| `bonds`          | list<struct{from,to,sats}>        | Tx-level bond activations |

Sharded one parquet per difficulty epoch (2016 blocks). Browser
fetches the relevant shard when scrubbing into a new epoch.

### `status.json`

Companion sidecar — not parquet. Schema mirrors
`src/types/lattice.ts::LatticeStatus`. Field list:

```json
{
  "currentBlock":         876000,
  "lastBlockTime":        "2026-04-29T18:47:23Z",
  "nextBlockEtaMs":       312000,
  "snapshotGeneratedAt":  "2026-04-29T19:00:00Z",
  "freeTierNodeCount":    9853,
  "pipeline": {
    "bitcoind": "ok",
    "walk":     "ok",
    "reduce":   "stale",
    "r2":       "ok"
  }
}
```

`pipeline` per-component flags use one of: `ok`, `stale`, `failed`,
`stubbed`. Browsers tolerate all states; "failed" surfaces an
error banner on `/status`.

## Schema-stability commitment

These shapes are the public contract. From v0.1 forward:

- **Additive changes are forward-compatible.** New columns can be
  added; older readers ignore unknown fields.
- **No renames or removals without a major-version bump.** A
  major bump rebuilds the bundle under a new R2 prefix
  (e.g., `s3://.../data/v0.2/` → `s3://.../data/v1.0/`); both
  bundles served in parallel during the transition.
- **Column types do not change.** A `uint32` column stays a
  `uint32`. If a column needs a wider type, add a new column
  (e.g., `total_received_sats_v2` as `uint128`) and deprecate
  the old one.

## Generating the bundle

The pipeline runs operator-side against the operator's own bitcoind
(full walkthrough in [README.md](README.md)):

```bash
# 1. Walk the chain → out/agg/* window partials (resumable)
node --max-old-space-size=12288 chain-tools/ingest/walk_chain_scalable.mjs

# 2. Reduce partials → out/real-substrate-* (DuckDB, out-of-core)
chain-tools/.venv/bin/python chain-tools/export/reduce_substrate.py

# 3. Carve the tiered parquet bundle → public/data/<version>/
chain-tools/.venv/bin/python chain-tools/export/build_bundle.py \
    --substrate-dir chain-tools/out --output-dir public/data/v0.1.0 --tiers free,pro,max

# 4. deploy/push_to_r2.sh uploads the bundle to R2
```

The output parquet matches `WALLETS_SCHEMA` / `BONDS_SCHEMA` /
`COINS_SCHEMA` exactly; downstream readers (vault generators, browser
DuckDB-Wasm queries) read against the schemas in `lib/schemas.py`.

## TypeScript ↔ pyarrow type mapping

| pyarrow type           | TypeScript type      |
|------------------------|----------------------|
| `pa.string()`          | `string`             |
| `pa.bool_()`           | `boolean`            |
| `pa.uint32()`          | `number` (≤ 2³² − 1) |
| `pa.uint64()`          | `bigint`             |
| `pa.int32()`           | `number`             |
| `pa.list_(...)`        | `T[]`                |
| `pa.struct([...])`     | `{ ... }`            |

`uint64` → `bigint` is the boundary that breaks JS-number safe
integer range. `total_received_sats` and `sats` are bigints
in `src/types/wallet.ts` for this reason.
