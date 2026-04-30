import type { Metadata } from 'next';
import { GraphView } from '@/components/views/GraphView';
import { WalletInspector } from '@/components/WalletInspector';
import { BlockStats } from '@/components/BlockStats';
import { Scrubber } from '@/components/Scrubber';
import { Playback } from '@/components/Playback';
import { HalvingTimeline } from '@/components/HalvingTimeline';
import { BlockNarrative } from '@/components/BlockNarrative';

export const metadata: Metadata = {
  title: 'Graph view',
  description:
    'Force-directed Obsidian-style graph of Bitcoin wallets. Position emerges from transaction frequency. Drag nodes to play with the layout. timechaingraph.com.',
};

export default function GraphHome() {
  return (
    <div className="py-12 md:py-16">
      <p className="text-mono text-xs uppercase tracking-[0.32em] text-[color:var(--color-gold)]">
        Geometry · force-directed
      </p>
      <h1 className="text-display mt-3 text-4xl font-semibold leading-[1.05] md:text-6xl">
        The Graph view
        <br />
        <span className="brass-shimmer">an Obsidian vault of money.</span>
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[color:var(--color-text-secondary)] md:text-xl">
        Position emerges from transaction frequency. Edge spring force scales
        with how often two wallets transact, so hubs swell with activity and
        clusters reveal themselves. Bonds fade across the next ten blocks
        like memories. Miners glow red, whales gold, dust grey, Satoshi at
        the brass-gold center.
      </p>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <div className="brass-panel relative rounded-lg overflow-hidden">
            <GraphView />
            <BlockNarrative />
          </div>
          <Scrubber />
          <Playback autoStart />
          <HalvingTimeline />
        </div>
        <div className="lg:sticky lg:top-6 lg:self-start lg:flex lg:flex-col lg:gap-4">
          <BlockStats />
          <WalletInspector />
        </div>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        <Bullet label="Frequency = position" body="The more two wallets transact, the tighter their spring. Heavy hubs converge, isolates drift to the periphery." />
        <Bullet label="Edges fade" body="Each transaction draws an edge that fades alpha-linearly over the next ten blocks. The graph remembers, but it forgets." />
        <Bullet label="Obsidian export" body="The vault is a real Obsidian vault — clone the repo, open it in your client, browse with the graph plugin you already trust." />
      </div>
    </div>
  );
}

function Bullet({ label, body }: { label: string; body: string }) {
  return (
    <div className="brass-panel rounded-lg p-6">
      <p className="text-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-gold)]">
        {label}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
        {body}
      </p>
    </div>
  );
}
