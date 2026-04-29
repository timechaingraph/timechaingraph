'use client';

import { useTimegridStore } from '@/store/timegridStore';
import { epochFromHeight, isHalvingBlock } from '@/types/block';

/**
 * BlockStats — block-level metadata for whatever block the scrubber
 * sits on. Companion to <WalletInspector>: WalletInspector tells you
 * about a wallet, BlockStats tells you about a block. Both Grid and
 * Graph views can mount this; both write to the same `currentBlock`
 * slice in `useTimegridStore`.
 *
 * For v0.1 (no real adapter yet) this only surfaces fields that can
 * be derived deterministically from the block height: epoch number,
 * halvings crossed, halving-block flag, and an estimated wall-clock
 * date assuming the canonical 10-minute average block time. Once the
 * BitcoinChainAdapter ships, fields like miner / txCount / feeSats
 * fill in from the parquet shard.
 */

// Bitcoin's genesis block timestamp: 2009-01-03 18:15:05 UTC
const GENESIS_TIMESTAMP_MS = 1_231_006_505 * 1000;
const AVG_BLOCK_TIME_MS = 10 * 60 * 1000;

function estimateBlockDate(height: number): Date {
  return new Date(GENESIS_TIMESTAMP_MS + height * AVG_BLOCK_TIME_MS);
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function BlockStats() {
  const currentBlock = useTimegridStore((s) => s.currentBlock);
  const latestBlock = useTimegridStore((s) => s.latestBlock);

  const ready = latestBlock > 0;
  const epoch = epochFromHeight(currentBlock);
  const halvings = Math.floor(currentBlock / 210_000);
  const isHalving = isHalvingBlock(currentBlock);
  const estimatedDate = estimateBlockDate(currentBlock);

  return (
    <div className="brass-panel rounded-lg p-5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-brass-bright)]">
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
          <dl className="mt-4 grid grid-cols-2 gap-3 text-mono text-xs">
            <Field label="Estimated date" value={formatDate(estimatedDate)} />
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
