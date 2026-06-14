import type { ReactNode } from 'react';
import { NavBar } from '@/components/NavBar';

/**
 * Graph (kiosk) layout — escapes the document-style chrome to give
 * the brain lattice the full viewport. The NavBar still renders at
 * the top so the visitor can navigate away, but nothing else (no
 * centered max-width, no SiteFooter, no scrollable document content).
 * The page renders as a fixed full-screen canvas with floating HUD
 * panels overlaid — non-blocking, brass-translucent, click-through.
 *
 * Body scroll is disabled by `overflow-hidden` on this wrapper +
 * `h-dvh` viewport-locking. /graph becomes a "place" you visit
 * rather than a "document" you scroll, matching the user's directive
 * 2026-04-30: full-screen HUD, non-blocking, same as the grid kiosk
 * with a bigger canvas and a tighter engine.
 */
export default function GraphLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-[color:var(--color-background)]">
      <div className="px-6 pt-4 md:px-10">
        <NavBar />
      </div>
      <div className="relative flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
