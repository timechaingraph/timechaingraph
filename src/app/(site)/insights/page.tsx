import type { Metadata } from 'next';
import { INSIGHTS_SUBSCRIBE_URL, SITE_URL } from '@/lib/site-config';
import { InsightsSignup } from '@/components/InsightsSignup';

export const metadata: Metadata = {
  title: 'Timechain Insights — free newsletter',
  description:
    'Free weekly on-chain analysis: wallet-graph topology shifts, epoch stats, halving milestones, and government holdings changes. No tracking. No ads. Self-hosted.',
  openGraph: {
    title: 'Timechain Insights',
    description:
      'On-chain analysis from the operators of timechaingraph.com — epoch by epoch, delivered to your inbox.',
    url: `${SITE_URL}/insights`,
    type: 'website',
    images: [{ url: `${SITE_URL}/og-insights.svg`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Timechain Insights',
    description: 'On-chain analysis from the operators of timechaingraph.com — epoch by epoch, delivered to your inbox.',
    images: [`${SITE_URL}/og-insights.svg`],
  },
};

export default function InsightsPage() {
  return (
    <div className="py-12 md:py-16">
      <p className="text-mono text-base uppercase tracking-[0.32em] text-[color:var(--color-amber)]">
        Timechain Insights · free
      </p>
      <h1 className="text-display mt-3 text-4xl font-semibold leading-[1.05] md:text-6xl">
        The chain,
        <br />
        <span className="brass-shimmer">decoded.</span>
      </h1>

      <div className="mt-6 max-w-2xl space-y-4 text-lg leading-relaxed text-[color:var(--color-text-secondary)] md:text-xl">
        <p>
          Every epoch, the Bitcoin chain tells a story: wallets consolidating, miners rotating,
          governments accumulating. Most of it goes unnoticed. We read the ledger and write it down.
        </p>
        <p>
          Timechain Insights is a free newsletter built on the same substrate that powers the three
          visualizers — self-hosted bitcoind, DuckDB, no third-party data. When the data says
          something interesting, you hear about it first.
        </p>
      </div>

      <div className="mt-8 max-w-xl">
        <InsightsSignup subscribeUrl={INSIGHTS_SUBSCRIBE_URL} />
      </div>

      <div className="mt-16">
        <h2 className="text-display text-2xl font-semibold text-[color:var(--color-text-primary)]">
          What to expect
        </h2>
        <ul className="mt-4 max-w-xl space-y-3 text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
          <li className="flex gap-3">
            <span className="mt-0.5 shrink-0 text-[color:var(--color-amber)]">→</span>
            <span>
              <strong className="text-[color:var(--color-text-primary)]">Wallet-graph topology</strong>
              {' '}— which hub wallets grew or shrank this epoch; new clustering patterns.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 shrink-0 text-[color:var(--color-amber)]">→</span>
            <span>
              <strong className="text-[color:var(--color-text-primary)]">Epoch stats</strong>
              {' '}— block count, average fee rates, difficulty adjustment, halving countdown.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 shrink-0 text-[color:var(--color-amber)]">→</span>
            <span>
              <strong className="text-[color:var(--color-text-primary)]">Geographic shifts</strong>
              {' '}— node distribution, hashrate share, and government holdings changes (source-cited).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 shrink-0 text-[color:var(--color-amber)]">→</span>
            <span>
              <strong className="text-[color:var(--color-text-primary)]">Honesty</strong>
              {' '}— what the data can and cannot show. We publish the knowability ladder prominently.
            </span>
          </li>
        </ul>
      </div>

      <div className="mt-16">
        <h2 className="text-display text-2xl font-semibold text-[color:var(--color-text-primary)]">
          Archive
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-[color:var(--color-text-muted)]">
          The first issue ships soon. Past issues will be archived here — publicly readable,
          no account required.
        </p>
      </div>

      <p className="mt-12 max-w-2xl text-xs leading-relaxed text-[color:var(--color-text-muted)]">
        Self-hosted on our own server (listmonk). Your email is stored only there — not shared
        with any third party, not used for anything other than delivering the newsletter. Unsubscribe
        in one click. No tracking pixels. The infrastructure is the same privacy guarantee as the
        visualizers.
      </p>
    </div>
  );
}
