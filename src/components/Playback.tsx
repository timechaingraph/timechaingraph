'use client';

import { useEffect, useState } from 'react';
import { useTimegridStore } from '@/store/timegridStore';

/**
 * Playback — auto-advance the scrubber so the lattice plays itself.
 *
 * Hit play and `currentBlock` advances at the selected rate; the
 * web canvas's existing scrubber subscription wakes neurons, fires
 * synapses, fades out gone-dark wallets in lockstep. Watch the
 * Bitcoin brain develop from genesis to tip in seconds.
 *
 * Shared component — both Grid and Graph mount it alongside the
 * Scrubber. The brain plays the same way regardless of geometry.
 */

const SPEED_OPTIONS = [
  { label: 'Slow', blocksPerTick: 50 },
  { label: 'Normal', blocksPerTick: 500 },
  { label: 'Fast', blocksPerTick: 5000 },
  { label: 'Max', blocksPerTick: 50_000 },
] as const;

/** ~16fps tick rate; smooth without burning CPU. */
const TICK_INTERVAL_MS = 60;

export function Playback() {
  const currentBlock = useTimegridStore((s) => s.currentBlock);
  const latestBlock = useTimegridStore((s) => s.latestBlock);
  const setCurrentBlock = useTimegridStore((s) => s.setCurrentBlock);
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);
  const ready = latestBlock > 0;
  const atTip = ready && currentBlock >= latestBlock;

  useEffect(() => {
    if (!playing || !ready) return;
    const id = setInterval(() => {
      const cur = useTimegridStore.getState().currentBlock;
      const tip = useTimegridStore.getState().latestBlock;
      const blocksPerTick = SPEED_OPTIONS[speedIdx].blocksPerTick;
      const next = Math.min(cur + blocksPerTick, tip);
      setCurrentBlock(next);
      if (next >= tip) setPlaying(false);
    }, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [playing, speedIdx, ready, setCurrentBlock]);

  function togglePlay(): void {
    if (atTip) {
      // Rewind to genesis and play
      setCurrentBlock(0);
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  }

  const buttonLabel = !ready
    ? 'Awaiting data'
    : playing
      ? '⏸ Pause'
      : atTip
        ? '↺ Rewind'
        : '▶ Play';

  return (
    <div className="brass-panel flex flex-wrap items-center gap-3 rounded-lg p-3">
      <button
        type="button"
        onClick={togglePlay}
        disabled={!ready}
        aria-label={playing ? 'Pause playback' : 'Start playback'}
        className="text-mono rounded-md border border-[color:var(--color-card-border)] bg-[color:var(--color-background-light)] px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-[color:var(--color-text-primary)] transition-colors hover:border-[color:var(--color-amber)] hover:text-[color:var(--color-amber)] disabled:opacity-40"
      >
        {buttonLabel}
      </button>
      <div className="flex items-center gap-1" role="group" aria-label="Playback speed">
        {SPEED_OPTIONS.map((opt, i) => {
          const active = i === speedIdx;
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => setSpeedIdx(i)}
              disabled={!ready}
              aria-pressed={active}
              className={[
                'text-mono rounded-md px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] transition-colors',
                active
                  ? 'bg-[color:var(--color-amber)]/15 text-[color:var(--color-amber)]'
                  : 'text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-secondary)]',
                'disabled:opacity-40',
              ].join(' ')}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <span className="text-mono ml-auto text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
        {ready
          ? `block ${currentBlock.toLocaleString()} / ${latestBlock.toLocaleString()}`
          : 'no data'}
      </span>
    </div>
  );
}
