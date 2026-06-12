'use client';

/**
 * liveTip — poll OUR same-origin /api/tip relay and feed the store.
 *
 * Privacy: the browser only ever talks to our own domain; the relay does the
 * third-party fetch server-side (see functions/api/tip.js). Poll cadence 30s
 * (the relay edge-caches ~30s, so polling faster buys nothing), paused while
 * the tab is hidden.
 */
import { useEffect } from 'react';
import { useTimegridStore } from '@/store/timegridStore';

export const TIP_POLL_MS = 30_000;

interface TipPayload {
  height: number | null;
  timestamp: number | null;
}

/**
 * Apply a freshly polled tip to the store. Pure decision logic, exported for
 * tests:
 *  - latestBlock only ever EXTENDS (a lagging upstream never shrinks the range)
 *  - if the viewer is parked at the old tip and NOT mid-playback, follow the
 *    chain head so "now" stays now; a mid-history scrub or a running playback
 *    is never yanked.
 */
export function applyTip(
  store: {
    latestBlock: number;
    currentBlock: number;
    playbackPlaying: boolean;
    setLatestBlock(h: number): void;
    setCurrentBlock(h: number): void;
    setLiveTip(t: { height: number; timestamp: number | null }): void;
  },
  tip: TipPayload,
): void {
  if (!tip.height) return;
  store.setLiveTip({ height: tip.height, timestamp: tip.timestamp });
  if (tip.height > store.latestBlock) {
    const wasAtTip = store.currentBlock >= store.latestBlock;
    store.setLatestBlock(tip.height);
    if (wasAtTip && !store.playbackPlaying) store.setCurrentBlock(tip.height);
  }
}

/** Mount-once hook (GraphCanvas): polls the relay and applies each tip. */
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
