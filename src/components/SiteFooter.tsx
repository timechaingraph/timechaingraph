import Link from 'next/link';
import {
  VIEW_BRAND,
  VIEW_DOMAIN,
  VIEW_ACCENT,
  OTHER_VIEW_BRAND,
  OTHER_VIEW_DOMAIN,
  OTHER_VIEW_ACCENT,
  OTHER_VIEW_URL,
  SHOW_OTHER_VIEW_CALLOUTS,
  SUPPORT_EMAIL,
  SOCIAL_LINKS,
} from '@/lib/site-config';
import { SocialIcon } from '@/components/SocialIcons';

/**
 * SiteFooter — shared footer. Identical in both Grid and Graph repos.
 * View-specific labels come from site-config so this file stays
 * byte-identical between siblings.
 *
 * Build hash + version are injected at build time via NEXT_PUBLIC_*
 * environment variables (set in CI from `git rev-parse --short HEAD`).
 */

const BUILD_HASH = process.env.NEXT_PUBLIC_BUILD_HASH ?? 'dev';
const BUILD_VERSION = process.env.NEXT_PUBLIC_BUILD_VERSION ?? '0.1.0';

const SITEMAP: Array<{ heading: string; links: Array<{ href: string; label: string }> }> = [
  {
    heading: 'Project',
    links: [
      { href: '/about', label: 'About' },
      { href: '/status', label: 'Status' },
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
    links: [
      { href: '/donate', label: 'Donate' },
      ...(SUPPORT_EMAIL ? [{ href: `mailto:${SUPPORT_EMAIL}`, label: 'Contact' }] : []),
    ],
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
            <span style={{ color: ACCENT_VAR[VIEW_ACCENT] }}>{VIEW_DOMAIN}</span>
            {SHOW_OTHER_VIEW_CALLOUTS ? (
              <>
                . {OTHER_VIEW_BRAND} View at{' '}
                <a
                  href={OTHER_VIEW_URL}
                  className="hover:underline"
                  style={{ color: ACCENT_VAR[OTHER_VIEW_ACCENT] }}
                >
                  {OTHER_VIEW_DOMAIN}
                </a>
                . Same chain, two views.
              </>
            ) : (
              ". Bitcoin's digital real estate, block by block."
            )}
          </p>
        </div>

        {SITEMAP.map((section) => (
          <div key={section.heading}>
            <h3 className="text-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-brass-bright)]">
              {section.heading}
            </h3>
            <ul className="mt-3 space-y-2">
              {section.links.map((l) => {
                const external =
                  l.href.startsWith('http') || l.href.startsWith('mailto:');
                return (
                  <li key={l.href}>
                    {external ? (
                      <a
                        href={l.href}
                        className="transition-colors hover:text-[color:var(--color-text-primary)]"
                        {...(l.href.startsWith('http')
                          ? { target: '_blank', rel: 'noopener noreferrer' }
                          : {})}
                      >
                        {l.label}
                      </a>
                    ) : (
                      <Link
                        href={l.href}
                        className="transition-colors hover:text-[color:var(--color-text-primary)]"
                      >
                        {l.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {SHOW_OTHER_VIEW_CALLOUTS ? (
          <div>
            <h3 className="text-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-brass-bright)]">
              {OTHER_VIEW_BRAND} View
            </h3>
            <ul className="mt-3 space-y-2">
              <li>
                <a
                  href={OTHER_VIEW_URL}
                  className="transition-colors hover:text-[color:var(--color-text-primary)]"
                >
                  Open ⟶
                </a>
              </li>
            </ul>
          </div>
        ) : (
          <div />
        )}
      </div>

      <div className="mt-10 flex flex-col gap-3 border-t border-[color:var(--color-card-border)] pt-6 md:flex-row md:items-center md:justify-between">
        <p>Built on the open Bitcoin protocol. No coin, no token, no funding round.</p>
        {SOCIAL_LINKS.length > 0 && (
          <ul className="flex items-center gap-5">
            {SOCIAL_LINKS.map((s) => (
              <li key={s.label}>
                <a
                  href={s.href}
                  {...(s.href.startsWith('mailto:')
                    ? {}
                    : { target: '_blank', rel: 'noopener noreferrer' })}
                  aria-label={s.label}
                  className="block text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-primary)]"
                >
                  <SocialIcon icon={s.icon} className="h-5 w-5" />
                </a>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[color:var(--color-text-faint)]">
          v{BUILD_VERSION} · {BUILD_HASH}
        </p>
      </div>
    </footer>
  );
}
