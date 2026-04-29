import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { NavBar } from '@/components/NavBar';
import { SiteFooter } from '@/components/SiteFooter';
import {
  SITE_URL,
  SITE_TITLE,
  SITE_TITLE_FULL,
  SITE_DESCRIPTION,
} from '@/lib/site-config';
import './globals.css';

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
    title: SITE_TITLE_FULL,
    description: SITE_DESCRIPTION,
    siteName: SITE_TITLE,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE_FULL,
    description: SITE_DESCRIPTION,
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
      <body>
        <main className="relative mx-auto flex min-h-dvh max-w-6xl flex-col px-6 pb-12 pt-8 md:px-10">
          <NavBar />
          {children}
          <SiteFooter />
        </main>
      </body>
    </html>
  );
}
