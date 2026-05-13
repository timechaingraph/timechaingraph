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
 * Landing page — minimalist. Hero, three pillars, sister callout,
 * privacy promise. The bulk of the work is done by /graph itself —
 * this page exists to send the visitor there.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <Pillars />
      <SisterCallout />
      <Promise />
    </>
  );
}

/* ─────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="grid gap-10 py-14 md:grid-cols-[1.05fr_1fr] md:gap-14 md:py-20">
      <div className="flex flex-col justify-center gap-7">
        <p className="text-mono text-xs uppercase tracking-[0.32em] text-[color:var(--color-accent-cyan)]">
          {BRAND_TAGLINE}
        </p>
        <h1 className="text-display text-5xl font-semibold leading-[1.05] md:text-7xl">
          {VIEW_HERO_TOP}
          <br />
          <span className="brass-shimmer">{VIEW_HERO_BOTTOM}</span>
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-[color:var(--color-text-secondary)] md:text-xl">
          {VIEW_HERO_DESCRIPTION}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/graph"
            className="brass-panel rounded-full px-6 py-3 text-mono text-sm uppercase tracking-[0.18em] transition-colors hover:border-[color:var(--color-amber)]"
            style={{ color: 'var(--color-gold)' }}
          >
            Open the graph ⟶
          </Link>
          <span className="text-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-text-muted)]">
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

function Pillars() {
  const items: Array<{ label: string; body: string }> = [
    {
      label: 'Network',
      body: 'Every wallet a neuron. Every transaction a synapse. The brain of the chain, drawn as it grows.',
    },
    {
      label: 'Time',
      body: 'A block-by-block scrubber over Bitcoin’s history. Watch the network think, halving by halving.',
    },
    {
      label: 'Private',
      body: 'Self-hosted node, static snapshots, no third-party scripts. Your visit is invisible.',
    },
  ];
  return (
    <section className="border-t border-[color:var(--color-card-border)] py-14 md:py-16">
      <div className="grid gap-px overflow-hidden rounded-xl border border-[color:var(--color-card-border)] bg-[color:var(--color-card-border)] md:grid-cols-3">
        {items.map((it) => (
          <div
            key={it.label}
            className="bg-[color:var(--color-background)] p-7 md:p-9"
          >
            <p className="text-mono text-xs uppercase tracking-[0.24em] text-[color:var(--color-brass-bright)]">
              {it.label}
            </p>
            <p className="mt-4 leading-relaxed text-[color:var(--color-text-secondary)]">
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
    <section className="border-t border-[color:var(--color-card-border)] py-14 md:py-16">
      <a
        href={SISTER_URL}
        className="brass-panel group flex flex-col gap-3 rounded-xl p-7 transition-colors hover:border-[color:var(--color-amber)] md:flex-row md:items-baseline md:justify-between md:gap-6"
      >
        <div className="flex-1">
          <p className="text-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-text-muted)]">
            Sister site · {SISTER_DOMAIN}
          </p>
          <p className="text-display mt-2 text-2xl font-semibold text-[color:var(--color-accent-cyan)]">
            View as {SISTER_BRAND}
          </p>
          <p className="mt-2 text-[color:var(--color-text-secondary)]">
            Same chain, the other geometry: {SISTER_TAGLINE}.
          </p>
        </div>
        <span className="text-mono text-xs uppercase tracking-wider text-[color:var(--color-amber)] transition-opacity group-hover:opacity-80">
          Open ⟶
        </span>
      </a>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────── */

function Promise() {
  return (
    <section className="border-t border-[color:var(--color-card-border)] py-14 md:py-16">
      <div className="grid gap-10 md:grid-cols-[1.1fr_1fr]">
        <p className="text-display text-2xl leading-snug text-[color:var(--color-text-primary)] md:text-3xl">
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
      <div className="mt-8 flex flex-wrap gap-3">
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
