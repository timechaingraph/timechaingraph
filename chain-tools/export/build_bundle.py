#!/usr/bin/env python3
"""build_bundle.py — JSONL substrate -> tiered Parquet bundle for the browser.

Reads the reduced operator substrate (real-substrate-{wallets,bonds}.jsonl,
produced by walk_chain_scalable.mjs + reduce_substrate.py) and emits a static,
versioned Parquet bundle the browser fetches via DuckDB-Wasm
(see chain-tools/README.md).

Tiers (nested supersets, Free subset of Pro subset of Max), thresholds from
the tier model in the README:
    free  : >= 1000 BTC ever received          (whales + major pools)
    pro   : >= 10 BTC ever received OR miner
    max   : significance floor (miner OR >=1 BTC OR >=100 txs)

A bond is included in a tier iff BOTH endpoints are in that tier (no edges
dangling to unrendered nodes). Wallet parquet matches WALLETS_SCHEMA exactly;
the client derives role (whale/miner/significant/dust/satoshi) from the columns.

Usage:
    python3 chain-tools/export/build_bundle.py \\
        --substrate-dir chain-tools/out.pre-cutover-backup \\
        --output-dir public/data/v0.1.0 \\
        --tiers free,pro \\
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
TIERS = ['free', 'pro', 'max']  # index 0..2; smaller index = more exclusive
TIER_IDX = {t: i for i, t in enumerate(TIERS)}


def min_tier(total_sats: int, is_miner: bool, tx_count: int) -> int:
    """Smallest (most exclusive) tier index the wallet qualifies for, or -1."""
    if total_sats >= 1000 * SATS:
        return 0  # free
    if total_sats >= 10 * SATS or is_miner:
        return 1  # pro
    if is_miner or total_sats >= 1 * SATS or tx_count >= 100:
        return 2  # max
    return -1     # below the significance floor (shouldn't occur if pre-filtered)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    p.add_argument('--substrate-dir', type=Path, required=True)
    p.add_argument('--output-dir', type=Path, required=True)
    p.add_argument('--tiers', default='free,pro',
                   help='comma list of tiers to emit (free,pro,max)')
    p.add_argument('--bundle-version', default='v0.1.0')
    return p.parse_args()


def main() -> None:
    args = parse_args()
    import pyarrow as pa
    import pyarrow.parquet as pq

    emit = [t for t in args.tiers.split(',') if t in TIERS]
    if not emit:
        raise SystemExit(f'No valid tiers in {args.tiers!r} (choose from {TIERS})')

    sub = args.substrate_dir
    meta = json.loads((sub / 'real-substrate-meta.json').read_text())
    tip_block = int(meta.get('tipBlock', 0))

    # ---- Pass 1: wallets -> per-tier rows + address sets -------------------
    wallet_rows: dict[str, list[dict]] = {t: [] for t in emit}
    addr_set: dict[str, set[str]] = {t: set() for t in emit}
    n_wallets = 0
    with (sub / 'real-substrate-wallets.jsonl').open() as f:
        for line in f:
            if not line.strip():
                continue
            w = json.loads(line)
            total = int(w['totalReceivedSats'])
            miner = bool(w['isMiner'])
            txc = int(w['txCount'])
            m = min_tier(total, miner, txc)
            if m < 0:
                continue
            row = {
                'address': w['address'],
                'first_seen_block': int(w['firstSeenBlock']),
                'last_active_block': int(w['lastActiveBlock']),
                'total_received_sats': total,
                'tx_count': txc,
                'is_miner': miner,
            }
            for t in emit:
                if TIER_IDX[t] >= m:
                    wallet_rows[t].append(row)
                    addr_set[t].add(w['address'])
            n_wallets += 1

    # ---- Pass 2: bonds -> per-tier (both endpoints in tier) ----------------
    bond_rows: dict[str, list[dict]] = {t: [] for t in emit}
    with (sub / 'real-substrate-bonds.jsonl').open() as f:
        for line in f:
            if not line.strip():
                continue
            b = json.loads(line)
            fr, to = b['fromAddress'], b['toAddress']
            row = None
            for t in emit:
                s = addr_set[t]
                if fr in s and to in s:
                    if row is None:
                        row = {
                            'from_address': fr,
                            'to_address': to,
                            'sats': int(b['sats']),
                            'formation_block': int(b.get('formationBlock', 0)),
                        }
                    bond_rows[t].append(row)

    # ---- Write parquet + manifest -----------------------------------------
    out = args.output_dir
    (out / 'wallets').mkdir(parents=True, exist_ok=True)
    (out / 'bonds').mkdir(parents=True, exist_ok=True)
    manifest_tiers: dict[str, dict] = {}

    for t in emit:
        wt = pa.Table.from_pylist(wallet_rows[t], schema=WALLETS_SCHEMA)
        wpath = out / 'wallets' / f'{t}.parquet'
        pq.write_table(wt, wpath, compression='zstd', use_dictionary=['address'])
        bt = pa.Table.from_pylist(bond_rows[t], schema=BONDS_SCHEMA)
        bpath = out / 'bonds' / f'{t}.parquet'
        pq.write_table(bt, bpath, compression='zstd',
                       use_dictionary=['from_address', 'to_address'])
        manifest_tiers[t] = {
            'wallets': {'path': f'wallets/{t}.parquet',
                        'rows': len(wallet_rows[t]),
                        'bytes': wpath.stat().st_size},
            'bonds': {'path': f'bonds/{t}.parquet',
                      'rows': len(bond_rows[t]),
                      'bytes': bpath.stat().st_size},
        }
        print(f'  {t:4s}: {len(wallet_rows[t]):>9,} wallets ({wpath.stat().st_size:>10,}B)  '
              f'{len(bond_rows[t]):>10,} bonds ({bpath.stat().st_size:>11,}B)')

    # ---- timestamps: tier-independent block -> unix-seconds ----------------
    # The scrubber spans block 0..tip regardless of tier, so this single asset
    # carries real per-block wall-clock time (vs the 10-min estimate the UI
    # falls back to). The browser loads it into a height-indexed Uint32Array.
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
        'schema': 'bundle-manifest/v1',
        'bundleVersion': args.bundle_version,
        'tipBlock': tip_block,
        'sourceSchema': meta.get('schema'),
        'tiers': manifest_tiers,
        'timestamps': ts_entry,
        'freeTierNodeCount': manifest_tiers.get('free', {}).get('wallets', {}).get('rows', 0),
    }
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'\n  manifest -> {out / "manifest.json"}  (tipBlock {tip_block:,}, '
          f'{n_wallets:,} significant wallets scanned)')


if __name__ == '__main__':
    main()
