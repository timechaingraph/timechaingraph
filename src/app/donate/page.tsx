import type { Metadata } from 'next';
import { UnderDevelopment } from '@/components/UnderDevelopment';

export const metadata: Metadata = {
  title: 'Donate',
  description:
    'Support Timechain development. Lightning, GitHub Sponsors, OpenSats — donations only, no paid tiers.',
};

export default function DonatePage() {
  return (
    <div className="py-12 md:py-16">
      <p className="text-mono text-xs uppercase tracking-[0.32em] text-[color:var(--color-amber)]">
        Support · optional
      </p>
      <h1 className="text-display mt-3 text-4xl font-semibold leading-[1.05] md:text-6xl">
        If it&apos;s useful,
        <br />
        <span className="brass-shimmer">keep it going.</span>
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[color:var(--color-text-secondary)] md:text-xl">
        Timechain is free for everyone — Grid, Graph, API, all tiers, no
        paywall. The project runs on donations. Lightning is preferred
        because it keeps support KYC-free; cards are not currently
        accepted to keep the privacy posture clean.
      </p>

      <div className="mt-10">
        <UnderDevelopment
          targetVersion="v0.2"
          description="Donation rails go live with the first paid-feature-free release of the API. For now, watch this page for Lightning address + GitHub Sponsors links."
        />
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <Channel
          title="Lightning"
          accent="var(--color-amber)"
          body="Lightning address (LNURL). Instant settlement. No KYC. Recommended."
          status="planned"
        />
        <Channel
          title="GitHub Sponsors"
          accent="var(--color-accent-cyan)"
          body="Recurring or one-off, settled in fiat by GitHub. Configured via .github/FUNDING.yml."
          status="planned"
        />
        <Channel
          title="OpenSats"
          accent="var(--color-gold)"
          body="Grant application planned post-launch. OpenSats funds open-source Bitcoin work."
          status="post-launch"
        />
        <Channel
          title="BTCPay donate widget"
          accent="var(--color-brass-bright)"
          body='Self-hosted "donate any amount" via BTCPay Server. Privacy-first; no third-party processor.'
          status="optional"
        />
      </div>
    </div>
  );
}

function Channel({
  title,
  accent,
  body,
  status,
}: {
  title: string;
  accent: string;
  body: string;
  status: string;
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
    </div>
  );
}
