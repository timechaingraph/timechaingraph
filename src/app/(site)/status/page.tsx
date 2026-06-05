import type { Metadata } from 'next';
import { LiveStatus } from '@/components/LiveStatus';

export const metadata: Metadata = {
  title: 'Status',
  description:
    'Live status of the Timechain pipeline: current block height, parquet snapshot age, infra health.',
};

export default function StatusPage() {
  return (
    <div className="py-12 md:py-16">
      <p className="text-mono text-xs uppercase tracking-[0.32em] text-[color:var(--color-accent-cyan)]">
        Live status
      </p>
      <h1 className="text-display mt-3 text-4xl font-semibold leading-[1.05] md:text-6xl">
        Pipeline
        <br />
        <span className="brass-shimmer">vital signs.</span>
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[color:var(--color-text-secondary)] md:text-xl">
        Block height, last-block age, and next-block ETA from the
        snapshot sidecar (<code className="text-mono text-sm">/status.json</code>).
        For v0.1 this is a static fixture refreshed manually; v0.2+
        regenerates it on every block from the chain-tools pipeline
        and serves it from R2.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <LiveStatus />
        <div className="brass-panel rounded-lg p-5">
          <p className="text-mono text-[10px] uppercase tracking-[0.32em] text-[color:var(--color-brass-bright)]">
            Pipeline health
          </p>
          <ul className="mt-3 space-y-2 text-mono text-xs text-[color:var(--color-text-secondary)]">
            {[
              { label: 'bitcoind sync', state: 'stubbed' },
              { label: 'substrate walk', state: 'stubbed' },
              { label: 'parquet snapshots', state: 'stubbed' },
              { label: 'R2 bucket', state: 'stubbed' },
            ].map((row) => (
              <li key={row.label} className="flex justify-between">
                <span>{row.label}</span>
                <span className="text-[color:var(--color-text-faint)]">{row.state}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-mono text-[10px] leading-relaxed text-[color:var(--color-text-faint)]">
            Pipeline stack is in early build-out. Each component lights up
            as it lands in production.
          </p>
        </div>
      </div>
    </div>
  );
}
