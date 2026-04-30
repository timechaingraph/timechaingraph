'use client';

import { useTimegridStore } from '@/store/timegridStore';

/**
 * Scrubber — minimal block slider, single thin row. Compact enough
 * to live alongside Playback in a tight bottom HUD strip without
 * stealing canvas real estate.
 *
 * Layout:
 *   [block N] [=======◯=================] [tip M]
 *
 * Manual drag pauses auto-playback. Disabled state collapses the
 * label area.
 */
export function Scrubber() {
  const currentBlock = useTimegridStore((s) => s.currentBlock);
  const latestBlock = useTimegridStore((s) => s.latestBlock);
  const setCurrentBlock = useTimegridStore((s) => s.setCurrentBlock);
  const setPlaybackPlaying = useTimegridStore((s) => s.setPlaybackPlaying);

  const ready = latestBlock > 0;

  return (
    <div
      className="flex items-center gap-3 px-2"
      aria-disabled={!ready}
      role="group"
      aria-label="Block scrubber"
    >
      <span className="text-mono w-12 shrink-0 text-right text-[10px] tabular-nums text-[color:var(--color-text-primary)]">
        {ready ? currentBlock.toLocaleString() : '—'}
      </span>
      <input
        type="range"
        min={0}
        max={Math.max(latestBlock, 1)}
        value={currentBlock}
        step={1}
        disabled={!ready}
        onChange={(e) => {
          setPlaybackPlaying(false);
          setCurrentBlock(Number(e.target.value));
        }}
        className="h-1 w-full accent-[color:var(--color-amber)] disabled:opacity-30"
        aria-label={`Block ${currentBlock.toLocaleString()} of ${latestBlock.toLocaleString()}`}
      />
      <span className="text-mono w-12 shrink-0 text-[10px] tabular-nums text-[color:var(--color-text-muted)]">
        {ready ? latestBlock.toLocaleString() : '—'}
      </span>
    </div>
  );
}
