import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import {
  SITE_URL,
  SITE_TITLE,
  SITE_TITLE_FULL,
  SITE_DESCRIPTION,
} from '@/lib/site-config';
import './globals.css';

/**
 * Root layout — minimal shell. Contains only the html + body tags
 * and global metadata. The actual chrome (NavBar, SiteFooter, max-
 * width container, padding) lives in `(site)/layout.tsx`, which
 * applies to every regular page. The kiosk-style routes (currently
 * `/graph`) get their own full-viewport layout via `graph/layout.tsx`
 * and skip the centered container entirely.
 *
 * Splitting the chrome out of root lets `/graph` truly own the
 * viewport without fighting the centered max-w-6xl container, and
 * keeps document-style pages (`/about`, `/pricing`, etc.) unchanged.
 */

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE_FULL,
    template: `%s · ${SITE_TITLE}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    'Bitcoin',
    'blockchain visualization',
    'timechain',
    'wallet network',
    'on-chain analytics',
    'privacy-first',
  ],
  authors: [{ name: SITE_TITLE }],
  creator: SITE_TITLE,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: SITE_TITLE,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: SITE_TITLE_FULL }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/og.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: '#08080C',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
