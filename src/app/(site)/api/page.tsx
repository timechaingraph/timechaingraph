import type { Metadata } from 'next';
import { UnderDevelopment } from '@/components/UnderDevelopment';

export const metadata: Metadata = {
  title: 'API',
  description:
    'Developer API for the Timechain dataset — wallets, blocks, lattice keyframes, Prolog queries. Free with rate limits, donation supported.',
};

export default function ApiOverview() {
  return (
    <div className="py-12 md:py-16">
      <p className="text-mono text-base uppercase tracking-[0.32em] text-[color:var(--color-accent)]">
        Developer surface
      </p>
      <h1 className="text-display mt-3 text-4xl font-semibold leading-[1.05] md:text-6xl">
        The API
        <br />
        <span className="brass-shimmer">queryable timechain.</span>
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[color:var(--color-text-secondary)] md:text-xl">
        Same data that drives the Grid and the Graph, exposed as a JSON API
        at <span className="text-mono text-[color:var(--color-accent)]">api.timechaingraph.com</span>.
        Free for everyone, with per-key rate limits to keep the service
        healthy. Sign in with Google or GitHub to mint a key. Heavy users
        can request lifted limits — no payment, just a stated use case.
      </p>

      <div className="mt-10">
        <UnderDevelopment
          targetVersion="v0.4"
          description="The API ships after the Grid and Graph viewers reach parity. Initial endpoints will cover wallet lookup, block activity, lattice keyframes, halving metadata, and a sandboxed Prolog query endpoint."
        />
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <Endpoint method="GET" path="/v1/wallet/{address}" desc="Wallet metadata + lifetime stats." />
        <Endpoint method="GET" path="/v1/block/{height}/activity" desc="Coinbase, spenders, recipients, bonds." />
        <Endpoint method="GET" path="/v1/lattice/keyframe/{height}" desc="Pre-baked positions at a block height." />
        <Endpoint method="GET" path="/v1/halvings" desc="All halvings + projected dates." />
        <Endpoint method="POST" path="/v1/query" desc="Sandboxed Prolog queries against the fact base." />
        <Endpoint method="GET" path="/v1/status" desc="Live block height + snapshot age." />
      </div>
    </div>
  );
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  return (
    <div className="brass-panel rounded-lg p-5">
      <div className="flex items-baseline gap-3">
        <span
          className="rounded px-2 py-0.5 text-mono text-[10px] uppercase tracking-wider"
          style={{
            background: 'rgba(0, 212, 255, 0.12)',
            color: 'var(--color-accent)',
          }}
        >
          {method}
        </span>
        <code className="text-mono text-sm break-all text-[color:var(--color-text-primary)]">{path}</code>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
        {desc}
      </p>
    </div>
  );
}
