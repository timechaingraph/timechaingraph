'use client';

import { useEffect, useState } from 'react';
import { useTimegridStore } from '@/store/timegridStore';
import {
  fetchBlockSnapshot,
  type BlockSnapshot,
} from '@/data/blockSnapshots';
import { ROLE_CSS } from '@/lib/role-visuals';
import { FIXTURE_SUBSTRATE } from '@/data/substrate';
import { epochFromHeight } from '@/types/block';

/**
 * GraphSidebar — graph-only compact left-side HUD. Combines what
 * the shared <BlockNarrative> + <BlockStats> components surface into
 * a single narrow card stack, sized to leave the canvas as wide as
 * possible. Mounted by /graph's kiosk page; not in SHARED_PATHS
 * because the grid view uses the wider floating-panel pattern.
 *
 * The card auto-fetches the per-block snapshot for `currentBlock`
 * via the shared blockSnapshots client; the canvas's Animate /
 * Narrate playback drives currentBlock at 1 block / 10s, and this
 * sidebar updates in lockstep.
 */

const GENESIS_TIMESTAMP_MS = 1_231_006_505 * 1000;
const AVG_BLOCK_TIME_MS = 10 * 60 * 1000;

function shortAddress(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function minterLabel(snap: BlockSnapshot): { label: string; color: string } {
  const wallet = FIXTURE_SUBSTRATE.walletByAddress(snap.minter);
  if (!wallet) {
    return { label: shortAddress(snap.minter), color: 'var(--color-text-muted)' };
  }
  if (wallet.role === 'satoshi') {
    return { label: 'Satoshi', color: ROLE_CSS.satoshi };
  }
  return { label: shortAddress(snap.minter), color: ROLE_CSS[wallet.role] };
}

function formatBtc(n: number): string {
  if (n >= 1_000) return Math.round(n).toLocaleString();
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(2);
}

function estimateDate(height: number): string {
  return new Date(GENESIS_TIMESTAMP_MS + height * AVG_BLOCK_TIME_MS)
    .toISOString()
    .slice(0, 10);
}

export function GraphSidebar() {
  const currentBlock = useTimegridStore((s) => s.currentBlock);
  const latestBlock = useTimegridStore((s) => s.latestBlock);
  const [snapshot, setSnapshot] = useState<BlockSnapshot | null>(null);

  useEffect(() => {
    if (latestBlock === 0) return;
    let cancelled = false;
    void fetchBlockSnapshot(currentBlock).then((s) => {
      if (!cancelled) setSnapshot(s);
    });
    return () => {
      cancelled = true;
    };
  }, [currentBlock, latestBlock]);

  const ready = latestBlock > 0;
  const epoch = epochFromHeight(currentBlock);
  const halvings = Math.floor(currentBlock / 210_000);
  const blocksToNext = 210_000 - (currentBlock % 210_000);
  const minter = snapshot ? minterLabel(snapshot) : null;

  return (
    <div
      className="brass-panel rounded-lg px-4 py-3 text-mono text-xs"
      style={{
        backgroundColor: 'rgba(8, 8, 12, 0.78)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      aria-live="polite"
      aria-atomic="true"
    >
      {/* Header: block label + halving badge */}
      <div className="flex items-baseline justify-between gap-3">
        <span
          className="text-[9px] uppercase tracking-[0.28em]"
          style={{ color: 'var(--color-brass-bright)' }}
        >
          Block
        </span>
        {snapshot?.halving && (
          <span
            className="text-[9px] uppercase tracking-[0.22em]"
            style={{ color: 'var(--color-amber)' }}
          >
            ⚡ halving
          </span>
        )}
      </div>

      {/* Big block number */}
      <p className="text-display mt-1 text-2xl font-semibold leading-none text-[color:var(--color-text-primary)]">
        {ready ? currentBlock.toLocaleString() : '—'}
      </p>
      <p className="mt-1 text-[10px] text-[color:var(--color-text-muted)]">
        epoch {epoch} · {halvings} {halvings === 1 ? 'halving' : 'halvings'} crossed
      </p>

      {/* Minter line — only when snapshot is loaded */}
      {minter && (
        <div className="mt-3 flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: minter.color, boxShadow: `0 0 6px ${minter.color}` }}
          />
          <span style={{ color: minter.color }}>Mined by {minter.label}</span>
        </div>
      )}
      {snapshot && (
        <p className="mt-1 text-[color:var(--color-text-secondary)]">
          + {snapshot.subsidy} BTC opened
          <span className="ml-1 text-[color:var(--color-text-muted)]">
            · {formatBtc(snapshot.cumulativeSupplyBtc)} BTC total
          </span>
        </p>
      )}

      {/* Compact stats — two-column grid, only when ready */}
      {ready && (
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-[color:var(--color-card-border)] pt-3 text-[10px]">
          <Field label="Subsidy" value={`${snapshot?.subsidy ?? '—'} BTC`} />
          <Field
            label="Issued"
            value={
              snapshot ? `${formatBtc(snapshot.cumulativeSupplyBtc)} BTC` : '—'
            }
          />
          <Field label="Next halving" value={`${blocksToNext.toLocaleString()} blocks`} />
          <Field label="Est. date" value={estimateDate(currentBlock)} />
        </dl>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[9px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
        {label}
      </dt>
      <dd className="mt-0.5 text-[color:var(--color-text-primary)]">{value}</dd>
    </div>
  );
}
