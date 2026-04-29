import type { Metadata } from 'next';
import { UnderDevelopment } from '@/components/UnderDevelopment';

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
        When the chain-tools pipeline is live, this page will show the
        current Bitcoin block height that the lattice is rendering, the age
        of the most recent parquet snapshot on the CDN, and whether the
        bitcoind + electrs operator infrastructure is reachable.
      </p>

      <div className="mt-10">
        <UnderDevelopment
          targetVersion="v0.1"
          description="Live pipeline status surfaces alongside the first real-data Grid + Graph ship. For now, you can confirm a build is reachable by the version + commit hash in the footer of this page."
        />
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-2">
        <Metric label="Bitcoin block height" value="—" hint="from operator bitcoind" />
        <Metric label="Snapshot age" value="—" hint="time since last parquet write" />
        <Metric label="Free tier nodes" value="—" hint="whales + major miners" />
        <Metric label="Pipeline health" value="—" hint="bitcoind + electrs + R2" />
      </div>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="brass-panel rounded-lg p-5">
      <p className="text-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-text-muted)]">
        {label}
      </p>
      <p className="text-display mt-2 text-2xl font-semibold text-[color:var(--color-text-primary)]">
        {value}
      </p>
      <p className="mt-1 text-mono text-[10px] text-[color:var(--color-text-faint)]">
        {hint}
      </p>
    </div>
  );
}
