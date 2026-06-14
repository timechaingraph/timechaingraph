import type { Metadata } from 'next';
import { GraphCanvas } from '@/components/views/GraphCanvas';

export const metadata: Metadata = {
  title: 'Graph — the living network of Bitcoin',
  description:
    "Bitcoin's living network, rendered: every wallet a node, every transaction an edge, queried in your browser via self-hosted DuckDB-Wasm. No accounts, no tracking.",
};

/**
 * /graph — the live force-directed view.
 *
 * GraphCanvas (client) loads the runtime substrate — the R2/DuckDB parquet
 * bundle by default (NEXT_PUBLIC_USE_R2=0 forces the fixture) — then mounts
 * the PixiJS GraphView against real chain data. The page stays a server
 * component so it can export metadata; all the heavy client work is isolated
 * in GraphCanvas.
 */
export default function GraphHome() {
  return (
    <>
      {/* Screen-reader / crawler heading — the route is a full-viewport canvas
          kiosk with no visible heading, so expose one for a11y + SEO. */}
      <h1 className="sr-only">Timechain Graph — the living network of Bitcoin</h1>
      <GraphCanvas />
    </>
  );
}
