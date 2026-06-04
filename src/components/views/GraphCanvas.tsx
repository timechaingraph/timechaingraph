'use client';

/**
 * GraphCanvas — client loader for /graph.
 *
 * Loads the runtime ChainSubstrate (R2/DuckDB parquet by default, fixture
 * fallback) and seeds the scrubber range from its tipBlock, THEN dynamically
 * imports GraphView — so GraphView's module-level wallet/bond reads observe
 * the loaded data (load order = dependency injection; see src/data/substrate.ts).
 * Keeps the heavy PixiJS + DuckDB-Wasm graph out of SSR/prerender entirely.
 */
import { useEffect, useState, type ComponentType } from 'react';
import { loadSubstrate } from '@/data/substrate';
import { useTimegridStore } from '@/store/timegridStore';

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

  return (
    <div className="relative h-full w-full">
      {error ? (
        <div className="flex h-full w-full items-center justify-center px-6 text-center">
          <p className="text-mono text-sm text-[color:var(--color-amber)]">
            Couldn’t load chain data: {error}
          </p>
        </div>
      ) : !Graph ? (
        <div className="flex h-full w-full items-center justify-center px-6 text-center">
          <p className="text-mono text-sm uppercase tracking-[0.24em] text-[color:var(--color-brass-bright)]">
            Loading the living network…
          </p>
        </div>
      ) : (
        <Graph />
      )}
    </div>
  );
}
