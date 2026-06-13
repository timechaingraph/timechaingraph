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
      className="flex items-center gap-2 px-2 sm:gap-3"
      aria-disabled={!ready}
      role="group"
      aria-label="Block scrubber"
    >
      <span className="text-mono w-14 shrink-0 text-right text-xs tabular-nums text-[color:var(--color-text-primary)] sm:w-12 sm:text-[10px]">
        {ready ? currentBlock.toLocaleString() : '—'}
      </span>
      {/* h-8 on mobile gives a 32px touch target while keeping the visual
          track thin (browser centres the 4px track within the taller element).
          sm:h-1 restores the slim desktop appearance. */}
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
        className="h-8 w-full cursor-pointer touch-none accent-[color:var(--color-amber)] disabled:opacity-30 sm:h-1"
        aria-label={`Block ${currentBlock.toLocaleString()} of ${latestBlock.toLocaleString()}`}
      />
      <span className="text-mono w-14 shrink-0 text-xs tabular-nums text-[color:var(--color-text-muted)] sm:w-12 sm:text-[10px]">
        {ready ? latestBlock.toLocaleString() : '—'}
      </span>
    </div>
  );
}
