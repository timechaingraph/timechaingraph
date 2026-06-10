'use client';

import { useEffect } from 'react';
import { useTimegridStore } from '@/store/timegridStore';

/**
 * Playback — auto-advance the scrubber so the lattice plays itself.
 *
 * "Narrate" is a single-block study pace (1 block / 3s — read each block as a
 * stanza). The rest TRAVERSE the whole chain (block 0 → tip) in a fixed
 * wall-clock budget, independent of chain length — `blocksPerTick` is derived
 * from the live tip:
 *   Slow 24 min · Normal 12 min · Fast 6 min · Max 3 min.
 * Both sister views (Graph + Grid) import this same SPEED_OPTIONS, so their
 * playback speeds stay identical.
 *
 * Play state + speed index live in the store (`playbackPlaying`,
 * `playbackSpeedIdx`), so any interaction that should pause playback (Scrubber
 * drag, halving-jump) can call `setPlaybackPlaying(false)` without coupling here.
 */

export interface PlaybackSpeed {
  label: string;
  /**
   * Wall-clock seconds to traverse the WHOLE chain (block 0 → tip) at this
   * speed; `null` is the fixed single-block "Narrate" study pace. The per-tick
   * step is derived from the live tip (see `blocksPerTick`) so the traversal
   * lands on its target duration at any chain length.
   */
  fullScrubSeconds: number | null;
  tickIntervalMs: number;
}

export const SPEED_OPTIONS: readonly PlaybackSpeed[] = [
  { label: 'Narrate', fullScrubSeconds: null, tickIntervalMs: 3000 }, // 1 block / 3s
  { label: 'Slow', fullScrubSeconds: 1440, tickIntervalMs: 100 }, // 24 min full chain
  { label: 'Normal', fullScrubSeconds: 720, tickIntervalMs: 100 }, // 12 min full chain
  { label: 'Fast', fullScrubSeconds: 360, tickIntervalMs: 100 }, //  6 min full chain
  { label: 'Max', fullScrubSeconds: 180, tickIntervalMs: 100 }, //  3 min full chain
] as const;

/** Auto-start speed: Max — the full chain plays out in ~3 min, the showcase pace. */
export const AUTOSTART_SPEED_IDX = SPEED_OPTIONS.length - 1;

/**
 * Blocks to advance per tick for `speed` at the current `tip`, chosen so a
 * full-chain traversal hits its target wall-clock duration regardless of how
 * long the chain is (tip grows → bigger step, same minutes).
 */
export function blocksPerTick(speed: PlaybackSpeed, tip: number): number {
  if (speed.fullScrubSeconds == null) return 1;
  const ticks = (speed.fullScrubSeconds * 1000) / speed.tickIntervalMs;
  return Math.max(1, Math.round(tip / ticks));
}

interface PlaybackProps {
  /**
   * If true, automatically begins playback from block 0 at the showcase speed
   * once the lattice has data — first-time visitors land at genesis and watch
   * the map build unprompted (unless they grab the scrubber).
   */
  autoStart?: boolean;
}

export function Playback({ autoStart = false }: PlaybackProps) {
  const currentBlock = useTimegridStore((s) => s.currentBlock);
  const latestBlock = useTimegridStore((s) => s.latestBlock);
  const setCurrentBlock = useTimegridStore((s) => s.setCurrentBlock);
  const playing = useTimegridStore((s) => s.playbackPlaying);
  const setPlaying = useTimegridStore((s) => s.setPlaybackPlaying);
  const speedIdx = useTimegridStore((s) => s.playbackSpeedIdx);
  const setSpeedIdx = useTimegridStore((s) => s.setPlaybackSpeedIdx);

  const ready = latestBlock > 0;
  const atTip = ready && currentBlock >= latestBlock;
  const speed = SPEED_OPTIONS[speedIdx] ?? SPEED_OPTIONS[0];

  // Auto-start: when the lattice first has data and the scrubber hasn't been
  // touched, rewind to genesis and play at the showcase speed.
  useEffect(() => {
    if (!autoStart || !ready) return;
    const cur = useTimegridStore.getState().currentBlock;
    const tip = useTimegridStore.getState().latestBlock;
    if (cur === tip && !useTimegridStore.getState().playbackPlaying) {
      useTimegridStore.getState().setCurrentBlock(0);
      useTimegridStore.getState().setPlaybackSpeedIdx(AUTOSTART_SPEED_IDX);
      useTimegridStore.getState().setPlaybackPlaying(true);
    }
  }, [autoStart, ready]);

  // Tick loop. Re-creates whenever play state, speed, or readiness changes — the
  // cleanup clears the old interval before the new one starts, so changing speed
  // mid-play never doubles up timers.
  useEffect(() => {
    if (!playing || !ready) return;
    const id = setInterval(() => {
      const cur = useTimegridStore.getState().currentBlock;
      const tip = useTimegridStore.getState().latestBlock;
      const next = Math.min(cur + blocksPerTick(speed, tip), tip);
      setCurrentBlock(next);
      if (next >= tip) {
        useTimegridStore.getState().setPlaybackPlaying(false);
      }
    }, speed.tickIntervalMs);
    return () => clearInterval(id);
  }, [playing, speed, ready, setCurrentBlock]);

  function togglePlay(): void {
    if (atTip) {
      // Rewind to genesis and play.
      setCurrentBlock(0);
      setPlaying(true);
      return;
    }
    setPlaying(!playing);
  }

  const buttonLabel = !ready
    ? 'Awaiting data'
    : playing
      ? '⏸ Pause'
      : atTip
        ? '↺ Rewind'
        : '▶ Play';

  return (
    <div className="flex items-center gap-1.5 px-2">
      <button
        type="button"
        onClick={togglePlay}
        disabled={!ready}
        aria-label={playing ? 'Pause playback' : 'Start playback'}
        className="text-mono shrink-0 rounded-md border border-[color:var(--color-card-border)] bg-[color:var(--color-background-light)] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[color:var(--color-text-primary)] transition-colors hover:border-[color:var(--color-amber)] hover:text-[color:var(--color-amber)] disabled:opacity-40"
      >
        {buttonLabel}
      </button>
      <div
        className="flex items-center gap-0.5"
        role="group"
        aria-label="Playback speed"
      >
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
                'text-mono rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] transition-colors',
                active
                  ? 'bg-[color:var(--color-amber)]/20 text-[color:var(--color-amber)]'
                  : 'text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-secondary)]',
                'disabled:opacity-40',
              ].join(' ')}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
