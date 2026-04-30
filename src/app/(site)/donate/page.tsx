import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Fund the node',
  description:
    'Support Timechain Graph. Lightning, GitHub Sponsors, OpenSats. Donations only — no paywall, no token, no funding round.',
};

const LIGHTNING_ADDRESS = 'donate@timechaingraph.com';
const GITHUB_SPONSORS_URL = 'https://github.com/sponsors';

export default function DonatePage() {
  return (
    <div className="py-12 md:py-16">
      <p className="text-mono text-xs uppercase tracking-[0.32em] text-[color:var(--color-amber)]">
        Fund the node · optional
      </p>
      <h1 className="text-display mt-3 text-4xl font-semibold leading-[1.05] md:text-6xl">
        If it&apos;s useful,
        <br />
        <span className="brass-shimmer">keep it lit.</span>
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[color:var(--color-text-secondary)] md:text-xl">
        Free for everyone — every view, every block, every tier. The
        operator runs a self-hosted Bitcoin node so your viewer stays
        private. Lightning is preferred: instant, KYC-free, settles in
        seconds.
      </p>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <Channel
          title="Lightning"
          accent="var(--color-amber)"
          status="primary"
          body="Lightning address (LNURL). Instant. No KYC."
        >
          <code
            className="text-mono mt-4 block break-all rounded-md border border-[color:var(--color-card-border)] bg-[color:var(--color-background-light)] px-3 py-2 text-sm text-[color:var(--color-amber)]"
          >
            {LIGHTNING_ADDRESS}
          </code>
          <p className="mt-3 text-xs text-[color:var(--color-text-muted)]">
            Paste into any Lightning wallet (Wallet of Satoshi, Phoenix,
            Zeus, Strike).
          </p>
        </Channel>

        <Channel
          title="GitHub Sponsors"
          accent="var(--color-accent-cyan)"
          status="planned"
          body="Recurring or one-off, settled in fiat by GitHub. Configured via .github/FUNDING.yml."
        >
          <a
            href={GITHUB_SPONSORS_URL}
            className="text-mono mt-4 inline-block rounded-md border border-[color:var(--color-card-border)] bg-[color:var(--color-background-light)] px-4 py-2 text-sm transition-colors hover:border-[color:var(--color-accent-cyan)]"
            style={{ color: 'var(--color-accent-cyan)' }}
            rel="noopener noreferrer"
            target="_blank"
          >
            Sponsor on GitHub ⟶
          </a>
        </Channel>

        <Channel
          title="OpenSats"
          accent="var(--color-gold)"
          status="post-launch"
          body="Grant application planned post-launch. OpenSats funds open-source Bitcoin work — public, audited, no strings."
        />

        <Channel
          title="BTCPay"
          accent="var(--color-brass-bright)"
          status="optional"
          body="Self-hosted donate widget via BTCPay Server. Privacy-first; no third-party processor. Coming v0.2."
        />
      </div>

      <p className="mt-12 max-w-2xl text-sm leading-relaxed text-[color:var(--color-text-muted)]">
        No coin. No token. No funding round. The project ships its
        source open and welcomes audit. If it works for you and you can
        spare a sat, the node thanks you. If you can&apos;t, it&apos;s
        still free.
      </p>
    </div>
  );
}

function Channel({
  title,
  accent,
  body,
  status,
  children,
}: {
  title: string;
  accent: string;
  body: string;
  status: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="brass-panel rounded-lg p-6">
      <div className="flex items-baseline justify-between">
        <span
          className="text-display text-xl font-semibold"
          style={{ color: accent }}
        >
          {title}
        </span>
        <span className="text-mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
          {status}
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
        {body}
      </p>
      {children}
    </div>
  );
}
