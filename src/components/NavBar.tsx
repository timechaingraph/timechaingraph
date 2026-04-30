'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  VIEW_BRAND,
  VIEW_TAGLINE,
  VIEW_ACCENT,
  SISTER_BRAND,
  SISTER_URL,
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
  { href: '/pricing', label: 'Pricing' },
  { href: '/api', label: 'API', inDev: true },
  { href: '/docs', label: 'Docs', inDev: true },
  { href: '/status', label: 'Status' },
  { href: '/privacy', label: 'Privacy' },
];

const ACCENT_VAR: Record<'cyan' | 'gold', string> = {
  cyan: 'var(--color-accent-cyan)',
  gold: 'var(--color-gold)',
};

export function NavBar() {
  const pathname = usePathname() ?? '/';
  const [mobileOpen, setMobileOpen] = useState(false);
  const accent = ACCENT_VAR[VIEW_ACCENT];

  return (
    <header className="relative z-10 flex items-center justify-between gap-4 pb-4">
      <Link
        href="/"
        className="flex items-center gap-3 text-mono text-sm transition-opacity hover:opacity-80"
        aria-label={`Timechain ${VIEW_BRAND} — home`}
      >
        <Logo size={32} accent="brass" />
        <span className="brass-shimmer text-base font-semibold tracking-wider">
          TIMECHAIN&nbsp;·&nbsp;{VIEW_BRAND}
        </span>
        <span
          className="hidden text-[10px] uppercase tracking-[0.24em] md:inline"
          style={{ color: accent, opacity: 0.7 }}
        >
          {VIEW_TAGLINE}
        </span>
      </Link>

      <nav
        className="hidden items-center gap-5 text-mono text-xs lg:flex"
        aria-label="Primary"
      >
        {SECTIONS.map((link) => (
          <NavLinkItem key={link.href} link={link} pathname={pathname} />
        ))}
        <CrossDomainLink />
      </nav>

      <button
        type="button"
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((o) => !o)}
        className="brass-panel rounded-md px-3 py-2 text-mono text-xs uppercase tracking-wider lg:hidden"
      >
        {mobileOpen ? 'Close' : 'Menu'}
      </button>

      {mobileOpen && (
        <div
          className="brass-panel absolute right-0 top-full z-20 mt-2 flex w-56 flex-col gap-1 rounded-lg p-3 lg:hidden"
          role="menu"
        >
          {SECTIONS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-between rounded px-3 py-2 text-mono text-xs hover:bg-[color:var(--color-surface-hover)]"
            >
              <span>{link.label}</span>
              {link.inDev && <InDevBadge />}
            </Link>
          ))}
          <a
            href={SISTER_URL}
            onClick={() => setMobileOpen(false)}
            className="mt-1 rounded px-3 py-2 text-mono text-xs"
            style={{ color: 'var(--color-amber)' }}
          >
            View as {SISTER_BRAND} ⟶
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

function CrossDomainLink() {
  return (
    <a
      href={SISTER_URL}
      className="rounded-full border px-3 py-1 text-mono text-xs uppercase tracking-wider transition-colors"
      style={{
        borderColor: 'var(--color-brass-border)',
        color: 'var(--color-amber)',
      }}
    >
      View as {SISTER_BRAND} ⟶
    </a>
  );
}

function InDevBadge() {
  return (
    <span
      className="rounded-full px-1.5 py-px text-[8px] uppercase tracking-wider"
      style={{
        backgroundColor: 'rgba(245, 166, 35, 0.12)',
        color: 'var(--color-amber)',
      }}
    >
      dev
    </span>
  );
}
