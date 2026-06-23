import Link from 'next/link';
import { HeroVisual } from '@/components/HeroVisual';
import {
  VIEW_HERO_TOP,
  VIEW_HERO_BOTTOM,
  VIEW_HERO_DESCRIPTION,
  VIEW_DOMAIN,
} from '@/lib/site-config';

/**
 * Landing page — minimalist narrative shell.
 *
 * Anchored on a single statement of vision (the hero) and a small
 * number of supporting facts (mission strip, three pillars). The
 * funding promise closes the page. The cross-view link to the other
 * project lives only in the NavBar topbar button — no duplicate
 * card on this page.
 *
 * The bulk of the actual product lives at /graph (the canvas itself);
 * this page exists to set frame and intent, then send the visitor
 * onward.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <Mission />
      <Pillars />
      <Promise />
    </>
  );
}

/* ─────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="grid items-center gap-12 py-4 md:grid-cols-[1.1fr_1fr] md:gap-16 md:py-8 lg:gap-20 lg:py-10">
      <div className="flex flex-col gap-8 self-start">
        <h1
          className="text-display hero-gradient text-5xl font-bold leading-[1.02] tracking-tight md:text-7xl lg:text-[5.5rem]"
          style={{ animation: 'drift-up 0.7s ease-out 0.15s both' }}
        >
          {VIEW_HERO_TOP}
          <br />
          {VIEW_HERO_BOTTOM}
        </h1>
        <p
          className="max-w-xl text-pretty text-base leading-relaxed text-[color:var(--color-text-secondary)] md:text-lg"
          style={{ animation: 'drift-up 0.7s ease-out 0.25s both' }}
        >
          {VIEW_HERO_DESCRIPTION}
        </p>
        <div
          className="flex flex-wrap items-center gap-4 pt-2"
          style={{ animation: 'drift-up 0.7s ease-out 0.35s both' }}
        >
          <Link
            href="/graph"
            className="rounded-full px-7 py-3.5 text-mono text-base font-semibold uppercase tracking-[0.2em] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(255,215,0,0.5)]"
            style={{ background: 'var(--color-accent)', color: 'var(--color-background)' }}
          >
            Open the graph ⟶
          </Link>
          <span className="flex items-center gap-2 whitespace-nowrap text-mono text-base uppercase tracking-[0.24em] text-[color:var(--color-text-muted)]">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{
                background: 'var(--color-accent)',
                boxShadow: '0 0 6px var(--color-accent)',
              }}
            />
            open source · no sign-up · no tracking
          </span>
        </div>
      </div>

      <div
        className="relative flex aspect-square items-center justify-center"
        style={{ animation: 'drift-up 0.9s ease-out 0.4s both' }}
      >
        <HeroVisual />
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────── */

function Mission() {
  return (
    <section className="border-t border-[color:var(--color-card-border)] py-10 md:py-12">
      <p className="text-display text-xl leading-snug text-[color:var(--color-text-secondary)] md:text-2xl md:leading-snug">
        Bitcoin&apos;s ledger is{' '}
        <span className="text-[color:var(--color-text-primary)]">public</span>
        . Reading it shouldn&apos;t require a chain-analytics firm.
        Timechain Graph makes the network observable to anyone with a
        browser — and{' '}
        <span className="text-[color:var(--color-gold)]">observable to no one but you</span>
        .
      </p>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────── */

function Pillars() {
  const items: Array<{ label: string; body: string }> = [
    {
      label: 'Network',
      body: 'Every wallet a node. Every transaction an edge. Position emerges from the connections, not from a coordinate.',
    },
    {
      label: 'Time',
      body: 'Scrub block by block across Bitcoin’s history. Watch the network form, halving by halving.',
    },
    {
      label: 'Private',
      body: 'Self-hosted node. Static snapshots. Zero third-party scripts. Verifiable in DevTools, every session.',
    },
  ];
  return (
    <section className="border-t border-[color:var(--color-card-border)] py-14 md:py-20">
      <div className="grid gap-px overflow-hidden rounded-xl border border-[color:var(--color-card-border)] bg-[color:var(--color-card-border)] md:grid-cols-3">
        {items.map((it) => (
          <div
            key={it.label}
            className="bg-[color:var(--color-background)] p-7 md:p-9"
          >
            <p className="text-mono text-base uppercase tracking-[0.28em] text-[color:var(--color-brass-bright)]">
              {it.label}
            </p>
            <p className="mt-5 leading-relaxed text-[color:var(--color-text-secondary)]">
              {it.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────── */

function Promise() {
  return (
    <section className="border-t border-[color:var(--color-card-border)] py-14 md:py-20">
      <div className="grid gap-10 md:grid-cols-[1.2fr_1fr] md:gap-14">
        <p className="text-display text-2xl leading-snug text-[color:var(--color-text-primary)] md:text-3xl md:leading-snug">
          Free. Forever. Funded by the people who see Bitcoin clearer
          because of it.
        </p>
        <ul className="space-y-3 text-base text-[color:var(--color-text-secondary)]">
          {[
            'Self-hosted node · no third-party calls',
            'No analytics · no tracking · no sign-up',
            'Bitcoin-funded · KYC-free',
            'Source open · audit any time',
          ].map((line) => (
            <li key={line} className="flex items-baseline gap-3">
              <span className="text-mono text-[color:var(--color-brass-bright)]">▸</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-10 flex flex-wrap items-baseline gap-4">
        <Link
          href="/donate"
          className="text-mono text-base uppercase tracking-[0.22em] text-[color:var(--color-amber)] hover:underline"
        >
          Fund the node ⟶
        </Link>
        <span className="text-mono text-base uppercase tracking-[0.22em] text-[color:var(--color-text-muted)]">
          {VIEW_DOMAIN}
        </span>
      </div>
    </section>
  );
}
