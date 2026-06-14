'use client';

import { useEffect, useState } from 'react';
import { useTimegridStore } from '@/store/timegridStore';
import { getActiveSubstrate } from '@/data/substrate';

/**
 * LiveTipPanel — the bottom-right chain-tail HUD on /graph.
 *
 * Shows the LIVE tip (from the same-origin /api/tip relay via useLiveTip),
 * a since-last-block stopwatch, the ~10-minute next-block countdown, a
 * data-freshness note when the tip outruns the bundle — and, docked at the
 * panel's bottom, the CURRENT BLOCK readout (the scrubber position) that
 * used to float alone in this corner.
 */

const TARGET_BLOCK_SECONDS = 600;

function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function LiveTipPanel() {
  const currentBlock = useTimegridStore((s) => s.currentBlock);
  const liveTip = useTimegridStore((s) => s.liveTip);

  // 1-second heartbeat for the stopwatch/countdown while a timestamp exists.
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    if (!liveTip?.timestamp) return;
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, [liveTip?.timestamp]);

  const sinceLast = liveTip?.timestamp ? Math.max(0, nowSec - liveTip.timestamp) : null;
  const toNext = sinceLast !== null ? TARGET_BLOCK_SECONDS - sinceLast : null;
  const bundleTip = getActiveSubstrate().tipBlock;
  const blocksPastBundle = liveTip ? Math.max(0, liveTip.height - bundleTip) : 0;

  return (
    <div
      aria-hidden
      className="text-mono pointer-events-none absolute bottom-28 right-3 z-10 w-[210px] max-w-[calc(100vw-1.5rem)] rounded-md border border-[color:var(--color-card-border)] bg-[color:var(--color-background)]/85 px-3 py-2 text-[10px] uppercase tracking-[0.18em] backdrop-blur-sm sm:bottom-3"
    >
      {liveTip ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[color:var(--color-text-muted)]">
              <span
                className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
                style={{ background: 'var(--color-gold)' }}
              />
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
            <div className="mt-1 flex items-center justify-between gap-2 tabular-nums text-[color:var(--color-text-secondary)]">
              <span>last {mmss(sinceLast)} ago</span>
              <span className="text-[color:var(--color-amber)]">
                {toNext !== null && toNext > 0 ? `next ~${mmss(toNext)}` : 'any moment'}
              </span>
            </div>
          )}
          {blocksPastBundle > 0 && (
            <div className="mt-1 text-[9px] tracking-[0.14em] text-[color:var(--color-text-faint)]">
              data through {bundleTip.toLocaleString()} · +{blocksPastBundle.toLocaleString()} pending
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center gap-1.5 text-[color:var(--color-text-muted)]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--color-text-faint)]" />
          Live tip — connecting…
        </div>
      )}

      {/* CURRENT BLOCK — the scrubber position, docked at the panel bottom. */}
      <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-[color:var(--color-card-border)] pt-1.5">
        <span className="text-[color:var(--color-amber)]">Current block</span>
        <span className="tabular-nums text-[color:var(--color-text-primary)]">
          {currentBlock.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
