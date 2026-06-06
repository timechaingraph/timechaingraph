import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Not found',
  description:
    'This route does not exist on timechaingraph.com. Available routes listed.',
};

/**
 * Custom 404 — replaces Next.js's bare default. Surfaces every
 * top-level route currently defined on the public viewer so users
 * who mistype a URL (e.g. /lattice, /grid) can navigate to what's
 * actually here. Mirrors the brass-panel aesthetic of the rest of
 * the site so the 404 doesn't feel like an outage.
 */

const ROUTES: Array<{ href: string; label: string; blurb: string; tone: 'amber' | 'gold' }> = [
  {
    href: '/',
    label: 'Landing',
    blurb: 'Project overview, hero, mission',
    tone: 'gold',
  },
  {
    href: '/graph',
    label: '/graph',
    blurb: 'Force-directed wallet network — the main viewer',
    tone: 'gold',
  },
  {
    href: '/about',
    label: '/about',
    blurb: 'Why this exists, who it is for, lineage',
    tone: 'gold',
  },
  {
    href: '/pricing',
    label: '/pricing',
    blurb: 'All tiers free; donation-supported',
    tone: 'amber',
  },
  {
    href: '/donate',
    label: '/donate',
    blurb: 'Self-custodial on-chain Bitcoin — no KYC',
    tone: 'amber',
  },
  {
    href: '/privacy',
    label: '/privacy',
    blurb: 'Full privacy posture, observable in DevTools',
    tone: 'gold',
  },
  {
    href: '/status',
    label: '/status',
    blurb: 'Block height, snapshot age, infra health',
    tone: 'gold',
  },
  {
    href: '/api',
    label: '/api',
    blurb: 'Developer API endpoints (v0.4)',
    tone: 'amber',
  },
  {
    href: '/docs',
    label: '/docs',
    blurb: 'OpenAPI spec + getting-started',
    tone: 'amber',
  },
];

const TONE_COLOR: Record<'amber' | 'gold', string> = {
  amber: 'var(--color-amber)',
  gold: 'var(--color-gold)',
};

export default function NotFound() {
  return (
    <div className="py-12 md:py-16">
      <p className="text-mono text-xs uppercase tracking-[0.32em] text-[color:var(--color-amber)]">
        404 · off-network
      </p>
      <h1 className="text-display mt-3 text-4xl font-semibold leading-[1.05] md:text-6xl">
        That node
        <br />
        <span className="brass-shimmer">is empty.</span>
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[color:var(--color-text-secondary)] md:text-xl">
        No wallet lives at this URL. The network still does — pick a
        route below or head back to the graph.
      </p>

      <ul className="mt-10 grid gap-3 md:grid-cols-2">
        {ROUTES.map((r) => (
          <li key={r.href}>
            <Link
              href={r.href}
              className="brass-panel group flex flex-col gap-1 rounded-lg p-5 transition-colors"
              style={{ borderColor: 'var(--color-card-border)' }}
            >
              <span
                className="text-mono text-xs uppercase tracking-[0.22em] group-hover:underline"
                style={{ color: TONE_COLOR[r.tone] }}
              >
                {r.label}
              </span>
              <span className="text-sm text-[color:var(--color-text-secondary)]">
                {r.blurb}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
