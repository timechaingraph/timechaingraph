'use client';

/**
 * GraphCanvas — client loader + chrome for /graph.
 *
 * Loads the runtime ChainSubstrate (R2/DuckDB parquet by default, fixture
 * fallback) and seeds the scrubber range from its tipBlock, THEN dynamically
 * imports GraphView — so GraphView's module-level wallet/bond reads observe
 * the loaded data (load order = dependency injection; see src/data/substrate.ts).
 * Keeps the heavy PixiJS + DuckDB-Wasm graph out of SSR/prerender. Once the
 * canvas is ready it mounts the scrubber (GraphPlayBar) + the wallet inspector
 * as non-blocking overlays — the same chrome the kiosk page used pre-placeholder.
 */
import { useEffect, useState, type ComponentType } from 'react';
import { loadSubstrate } from '@/data/substrate';
import { useTimegridStore } from '@/store/timegridStore';
import { GraphPlayBar } from './GraphPlayBar';
import { WalletInspector } from '@/components/WalletInspector';

export function GraphCanvas() {
  const [Graph, setGraph] = useState<ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sub = await loadSubstrate();
        const store = useTimegridStore.getState();
        store.setLatestBlock(sub.tipBlock);
        store.setCurrentBlock(sub.tipBlock); // open at the tip — full network visible
        const mod = await import('./GraphView');
        if (!cancelled) setGraph(() => mod.GraphView);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center px-6 text-center">
        <p className="text-mono text-sm text-[color:var(--color-amber)]">Couldn’t load chain data: {error}</p>
      </div>
    );
  }
  if (!Graph) {
    return (
      <div className="flex h-full w-full items-center justify-center px-6 text-center">
        <p className="text-mono text-sm uppercase tracking-[0.24em] text-[color:var(--color-brass-bright)]">
          Loading the living network…
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {/* The lattice — fills the area, beneath the overlays. */}
      <div className="absolute inset-0">
        <Graph />
      </div>

      {/* Wallet inspector — appears when a wallet is selected (lg+). */}
      <div className="pointer-events-none absolute top-3 right-3 bottom-20 z-10 hidden w-[300px] max-w-[calc(100vw-1.5rem)] flex-col gap-3 overflow-y-auto pr-1 lg:flex">
        <div className="pointer-events-auto">
          <WalletInspector />
        </div>
      </div>

      {/* Bottom: scrubber + playback (block 0 → tip). */}
      <div className="pointer-events-none absolute right-0 bottom-3 left-0 z-10 flex justify-center px-3">
        <div className="pointer-events-auto w-full max-w-3xl">
          <GraphPlayBar />
        </div>
      </div>
    </div>
  );
}
