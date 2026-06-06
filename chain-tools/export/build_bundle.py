#!/usr/bin/env python3
"""build_bundle.py — JSONL substrate -> single public Parquet bundle for the browser.

Reads the reduced operator substrate (real-substrate-{wallets,bonds}.jsonl,
produced by walk_chain_scalable.mjs + reduce_substrate.py) and emits a static,
versioned Parquet bundle the browser fetches via DuckDB-Wasm
(see chain-tools/README.md).

The site is all-free / all-public / donation-funded — there are no tiers. This
carves ONE public dataset: a wallet is included if it is a miner OR ever
received >= --min-btc BTC. A bond is included iff BOTH endpoints are in the set
(no edges dangling to unrendered nodes). Wallet parquet matches WALLETS_SCHEMA
exactly; the client derives role (whale/miner/significant/dust/satoshi) from the
columns. Raise --min-btc to shrink the node count to what the renderer handles.

Usage:
    python3 chain-tools/export/build_bundle.py \\
        --substrate-dir chain-tools/out \\
        --output-dir public/data/v0.1.0 \\
        --min-btc 1000 \\
        --bundle-version v0.1.0
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'lib'))
try:
    from schemas import WALLETS_SCHEMA, BONDS_SCHEMA  # type: ignore[import-not-found]
except ImportError as exc:
    raise SystemExit('Cannot import chain-tools/lib/schemas.py — run from repo root') from exc

SATS = 100_000_000


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    p.add_argument('--substrate-dir', type=Path, required=True)
    p.add_argument('--output-dir', type=Path, required=True)
    p.add_argument('--min-btc', type=float, default=1000.0,
                   help='include a wallet if it ever received >= this many BTC '
                        '(miners always included). The site ships a SINGLE public '
                        'dataset (no tiers); raise this to shrink the node count '
                        'to what the renderer handles.')
    p.add_argument('--bundle-version', default='v0.1.0')
    return p.parse_args()


def main() -> None:
    args = parse_args()
    import pyarrow as pa
    import pyarrow.parquet as pq

    sub = args.substrate_dir
    meta = json.loads((sub / 'real-substrate-meta.json').read_text())
    tip_block = int(meta.get('tipBlock', 0))
    floor_sats = int(args.min_btc * SATS)

    # ---- Pass 1: wallets above the public floor (single dataset, no tiers) --
    wallet_rows: list[dict] = []
    addr_set: set[str] = set()
    n_scanned = 0
    with (sub / 'real-substrate-wallets.jsonl').open() as f:
        for line in f:
            if not line.strip():
                continue
            w = json.loads(line)
            n_scanned += 1
            total = int(w['totalReceivedSats'])
            miner = bool(w['isMiner'])
            if not (miner or total >= floor_sats):
                continue
            wallet_rows.append({
                'address': w['address'],
                'first_seen_block': int(w['firstSeenBlock']),
                'last_active_block': int(w['lastActiveBlock']),
                'total_received_sats': total,
                'tx_count': int(w['txCount']),
                'is_miner': miner,
            })
            addr_set.add(w['address'])

    # ---- Pass 2: bonds where BOTH endpoints are in the public set -----------
    bond_rows: list[dict] = []
    with (sub / 'real-substrate-bonds.jsonl').open() as f:
        for line in f:
            if not line.strip():
                continue
            b = json.loads(line)
            fr, to = b['fromAddress'], b['toAddress']
            if fr in addr_set and to in addr_set:
                bond_rows.append({
                    'from_address': fr,
                    'to_address': to,
                    'sats': int(b['sats']),
                    'formation_block': int(b.get('formationBlock', 0)),
                })

    # ---- Write parquet (flat, single dataset) ------------------------------
    out = args.output_dir
    out.mkdir(parents=True, exist_ok=True)
    wt = pa.Table.from_pylist(wallet_rows, schema=WALLETS_SCHEMA)
    wpath = out / 'wallets.parquet'
    pq.write_table(wt, wpath, compression='zstd', use_dictionary=['address'])
    bt = pa.Table.from_pylist(bond_rows, schema=BONDS_SCHEMA)
    bpath = out / 'bonds.parquet'
    pq.write_table(bt, bpath, compression='zstd',
                   use_dictionary=['from_address', 'to_address'])
    print(f'  wallets: {len(wallet_rows):>9,} ({wpath.stat().st_size:>11,}B)  '
          f'bonds: {len(bond_rows):>10,} ({bpath.stat().st_size:>12,}B)')

    # ---- timestamps: block -> unix-seconds (scrubber wall-clock) -----------
    # The scrubber spans block 0..tip; this single asset carries real per-block
    # wall-clock time (vs the 10-min estimate the UI falls back to). The browser
    # loads it into a height-indexed Uint32Array.
    ts_entry = None
    ts_path = sub / 'real-substrate-timestamps.json'
    if ts_path.exists():
        from datetime import datetime
        raw = json.loads(ts_path.read_text())
        ts_rows = []
        for block_str, iso in raw.items():
            try:
                unix = int(datetime.fromisoformat(iso.replace('Z', '+00:00')).timestamp())
            except (ValueError, TypeError):
                continue
            ts_rows.append({'block': int(block_str), 't': unix})
        ts_rows.sort(key=lambda r: r['block'])
        ts_schema = pa.schema([('block', pa.uint32()), ('t', pa.uint32())])
        tt = pa.Table.from_pylist(ts_rows, schema=ts_schema)
        tpath = out / 'timestamps.parquet'
        pq.write_table(tt, tpath, compression='zstd')
        ts_entry = {'path': 'timestamps.parquet',
                    'rows': len(ts_rows),
                    'bytes': tpath.stat().st_size}
        print(f'  timestamps: {len(ts_rows):>7,} blocks ({tpath.stat().st_size:>10,}B)')

    manifest = {
        'schema': 'bundle-manifest/v2',
        'bundleVersion': args.bundle_version,
        'tipBlock': tip_block,
        'sourceSchema': meta.get('schema'),
        'wallets': {'path': 'wallets.parquet',
                    'rows': len(wallet_rows),
                    'bytes': wpath.stat().st_size},
        'bonds': {'path': 'bonds.parquet',
                  'rows': len(bond_rows),
                  'bytes': bpath.stat().st_size},
        'timestamps': ts_entry,
        'nodeCount': len(wallet_rows),
    }
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'\n  manifest -> {out / "manifest.json"}  (tipBlock {tip_block:,}, '
          f'{len(wallet_rows):,} public wallets, {n_scanned:,} scanned)')


if __name__ == '__main__':
    main()
