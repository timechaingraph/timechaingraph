import type { Metadata } from 'next';
import { GraphView } from '@/components/views/GraphView';
import { GraphSidebar } from '@/components/views/GraphSidebar';
import { GraphPlayBar } from '@/components/views/GraphPlayBar';
import { WalletInspector } from '@/components/WalletInspector';

export const metadata: Metadata = {
  title: 'Graph view',
  description:
    "Bitcoin's living network. Every wallet a neuron. Every transaction a synapse. Watch the brain of the chain think, block by block.",
};

/**
 * /graph — kiosk-mode page. Per user directive 2026-04-30, full-
 * viewport canvas with compact non-blocking HUDs.
 *
 * Layout:
 *   - <GraphView /> fills the kiosk area absolutely.
 *   - Left sidebar: <GraphSidebar /> — narrow card stacking block
 *     narrative + stats into a single ~260px-wide column. Replaces
 *     the floating top-center BlockNarrative + top-right BlockStats
 *     so the canvas keeps both halves of its width.
 *   - Right column: <WalletInspector /> only when a wallet is
 *     selected (lg+).
 *   - Bottom row: <GraphPlayBar /> — single thin pill containing
 *     play/pause + speed pills + scrubber + block readout. Replaces
 *     the stacked Scrubber + Playback panels (which doubled the
 *     bottom-bar height).
 *
 * All HUD wrappers use `pointer-events-none` so canvas hover/click
 * passes through where panels don't physically cover; inner content
 * is `pointer-events-auto`. Translucent brass-panel + backdrop-blur
 * keeps the lattice readable behind every overlay.
 */
export default function GraphHome() {
  return (
    <div className="relative h-full w-full">
      {/* The lattice — fills the kiosk area, sits underneath all overlays. */}
      <div className="absolute inset-0">
        <GraphView />
      </div>

      {/* Left sidebar: combined narrative + stats. */}
      <div className="pointer-events-none absolute top-3 left-3 z-10 w-[260px] max-w-[calc(100vw-1.5rem)]">
        <div className="pointer-events-auto">
          <GraphSidebar />
        </div>
      </div>

      {/* Right column: wallet inspector — appears when a wallet is
          selected. Hidden on small viewports; on mobile the inspector
          is reachable via tap-to-open in a future commit. */}
      <div className="pointer-events-none absolute top-3 right-3 bottom-20 z-10 hidden w-[300px] max-w-[calc(100vw-1.5rem)] flex-col gap-3 overflow-y-auto pr-1 lg:flex">
        <div className="pointer-events-auto">
          <WalletInspector />
        </div>
      </div>

      {/* Bottom row: thin combined playbar. */}
      <div className="pointer-events-none absolute right-0 bottom-3 left-0 z-10 flex justify-center px-3">
        <div className="pointer-events-auto w-full max-w-3xl">
          <GraphPlayBar />
        </div>
      </div>
    </div>
  );
}
