'use client';

import { useEffect } from 'react';
import { useTimegridStore } from '@/store/timegridStore';

/**
 * Playback — auto-advance the scrubber so the lattice plays itself.
 *
 * Speeds run from "Narrate" (1 block per 10 seconds — the cinematic,
 * left-idle-and-watch pace) to "Max" (50,000 blocks per tick — full
 * fast-forward to the chain tip in a few seconds). Each speed
 * declares its own setInterval delay; Narrate uses a slow
 * 10s-per-block timer while the faster speeds fire at ~16 fps.
 *
 * Play state + speed index live in the store (`playbackPlaying`,
 * `playbackSpeedIdx`), so any interaction that should pause the
 * playback (Scrubber drag, canvas pan, halving-timeline jump) can
 * just call `setPlaybackPlaying(false)` without coupling to this
 * component.
 *
 * The `autoStart` prop, set on /grid mount, kicks playback off at
 * Narrate speed from block 0 the first time the lattice has data —
 * the visitor is dropped at genesis and watches the map grow unless
 * they reach for the scrubber.
 */

export interface PlaybackSpeed {
  label: string;
  blocksPerTick: number;
  tickIntervalMs: number;
}

export const SPEED_OPTIONS: readonly PlaybackSpeed[] = [
  // Narrate — the storytelling pace. Read each block as a stanza.
  // 10 seconds per block lets the user follow the territory expanding
  // around Satoshi without feeling rushed. This is the default.
  { label: 'Narrate', blocksPerTick: 1, tickIntervalMs: 10_000 },
  // Slow / Normal / Fast / Max — block-by-block at a steady human-
  // readable cadence. All four advance ONE block per tick so the
  // empire-border + block-narrative card update on every step;
  // they only differ in the tick interval. Per user directive
  // 2026-04-30: Slow=1bps, Normal=2bps, Fast=3bps, Max=10bps.
  { label: 'Slow', blocksPerTick: 1, tickIntervalMs: 1000 },
  { label: 'Normal', blocksPerTick: 1, tickIntervalMs: 500 },
  { label: 'Fast', blocksPerTick: 1, tickIntervalMs: 333 },
  { label: 'Max', blocksPerTick: 1, tickIntervalMs: 100 },
] as const;

interface PlaybackProps {
  /**
   * If true, automatically begins narrate-speed playback from block 0
   * once the lattice has data. Mounted on /grid so first-time visitors
   * land at genesis and watch the map grow unprompted.
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

  // Auto-start: when the lattice first has data and the scrubber has
  // not been touched, rewind to genesis and begin narrate-speed
  // playback. Runs once per mount via the autoStartFired guard.
  useEffect(() => {
    if (!autoStart || !ready) return;
    const cur = useTimegridStore.getState().currentBlock;
    const tip = useTimegridStore.getState().latestBlock;
    // Only auto-start if the scrubber is at the tip (the canvas seed
    // value) — that signals "user hasn't grabbed it yet". If the user
    // has scrubbed mid-range, leave them be.
    if (cur === tip && !useTimegridStore.getState().playbackPlaying) {
      useTimegridStore.getState().setCurrentBlock(0);
      useTimegridStore.getState().setPlaybackSpeedIdx(0);
      useTimegridStore.getState().setPlaybackPlaying(true);
    }
  }, [autoStart, ready]);

  // Tick loop. Re-creates whenever play state, speed, or readiness
  // changes — the cleanup clears the old interval before the new one
  // starts, so changing speed mid-play never doubles up timers.
  useEffect(() => {
    if (!playing || !ready) return;
    const id = setInterval(() => {
      const cur = useTimegridStore.getState().currentBlock;
      const tip = useTimegridStore.getState().latestBlock;
      const next = Math.min(cur + speed.blocksPerTick, tip);
      setCurrentBlock(next);
      if (next >= tip) {
        useTimegridStore.getState().setPlaybackPlaying(false);
      }
    }, speed.tickIntervalMs);
    return () => clearInterval(id);
  }, [playing, speed.blocksPerTick, speed.tickIntervalMs, ready, setCurrentBlock]);

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
