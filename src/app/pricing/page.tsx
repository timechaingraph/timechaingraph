import type { Metadata } from 'next';
import Link from 'next/link';
import { AccessTiers } from '@/components/AccessTiers';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Timechain is free for everyone. Tiers are a data-resolution choice, not a paywall. Donations support development.',
};

export default function PricingPage() {
  return (
    <div className="py-12 md:py-16">
      <p className="text-mono text-xs uppercase tracking-[0.32em] text-[color:var(--color-accent-cyan)]">
        Cost · zero
      </p>
      <h1 className="text-display mt-3 text-4xl font-semibold leading-[1.05] md:text-6xl">
        All tiers,
        <br />
        <span className="brass-shimmer">free.</span>
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[color:var(--color-text-secondary)] md:text-xl">
        Every tier is open. No paywall, no KYC, no sign-in required for
        viewing. The tier you pick is a <em>data resolution</em> choice —
        Free shows ~10k whales and miners, Pro thickens to ~500k, Max
        gives you the full ~3M-node database. Pick the density your
        browser can handle. The project is supported by{' '}
        <Link
          href="/donate"
          className="text-[color:var(--color-amber)] underline-offset-4 hover:underline"
        >
          donations
        </Link>
        .
      </p>

      <div className="mt-12">
        <AccessTiers />
      </div>

      <div className="mt-12 brass-panel rounded-lg p-6">
        <h2 className="text-display text-2xl font-semibold">Why no paywall?</h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-[color:var(--color-text-secondary)]">
          Bitcoin&apos;s ledger is public. Charging for a view of a public
          ledger feels off-brand. Instead, the project runs on donations
          (Lightning, GitHub Sponsors, and OpenSats once we&apos;re
          eligible). If you find Timechain useful, support keeps it
          going. If you don&apos;t, the data is still free.
        </p>
        <Link
          href="/donate"
          className="mt-5 inline-block text-mono text-xs uppercase tracking-wider text-[color:var(--color-amber)]"
        >
          See donation options ⟶
        </Link>
      </div>
    </div>
  );
}
