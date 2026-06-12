'use client';

import { useEffect, useState } from 'react';
import { useTimegridStore } from '@/store/timegridStore';
import { epochFromHeight, isHalvingBlock } from '@/types/block';
import { subsidyAtBlock, cumulativeSubsidy } from '@/lib/spiral';
import { blockDate, formatBlockDate } from '@/lib/blockDate';
import { getActiveSubstrate } from '@/data/substrate';

/**
 * BlockStats — block-level metadata for whatever block the scrubber sits on,
 * plus the LIVE chain-tail ticker: the current tip (from our same-origin
 * /api/tip relay via useLiveTip), a since-last-block stopwatch, a ~10-minute
 * next-block countdown, and an honesty line whenever the live tip has moved
 * past the data bundle's last block.
 *
 * Surfaces fields derived deterministically from the block height (epoch,
 * halvings crossed, halving-block flag, subsidy, issuance) plus the block's
 * date — the REAL mined time when the bundle carries timestamps (via
 * `blockDate`), falling back to a 10-minute estimate otherwise.
 */

const TARGET_BLOCK_SECONDS = 600; // Bitcoin's 10-minute target

// Compact BTC formatter for the issuance running-total. Uses comma
// thousands at >=1k, two decimals at fractional values, no fractional
// digits otherwise — keeps the panel scannable while preserving
// fractional precision around halving boundaries.
function formatBtc(n: number): string {
  if (n >= 1_000) return Math.round(n).toLocaleString();
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(2);
}

function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function BlockStats() {
  const currentBlock = useTimegridStore((s) => s.currentBlock);
  const latestBlock = useTimegridStore((s) => s.latestBlock);
  const liveTip = useTimegridStore((s) => s.liveTip);

  // 1-second heartbeat for the stopwatch/countdown — only while live data
  // exists with a usable timestamp.
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    if (!liveTip?.timestamp) return;
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, [liveTip?.timestamp]);

  const ready = latestBlock > 0;
  const epoch = epochFromHeight(currentBlock);
  const halvings = Math.floor(currentBlock / 210_000);
  const isHalving = isHalvingBlock(currentBlock);
  const { date: blockWhen, estimated: dateEstimated } = blockDate(currentBlock);
  // Per user directive 2026-04-30: "fractions will always be
  // scrubbed to whole BTC" — every display value floors to the
  // nearest whole BTC since the grid quantizes 1 cell = 1 BTC.
  const subsidy = Math.floor(subsidyAtBlock(currentBlock));
  const issued = Math.floor(cumulativeSubsidy(currentBlock));
  const blocksToNextHalving = 210_000 - (currentBlock % 210_000);

  // Live-tail derived values. sinceLast clamps ≥0 (clock skew between the tip
  // source and the viewer's clock); the countdown is the 10-minute TARGET, so
  // past-due blocks show "any moment" rather than a fake negative timer.
  const sinceLast = liveTip?.timestamp ? Math.max(0, nowSec - liveTip.timestamp) : null;
  const toNext = sinceLast !== null ? TARGET_BLOCK_SECONDS - sinceLast : null;
  const bundleTip = getActiveSubstrate().tipBlock;
  const blocksPastBundle = liveTip ? Math.max(0, liveTip.height - bundleTip) : 0;

  return (
    <div className="brass-panel rounded-lg p-5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-mono text-sm font-semibold uppercase tracking-[0.22em] text-[color:var(--color-brass-bright)]">
          Block stats
        </span>
        {isHalving && (
          <span
            className="text-mono text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--color-amber)' }}
          >
            halving
          </span>
        )}
      </div>

      {ready ? (
        <>
          <p className="text-display mt-3 text-3xl font-semibold leading-none text-[color:var(--color-text-primary)]">
            {currentBlock.toLocaleString()}
          </p>
          <p className="mt-1 text-mono text-xs text-[color:var(--color-text-muted)]">
            epoch {epoch} · {halvings} {halvings === 1 ? 'halving' : 'halvings'} crossed
          </p>

          {/* Live chain tail — tip height pops on each new block (key remount). */}
          {liveTip && (
            <div className="mt-3 rounded-md border border-[color:var(--color-card-border)] bg-[color:var(--color-background-light)] px-3 py-2 text-mono text-xs">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
                  style={{ background: 'var(--color-gold)' }}
                />
                <span className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">
                  Live tip
                </span>
                <span
                  key={liveTip.height}
                  className="inline-block font-semibold tabular-nums text-[color:var(--color-gold)]"
                  style={{ animation: 'tip-pop 0.6s ease-out' }}
                >
                  {liveTip.height.toLocaleString()}
                </span>
              </div>
              {sinceLast !== null && (
                <div className="mt-1.5 flex justify-between gap-3 tabular-nums text-[color:var(--color-text-secondary)]">
                  <span>last block {mmss(sinceLast)} ago</span>
                  <span className="text-[color:var(--color-amber)]">
                    {toNext !== null && toNext > 0 ? `next ~${mmss(toNext)}` : 'next: any moment'}
                  </span>
                </div>
              )}
            </div>
          )}

          <dl className="mt-4 grid grid-cols-2 gap-3 text-mono text-xs">
            <Field label="Block subsidy" value={`${subsidy} BTC`} />
            <Field label="Issued so far" value={`${formatBtc(issued)} BTC`} />
            <Field
              label="Next halving"
              value={`in ${blocksToNextHalving.toLocaleString()} blocks`}
            />
            <Field
              label={dateEstimated ? 'Est. date' : 'Date'}
              value={formatBlockDate(blockWhen)}
            />
            <Field label="Latest tip" value={`block ${latestBlock.toLocaleString()}`} />
          </dl>

          {/* Honesty line: the tip has outrun the rendered dataset. */}
          {blocksPastBundle > 0 && (
            <p className="mt-3 text-mono text-[10px] leading-relaxed text-[color:var(--color-text-muted)]">
              Graph data through block {bundleTip.toLocaleString()} —{' '}
              {blocksPastBundle.toLocaleString()} newer{' '}
              {blocksPastBundle === 1 ? 'block lands' : 'blocks land'} at the next data
              refresh.
            </p>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
          Awaiting data. Block stats activate once the adapter or a
          view seeds <code>latestBlock</code>.
        </p>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
        {label}
      </dt>
      <dd className="mt-1 text-[color:var(--color-text-primary)]">{value}</dd>
    </div>
  );
}
