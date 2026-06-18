import type { Metadata } from 'next';
import { UnderDevelopment } from '@/components/UnderDevelopment';
import { VIEW_BRAND_NAME, VIEW_DOMAIN, GITHUB_URL } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Documentation',
  description:
    'How Timechain works: a self-hosted Bitcoin pipeline (bitcoind → DuckDB → Parquet → in-browser DuckDB-Wasm), the honest same-origin residual, and how to verify the privacy claim yourself in your browser.',
};

const REPO_THREAT_MODEL = `${GITHUB_URL}/blob/main/docs/THREAT_MODEL.md`;
const REPO_INFRA = `${GITHUB_URL}/blob/main/docs/INFRA_storage_and_serving.md`;

// View-agnostic on purpose: prose avoids "wallets/bonds" (Graph) vs
// "coins/tiles" (Grid) so this file stays byte-identical between siblings.
const PIPELINE: Array<{ plane: string; title: string; body: string }> = [
  {
    plane: 'Operator plane · offline',
    title: 'Self-hosted bitcoind',
    body: 'Source data comes from Bitcoin’s own peer-to-peer network into a full node the operator runs, read directly over JSON-RPC (getblock v3). No third-party indexer or block explorer is ever involved.',
  },
  {
    plane: 'Operator plane · offline',
    title: 'Reduce with DuckDB',
    body: 'An out-of-core DuckDB pass distills the chain down to just the slice this view renders — running in bounded memory on the operator’s machine, with no cloud service involved.',
  },
  {
    plane: 'Operator plane · offline',
    title: 'Carve a static Parquet bundle',
    body: 'The result is exported as a static, columnar Parquet bundle plus a manifest — a plain file you can inspect, with nothing viewer-specific in it.',
  },
  {
    plane: 'Serving plane',
    title: 'Serve from our own origin',
    body: `The bundle is published to a storage bucket we control (Cloudflare R2) and served from ${VIEW_DOMAIN}. No library, font, or asset is loaded from anyone else.`,
  },
  {
    plane: 'Serving plane · your browser',
    title: 'Query locally with DuckDB-Wasm',
    body: 'Your browser HTTP-range-reads only the slices it needs and runs every query locally in self-hosted DuckDB-Wasm. The analysis happens on your machine — there is no backend to send it to.',
  },
];

export default function DocsPage() {
  return (
    <div className="py-12 md:py-16">
      <p className="text-mono text-base uppercase tracking-[0.32em] text-[color:var(--color-accent)]">
        How it works
      </p>
      <h1 className="text-display mt-3 text-4xl font-semibold leading-[1.05] md:text-6xl">
        Observably
        <br />
        <span className="brass-shimmer">private.</span>
      </h1>

      <div className="mt-10 max-w-2xl space-y-6 text-base leading-relaxed text-[color:var(--color-text-secondary)] md:text-lg">
        <p>
          Timechain {VIEW_BRAND_NAME} draws the whole Bitcoin chain in your
          browser — and it does so without telling anyone you looked. That
          isn’t a promise printed on a page; it’s a property of how the thing
          is built, and you can check it yourself in under a minute (
          <a
            href="#verify"
            className="text-[color:var(--color-gold)] underline-offset-4 hover:underline"
          >
            jump to how
          </a>
          ).
        </p>
      </div>

      <section className="mt-16 border-t border-[color:var(--color-card-border)] pt-10">
        <h2 className="text-display text-2xl font-semibold">The pipeline</h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-[color:var(--color-text-secondary)] md:text-lg">
          The chain data is built offline by the operator and shipped as a
          static file. The browser never talks to a block explorer, an
          indexer, or any third-party API — it reads one bundle from our own
          origin and queries it locally.
        </p>
        <ol className="mt-8 space-y-4">
          {PIPELINE.map((step, i) => (
            <li
              key={step.title}
              className="brass-panel flex gap-4 rounded-lg p-5"
              style={{ borderColor: 'var(--color-card-border)' }}
            >
              <span
                className="text-mono text-sm font-semibold"
                style={{ color: 'var(--color-brass-bright)' }}
                aria-hidden
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <p className="text-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-accent)]">
                  {step.plane}
                </p>
                <p className="mt-1 font-semibold text-[color:var(--color-text-primary)]">
                  {step.title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16 border-t border-[color:var(--color-card-border)] pt-10">
        <h2 className="text-display text-2xl font-semibold">What your visit reveals</h2>
        <div className="mt-4 max-w-2xl space-y-4 text-base leading-relaxed text-[color:var(--color-text-secondary)] md:text-lg">
          <p>
            <strong className="text-[color:var(--color-text-primary)]">
              To our origin ({VIEW_DOMAIN}):
            </strong>{' '}
            ordinary requests for static files — the page, its scripts and
            styles, system fonts, the Parquet data bundle, and the DuckDB-Wasm
            engine. The same footprint as loading any static website.
          </p>
          <p>
            <strong className="text-[color:var(--color-text-primary)]">
              To any third party:
            </strong>{' '}
            nothing. No analytics, no tag managers, no CDN-hosted libraries, no
            web fonts, no telemetry, no cookies tied to you. There is no server
            that could log your queries, because the queries run in your browser.
          </p>
        </div>
      </section>

      <section
        id="verify"
        className="mt-16 border-t border-[color:var(--color-card-border)] pt-10"
      >
        <h2 className="text-display text-2xl font-semibold">Verify it yourself</h2>
        <ul className="mt-4 max-w-2xl space-y-3 text-base leading-relaxed text-[color:var(--color-text-secondary)] md:text-lg">
          <li>
            <strong className="text-[color:var(--color-text-primary)]">
              Open DevTools → Network
            </strong>{' '}
            and reload. Every request targets {VIEW_DOMAIN}. If you ever see a
            third-party domain, that is a bug — please report it.
          </li>
          <li>
            <strong className="text-[color:var(--color-text-primary)]">
              Read the audit.
            </strong>{' '}
            Every push runs a privacy audit that scans the built site for
            forbidden third-party domains (Google Fonts/Analytics, common CDNs,
            trackers) and fails the build if one leaks in. The boundary is a
            required green check, not a pinky-swear.
          </li>
        </ul>
      </section>

      <section className="mt-16 border-t border-[color:var(--color-card-border)] pt-10">
        <h2 className="text-display text-2xl font-semibold">One honest caveat</h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-[color:var(--color-text-secondary)] md:text-lg">
          A network observer (your ISP, a state-level watcher) can still see
          that you connected to {VIEW_DOMAIN} at all — that is true of every
          website. If that matters to you, reach the site over Tor; a dedicated
          onion service is on the roadmap. What we can promise is that nothing
          on our side ever links a visit to a person.
        </p>
      </section>

      <section className="mt-16 border-t border-[color:var(--color-card-border)] pt-10">
        <h2 className="text-display text-2xl font-semibold">Read the source</h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-[color:var(--color-text-secondary)] md:text-lg">
          This page is the short version. The formal, checkable detail lives in
          the repository:
        </p>
        <ul className="mt-4 max-w-2xl space-y-2 text-base leading-relaxed text-[color:var(--color-text-secondary)] md:text-lg">
          <li>
            <a
              href={REPO_THREAT_MODEL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[color:var(--color-gold)] underline-offset-4 hover:underline"
            >
              Threat model &amp; privacy posture
            </a>{' '}
            — the priorities, the data flow, what is enforced and how.
          </li>
          <li>
            <a
              href={REPO_INFRA}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[color:var(--color-gold)] underline-offset-4 hover:underline"
            >
              Storage &amp; serving infrastructure
            </a>{' '}
            — how the bundle is built and served without touching your privacy.
          </li>
          <li>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[color:var(--color-gold)] underline-offset-4 hover:underline"
            >
              The full source on GitHub
            </a>{' '}
            — read it, audit it, run it yourself.
          </li>
        </ul>
      </section>

      <section className="mt-16 border-t border-[color:var(--color-card-border)] pt-10">
        <h2 className="text-display text-2xl font-semibold">API reference</h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-[color:var(--color-text-secondary)] md:text-lg">
          A documented, self-hosted developer API over the same public dataset —
          endpoints, a getting-started guide, and a sandboxed query cookbook — is
          planned.
        </p>
        <div className="mt-6">
          <UnderDevelopment
            targetVersion="v0.4"
            title="API reference"
            description="The API and its docs ship together. The first chapters cover the v1 endpoint catalogue, authentication, and the sandboxed query interface — rendered via self-hosted Scalar, no third-party CDN."
          />
        </div>
      </section>
    </div>
  );
}
