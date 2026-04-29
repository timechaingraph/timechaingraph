"""
from_fixture.py - Convert FIXTURE_SUBSTRATE (TypeScript) to parquet.

The bridge between the TS-side mock fixture and the Python parquet
pipeline. Lets us exercise the WALLETS_SCHEMA + BONDS_SCHEMA +
COINS_SCHEMA contracts end-to-end before bitcoind is online; the
operator can validate parquet readers against real-shape data
without spinning up infra.

Pipeline:
  1. `npm run substrate:dump` writes out/substrate-dump.json from
     FIXTURE_SUBSTRATE (vitest runs the dumper)
  2. `python3 chain-tools/ingest/from_fixture.py` reads that JSON
     and emits:
       out/wallets.parquet
       out/bonds.parquet
       out/coins.parquet

Each parquet matches the corresponding schema in
chain-tools/lib/schemas.py exactly. Round-tripping through this
bridge is the non-bitcoind validation that the schema set is
internally consistent + the operator's readers can consume what
the pipeline will eventually emit.

Usage
-----
    npm run substrate:dump      # produces out/substrate-dump.json
    python3 chain-tools/ingest/from_fixture.py \\
        --input out/substrate-dump.json \\
        --output-dir out/

Requires pyarrow (see requirements.txt).
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path

# Ensure chain-tools/lib + chain-tools/ingest are importable.
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'lib'))
sys.path.insert(0, str(HERE))

try:
    from schemas import (  # type: ignore[import-not-found]
        WALLETS_SCHEMA,
        BONDS_SCHEMA,
        COINS_SCHEMA,
    )
except ImportError as exc:
    raise SystemExit(
        'Cannot import chain-tools/lib/schemas.py - run from repo root'
    ) from exc


@dataclass
class WalletRow:
    address: str
    first_seen_block: int
    last_active_block: int
    total_received_sats: int
    tx_count: int
    is_miner: bool

    def to_dict(self) -> dict:
        return self.__dict__


@dataclass
class BondRow:
    from_address: str
    to_address: str
    sats: int
    formation_block: int

    def to_dict(self) -> dict:
        return self.__dict__


@dataclass
class CoinRow:
    id: str
    minted_at_block: int
    minted_index: int
    minter_address: str
    owner_address: str
    spiral_index: int
    grid_x: int
    grid_y: int
    is_halving: bool

    def to_dict(self) -> dict:
        return self.__dict__


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__.split('\n')[1])
    p.add_argument('--input', type=Path, required=True,
                   help='Path to substrate-dump.json')
    p.add_argument('--output-dir', type=Path, required=True,
                   help='Directory to emit parquet files')
    return p.parse_args()


def djb2(s: str) -> int:
    """Match the TS-side djb2 used to compute bond formation blocks."""
    h = 5381
    for ch in s:
        h = ((h << 5) + h + ord(ch)) & 0xFFFFFFFF
    return h


def main() -> None:
    args = parse_args()

    import pyarrow as pa
    import pyarrow.parquet as pq

    dump = json.loads(args.input.read_text())
    if dump.get('schema') != 'substrate-dump/v1':
        raise SystemExit(
            f'Unexpected dump schema: {dump.get("schema")!r}; '
            f'expected substrate-dump/v1'
        )

    args.output_dir.mkdir(parents=True, exist_ok=True)

    # --- wallets.parquet ---
    wallet_rows = [
        WalletRow(
            address=w['address'],
            first_seen_block=int(w['firstSeenBlock']),
            last_active_block=int(w['lastActiveBlock']),
            total_received_sats=int(w['totalReceivedSats']),
            tx_count=int(w['txCount']),
            is_miner=bool(w['isMiner']),
        )
        for w in dump['wallets']
    ]
    wallets_table = pa.Table.from_pylist(
        [r.to_dict() for r in wallet_rows],
        schema=WALLETS_SCHEMA,
    )
    wallets_path = args.output_dir / 'wallets.parquet'
    pq.write_table(wallets_table, wallets_path,
                   compression='snappy', use_dictionary=['address'])
    print(f'wrote {wallets_path} - {len(wallet_rows)} rows')

    # --- bonds.parquet ---
    # Compute formation block via djb2 (matches the TS-side bond fixture).
    wallet_by_addr = {w['address']: w for w in dump['wallets']}

    def formation_block(b: dict) -> int:
        a = wallet_by_addr[b['fromAddress']]
        c = wallet_by_addr[b['toAddress']]
        lo = max(a['firstSeenBlock'], c['firstSeenBlock'])
        hi = min(a['lastActiveBlock'], c['lastActiveBlock'])
        if hi <= lo:
            return lo
        seed = djb2(f'{b["fromAddress"]}|{b["toAddress"]}')
        return lo + (seed % (hi - lo))

    bond_rows = [
        BondRow(
            from_address=b['fromAddress'],
            to_address=b['toAddress'],
            sats=int(b['sats']),
            formation_block=formation_block(b),
        )
        for b in dump['bonds']
    ]
    bonds_table = pa.Table.from_pylist(
        [r.to_dict() for r in bond_rows],
        schema=BONDS_SCHEMA,
    )
    bonds_path = args.output_dir / 'bonds.parquet'
    pq.write_table(bonds_table, bonds_path,
                   compression='snappy', use_dictionary=['from_address', 'to_address'])
    print(f'wrote {bonds_path} - {len(bond_rows)} rows')

    # --- coins.parquet ---
    coin_rows = [
        CoinRow(
            id=c['id'],
            minted_at_block=int(c['mintedAtBlock']),
            minted_index=int(c['mintedIndex']),
            minter_address=c['minterAddress'],
            owner_address=c['ownerAddress'],
            spiral_index=int(c['spiralIndex']),
            grid_x=int(c['gridX']),
            grid_y=int(c['gridY']),
            is_halving=bool(c['isHalving']),
        )
        for c in dump['coins']
    ]
    coins_table = pa.Table.from_pylist(
        [r.to_dict() for r in coin_rows],
        schema=COINS_SCHEMA,
    )
    coins_path = args.output_dir / 'coins.parquet'
    pq.write_table(coins_table, coins_path,
                   compression='snappy',
                   use_dictionary=['minter_address', 'owner_address'])
    print(f'wrote {coins_path} - {len(coin_rows)} rows')

    print()
    print(f'Substrate-dump tipBlock: {dump["tipBlock"]:,}')
    print(f'Total parquet files: 3 in {args.output_dir}/')


if __name__ == '__main__':
    main()
