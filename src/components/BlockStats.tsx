'use client';

import { useTimegridStore } from '@/store/timegridStore';
import { epochFromHeight, isHalvingBlock } from '@/types/block';
import { subsidyAtBlock, cumulativeSubsidy } from '@/lib/spiral';
import { blockDate, formatBlockDate } from '@/lib/blockDate';

/**
 * BlockStats — block-level metadata for whatever block the scrubber sits on.
 * Deliberately NARROW (single column, slim card) so it costs as little canvas
 * as possible; the live chain-tail ticker lives in LiveTipPanel (bottom-right
 * of the graph), not here.
 *
 * Surfaces fields derived deterministically from the block height (epoch,
 * halvings, halving-block flag, subsidy, issuance) plus the block's date —
 * the REAL mined time when the bundle carries timestamps (via `blockDate`),
 * falling back to a 10-minute estimate otherwise.
 */

// Compact BTC formatter for the issuance running-total. Uses comma
// thousands at >=1k, two decimals at fractional values, no fractional
// digits otherwise — keeps the panel scannable while preserving
// fractional precision around halving boundaries.
function formatBtc(n: number): string {
  if (n >= 1_000) return Math.round(n).toLocaleString();
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(2);
}

export function BlockStats() {
  const currentBlock = useTimegridStore((s) => s.currentBlock);
  const latestBlock = useTimegridStore((s) => s.latestBlock);

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

  return (
    <div className="brass-panel rounded-lg p-4">
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
            epoch {epoch} · {halvings} {halvings === 1 ? 'halving' : 'halvings'}
          </p>
          <dl className="mt-4 grid grid-cols-1 gap-3 text-mono text-xs">
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
