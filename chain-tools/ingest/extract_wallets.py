"""
extract_wallets.py - Build wallets.parquet from a self-hosted bitcoind+electrs.

One row per "significant" Bitcoin address (miners + >1 BTC ever held OR >100 txs
ever; see significance_filter.py for the heuristic). The output feeds both vault
projections (brain + coin real-estate) and the browser-side
BitcoinChainAdapter.getNodes().

Schema is declared centrally in chain-tools/lib/schemas.py::WALLETS_SCHEMA so
both vault generators and the eventual TS adapter can read against the same
contract. Don't redefine column names here.

Usage
-----
    python extract_wallets.py \\
        --rpc-url http://localhost:8332 \\
        --rpc-cookie ~/.bitcoin/.cookie \\
        --electrs-rpc tcp://localhost:50001 \\
        --start-height 0 \\
        --end-height latest \\
        --output ./out/wallets.parquet

Privacy: this script ONLY talks to localhost bitcoind/electrs. Nothing leaves
the operator's machine until deploy/push_to_r2.sh uploads the parquet bundle.
"""
from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

# chain-tools/lib is on the path when running from repo root; if the user
# invokes this script from a different working directory, surface a clearer
# import error than the default ModuleNotFoundError.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'lib'))
try:
    from schemas import WALLETS_SCHEMA  # type: ignore[import-not-found]
except ImportError as exc:
    raise SystemExit(
        'Cannot import chain-tools/lib/schemas.py - run from repo root or '
        'check that chain-tools/lib/ exists.'
    ) from exc


@dataclass
class WalletRow:
    """In-memory row matching WALLETS_SCHEMA. Operator's RPC code populates."""
    address: str
    first_seen_block: int
    last_active_block: int
    total_received_sats: int
    tx_count: int
    is_miner: bool

    def to_dict(self) -> dict:
        return {
            'address': self.address,
            'first_seen_block': self.first_seen_block,
            'last_active_block': self.last_active_block,
            'total_received_sats': self.total_received_sats,
            'tx_count': self.tx_count,
            'is_miner': self.is_miner,
        }


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__.split('\n')[1])
    p.add_argument('--rpc-url', required=True, help='bitcoind JSON-RPC endpoint')
    p.add_argument('--rpc-cookie', type=Path, required=True, help='Path to bitcoind .cookie')
    p.add_argument('--electrs-rpc', required=True, help='electrs Electrum-protocol endpoint')
    p.add_argument('--start-height', type=int, default=0)
    p.add_argument('--end-height', default='latest')
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--batch-size', type=int, default=2016, help='Blocks per write batch')
    return p.parse_args()


def write_parquet(rows: list[WalletRow], output: Path) -> None:
    """Write a list of WalletRow to parquet matching WALLETS_SCHEMA.

    Pure I/O - operator-implementable without bitcoind. Used by the eventual
    full pipeline + by chain-tools/ingest/from_fixture.py for fixture-to-
    parquet conversion (see C2 in the master plan).
    """
    import pyarrow as pa
    import pyarrow.parquet as pq

    table = pa.Table.from_pylist(
        [r.to_dict() for r in rows],
        schema=WALLETS_SCHEMA,
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    pq.write_table(
        table,
        output,
        compression='snappy',
        use_dictionary=['address'],
    )


def main() -> None:
    args = parse_args()

    # TODO: Connect to bitcoind via JSON-RPC (use python-bitcoinrpc).
    # TODO: Connect to electrs via Electrum protocol.
    # TODO: Iterate blocks [start_height, end_height], for each:
    #         - Read coinbase outputs (these define is_miner=True)
    #         - Read all tx inputs -> mark addresses as spenders + bump tx_count
    #         - Read all tx outputs -> mark addresses as recipients + bump tx_count + total_received
    #         - Update first_seen_block/last_active_block per address
    # TODO: Apply significance filter (see significance_filter.py).
    # TODO: Build list of WalletRow, then call write_parquet(rows, args.output).

    _ = args
    raise NotImplementedError(
        'extract_wallets.py RPC-walking is a skeleton. write_parquet() is '
        'implemented and testable in isolation. Implementation requires a '
        'running bitcoind+electrs; see chain-tools/CONTRACT.md.'
    )


if __name__ == '__main__':
    main()
