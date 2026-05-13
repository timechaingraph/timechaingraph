import Link from 'next/link';
import { HeroVisual } from '@/components/HeroVisual';
import {
  VIEW_HERO_TOP,
  VIEW_HERO_BOTTOM,
  VIEW_HERO_DESCRIPTION,
  VIEW_DOMAIN,
  SISTER_BRAND,
  SISTER_DOMAIN,
  SISTER_TAGLINE,
  SISTER_URL,
  BRAND_TAGLINE,
} from '@/lib/site-config';

/**
 * Landing page — minimalist narrative shell.
 *
 * Anchored on a single statement of vision (the hero) and a small
 * number of supporting facts (mission strip, three pillars). Sister
 * callout and the funding promise close the page.
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
      <SisterCallout />
      <Promise />
    </>
  );
}

/* ─────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="grid items-center gap-12 py-16 md:grid-cols-[1.1fr_1fr] md:gap-16 md:py-24 lg:gap-20 lg:py-28">
      <div className="flex flex-col gap-8">
        <p className="text-mono text-[11px] uppercase tracking-[0.36em] text-[color:var(--color-accent-cyan)]">
          {BRAND_TAGLINE}
        </p>
        <h1 className="text-display text-5xl font-semibold leading-[1.02] tracking-tight md:text-7xl lg:text-[5.5rem]">
          {VIEW_HERO_TOP}
          <br />
          <span className="brass-shimmer">{VIEW_HERO_BOTTOM}</span>
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-[color:var(--color-text-secondary)] md:text-lg">
          {VIEW_HERO_DESCRIPTION}
        </p>
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <Link
            href="/graph"
            className="brass-panel rounded-full px-7 py-3.5 text-mono text-xs uppercase tracking-[0.2em] transition-all hover:border-[color:var(--color-amber)] hover:shadow-[0_0_24px_rgba(255,215,0,0.18)]"
            style={{ color: 'var(--color-gold)' }}
          >
            Open the graph ⟶
          </Link>
          <span className="text-mono text-[10px] uppercase tracking-[0.24em] text-[color:var(--color-text-muted)]">
            no sign-up · no tracking
          </span>
        </div>
      </div>

      <div className="relative flex aspect-square items-center justify-center">
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
        <span className="text-[color:var(--color-gold)]">observable to no one but them</span>
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
      body: 'Every wallet a neuron. Every transaction a synapse. Position emerges from the connections, not from a coordinate.',
    },
    {
      label: 'Time',
      body: 'Scrub block by block across Bitcoin’s history. Watch the network think, halving by halving.',
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
            <p className="text-mono text-[10px] uppercase tracking-[0.28em] text-[color:var(--color-brass-bright)]">
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

function SisterCallout() {
  return (
    <section className="border-t border-[color:var(--color-card-border)] py-14 md:py-20">
      <a
        href={SISTER_URL}
        className="brass-panel group flex flex-col gap-3 rounded-xl p-7 transition-colors hover:border-[color:var(--color-amber)] md:flex-row md:items-baseline md:justify-between md:gap-6 md:p-9"
      >
        <div className="flex-1">
          <p className="text-mono text-[10px] uppercase tracking-[0.28em] text-[color:var(--color-text-muted)]">
            Sister site · {SISTER_DOMAIN}
          </p>
          <p className="text-display mt-3 text-2xl font-semibold text-[color:var(--color-accent-cyan)] md:text-3xl">
            View as {SISTER_BRAND}
          </p>
          <p className="mt-2 text-[color:var(--color-text-secondary)]">
            Same chain, the other geometry: {SISTER_TAGLINE}.
          </p>
        </div>
        <span className="text-mono text-xs uppercase tracking-[0.2em] text-[color:var(--color-amber)] transition-opacity group-hover:opacity-80">
          Open ⟶
        </span>
      </a>
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
        <ul className="space-y-3 text-sm text-[color:var(--color-text-secondary)]">
          {[
            'Self-hosted node · no third-party calls',
            'No analytics · no tracking · no sign-up',
            'Lightning-funded · KYC-free',
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
          className="text-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-amber)] hover:underline"
        >
          Fund the node ⟶
        </Link>
        <span className="text-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-text-muted)]">
          {VIEW_DOMAIN}
        </span>
      </div>
    </section>
  );
}
