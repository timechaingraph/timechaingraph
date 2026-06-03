import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Graph view — under development',
  description:
    "Bitcoin's living network. Every wallet a node, every transaction an edge. The graph view is under development; data ingestion is in progress.",
};

/**
 * /graph — v0.0.1 placeholder.
 *
 * The full PixiJS force-directed renderer (GraphView component +
 * sidebars + scrubber + wallet inspector) lives at
 * `src/components/views/GraphView.tsx` and is wired up correctly.
 * It is intentionally NOT rendered here while real-chain ingestion
 * is in progress, because shipping the canvas without real block
 * snapshots would show synthetic / misleading data.
 *
 * Once the operator's bitcoind + electrs stack is synced and the
 * snapshot generator has emitted per-block JSON sidecars under
 * `public/blocks/`, swap the placeholder below for the actual
 * `<GraphView />`.
 */
export default function GraphHome() {
  return (
    <div className="flex h-full w-full items-center justify-center px-6">
      <section className="brass-panel max-w-2xl rounded-xl p-10 text-center md:p-14">
        <p className="text-mono text-xs uppercase tracking-[0.32em] text-[color:var(--color-accent-cyan)]">
          Under development
        </p>
        <h1 className="text-display mt-4 text-3xl font-semibold leading-[1.1] md:text-5xl">
          The graph is{' '}
          <span className="brass-shimmer">being built.</span>
        </h1>
        <div className="mt-7 space-y-5 text-left text-base leading-relaxed text-[color:var(--color-text-secondary)] md:text-lg">
          <p>
            The force-directed canvas is code-complete: PixiJS renderer,
            Velocity-Verlet physics, drag-to-pin, cursor-anchored zoom,
            playback scrubber, kiosk HUD. What it currently lacks is
            data — the operator&apos;s full-node sync and snapshot
            ingestion are in progress.
          </p>
          <p>
            We will not ship the canvas with synthetic data masquerading
            as real chain history. When the first real block snapshots
            land, this placeholder is gone and the lattice goes live.
          </p>
          <p className="text-[color:var(--color-text-muted)]">
            Follow progress on the{' '}
            <Link
              href="/status"
              className="text-[color:var(--color-gold)] underline-offset-4 hover:underline"
            >
              status page
            </Link>
            , or read more about the project on{' '}
            <Link
              href="/about"
              className="text-[color:var(--color-gold)] underline-offset-4 hover:underline"
            >
              about
            </Link>
            .
          </p>
        </div>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="brass-panel rounded-full px-6 py-3 text-mono text-sm uppercase tracking-[0.18em] transition-colors hover:border-[color:var(--color-amber)]"
            style={{ color: 'var(--color-gold)' }}
          >
            ⟵ Back home
          </Link>
          <a
            href="https://timechaingrid.com"
            className="rounded-full border border-[color:var(--color-card-border)] px-6 py-3 text-mono text-sm uppercase tracking-[0.18em] text-[color:var(--color-accent-cyan)] transition-colors hover:border-[color:var(--color-accent-cyan)]"
          >
            Try the Grid ⟶
          </a>
        </div>
      </section>
    </div>
  );
}
