"""
extract_wallets.py — Build wallets.parquet from a self-hosted bitcoind+electrs.

One row per "significant" Bitcoin address (miners + >1 BTC ever held OR >100 txs
ever; see significance_filter.py for the heuristic). The output feeds
apps/timegrid's BitcoinChainAdapter.getNodes().

Usage
-----
    python extract_wallets.py \
        --rpc-url http://localhost:8332 \
        --rpc-cookie ~/.bitcoin/.cookie \
        --electrs-rpc tcp://localhost:50001 \
        --start-height 0 \
        --end-height latest \
        --output ./out/wallets.parquet

Output schema
-------------
    address              : string       Bitcoin address (P2PKH/P2SH/SegWit/Taproot)
    first_seen_block     : uint32       Block height of first appearance as output
    last_active_block    : uint32       Block height of most recent input or output
    total_received_sats  : uint64       Lifetime cumulative satoshis received
    tx_count             : uint32       Lifetime tx references
    is_miner             : bool         Ever received a coinbase output

Privacy: this script ONLY talks to localhost bitcoind/electrs. Nothing leaves
the operator's machine until deploy/push_to_r2.sh uploads the parquet bundle.
"""
from __future__ import annotations

import argparse
from pathlib import Path


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


def main() -> None:
    args = parse_args()

    # TODO: Connect to bitcoind via JSON-RPC (use python-bitcoinrpc).
    # TODO: Connect to electrs via Electrum protocol.
    # TODO: Iterate blocks [start_height, end_height], for each:
    #         - Read coinbase outputs (these define is_miner=True)
    #         - Read all tx inputs → mark addresses as spenders + bump tx_count
    #         - Read all tx outputs → mark addresses as recipients + bump tx_count + total_received
    #         - Update first_seen_block/last_active_block per address
    # TODO: Apply significance filter (see significance_filter.py).
    # TODO: Write Apache parquet (snappy compression, dictionary-encoded address column)
    #       to args.output via pyarrow.

    raise NotImplementedError(
        'extract_wallets.py is a skeleton. Implementation requires a running '
        'bitcoind+electrs. See README.md for setup.'
    )


if __name__ == '__main__':
    main()
