import Link from 'next/link';
import {
  VIEW_BRAND,
  VIEW_DOMAIN,
  VIEW_ACCENT,
  SISTER_BRAND,
  SISTER_DOMAIN,
  SISTER_ACCENT,
  SISTER_URL,
} from '@/lib/site-config';

/**
 * SiteFooter — shared footer. Identical in both Grid and Graph repos.
 * View-specific labels come from site-config so this file stays
 * byte-identical between siblings.
 *
 * Build hash + version are injected at build time via NEXT_PUBLIC_*
 * environment variables (set in CI from `git rev-parse --short HEAD`).
 */

const BUILD_HASH = process.env.NEXT_PUBLIC_BUILD_HASH ?? 'dev';
const BUILD_VERSION = process.env.NEXT_PUBLIC_BUILD_VERSION ?? '0.0.1';

const SITEMAP: Array<{ heading: string; links: Array<{ href: string; label: string }> }> = [
  {
    heading: 'Project',
    links: [
      { href: '/about', label: 'About' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/status', label: 'Status' },
      { href: '/privacy', label: 'Privacy' },
    ],
  },
  {
    heading: 'Developers',
    links: [
      { href: '/api', label: 'API' },
      { href: '/docs', label: 'Docs' },
    ],
  },
  {
    heading: 'Support',
    links: [{ href: '/donate', label: 'Donate' }],
  },
];

const ACCENT_VAR: Record<'cyan' | 'gold', string> = {
  cyan: 'var(--color-accent-cyan)',
  gold: 'var(--color-gold)',
};

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-[color:var(--color-card-border)] pt-10 pb-6 text-mono text-xs text-[color:var(--color-text-muted)]">
      <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)_1fr]">
        <div>
          <p
            className="brass-shimmer text-mono text-sm font-semibold tracking-wider"
            style={{ display: 'inline-block' }}
          >
            TIMECHAIN · {VIEW_BRAND}
          </p>
          <p className="mt-3 max-w-xs leading-relaxed text-[color:var(--color-text-secondary)]">
            You&apos;re on{' '}
            <span style={{ color: ACCENT_VAR[VIEW_ACCENT] }}>{VIEW_DOMAIN}</span>.
            Sister project at{' '}
            <a
              href={SISTER_URL}
              className="hover:underline"
              style={{ color: ACCENT_VAR[SISTER_ACCENT] }}
            >
              {SISTER_DOMAIN}
            </a>
            . Same chain, two views.
          </p>
        </div>

        {SITEMAP.map((section) => (
          <div key={section.heading}>
            <h3 className="text-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-brass-bright)]">
              {section.heading}
            </h3>
            <ul className="mt-3 space-y-2">
              {section.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="transition-colors hover:text-[color:var(--color-text-primary)]"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h3 className="text-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-brass-bright)]">
            Sister
          </h3>
          <ul className="mt-3 space-y-2">
            <li>
              <a
                href={SISTER_URL}
                className="transition-colors hover:text-[color:var(--color-text-primary)]"
              >
                View as {SISTER_BRAND} ⟶
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-3 border-t border-[color:var(--color-card-border)] pt-6 md:flex-row md:items-center md:justify-between">
        <p>Built on the open Bitcoin protocol. No coin, no token, no funding round.</p>
        <p className="text-[color:var(--color-text-faint)]">
          v{BUILD_VERSION} · {BUILD_HASH}
        </p>
      </div>
    </footer>
  );
}
