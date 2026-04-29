"""
significance_filter.py — Heuristic for "wallet that matters enough to render".

Filters the universe of ~1B Bitcoin addresses down to ~1-3M nodes that fit on
the lattice. Two criteria, OR'd:

    1) Has ever received a coinbase output  (i.e. is a miner — keep all of them)
    2) Has held >1 BTC at any point  OR  has been referenced in >100 transactions

Tunable thresholds in MINER_CUTOFF, BALANCE_CUTOFF_SATS, TX_COUNT_CUTOFF.

Used by extract_wallets.py to decide which rows to emit.
"""
from __future__ import annotations

from dataclasses import dataclass


# 1 BTC in satoshis
BALANCE_CUTOFF_SATS = 100_000_000

# Lifetime tx count threshold for non-miners
TX_COUNT_CUTOFF = 100


@dataclass
class WalletStats:
    address: str
    is_miner: bool
    peak_balance_sats: int
    tx_count: int


def is_significant(w: WalletStats) -> bool:
    """Return True if this wallet should be rendered on the lattice."""
    if w.is_miner:
        return True
    if w.peak_balance_sats >= BALANCE_CUTOFF_SATS:
        return True
    if w.tx_count >= TX_COUNT_CUTOFF:
        return True
    return False


def explain(w: WalletStats) -> str:
    """Why a wallet was kept or dropped, for logging."""
    reasons: list[str] = []
    if w.is_miner:
        reasons.append('miner')
    if w.peak_balance_sats >= BALANCE_CUTOFF_SATS:
        reasons.append(f'peak_balance≥{BALANCE_CUTOFF_SATS:,}sats')
    if w.tx_count >= TX_COUNT_CUTOFF:
        reasons.append(f'txs≥{TX_COUNT_CUTOFF}')
    return ', '.join(reasons) if reasons else 'below all thresholds'
