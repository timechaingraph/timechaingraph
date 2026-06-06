#!/usr/bin/env python3
"""reduce_substrate.py — merge the combiner walker's window partials into the
final substrate, out-of-core, via DuckDB.

walk_chain_scalable.mjs emits pre-aggregated per-window partials:
    out/agg/wallets/part-*.jsonl.gz     (address, firstSeenBlock, lastActiveBlock,
                                          totalReceivedSats, txCount, isMiner)
    out/agg/bonds/part-*.jsonl.gz       (fromAddress, toAddress, sats, formationBlock)
    out/agg/timestamps/part-*.jsonl.gz  (b, t)

This reducer GROUP BYs across all windows (DuckDB spills to disk, so memory is
bounded regardless of chain size) and writes the SAME files the old monolithic
walker produced — so build_bundle.py is unchanged:
    out/real-substrate-wallets.jsonl
    out/real-substrate-bonds.jsonl
    out/real-substrate-meta.json
    out/real-substrate-timestamps.json

Two-pass significance filter (the key scale lever):
  * Wallets: keep only the Max-tier floor (miner OR >=1 BTC ever OR >=100 txs).
    The full chain has ~1B+ addresses, almost all dust the exporter would drop
    anyway; filtering here shrinks the output ~20x.
  * Bonds: keep only edges where BOTH endpoints survived the wallet filter
    (significant<->significant), so no edge dangles to an unrendered node.

Usage:
    chain-tools/.venv/bin/python chain-tools/export/reduce_substrate.py
    chain-tools/.venv/bin/python chain-tools/export/reduce_substrate.py \\
        --agg-dir chain-tools/out/agg --out-dir chain-tools/out
"""
from __future__ import annotations

import argparse
import glob
import json
from pathlib import Path

SATS = 100_000_000
# Max-tier / significance floor — must match build_bundle.min_tier()'s level-2.
SIGNIFICANCE_SQL = "(is_miner OR total_received_sats >= 100000000 OR tx_count >= 100)"

WALLET_COLS = {
    'address': 'VARCHAR',
    'firstSeenBlock': 'BIGINT',
    'lastActiveBlock': 'BIGINT',
    'totalReceivedSats': 'VARCHAR',  # written quoted; CAST to HUGEINT to SUM
    'txCount': 'BIGINT',
    'isMiner': 'BOOLEAN',
}
BOND_COLS = {
    'fromAddress': 'VARCHAR',
    'toAddress': 'VARCHAR',
    'sats': 'VARCHAR',
    'formationBlock': 'BIGINT',
}
TS_COLS = {'b': 'BIGINT', 't': 'VARCHAR'}


def parse_args() -> argparse.Namespace:
    here = Path(__file__).resolve().parent
    repo_root = here.parent.parent
    p = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    p.add_argument('--agg-dir', type=Path, default=repo_root / 'chain-tools' / 'out' / 'agg')
    p.add_argument('--out-dir', type=Path, default=repo_root / 'chain-tools' / 'out')
    p.add_argument('--memory-limit', default='12GB')
    p.add_argument('--threads', type=int, default=4)
    p.add_argument('--batch-files', type=int, default=50,
                   help='window partials per read_json chunk. A single read_json '
                        'over the full-chain glob (~269GB) cannot spill and OOMs; '
                        'chunking bounds memory. Lower = safer/slower.')
    return p.parse_args()


def cols_struct(cols: dict[str, str]) -> str:
    inner = ', '.join(f"'{k}': '{v}'" for k, v in cols.items())
    return '{' + inner + '}'


def file_list_sql(files: list[str]) -> str:
    """DuckDB list literal of file paths for read_json([...])."""
    return '[' + ', '.join("'" + f + "'" for f in files) + ']'


def main() -> None:
    args = parse_args()
    import duckdb

    agg = args.agg_dir
    out = args.out_dir
    out.mkdir(parents=True, exist_ok=True)

    wallets_glob = str(agg / 'wallets' / 'part-*.jsonl.gz')
    bonds_glob = str(agg / 'bonds' / 'part-*.jsonl.gz')
    ts_glob = str(agg / 'timestamps' / 'part-*.jsonl.gz')

    n_wallet_parts = len(glob.glob(wallets_glob))
    if n_wallet_parts == 0:
        raise SystemExit(f'No wallet partials at {wallets_glob} — run the walker first.')
    print(f'Reducing {n_wallet_parts} window partial(s) from {agg} …')

    tmp_dir = out / 'duckdb-tmp'
    tmp_dir.mkdir(parents=True, exist_ok=True)

    # Disk-backed database (not in-memory): the wallets/bonds result tables live
    # on disk instead of RAM, so only the active operator's working set counts
    # against memory_limit. Essential at full-chain scale (~1.3M wallets across
    # 3k+ partials) — an in-memory connection OOMs even at 16GB.
    db_path = tmp_dir / 'reduce.db'
    db_path.unlink(missing_ok=True)
    con = duckdb.connect(str(db_path))
    con.execute(f"PRAGMA memory_limit='{args.memory_limit}'")
    con.execute(f"PRAGMA threads={args.threads}")
    con.execute(f"PRAGMA temp_directory='{tmp_dir}'")
    # Don't track insertion order — lets the hash-aggregate spill to
    # temp_directory and keeps the reduce memory-bounded.
    con.execute("PRAGMA preserve_insertion_order=false")

    # ---- wallets: chunked two-phase merge ------------------------------------
    # A single read_json over the full-chain glob (~269GB gzipped) cannot spill
    # and OOMs at any memory_limit. So read the partials in bounded chunks into a
    # native staging table, then run the final GROUP BY over that table — native
    # table aggregates DO spill to temp_directory, so this stays memory-bounded.
    wallet_files = sorted(glob.glob(wallets_glob))
    con.execute("""
        CREATE TABLE wallets_stage (
            address VARCHAR, first_seen_block BIGINT, last_active_block BIGINT,
            total_received_sats HUGEINT, tx_count BIGINT, is_miner BOOLEAN
        )
    """)
    for i in range(0, len(wallet_files), args.batch_files):
        chunk = wallet_files[i:i + args.batch_files]
        con.execute(f"""
            INSERT INTO wallets_stage
            SELECT address, MIN(firstSeenBlock), MAX(lastActiveBlock),
                   SUM(totalReceivedSats::HUGEINT), SUM(txCount)::BIGINT, bool_or(isMiner)
            FROM read_json({file_list_sql(chunk)},
                           format='newline_delimited', columns={cols_struct(WALLET_COLS)})
            GROUP BY address
        """)
        print(f'  wallets: staged {min(i + args.batch_files, len(wallet_files))}/'
              f'{len(wallet_files)} partials', flush=True)
    con.execute(f"""
        CREATE TABLE wallets AS
        SELECT address,
               MIN(first_seen_block)    AS first_seen_block,
               MAX(last_active_block)   AS last_active_block,
               SUM(total_received_sats) AS total_received_sats,
               SUM(tx_count)::BIGINT    AS tx_count,
               bool_or(is_miner)        AS is_miner
        FROM wallets_stage
        GROUP BY address
        HAVING {SIGNIFICANCE_SQL}
    """)
    con.execute("DROP TABLE wallets_stage")
    (n_wallets,) = con.execute("SELECT count(*) FROM wallets").fetchone()
    print(f'  significant wallets: {n_wallets:,}', flush=True)

    # ---- bonds: same chunked two-phase, then significant<->significant --------
    bond_files = sorted(glob.glob(bonds_glob))
    if bond_files:
        con.execute("""
            CREATE TABLE bonds_stage (
                from_address VARCHAR, to_address VARCHAR, sats HUGEINT, formation_block BIGINT
            )
        """)
        for i in range(0, len(bond_files), args.batch_files):
            chunk = bond_files[i:i + args.batch_files]
            con.execute(f"""
                INSERT INTO bonds_stage
                SELECT fromAddress, toAddress, SUM(sats::HUGEINT), MIN(formationBlock)
                FROM read_json({file_list_sql(chunk)},
                               format='newline_delimited', columns={cols_struct(BOND_COLS)})
                GROUP BY fromAddress, toAddress
            """)
            print(f'  bonds: staged {min(i + args.batch_files, len(bond_files))}/'
                  f'{len(bond_files)} partials', flush=True)
        con.execute(f"""
            CREATE TABLE bonds AS
            WITH merged AS (
                SELECT from_address, to_address,
                       SUM(sats) AS sats, MIN(formation_block) AS formation_block
                FROM bonds_stage GROUP BY from_address, to_address
            )
            SELECT m.* FROM merged m
            WHERE m.from_address IN (SELECT address FROM wallets)
              AND m.to_address   IN (SELECT address FROM wallets)
        """)
        con.execute("DROP TABLE bonds_stage")
        (n_bonds,) = con.execute("SELECT count(*) FROM bonds").fetchone()
    else:
        con.execute("CREATE TABLE bonds (from_address VARCHAR, to_address VARCHAR, sats HUGEINT, formation_block BIGINT)")
        n_bonds = 0
    print(f'  significant<->significant bonds: {n_bonds:,}', flush=True)

    # ---- write substrate jsonl (build_bundle.py input shape) -----------------
    wallets_out = out / 'real-substrate-wallets.jsonl'
    con.execute(f"""
        COPY (
            SELECT
                address,
                first_seen_block      AS firstSeenBlock,
                last_active_block     AS lastActiveBlock,
                total_received_sats::VARCHAR AS totalReceivedSats,
                tx_count              AS txCount,
                is_miner              AS isMiner
            FROM wallets
            ORDER BY first_seen_block, address
        ) TO '{wallets_out}' (FORMAT JSON)
    """)

    bonds_out = out / 'real-substrate-bonds.jsonl'
    con.execute(f"""
        COPY (
            SELECT
                from_address      AS fromAddress,
                to_address        AS toAddress,
                sats::VARCHAR     AS sats,
                formation_block   AS formationBlock
            FROM bonds
            ORDER BY formation_block, from_address
        ) TO '{bonds_out}' (FORMAT JSON)
    """)

    # ---- timestamps + meta ---------------------------------------------------
    block_timestamps: dict[str, str] = {}
    tip_block = int(con.execute("SELECT max(last_active_block) FROM wallets").fetchone()[0] or 0)
    if len(glob.glob(ts_glob)) > 0:
        rows = con.execute(f"""
            SELECT b, MIN(t) AS t
            FROM read_json('{ts_glob}',
                           format='newline_delimited',
                           columns={cols_struct(TS_COLS)})
            GROUP BY b ORDER BY b
        """).fetchall()
        block_timestamps = {str(b): t for (b, t) in rows}
        if rows:
            tip_block = max(tip_block, int(rows[-1][0]))
    (out / 'real-substrate-timestamps.json').write_text(
        json.dumps(block_timestamps) + '\n')

    agg_meta = {}
    agg_meta_path = agg / 'meta.json'
    if agg_meta_path.exists():
        agg_meta = json.loads(agg_meta_path.read_text())

    meta = {
        'schema': 'real-substrate/v5',
        'tipBlock': tip_block,
        'lastFlushedBlock': agg_meta.get('lastFlushedBlock', tip_block),
        'significantWallets': n_wallets,
        'significantBonds': n_bonds,
        'sourceParts': n_wallet_parts,
        'generatedAt': agg_meta.get('generatedAt'),
    }
    (out / 'real-substrate-meta.json').write_text(json.dumps(meta, indent=2) + '\n')

    print(f'\n  wrote {wallets_out.name} ({wallets_out.stat().st_size:,}B)')
    print(f'  wrote {bonds_out.name} ({bonds_out.stat().st_size:,}B)')
    print(f'  wrote real-substrate-timestamps.json ({len(block_timestamps):,} blocks)')
    print(f'  tipBlock {tip_block:,} — next: build_bundle.py')


if __name__ == '__main__':
    main()
