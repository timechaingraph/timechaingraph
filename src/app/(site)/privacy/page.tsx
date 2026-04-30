import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy',
  description:
    'Privacy posture: no third-party scripts, no Google Fonts, no analytics, no fingerprinting. Source data flows from Bitcoin&apos;s P2P network into self-hosted infra.',
};

export default function PrivacyPage() {
  return (
    <div className="py-12 md:py-16">
      <p className="text-mono text-xs uppercase tracking-[0.32em] text-[color:var(--color-accent-cyan)]">
        Posture · privacy-first
      </p>
      <h1 className="text-display mt-3 text-4xl font-semibold leading-[1.05] md:text-6xl">
        What we
        <br />
        <span className="brass-shimmer">don&apos;t collect.</span>
      </h1>

      <div className="mt-10 grid gap-10 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6 text-base leading-relaxed text-[color:var(--color-text-secondary)] md:text-lg">
          <p>
            Source data flows from Bitcoin&apos;s own peer-to-peer protocol
            into a self-hosted full node (bitcoind + electrs). Extraction
            runs offline on infrastructure we control. Snapshots are
            distributed from a CDN bucket we control (Cloudflare R2). At
            no point does the viewer&apos;s browser talk to a third-party
            data provider.
          </p>
          <p>
            The viewer pages on{' '}
            <span className="text-[color:var(--color-accent-cyan)]">timechaingrid.com</span>{' '}
            and{' '}
            <span className="text-[color:var(--color-gold)]">timechaingraph.com</span>{' '}
            ship system fonts only — no Google Fonts, no Adobe Fonts, no
            CDN-hosted libraries. Verifiable with the DevTools Network tab
            during a full session: every request goes to a domain we own.
          </p>
          <p>
            The developer API at{' '}
            <span className="text-mono text-[color:var(--color-accent-cyan)]">
              api.timechaingraph.com
            </span>{' '}
            requires Google or GitHub OAuth to mint an API key. That is
            opt-in identity for developers who want a key — it lives on a
            different subdomain and never runs on the viewer. The
            viewer stays observably anonymous.
          </p>
        </div>

        <ul className="space-y-3 text-sm text-[color:var(--color-text-secondary)]">
          {[
            'Self-hosted bitcoind + electrs',
            'Static parquet on own CDN (Cloudflare R2)',
            'No third-party scripts, no Google Fonts',
            'No analytics, no fingerprinting',
            'No per-viewer telemetry',
            'Donations via Lightning — no KYC',
            'OAuth lives only on api.* subdomain',
            'Tor onion service planned for v0.3',
          ].map((line) => (
            <li key={line} className="flex items-baseline gap-3">
              <span className="text-mono text-[color:var(--color-brass-bright)]">▸</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      <section className="mt-16 border-t border-[color:var(--color-card-border)] pt-10">
        <h2 className="text-display text-2xl font-semibold">Verification</h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-[color:var(--color-text-secondary)]">
          Open DevTools, switch to the Network tab, and reload either
          domain. Every request should resolve to a domain we operate
          (timechaingrid.com, timechaingraph.com, or our own R2 bucket).
          If you see a request to anything else, that&apos;s a bug — open
          an issue.
        </p>
      </section>

      <section className="mt-12 border-t border-[color:var(--color-card-border)] pt-10">
        <h2 className="text-display text-2xl font-semibold">API user data</h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-[color:var(--color-text-secondary)]">
          For developers who sign in to the API: we store your provider
          subject (Google or GitHub user id), email (for account recovery
          only — no marketing), API key hashes, and aggregated request
          counts. We do not log per-call query strings, viewer IPs, or
          browser fingerprints. Account deletion purges everything;
          aggregate counters are anonymized.
        </p>
      </section>
    </div>
  );
}
