'use client';

import { useEffect, useState } from 'react';
import { useTimegridStore } from '@/store/timegridStore';
import {
  fetchBlockSnapshot,
  type BlockSnapshot,
} from '@/data/blockSnapshots';
import { ROLE_CSS } from '@/lib/role-visuals';
import { FIXTURE_SUBSTRATE } from '@/data/substrate';

/**
 * BlockNarrative — HUD card overlaid on the grid that displays the
 * snapshot of the current block. Fetches the per-block JSON at
 * `/blocks/...` whenever currentBlock changes, then renders a small
 * brass-panel card with the block's "story":
 *
 *   BLOCK 042
 *   ▸ Mined by Satoshi
 *   ▸ +50 BTC opened (cumulative: 2,150 BTC)
 *
 * The fetch is async; while the snapshot is being loaded the card
 * shows a thin loading state. If the fetch fails (no snapshots
 * available — e.g., user navigated to /grid without running
 * `vault:generate`), the card hides itself rather than complaining
 * loudly.
 *
 * This is the user-facing instantiation of the block-by-block
 * snapshot architecture: each per-block JSON literally drives the
 * narrative card on top of the lattice. As the scrubber advances
 * during Narrate-mode playback, the card updates in lockstep.
 */

function shortAddress(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function minterLabel(snapshot: BlockSnapshot): {
  label: string;
  color: string;
} {
  const wallet = FIXTURE_SUBSTRATE.walletByAddress(snapshot.minter);
  if (!wallet) {
    return { label: shortAddress(snapshot.minter), color: 'var(--color-text-muted)' };
  }
  if (wallet.role === 'satoshi') {
    return { label: 'Satoshi', color: ROLE_CSS.satoshi };
  }
  return { label: shortAddress(snapshot.minter), color: ROLE_CSS[wallet.role] };
}

export function BlockNarrative() {
  const currentBlock = useTimegridStore((s) => s.currentBlock);
  const latestBlock = useTimegridStore((s) => s.latestBlock);
  const [snapshot, setSnapshot] = useState<BlockSnapshot | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (latestBlock === 0) return;
    let cancelled = false;
    void fetchBlockSnapshot(currentBlock).then((s) => {
      if (cancelled) return;
      setSnapshot(s);
      // Once we know snapshots are reachable, lock that in so a
      // single late 404 doesn't toggle the card out from under the
      // user. If the very first fetch returns null we treat the
      // whole feature as unavailable and stay hidden.
      if (s) setAvailable(true);
      else if (available === null) setAvailable(false);
    });
    return () => {
      cancelled = true;
    };
  }, [currentBlock, latestBlock, available]);

  if (available === false) return null;
  if (!snapshot) return null;

  const minter = minterLabel(snapshot);
  const isHalving = snapshot.halving;

  return (
    <div
      className="brass-panel pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-lg px-4 py-2.5 text-mono text-xs"
      style={{
        backgroundColor: 'rgba(8, 8, 12, 0.78)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        minWidth: '260px',
        maxWidth: '90%',
      }}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span
          className="text-mono text-[10px] uppercase tracking-[0.28em]"
          style={{ color: 'var(--color-brass-bright)' }}
        >
          Block {snapshot.block.toLocaleString()}
        </span>
        {isHalving && (
          <span
            className="text-mono text-[9px] uppercase tracking-[0.22em]"
            style={{ color: 'var(--color-amber)' }}
          >
            ⚡ halving
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: minter.color, boxShadow: `0 0 6px ${minter.color}` }}
        />
        <span style={{ color: minter.color }}>Mined by {minter.label}</span>
      </div>
      <div className="mt-1 text-[color:var(--color-text-secondary)]">
        + {snapshot.subsidy} BTC opened
        <span className="ml-2 text-[color:var(--color-text-muted)]">
          · {snapshot.cumulativeSupplyBtc.toLocaleString()} BTC total
        </span>
      </div>
    </div>
  );
}
