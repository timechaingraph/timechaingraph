import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Why Timechain exists, what motivates the project, who it is for, and how it stays privacy-first.',
};

export default function AboutPage() {
  return (
    <div className="py-12 md:py-16">
      <p className="text-mono text-xs uppercase tracking-[0.32em] text-[color:var(--color-accent-cyan)]">
        Background
      </p>
      <h1 className="text-display mt-3 text-4xl font-semibold leading-[1.05] md:text-6xl">
        Bitcoin is a
        <br />
        <span className="brass-shimmer">civilization.</span>
      </h1>

      <div className="mt-10 space-y-6 text-base leading-relaxed text-[color:var(--color-text-secondary)] md:text-lg">
        <p>
          Bitcoin&apos;s blockchain is the largest publicly observed
          economic civilization in history. Every wallet is an actor.
          Every transaction is an event. Every block is a tick of a
          global clock that has not stopped since 3 January 2009.
          Timechain renders that civilization.
        </p>
        <p>
          The project ships two views — a stationary{' '}
          <Link href="/grid" className="text-[color:var(--color-accent-cyan)] underline-offset-4 hover:underline">
            Grid
          </Link>{' '}
          for reference and aggregate work, and a force-directed{' '}
          <Link href="/graph" className="text-[color:var(--color-gold)] underline-offset-4 hover:underline">
            Graph
          </Link>{' '}
          for emergent structure. Same chain, two geometries.
        </p>
        <p>
          The data flows from Bitcoin&apos;s own peer-to-peer protocol
          into a self-hosted bitcoind + electrs pair. Extraction is
          offline. Snapshots ship from a CDN we control. The viewer
          touches no third-party at runtime — verifiable in DevTools.
        </p>
        <p>
          The project is built on the open Bitcoin protocol. There is
          no coin. There is no token. There is no funding round. If
          you find it useful, you can{' '}
          <Link
            href="/donate"
            className="text-[color:var(--color-amber)] underline-offset-4 hover:underline"
          >
            support the work
          </Link>
          . If you don&apos;t, it is still free.
        </p>
      </div>

      <section className="mt-16 border-t border-[color:var(--color-card-border)] pt-10">
        <h2 className="text-display text-2xl font-semibold">Lineage</h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-[color:var(--color-text-secondary)]">
          Forked clean on 2026-04-29 from the Exodus monorepo&apos;s
          in-progress <code className="text-mono">apps/timegrid</code>{' '}
          fork. The shared rendering primitives that used to live in
          <code className="text-mono"> @exodus/lattice-core </code>were
          inlined here so this project has no cross-repo dependency.
          From that point on, the two evolve independently.
        </p>
      </section>

      <section className="mt-12 border-t border-[color:var(--color-card-border)] pt-10">
        <h2 className="text-display text-2xl font-semibold">Who it is for</h2>
        <ul className="mt-4 space-y-3 text-base leading-relaxed text-[color:var(--color-text-secondary)]">
          <li>
            <strong className="text-[color:var(--color-text-primary)]">Bitcoiners</strong>{' '}
            — visualize the network you already trust, find the wallets you
            already follow, watch halvings flash by.
          </li>
          <li>
            <strong className="text-[color:var(--color-text-primary)]">Researchers</strong>{' '}
            — query the lattice via the API, run Prolog over the fact base,
            export an Obsidian vault.
          </li>
          <li>
            <strong className="text-[color:var(--color-text-primary)]">Educators</strong>{' '}
            — show students 16 years of monetary history as a single
            scrubbable surface.
          </li>
          <li>
            <strong className="text-[color:var(--color-text-primary)]">Privacy advocates</strong>{' '}
            — verify that the public viewer makes zero third-party
            requests, end of session.
          </li>
        </ul>
      </section>
    </div>
  );
}
