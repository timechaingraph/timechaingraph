import type { Metadata } from 'next';
import {
  DONATION_BTC_ADDRESS,
  DONATION_LIVE,
  VIEW_BRAND_NAME,
} from '@/lib/site-config';
import { DonateAddress } from '@/components/DonateAddress';

export const metadata: Metadata = {
  title: 'Support the work',
  description: `Timechain ${VIEW_BRAND_NAME} is 100% free and open source, funded only by donations. Bitcoin-native — no token, no paywall, no tracking.`,
};

export default function DonatePage() {
  return (
    <div className="py-12 md:py-16">
      <p className="text-mono text-base uppercase tracking-[0.32em] text-[color:var(--color-amber)]">
        Support the work · always optional
      </p>
      <h1 className="text-display mt-3 text-4xl font-semibold leading-[1.05] md:text-6xl">
        Free forever.
        <br />
        <span className="brass-shimmer">Funded by belief.</span>
      </h1>

      <div className="mt-6 max-w-2xl space-y-4 text-lg leading-relaxed text-[color:var(--color-text-secondary)] md:text-xl">
        <p>
          Timechain {VIEW_BRAND_NAME} is 100% free and 100% open source — every
          view, every block. No paywall, no token, no funding round,
          no ads, no tracking. We don&apos;t sell your attention because we never
          collect it.
        </p>
        <p>
          We built this because we believe in Bitcoin: a public ledger anyone
          should be able to <em>read</em> — without an account, a middleman, or a
          trace. That belief is the whole model. The only thing keeping it lit is
          people who find it useful sending a few sats.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <div className="brass-panel rounded-lg p-6">
          <div className="flex items-baseline justify-between">
            <span
              className="text-display text-xl font-semibold"
              style={{ color: 'var(--color-gold)' }}
            >
              On-chain Bitcoin
            </span>
            <span className="text-mono text-base uppercase tracking-wider text-[color:var(--color-text-muted)]">
              {DONATION_LIVE ? 'live' : 'coming'}
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
            Sent to a self-custodial address we control — no processor, no KYC,
            no middleman. Just Bitcoin, peer to peer.
          </p>
          {DONATION_LIVE ? (
            <DonateAddress
              address={DONATION_BTC_ADDRESS}
              label={`Timechain ${VIEW_BRAND_NAME}`}
            />
          ) : (
            <p className="mt-4 rounded-md border border-dashed border-[color:var(--color-card-border)] px-3 py-2 text-xs text-[color:var(--color-text-muted)]">
              The receive address goes live the moment our node is online —
              shipping with v0.1, QR code included.
            </p>
          )}
        </div>

        <div className="brass-panel rounded-lg p-6">
          <div className="flex items-baseline justify-between">
            <span
              className="text-display text-xl font-semibold"
              style={{ color: 'var(--color-amber)' }}
            >
              Lightning
            </span>
            <span className="text-mono text-base uppercase tracking-wider text-[color:var(--color-text-muted)]">
              coming
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
            Instant, low-fee sats for small tips — served from our own node
            (BTCPay), never a custodial third party. Arrives with v0.1.
          </p>
        </div>
      </div>

      <p className="mt-8 max-w-2xl text-xs leading-relaxed text-[color:var(--color-text-muted)]">
        Post-launch we&apos;ll also apply for an{' '}
        <a
          href="https://opensats.org"
          rel="noopener noreferrer"
          target="_blank"
          className="underline decoration-dotted underline-offset-2 transition-colors hover:text-[color:var(--color-text-secondary)]"
        >
          OpenSats
        </a>{' '}
        grant — it funds open-source Bitcoin work, public and audited, no
        strings. Which is exactly what this is.
      </p>

      <p className="mt-12 max-w-2xl text-sm leading-relaxed text-[color:var(--color-text-muted)]">
        No coin. No token. No funding round. The source ships open and welcomes
        audit. If it&apos;s useful and you can spare a few sats, the node thanks
        you. If you can&apos;t — it&apos;s still free, forever.
      </p>
    </div>
  );
}
