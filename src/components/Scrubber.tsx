'use client';

import { useTimegridStore } from '@/store/timegridStore';
import { epochFromHeight } from '@/types/block';

/**
 * Scrubber — full-range block slider. Shared component; both Grid and
 * Graph views can mount it beside their canvas.
 *
 * Drives `useTimegridStore.currentBlock` directly. Disabled until
 * `latestBlock > 0` (the adapter or a view's seed function fills it).
 *
 * Visual: brass-panel; range input styled with Tailwind's accent-color
 * utility so the thumb matches the project's amber. Below the slider
 * shows current block, halving epoch, and the genesis/latest endpoints
 * as text waypoints.
 */
export function Scrubber() {
  const currentBlock = useTimegridStore((s) => s.currentBlock);
  const latestBlock = useTimegridStore((s) => s.latestBlock);
  const setCurrentBlock = useTimegridStore((s) => s.setCurrentBlock);

  const ready = latestBlock > 0;
  const epoch = epochFromHeight(currentBlock);
  const halvingsCrossed = Math.floor(currentBlock / 210_000);

  return (
    <div className="brass-panel rounded-lg p-5" aria-disabled={!ready}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <span className="text-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-brass-bright)]">
          Block scrubber
        </span>
        <span className="text-mono text-xs text-[color:var(--color-text-muted)]">
          {ready ? (
            <>
              block{' '}
              <span className="text-[color:var(--color-text-primary)]">
                {currentBlock.toLocaleString()}
              </span>
              {' '}· epoch {epoch} · {halvingsCrossed}{' '}
              {halvingsCrossed === 1 ? 'halving' : 'halvings'} crossed
            </>
          ) : (
            'awaiting data…'
          )}
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={Math.max(latestBlock, 1)}
        value={currentBlock}
        step={1}
        disabled={!ready}
        onChange={(e) => setCurrentBlock(Number(e.target.value))}
        className="w-full accent-[color:var(--color-amber)] disabled:opacity-30"
        aria-label={`Block scrubber. Current block: ${currentBlock.toLocaleString()} of ${latestBlock.toLocaleString()}`}
      />

      <div className="mt-2 flex justify-between text-mono text-[10px] text-[color:var(--color-text-faint)]">
        <span>genesis · 2009</span>
        <span>{ready ? `tip · ${latestBlock.toLocaleString()}` : '—'}</span>
      </div>
    </div>
  );
}
