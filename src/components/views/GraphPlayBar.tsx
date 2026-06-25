'use client';

import { useEffect, useRef, useState } from 'react';
import { useTimegridStore } from '@/store/timegridStore';
import { SPEED_OPTIONS, blocksPerTick } from '@/components/Playback';
import { blockDate, formatBlockDate } from '@/lib/blockDate';

// Static facts per halving epoch (index = ordinal 1-based → use halvings[i]).
const HALVING_DATA = [
  {
    name: 'First Halving',
    subsidy: '50 → 25 BTC',
    cumulativeBTC: '10,500,000 BTC',
    note: "Bitcoin's first supply shock. The block reward dropped overnight.",
  },
  {
    name: 'Second Halving',
    subsidy: '25 → 12.5 BTC',
    cumulativeBTC: '15,750,000 BTC',
    note: 'Ethereum had launched the year before. ~75% of all BTC ever.',
  },
  {
    name: 'Third Halving',
    subsidy: '12.5 → 6.25 BTC',
    cumulativeBTC: '18,375,000 BTC',
    note: 'Mined during the COVID-19 pandemic. ~87.5% of all BTC ever.',
  },
  {
    name: 'Fourth Halving',
    subsidy: '6.25 → 3.125 BTC',
    cumulativeBTC: '19,687,500 BTC',
    note: 'Spot ETFs approved 3 months prior. ~93.75% of all BTC ever.',
  },
] as const;

/**
 * GraphPlayBar — graph-only compact playback control. A single-row
 * brass-panel containing Play/Pause toggle, speed pills, scrubber
 * slider, and block readout. Replaces the stacked <Scrubber>
 * + <Playback> brass-panels at the bottom of the kiosk page so
 * the canvas keeps as much vertical space as possible.
 *
 * Behavior is identical to the shared components: same store keys
 * (`currentBlock`, `latestBlock`, `playbackPlaying`,
 * `playbackSpeedIdx`), same `SPEED_OPTIONS` import, same auto-start
 * semantics. The shared `<Playback>` is still used by companion's
 * /grid kiosk; this slim variant is graph-only.
 */
export function GraphPlayBar() {
  const currentBlock = useTimegridStore((s) => s.currentBlock);
  const latestBlock = useTimegridStore((s) => s.latestBlock);
  const setCurrentBlock = useTimegridStore((s) => s.setCurrentBlock);
  const playing = useTimegridStore((s) => s.playbackPlaying);
  const setPlaying = useTimegridStore((s) => s.setPlaybackPlaying);
  const speedIdx = useTimegridStore((s) => s.playbackSpeedIdx);
  const setSpeedIdx = useTimegridStore((s) => s.setPlaybackSpeedIdx);
  // Index (0-based) of the halving whose card is currently open; null = closed.
  const [openHalvingIdx, setOpenHalvingIdx] = useState<number | null>(null);
  // Tour mode: auto-plays from genesis, pauses 3s at each halving with epoch card.
  const [tourMode, setTourMode] = useState(false);
  const tourNextIdxRef = useRef(0); // next halving index the tour will pause at
  const tourTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // First-visit nudge — localStorage-gated; dismissed on any click or after 8 s.
  const [tourNudge, setTourNudge] = useState<boolean>(() => {
    try { return !localStorage.getItem('tcg-tour-nudge-seen'); } catch { return false; }
  });
  function dismissNudge(): void {
    try { localStorage.setItem('tcg-tour-nudge-seen', '1'); } catch { /* ignore */ }
    setTourNudge(false);
  }

  function cancelTour(): void {
    if (tourTimerRef.current) clearTimeout(tourTimerRef.current);
    tourTimerRef.current = null;
    tourNextIdxRef.current = 0;
    setTourMode(false);
    setOpenHalvingIdx(null);
  }

  function startTour(): void {
    cancelTour();
    tourNextIdxRef.current = 0;
    setCurrentBlock(0);
    setSpeedIdx(SPEED_OPTIONS.length - 1); // Fast
    setOpenHalvingIdx(null);
    setPlaying(true);
    setTourMode(true);
  }

  const ready = latestBlock > 0;
  const atTip = ready && currentBlock >= latestBlock;
  const speed = SPEED_OPTIONS[speedIdx] ?? SPEED_OPTIONS[0];
  const { date: when, estimated: whenEstimated } = blockDate(currentBlock);
  // Halving blocks within the loaded range → amber markers on the scrub track.
  const halvings: number[] = [];
  for (let h = 210_000; h <= latestBlock; h += 210_000) halvings.push(h);

  // Tick loop: same logic as Playback. Re-creates whenever play
  // state, speed, or readiness changes. Cleanup clears the prior
  // interval so changing speed mid-play never doubles up timers.
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

  // Tour waypoint monitor — fires on each currentBlock update during a tour.
  // When we reach (or pass) the next halving, pause, open its epoch card,
  // wait 3 s, close the card, advance the tour index, and resume.
  useEffect(() => {
    if (!tourMode) return;
    const nextH = halvings[tourNextIdxRef.current];
    if (nextH === undefined) {
      // Past all halvings — let natural playback finish, then cancel tour.
      // Deferred to avoid synchronous setState inside effect body.
      if (atTip) setTimeout(() => cancelTour(), 0);
      return;
    }
    if (currentBlock < nextH) return; // not there yet

    // Arrived at a halving block.
    setPlaying(false);
    setOpenHalvingIdx(tourNextIdxRef.current);
    tourTimerRef.current = setTimeout(() => {
      setOpenHalvingIdx(null);
      tourNextIdxRef.current += 1;
      setPlaying(true);
    }, 3000);

    return () => {
      if (tourTimerRef.current) clearTimeout(tourTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBlock, tourMode]);

  // Cancel tour when GraphView's Escape handler fires the 'tour:cancel' event.
  // cancelTour only closes over stable refs + setState — empty deps is correct.
  useEffect(() => {
    const handler = () => cancelTour();
    window.addEventListener('tour:cancel', handler);
    return () => window.removeEventListener('tour:cancel', handler);
  }, []);

  // Auto-dismiss the first-visit tour nudge after 8 s or on any document click.
  useEffect(() => {
    if (!tourNudge) return;
    const id = setTimeout(() => dismissNudge(), 8000);
    const onAnyClick = () => dismissNudge();
    document.addEventListener('click', onAnyClick, { once: true });
    return () => {
      clearTimeout(id);
      document.removeEventListener('click', onAnyClick);
    };
  }, [tourNudge]);

  function togglePlay(): void {
    if (tourMode) { cancelTour(); return; }
    if (atTip) {
      setCurrentBlock(0);
      setPlaying(true);
      return;
    }
    setPlaying(!playing);
  }

  const buttonGlyph = !ready ? '○' : playing ? '⏸' : atTip ? '↺' : '▶';

  return (
    <div
      className="brass-panel flex items-center gap-3 rounded-full px-3 py-1.5 text-mono"
      style={{
        backgroundColor: 'rgba(8, 8, 12, 0.78)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      aria-disabled={!ready}
    >
      {/* Play / Pause / Rewind — ⎵ Space hint fades in on hover */}
      <div className="group relative shrink-0">
        <button
          type="button"
          onClick={togglePlay}
          disabled={!ready}
          aria-label={playing ? 'Pause playback' : 'Start playback'}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--color-card-border)] text-xs text-[color:var(--color-text-primary)] transition-colors hover:border-[color:var(--color-amber)] hover:text-[color:var(--color-amber)] disabled:opacity-40"
        >
          {buttonGlyph}
        </button>
        <kbd
          className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded px-1 py-px font-sans text-[7px] leading-none text-[color:var(--color-text-faint)] opacity-0 transition-opacity group-hover:opacity-100"
          style={{ border: '1px solid rgba(255,255,255,0.10)' }}
        >
          ⎵
        </kbd>
      </div>

      {/* Speed pills — tighter than full Playback panel */}
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
                'rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] transition-colors',
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

      {/* Tour button — starts/cancels the guided Bitcoin history experience */}
      {ready && (
        <div className="relative shrink-0">
          {/* First-visit nudge — pulsing amber arrow, auto-dismissed after 8 s */}
          {tourNudge && !tourMode && (
            <div className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap">
              <span className="animate-pulse text-[9px] uppercase tracking-[0.12em] text-[color:var(--color-amber)]">
                ↑ tour
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={tourMode ? cancelTour : startTour}
            aria-label={tourMode ? 'Cancel tour' : 'Start guided Bitcoin history tour'}
            title={tourMode ? 'Cancel tour' : 'Guided tour: auto-plays through all 4 halvings'}
            className={[
              'text-mono rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] transition-colors',
              tourMode
                ? 'bg-[color:var(--color-amber)]/20 text-[color:var(--color-amber)] hover:bg-[color:var(--color-amber)]/30'
                : 'text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-secondary)]',
            ].join(' ')}
          >
            {tourMode ? '✕ Tour' : 'Tour'}
          </button>
        </div>
      )}

      {/* Scrubber — flexes to fill remaining space; halving ticks behind it */}
      <div className="relative min-w-0 flex-1">
        {ready && halvings.length > 0 && (
          // Halving quick-jumps. The container ignores pointer events so the
          // slider stays draggable everywhere; only the 4 narrow markers
          // capture clicks (jump the scrubber to that halving block + pause).
          // A drag begun on the thumb keeps pointer capture, so dragging
          // straight through a marker still works.
          <div className="pointer-events-none absolute inset-0 z-10">
            {halvings.map((h, i) => {
              const { date } = blockDate(h);
              const isOpen = openHalvingIdx === i;
              const data = HALVING_DATA[i];
              const pct = (h / latestBlock) * 100;
              return (
                <div
                  key={h}
                  className="absolute top-0 bottom-0 w-2.5 -translate-x-1/2"
                  style={{ left: `${pct}%` }}
                >
                  {/* Tick marker + click target */}
                  <button
                    type="button"
                    onClick={() => {
                      setPlaying(false);
                      setCurrentBlock(h);
                      setOpenHalvingIdx(isOpen ? null : i);
                    }}
                    title={`${data?.name ?? `Halving ${i + 1}`} · block ${h.toLocaleString()} · ${formatBlockDate(date)}`}
                    aria-label={`Jump to halving ${i + 1}, block ${h.toLocaleString()}`}
                    aria-expanded={isOpen}
                    className="group pointer-events-auto absolute top-0 bottom-0 w-2.5 -translate-x-1/2 cursor-pointer"
                  >
                    <span
                      className={[
                        'absolute left-1/2 top-1/2 w-px -translate-x-1/2 -translate-y-1/2 transition-all',
                        isOpen
                          ? 'h-4 bg-[color:var(--color-amber)]'
                          : 'h-2.5 bg-[color:var(--color-amber)]/70 group-hover:h-4 group-hover:bg-[color:var(--color-amber)]',
                      ].join(' ')}
                    />
                  </button>

                  {/* Epoch card — floats above the scrubber row */}
                  {isOpen && data && (
                    <div
                      className="brass-panel pointer-events-auto absolute bottom-full mb-3 w-52 rounded-lg px-3.5 py-3 text-left"
                      style={{
                        // Keep the card inside the scrubber's visible width.
                        // Cards near edges shift left/right to avoid clipping.
                        left: pct < 25 ? '0' : pct > 75 ? 'auto' : '-50%',
                        right: pct > 75 ? '0' : 'auto',
                      }}
                    >
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-amber)]">
                        {data.name}
                      </div>
                      <div className="space-y-1 text-mono text-[10px]">
                        <div className="text-[color:var(--color-text-secondary)]">
                          Block {h.toLocaleString()} · {formatBlockDate(date)}
                        </div>
                        <div className="text-[color:var(--color-text-primary)]">
                          {data.subsidy} per block
                        </div>
                        <div className="text-[color:var(--color-text-secondary)]">
                          {data.cumulativeBTC} mined
                        </div>
                        <div className="mt-1.5 border-t border-[color:var(--color-card-border)] pt-1.5 text-[9px] leading-snug text-[color:var(--color-text-muted)]">
                          {data.note}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <input
          type="range"
          min={0}
          max={Math.max(latestBlock, 1)}
          value={currentBlock}
          step={1}
          disabled={!ready}
          onChange={(e) => {
            // Manual scrub pauses auto-play and cancels tour.
            if (tourMode) cancelTour();
            setPlaying(false);
            setCurrentBlock(Number(e.target.value));
          }}
          className="w-full accent-[color:var(--color-amber)] disabled:opacity-30"
          aria-label={`Block scrubber. Current block: ${currentBlock.toLocaleString()} of ${latestBlock.toLocaleString()}`}
        />
      </div>

      {/* Block + date readout (real mined date, ~ prefix = estimate) */}
      <span className="flex shrink-0 flex-col items-end leading-tight">
        <span className="text-[10px] tabular-nums">
          {ready ? (
            <>
              <span className="text-[color:var(--color-text-primary)]">
                {currentBlock.toLocaleString()}
              </span>
              <span className="text-[color:var(--color-text-faint)]">
                {' / '}
                {latestBlock.toLocaleString()}
              </span>
            </>
          ) : (
            '—'
          )}
        </span>
        {ready && (
          <span
            className="text-[9px] tabular-nums text-[color:var(--color-text-muted)]"
            title={whenEstimated ? 'estimated (10-min average)' : 'real mined time'}
          >
            {whenEstimated ? '~' : ''}
            {formatBlockDate(when)}
          </span>
        )}
      </span>
    </div>
  );
}
