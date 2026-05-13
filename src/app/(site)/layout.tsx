import type { ReactNode } from 'react';
import { NavBar } from '@/components/NavBar';
import { SiteFooter } from '@/components/SiteFooter';

/**
 * (site) layout — the standard document-style shell applied to every
 * regular page (`/`, `/about`, `/pricing`, `/donate`, etc.). Centers
 * content in a max-w-6xl container with the brass NavBar at top and
 * SiteFooter at the bottom.
 *
 * The kiosk routes (`/graph`) bypass this layout entirely — they're
 * outside the (site) route group and use their own full-viewport
 * layout. Route groups in Next.js App Router don't affect URLs;
 * `/about` still resolves whether the file lives at app/about/ or
 * app/(site)/about/.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative z-10 mx-auto flex min-h-dvh max-w-6xl flex-col px-6 pb-12 pt-2 md:px-10 md:pt-3">
      <NavBar />
      {children}
      <SiteFooter />
    </main>
  );
}
