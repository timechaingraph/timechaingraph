"""
extract_activity.py — Build activity.parquet (per-block activity events).

For each block in the requested range, emit:
    miners       : list[str]   addresses receiving coinbase output
    spenders     : list[str]   addresses appearing as tx input
    recipients   : list[str]   addresses appearing as tx output (non-coinbase)
    bonds        : list of (from_addr, to_addr, sats) tuples for tx edges
    block_meta   : (height, hash, time, tx_count, fee_sats)

This feeds the per-block highlight overlay and bond rendering in apps/timegrid.
Sharded by difficulty epoch (one parquet per 2016-block range) for efficient
range loads from the browser.

Usage
-----
    python extract_activity.py \
        --rpc-url http://localhost:8332 \
        --rpc-cookie ~/.bitcoin/.cookie \
        --start-height 0 \
        --end-height latest \
        --output-dir ./out/activity/ \
        --shard-size 2016 \
        --wallets-parquet ./out/wallets.parquet

Output layout
-------------
    out/activity/
        epoch-0000.parquet     # blocks [0,        2016)
        epoch-0001.parquet     # blocks [2016,     4032)
        ...
        epoch-NNNN.parquet     # blocks [N*2016,   (N+1)*2016)

Only addresses that appear in wallets-parquet are emitted in the activity
events — non-significant addresses are dropped at this stage to keep the
parquet small. Bonds where neither endpoint is significant are also dropped.
"""
from __future__ import annotations

import argparse
from pathlib import Path


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__.split('\n')[1])
    p.add_argument('--rpc-url', required=True)
    p.add_argument('--rpc-cookie', type=Path, required=True)
    p.add_argument('--start-height', type=int, default=0)
    p.add_argument('--end-height', default='latest')
    p.add_argument('--output-dir', type=Path, required=True)
    p.add_argument('--shard-size', type=int, default=2016)
    p.add_argument('--wallets-parquet', type=Path, required=True,
                   help='Output of extract_wallets.py — used to filter to significant addresses only')
    return p.parse_args()


def main() -> None:
    args = parse_args()

    # TODO: Load significant-addresses set from wallets.parquet (column 'address').
    # TODO: Connect to bitcoind RPC.
    # TODO: For each block height H in [start, end]:
    #         block = rpc.getblock(rpc.getblockhash(H), 2)
    #         miners   = [coinbase_output_address(block)]
    #         spenders, recipients, bonds = walk_txs(block, significant_set)
    #         emit row (H, hash, time, tx_count, fee_sats, miners, spenders, recipients, bonds)
    # TODO: Flush to epoch-shard parquet every shard_size blocks.

    raise NotImplementedError(
        'extract_activity.py is a skeleton. Implementation requires a running '
        'bitcoind. Run extract_wallets.py first.'
    )


if __name__ == '__main__':
    main()
