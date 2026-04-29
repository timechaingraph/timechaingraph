"""
schemas.py - pyarrow parquet schemas for the chain-tools pipeline output.

Single source of truth for the parquet column shapes that both vault
generators (brain vault: wallets + bonds; coin-real-estate vault:
coins + subgrids) and the browser-side BitcoinChainAdapter consume.

This file is the contract the operator's chain-tools pipeline must
satisfy. Once bitcoind+electrs is online, the extract_*.py scripts
populate these schemas and emit parquet bundles to R2; the browser
fetches them via DuckDB-Wasm and projects into the appropriate vault
or canvas.

Schema-stability commitment: any new field is additive. Existing
fields don't get renamed or dropped without a major-version bump
documented in chain-tools/CONTRACT.md and vault/CONCEPTS.md.

Mirrored on the TypeScript side by:
- src/types/wallet.ts        (WalletData)  → WALLETS_SCHEMA
- src/types/wallet.ts        (WalletBond)  → BONDS_SCHEMA
- src/types/coin.ts          (Coin)        → COINS_SCHEMA
- (no TS mirror yet for activity - emitted+consumed only by canvas)

Run as a script to verify pyarrow can construct the schemas:
    python3 chain-tools/lib/schemas.py
"""
from __future__ import annotations

try:
    import pyarrow as pa
except ImportError as exc:  # pragma: no cover - guard against install-not-yet
    raise SystemExit(
        'pyarrow required (see chain-tools/ingest/requirements.txt). '
        'Run: pip install -r chain-tools/ingest/requirements.txt'
    ) from exc


# ---------- wallets.parquet --------------------------------------------------
#
# One row per "significant" Bitcoin address (miners + >1 BTC ever held OR >100
# txs). Filtered via significance_filter.is_significant. Feeds both vaults +
# the browser BitcoinChainAdapter.getNodes().
WALLETS_SCHEMA = pa.schema([
    pa.field('address', pa.string(), nullable=False,
             metadata={b'doc': b'P2PKH/P2SH/SegWit/Taproot Bitcoin address (string-encoded)'}),
    pa.field('first_seen_block', pa.uint32(), nullable=False,
             metadata={b'doc': b'Block height of first appearance as tx output'}),
    pa.field('last_active_block', pa.uint32(), nullable=False,
             metadata={b'doc': b'Block height of most recent appearance as input or output'}),
    pa.field('total_received_sats', pa.uint64(), nullable=False,
             metadata={b'doc': b'Lifetime cumulative satoshis received via outputs'}),
    pa.field('tx_count', pa.uint32(), nullable=False,
             metadata={b'doc': b'Lifetime distinct tx references'}),
    pa.field('is_miner', pa.bool_(), nullable=False,
             metadata={b'doc': b'Has ever received a coinbase output'}),
])


# ---------- bonds.parquet ----------------------------------------------------
#
# One row per (from, to) wallet pair that has ever transacted. sats is the
# cumulative aggregate; formation_block is the block of the first transaction
# between the pair. Feeds the brain vault's synapse markdown notes + the
# canvas's force-sim spring strengths.
BONDS_SCHEMA = pa.schema([
    pa.field('from_address', pa.string(), nullable=False,
             metadata={b'doc': b'Address that sent - sender side of the bond'}),
    pa.field('to_address', pa.string(), nullable=False,
             metadata={b'doc': b'Address that received - recipient side'}),
    pa.field('sats', pa.uint64(), nullable=False,
             metadata={b'doc': b'Aggregate satoshis transferred across all txs in this bond'}),
    pa.field('formation_block', pa.uint32(), nullable=False,
             metadata={b'doc': b'Block of the first transaction between this pair'}),
])


# ---------- coins.parquet ----------------------------------------------------
#
# One row per coin (UTXO / coinbase output). v0 invariant:
# `owner_address == minter_address` (no transfers tracked yet). v0.2+ the
# multi-input pipeline updates owner per spend.
COINS_SCHEMA = pa.schema([
    pa.field('id', pa.string(), nullable=False,
             metadata={b'doc': b'Coin id "B<block>I<index>" - e.g. "B0I0" is genesis coinbase output 0'}),
    pa.field('minted_at_block', pa.uint32(), nullable=False),
    pa.field('minted_index', pa.uint32(), nullable=False,
             metadata={b'doc': b'Position of this coinbase output within the block (0-indexed)'}),
    pa.field('minter_address', pa.string(), nullable=False,
             metadata={b'doc': b'Coinbase recipient at mint time'}),
    pa.field('owner_address', pa.string(), nullable=False,
             metadata={b'doc': b'Current owner at the snapshot tipBlock; = minter in v0'}),
    pa.field('spiral_index', pa.uint32(), nullable=False,
             metadata={b'doc': b'Ulam-spiral coord index (deterministic from mint order)'}),
    pa.field('grid_x', pa.int32(), nullable=False),
    pa.field('grid_y', pa.int32(), nullable=False),
    pa.field('is_halving', pa.bool_(), nullable=False,
             metadata={b'doc': b'True if this coin was minted in a halving block'}),
])


# ---------- activity/epoch-NNNN.parquet --------------------------------------
#
# One row per block, sharded into 2016-block files (one per difficulty epoch).
# Captures the per-block event log: which addresses produced/consumed +
# tx-level bond formations. Drives the per-block highlight overlay on the
# canvas + the vault's activity sidecars.
ACTIVITY_SCHEMA = pa.schema([
    pa.field('block_height', pa.uint32(), nullable=False),
    pa.field('block_hash', pa.string(), nullable=False),
    pa.field('block_time', pa.uint64(), nullable=False,
             metadata={b'doc': b'Block timestamp (Unix seconds)'}),
    pa.field('tx_count', pa.uint32(), nullable=False),
    pa.field('fee_sats', pa.uint64(), nullable=False,
             metadata={b'doc': b'Total fees collected in this block'}),
    pa.field('miners', pa.list_(pa.string()), nullable=False,
             metadata={b'doc': b'Addresses receiving coinbase output (usually 1, sometimes more)'}),
    pa.field('spenders', pa.list_(pa.string()), nullable=False,
             metadata={b'doc': b'Significant addresses appearing as tx input in this block'}),
    pa.field('recipients', pa.list_(pa.string()), nullable=False,
             metadata={b'doc': b'Significant addresses appearing as non-coinbase tx output'}),
    pa.field('bonds', pa.list_(pa.struct([
        pa.field('from_addr', pa.string()),
        pa.field('to_addr', pa.string()),
        pa.field('sats', pa.uint64()),
    ])), nullable=False,
             metadata={b'doc': b'Tx-level wallet-pair bonds activated this block'}),
])


# ---------- status.json shape (companion sidecar - not parquet) --------------
#
# Documented here for completeness; emitted by the deploy script alongside the
# parquet bundles. Keep in sync with src/types/lattice.ts::LatticeStatus.
STATUS_JSON_FIELDS = (
    'currentBlock',           # uint32
    'lastBlockTime',          # ISO 8601 string
    'nextBlockEtaMs',         # number (milliseconds)
    'snapshotGeneratedAt',    # ISO 8601 string
    'freeTierNodeCount',      # uint32
    'pipeline',               # object - per-component status flags
)


# ---------- self-check -------------------------------------------------------
if __name__ == '__main__':
    schemas = {
        'wallets': WALLETS_SCHEMA,
        'bonds': BONDS_SCHEMA,
        'coins': COINS_SCHEMA,
        'activity': ACTIVITY_SCHEMA,
    }
    for name, schema in schemas.items():
        print(f'=== {name}.parquet ===')
        print(schema.to_string(show_metadata=False))
        print()
    print(f'status.json fields: {STATUS_JSON_FIELDS}')
