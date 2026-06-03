import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Why Timechain Graph exists. Bitcoin as a living network — every wallet a node, every transaction an edge.',
};

export default function AboutPage() {
  return (
    <div className="py-12 md:py-16">
      <p className="text-mono text-xs uppercase tracking-[0.32em] text-[color:var(--color-accent-cyan)]">
        Background
      </p>
      <h1 className="text-display mt-3 text-4xl font-semibold leading-[1.05] md:text-6xl">
        The Graph
        <br />
        <span className="brass-shimmer">of Bitcoin.</span>
      </h1>

      <div className="mt-10 space-y-6 text-base leading-relaxed text-[color:var(--color-text-secondary)] md:text-lg">
        <p>
          Bitcoin is the largest publicly observed economic network in
          history. Every wallet is a node. Every transaction is an
          edge. Every block is a clock-tick that has not stopped since
          3 January 2009. Timechain Graph draws that network — live,
          private, in your browser.
        </p>
        <p>
          Two views ship in parallel. The force-directed{' '}
          <Link href="/graph" className="text-[color:var(--color-gold)] underline-offset-4 hover:underline">
            Graph
          </Link>{' '}
          for emergent structure — clusters thicken where activity
          concentrates. The stationary{' '}
          <a
            href="https://timechaingrid.com"
            className="text-[color:var(--color-accent-cyan)] underline-offset-4 hover:underline"
          >
            Grid
          </a>{' '}
          for fixed reference — every coin a tile on a 2D lattice
          expanding outward from Satoshi. Same chain, two geometries.
        </p>
        <p>
          Data flows from Bitcoin&apos;s peer-to-peer protocol into a
          self-hosted full node. Extraction runs offline. Snapshots ship
          from a CDN we control. Your viewer touches no third-party at
          runtime — verifiable in DevTools.
        </p>
        <p>
          No coin. No token. No funding round. If you find it useful,{' '}
          <Link
            href="/donate"
            className="text-[color:var(--color-amber)] underline-offset-4 hover:underline"
          >
            fund the node
          </Link>
          . If you don&apos;t, it&apos;s still free.
        </p>
      </div>

      <section className="mt-16 border-t border-[color:var(--color-card-border)] pt-10">
        <h2 className="text-display text-2xl font-semibold">Who it&apos;s for</h2>
        <ul className="mt-4 space-y-3 text-base leading-relaxed text-[color:var(--color-text-secondary)]">
          <li>
            <strong className="text-[color:var(--color-text-primary)]">Bitcoiners</strong>{' '}
            — see the network you already trust, find the wallets you
            already follow, watch halvings flash by.
          </li>
          <li>
            <strong className="text-[color:var(--color-text-primary)]">Researchers</strong>{' '}
            — query the lattice via the API, run logic over the fact
            base, export structured data.
          </li>
          <li>
            <strong className="text-[color:var(--color-text-primary)]">Educators</strong>{' '}
            — show 16 years of monetary history as a single scrubbable
            surface.
          </li>
          <li>
            <strong className="text-[color:var(--color-text-primary)]">Privacy advocates</strong>{' '}
            — verify zero third-party requests, end of session.
          </li>
        </ul>
      </section>
    </div>
  );
}
