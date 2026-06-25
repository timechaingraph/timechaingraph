'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  VIEW_BRAND,
  BRAND_TAGLINE,
  VIEW_ACCENT,
  OTHER_VIEW_BRAND,
  OTHER_VIEW_URL,
} from '@/lib/site-config';
import { Logo } from '@/components/Logo';

/**
 * NavBar — top-of-page navigation. Identical in both Grid and Graph repos;
 * brand label and cross-domain link target come from site-config so this
 * file stays byte-identical between siblings.
 */

interface NavLink {
  href: string;
  label: string;
  /** True if the destination route is not yet a finished product. */
  inDev?: boolean;
}

const SECTIONS: NavLink[] = [
  { href: '/about', label: 'About' },
  { href: '/insights', label: 'Insights' },
  { href: '/api', label: 'API', inDev: true },
  { href: '/docs', label: 'Docs' },
  { href: '/status', label: 'Status' },
];

const ACCENT_VAR: Record<'cyan' | 'gold' | 'amber', string> = {
  cyan: 'var(--color-accent-cyan)',
  gold: 'var(--color-gold)',
  amber: 'var(--color-amber)',
};

export function NavBar() {
  const pathname = usePathname() ?? '/';
  const [mobileOpen, setMobileOpen] = useState(false);
  const accent = ACCENT_VAR[VIEW_ACCENT];

  return (
    <header className="relative z-10 flex items-center justify-between gap-2 pb-1 md:gap-4">
      <Link
        href="/"
        className="flex items-center gap-4 text-mono text-base transition-opacity hover:opacity-80 md:gap-8"
        aria-label={`Timechain ${VIEW_BRAND} — home`}
      >
        <div className="flex items-center gap-2">
          <Logo size={32} />
          <span className="brass-shimmer text-lg font-semibold tracking-wider">
            TIMECHAIN<span className="mx-0.5">·</span>{VIEW_BRAND}
          </span>
        </div>
        <span
          className="hidden whitespace-nowrap text-sm uppercase tracking-[0.24em] md:inline"
          style={{ color: accent, opacity: 0.7 }}
        >
          {BRAND_TAGLINE}
        </span>
      </Link>

      <nav
        className="hidden items-center gap-5 text-mono text-sm lg:flex"
        aria-label="Primary"
      >
        {SECTIONS.map((link) => (
          <NavLinkItem key={link.href} link={link} pathname={pathname} />
        ))}
        <DonateLink active={pathname.startsWith('/donate')} accent={accent} />
        <CrossDomainLink accent={accent} />
      </nav>

      <button
        type="button"
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((o) => !o)}
        className="brass-panel rounded-md px-3 py-2 text-mono text-base uppercase tracking-wider lg:hidden"
      >
        {mobileOpen ? 'Close' : 'Menu'}
      </button>

      {mobileOpen && (
        <div
          className="brass-panel absolute right-0 top-full z-20 mt-2 flex w-56 max-w-[calc(100vw-1rem)] flex-col gap-1 rounded-lg p-3 lg:hidden"
          role="menu"
        >
          {SECTIONS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-between rounded px-3 py-2 text-mono text-base hover:bg-[color:var(--color-surface-hover)]"
            >
              <span>{link.label}</span>
              {link.inDev && <InDevBadge />}
            </Link>
          ))}
          <Link
            href="/donate"
            onClick={() => setMobileOpen(false)}
            className="mt-1 rounded px-3 py-2 text-mono text-base"
            style={{ color: accent }}
          >
            Donate
          </Link>
          <a
            href={OTHER_VIEW_URL}
            onClick={() => setMobileOpen(false)}
            className="rounded px-3 py-2 text-mono text-base"
            style={{ color: accent }}
          >
            {OTHER_VIEW_BRAND} View ⟶
          </a>
        </div>
      )}
    </header>
  );
}

function NavLinkItem({ link, pathname }: { link: NavLink; pathname: string }) {
  const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
  return (
    <Link
      href={link.href}
      className="flex items-center gap-1.5 transition-colors"
      style={{
        color: active
          ? 'var(--color-text-primary)'
          : 'var(--color-text-secondary)',
      }}
    >
      <span>{link.label}</span>
      {link.inDev && <InDevBadge />}
    </Link>
  );
}

function DonateLink({ active, accent }: { active: boolean; accent: string }) {
  return (
    <Link
      href="/donate"
      className="shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-mono text-sm uppercase tracking-wider transition-opacity hover:opacity-85"
      style={{
        borderColor: `color-mix(in srgb, ${accent} 45%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${accent} ${active ? 16 : 8}%, transparent)`,
        color: accent,
      }}
    >
      Donate
    </Link>
  );
}

function CrossDomainLink({ accent }: { accent: string }) {
  return (
    <a
      href={OTHER_VIEW_URL}
      className="shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-mono text-sm uppercase tracking-wider transition-colors hover:opacity-85"
      style={{
        borderColor: 'var(--color-brass-border)',
        color: accent,
      }}
    >
      {OTHER_VIEW_BRAND} View ⟶
    </a>
  );
}

function InDevBadge() {
  return (
    <span
      className="rounded-full px-1.5 py-px text-[10px] uppercase tracking-wider"
      style={{
        backgroundColor: 'rgba(245, 166, 35, 0.12)',
        color: 'var(--color-amber)',
      }}
    >
      dev
    </span>
  );
}
