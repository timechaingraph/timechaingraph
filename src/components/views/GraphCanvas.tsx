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
import { useLiveTip } from '@/data/liveTip';
import { useTimegridStore } from '@/store/timegridStore';
import { GraphPlayBar } from './GraphPlayBar';
import { WalletInspector } from '@/components/WalletInspector';
import { BlockStats } from '@/components/BlockStats';
import { WalletLegend } from '@/components/WalletLegend';
import { TopHubsChip } from '@/components/TopHubsChip';
import { MobileWalletSheet } from './MobileWalletSheet';

export function GraphCanvas() {
  const [Graph, setGraph] = useState<ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadStage, setLoadStage] = useState<string>('Loading the living network…');
  // Determinate percent during the wasm download+compile (the long silent step);
  // null for the fast discrete stages, which show an indeterminate pulse instead.
  const [loadPct, setLoadPct] = useState<number | null>(null);
  // Live chain-tip polling (same-origin relay) — extends the scrubber range
  // and drives the BlockStats live ticker as new blocks are mined.
  useLiveTip();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sub = await loadSubstrate((stage, pct) => {
          if (cancelled) return;
          setLoadStage(stage);
          setLoadPct(pct ?? null);
        });
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

  // Apply ?wallet= deep-link once the graph is ready (substrate must be loaded first).
  useEffect(() => {
    if (!Graph) return;
    try {
      const walletAddr = new URLSearchParams(window.location.search).get('wallet');
      if (walletAddr) useTimegridStore.getState().setSelectedWallet(walletAddr);
    } catch { /* SSR guard */ }
  }, [Graph]);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center px-6 text-center">
        <p className="text-mono text-sm text-[color:var(--color-amber)]">Couldn’t load chain data: {error}</p>
      </div>
    );
  }
  if (!Graph) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-mono text-sm uppercase tracking-[0.24em] text-[color:var(--color-brass-bright)]">
          {loadStage}
        </p>
        <div
          className="h-1 w-48 max-w-[70vw] overflow-hidden rounded-full bg-[color:var(--color-card-border)]"
          role="progressbar"
          aria-label="Loading progress"
          aria-valuenow={loadPct ?? undefined}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={
              loadPct === null
                ? 'h-full w-1/3 rounded-full bg-[color:var(--color-gold)] animate-pulse motion-reduce:animate-none'
                : 'h-full rounded-full bg-[color:var(--color-gold)] transition-[width] duration-300 ease-out'
            }
            style={loadPct === null ? undefined : { width: `${loadPct}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {/* The lattice — fills the area, beneath the overlays. */}
      <div className="absolute inset-0">
        <Graph />
      </div>

      {/* Top-left column — BlockStats + TopHubsChip, stacked (lg+). */}
      <div className="pointer-events-none absolute top-3 left-3 z-10 hidden w-[220px] max-w-[calc(100vw-1.5rem)] flex-col gap-3 lg:flex">
        <div className="pointer-events-auto">
          <BlockStats />
        </div>
        <div className="pointer-events-auto">
          <TopHubsChip />
        </div>
      </div>

      {/* Wallet legend — color key bottom-left, dismissible (lg+). */}
      <div className="pointer-events-none absolute bottom-16 left-3 z-10 hidden w-[220px] max-w-[calc(100vw-1.5rem)] lg:block">
        <div className="pointer-events-auto">
          <WalletLegend />
        </div>
      </div>

      {/* Mobile (<lg) legend — top-right (top-left holds the Reset chip). The
          lg+ legend above is hidden on phones, so without this the node colors
          are undecodable — the top comprehension-killer on shared-link traffic. */}
      <div className="pointer-events-none absolute top-3 right-3 z-10 w-[172px] max-w-[calc(100vw-1.5rem)] lg:hidden">
        <div className="pointer-events-auto">
          <WalletLegend />
        </div>
      </div>

      {/* Wallet inspector — appears when a wallet is selected (lg+). */}
      <div className="pointer-events-none absolute top-3 right-3 bottom-20 z-10 hidden w-[300px] max-w-[calc(100vw-1.5rem)] flex-col gap-3 overflow-y-auto pr-1 lg:flex">
        <div className="pointer-events-auto">
          <WalletInspector />
        </div>
      </div>

      {/* Mobile (<lg) tap-to-inspect bottom sheet — the lg+ inspector is hidden
          on phones, so a tap would otherwise select a wallet with nowhere to
          show it (a dead end). Self-subscribes; only mounts when one is picked. */}
      <MobileWalletSheet />

      {/* Bottom: scrubber + playback (block 0 → tip). The whole strip captures
          pointer events so hovering near the scrubber never reaches — and
          highlights — nodes on the canvas behind it. */}
      <div className="pointer-events-auto absolute right-0 bottom-3 left-0 z-10 flex justify-center px-3">
        <div className="w-full max-w-3xl">
          <GraphPlayBar />
        </div>
      </div>
    </div>
  );
}
