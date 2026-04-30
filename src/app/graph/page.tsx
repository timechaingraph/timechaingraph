import type { Metadata } from 'next';
import { GraphView } from '@/components/views/GraphView';
import { WalletInspector } from '@/components/WalletInspector';
import { BlockStats } from '@/components/BlockStats';
import { Scrubber } from '@/components/Scrubber';
import { Playback } from '@/components/Playback';
import { BlockNarrative } from '@/components/BlockNarrative';

export const metadata: Metadata = {
  title: 'Graph view',
  description:
    'Force-directed Obsidian-style graph of Bitcoin wallets. Position emerges from transaction frequency. Drag nodes to play with the layout. timechaingraph.com.',
};

/**
 * /graph — kiosk-mode page. Per user directive 2026-04-30, the graph
 * fills the viewport and the HUDs float over it without blocking the
 * canvas. Same pattern as sister's /grid: bigger lattice, tighter
 * brain-engine, non-scrollable.
 *
 * Layout:
 *   - <GraphView /> fills the kiosk area absolutely; force simulation
 *     gets the entire viewport instead of a 600px-tall panel.
 *   - <BlockNarrative /> floats top-center as the auto-updating
 *     storyteller card (already absolute-positioned internally).
 *   - Top-right: <BlockStats />
 *   - Right column (mid-screen): <WalletInspector />
 *   - Bottom row: <Scrubber /> + <Playback /> as a combined control bar.
 *
 * All HUD wrappers use `pointer-events-none` so canvas hover/click
 * passes through where panels don't physically cover; inner content
 * uses `pointer-events-auto` so the panels themselves stay
 * interactable. Translucent brass-panel + backdrop-blur keep the
 * canvas readable behind every overlay.
 */
export default function GraphHome() {
  return (
    <div className="relative h-full w-full">
      {/* The lattice — fills the kiosk area, sits underneath all overlays. */}
      <div className="absolute inset-0">
        <GraphView />
      </div>

      {/* Top-center storyteller card — block-by-block narrative. */}
      <BlockNarrative />

      {/* Top-right HUD: block stats. */}
      <div className="pointer-events-none absolute top-3 right-3 z-10 w-[280px] max-w-[calc(100vw-1.5rem)]">
        <div className="pointer-events-auto">
          <BlockStats />
        </div>
      </div>

      {/* Right-column secondary HUD: wallet inspector.
          Sits below the BlockStats so they stack on tall screens but
          never overlap on shorter ones (overflow-y-auto on the column
          lets the visitor scroll the right-side panels without
          disturbing the canvas). Hidden on small viewports — on
          mobile the inspector is reachable via tap-to-open in a
          future commit. */}
      <div className="pointer-events-none absolute top-[calc(3rem+260px)] right-3 bottom-32 z-10 hidden w-[300px] max-w-[calc(100vw-1.5rem)] flex-col gap-3 overflow-y-auto pr-1 lg:flex">
        <div className="pointer-events-auto">
          <WalletInspector />
        </div>
      </div>

      {/* Bottom row: scrubber + playback. Centered + max-width so it
          doesn't span gigantic ultrawide monitors awkwardly. */}
      <div className="pointer-events-none absolute right-0 bottom-3 left-0 z-10 flex justify-center px-3">
        <div className="pointer-events-auto flex w-full max-w-3xl flex-col gap-2">
          <Scrubber />
          <Playback autoStart />
        </div>
      </div>
    </div>
  );
}
