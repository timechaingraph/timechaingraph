'use client';

/**
 * liveTip — poll OUR same-origin /api/tip relay and feed the store.
 *
 * Privacy: the browser only ever talks to our own domain; the relay does the
 * third-party fetch server-side (see functions/api/tip.js). Poll cadence 30s
 * (the relay edge-caches ~30s, so polling faster buys nothing), paused while
 * the tab is hidden.
 *
 * IMPORTANT INVARIANT (operator bug-report 2026-06-13): the live tip is
 * DISPLAY-ONLY. It must never extend `latestBlock` or move `currentBlock` —
 * the scrubber, Block Stats, and playback are bounded by the DATA tip (the
 * deployed bundle's last block, seeded from the substrate), because the graph
 * has nothing to render past it. The gap between data tip and live tip is
 * surfaced explicitly in LiveTipPanel as "data through N · +M pending".
 */
import { useEffect } from 'react';
import { useTimegridStore } from '@/store/timegridStore';

export const TIP_POLL_MS = 30_000;

interface TipPayload {
  height: number | null;
  timestamp: number | null;
}

/**
 * Record a freshly polled tip. Pure + exported for tests. Deliberately does
 * NOTHING but `setLiveTip` — see the invariant above.
 */
export function applyTip(
  store: {
    setLiveTip(t: { height: number; timestamp: number | null }): void;
  },
  tip: TipPayload,
): void {
  if (!tip.height) return;
  store.setLiveTip({ height: tip.height, timestamp: tip.timestamp });
}

/** Mount-once hook (GraphCanvas): polls the relay and records each tip. */
export function useLiveTip(): void {
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      if (stopped) return;
      if (document.visibilityState === 'visible') {
        try {
          const r = await fetch('/api/tip', { cache: 'no-store' });
          if (r.ok) {
            const j = (await r.json()) as TipPayload;
            if (!stopped) applyTip(useTimegridStore.getState(), j);
          }
        } catch {
          // relay unreachable — keep the last known tip, retry next round
        }
      }
      if (!stopped) timer = setTimeout(poll, TIP_POLL_MS);
    }

    poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, []);
}
