import type { Metadata } from 'next';
import Link from 'next/link';
import {
  VIEW_BRAND_NAME,
  VIEW_DOMAIN,
  GITHUB_URL,
  SUPPORT_EMAIL,
} from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'FAQ',
  description: `Frequently asked questions about Timechain ${VIEW_BRAND_NAME} — what it visualises, where the Bitcoin data comes from, how privacy is enforced, and Bitcoin basics explained.`,
};

// JSON-LD structured data for Google's FAQ rich results.
// These appear as collapsed Q&A directly in search results pages.
const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: `What is Timechain ${VIEW_BRAND_NAME}?`,
      acceptedAnswer: {
        '@type': 'Answer',
        text: `Timechain ${VIEW_BRAND_NAME} draws the whole Bitcoin blockchain as a live, interactive ${VIEW_BRAND_NAME.toLowerCase()} in your browser — every significant wallet a node, every transaction a bond, the full public ledger visible without an account or login. It is free, open source (MIT), and funded only by donations.`,
      },
    },
    {
      '@type': 'Question',
      name: 'Where does the Bitcoin data come from?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'From a self-hosted Bitcoin full node (bitcoind) that the operator runs and reads directly over JSON-RPC. No third-party block explorer, no Electrum, no commercial indexer. Data is reduced offline with DuckDB and served as a static Parquet bundle from a CDN the operator controls.',
      },
    },
    {
      '@type': 'Question',
      name: 'What personal data do you collect?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: `None. There is no analytics, no cookies, no trackers, no login, and no account. The only footprint your visit leaves is standard CDN-layer server logs (IP + request path) — the same as loading any static website. Open DevTools and reload: every request targets ${VIEW_DOMAIN} only.`,
      },
    },
    {
      '@type': 'Question',
      name: 'What is a Bitcoin halving?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'A Bitcoin halving is a programmed event that cuts the block reward miners receive in half, occurring every 210,000 blocks (roughly every four years). At launch in 2009 the reward was 50 BTC per block. After four halvings it stands at 3.125 BTC. The final satoshi will be issued around the year 2140. Halvings are the mechanism that enforces the hard cap of 21 million bitcoin.',
      },
    },
    {
      '@type': 'Question',
      name: 'Who is Satoshi Nakamoto?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The pseudonymous individual or group who published the Bitcoin whitepaper on 31 October 2008 and launched the network on 3 January 2009. Satoshi mined roughly 1 million BTC in the early days, corresponding to known early-mined wallets, and disappeared from public view in late 2010. Their identity has never been confirmed.',
      },
    },
    {
      '@type': 'Question',
      name: 'How many Bitcoin wallets exist?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'There is no single answer. Hundreds of millions of addresses have ever received bitcoin, but the vast majority are dust or long-spent. The most economically significant cohort — wallets that received at least 1 BTC or participated in 100+ transactions — numbers in the low millions. That is the "Max" tier this tool renders.',
      },
    },
  ],
};

export default function FaqPage() {
  return (
    <div className="py-12 md:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
      />

      <p className="text-mono text-base uppercase tracking-[0.32em] text-[color:var(--color-accent)]">
        FAQ
      </p>
      <h1 className="text-display mt-3 text-4xl font-semibold leading-[1.05] md:text-6xl">
        Common
        <br />
        <span className="brass-shimmer">questions.</span>
      </h1>

      {/* ── About the tool ── */}
      <section className="mt-16 border-t border-[color:var(--color-card-border)] pt-10">
        <h2 className="text-display text-2xl font-semibold">
          About Timechain {VIEW_BRAND_NAME}
        </h2>
        <dl className="mt-6 max-w-2xl space-y-8 text-base leading-relaxed md:text-lg">
          <div>
            <dt className="font-semibold text-[color:var(--color-text-primary)]">
              What is Timechain {VIEW_BRAND_NAME}?
            </dt>
            <dd className="mt-2 text-[color:var(--color-text-secondary)]">
              Timechain {VIEW_BRAND_NAME} draws the whole Bitcoin blockchain as a
              live, interactive {VIEW_BRAND_NAME.toLowerCase()} in your browser —
              every significant wallet a node, every transaction a bond, the full
              public ledger visible without an account or login. It is free, open
              source, and funded only by donations.
            </dd>
          </div>

          <div>
            <dt className="font-semibold text-[color:var(--color-text-primary)]">
              Is it really free — no account, no paywall?
            </dt>
            <dd className="mt-2 text-[color:var(--color-text-secondary)]">
              Yes. Every tier, every view, every block — free forever. The source is{' '}
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[color:var(--color-gold)] underline-offset-4 hover:underline"
              >
                open on GitHub (MIT)
              </a>
              . The only thing keeping it lit is people who find it useful sending a few
              sats on the{' '}
              <Link
                href="/donate"
                className="text-[color:var(--color-amber)] underline-offset-4 hover:underline"
              >
                donate page
              </Link>
              .
            </dd>
          </div>

          <div>
            <dt className="font-semibold text-[color:var(--color-text-primary)]">
              Where does the chain data come from?
            </dt>
            <dd className="mt-2 text-[color:var(--color-text-secondary)]">
              From a self-hosted Bitcoin full node (
              <strong className="text-[color:var(--color-text-primary)]">bitcoind</strong>
              ) that the operator runs and reads directly over JSON-RPC. No third-party
              block explorer, no Electrum, no commercial indexer. The raw chain is reduced
              offline with DuckDB and shipped as a static Parquet bundle from a CDN the
              operator controls. See{' '}
              <Link
                href="/docs"
                className="text-[color:var(--color-gold)] underline-offset-4 hover:underline"
              >
                Docs
              </Link>{' '}
              for the full five-plane pipeline.
            </dd>
          </div>

          <div>
            <dt className="font-semibold text-[color:var(--color-text-primary)]">
              How current is the data?
            </dt>
            <dd className="mt-2 text-[color:var(--color-text-secondary)]">
              The dataset is a periodic snapshot rebuilt by the operator after each
              epoch — roughly weekly for early releases, more frequently as the pipeline
              matures. It shows the historical structure of the chain, not real-time
              mempool activity.
            </dd>
          </div>
        </dl>
      </section>

      {/* ── Privacy & data ── */}
      <section className="mt-16 border-t border-[color:var(--color-card-border)] pt-10">
        <h2 className="text-display text-2xl font-semibold">Privacy &amp; data collection</h2>
        <dl className="mt-6 max-w-2xl space-y-8 text-base leading-relaxed md:text-lg">
          <div>
            <dt className="font-semibold text-[color:var(--color-text-primary)]">
              What personal data do you collect about visitors?
            </dt>
            <dd className="mt-2 text-[color:var(--color-text-secondary)]">
              None. There is no analytics, no tag manager, no cookie banner, no login,
              and no form that captures personal data. The only footprint your visit
              leaves is standard CDN-layer server logs (IP + request path) — the same
              as loading any static website, and beyond our control. We never link that
              to an identity.
            </dd>
          </div>

          <div>
            <dt className="font-semibold text-[color:var(--color-text-primary)]">
              Are there cookies or trackers?
            </dt>
            <dd className="mt-2 text-[color:var(--color-text-secondary)]">
              No cookies are set. No pixels, beacons, or fingerprint scripts run. No
              data is sent to any analytics or advertising network. If you see anything
              different in your browser, that is a bug — please{' '}
              <a
                href={`${GITHUB_URL}/issues`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[color:var(--color-gold)] underline-offset-4 hover:underline"
              >
                file a report
              </a>
              .
            </dd>
          </div>

          <div>
            <dt className="font-semibold text-[color:var(--color-text-primary)]">
              How can I verify that?
            </dt>
            <dd className="mt-2 text-[color:var(--color-text-secondary)]">
              Open DevTools (
              <kbd className="rounded border border-[color:var(--color-card-border)] px-1.5 py-0.5 text-sm font-mono">
                F12
              </kbd>
              ), go to the{' '}
              <strong className="text-[color:var(--color-text-primary)]">Network</strong> tab,
              and reload. Every request should target{' '}
              <code className="text-sm text-[color:var(--color-gold)]">{VIEW_DOMAIN}</code>{' '}
              only. A CI gate on every build scans the compiled output for forbidden
              third-party domains and fails the build if any leak in — it is an enforced
              architecture invariant, not a policy statement. Read more under{' '}
              <Link
                href="/docs#verify"
                className="text-[color:var(--color-gold)] underline-offset-4 hover:underline"
              >
                Docs → Verify it yourself
              </Link>
              .
            </dd>
          </div>

          <div>
            <dt className="font-semibold text-[color:var(--color-text-primary)]">
              Is Timechain {VIEW_BRAND_NAME} GDPR compliant?
            </dt>
            <dd className="mt-2 text-[color:var(--color-text-secondary)]">
              Because no personal data is collected, stored, or processed, the GDPR&apos;s
              consent, data-subject rights, and controller-registration obligations do not
              arise — there is nothing to consent to and no data to delete or export.
              {SUPPORT_EMAIL && (
                <>
                  {' '}
                  If you believe this analysis is wrong, please reach us at{' '}
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="text-[color:var(--color-gold)] underline-offset-4 hover:underline"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                  .
                </>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {/* ── Bitcoin basics ── */}
      <section className="mt-16 border-t border-[color:var(--color-card-border)] pt-10">
        <h2 className="text-display text-2xl font-semibold">Bitcoin basics</h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-[color:var(--color-text-secondary)] md:text-lg">
          New to Bitcoin? Here are the concepts that make the most sense of what you
          are looking at.
        </p>
        <dl className="mt-8 max-w-2xl space-y-8 text-base leading-relaxed md:text-lg">
          <div>
            <dt className="font-semibold text-[color:var(--color-text-primary)]">
              What is the Bitcoin blockchain?
            </dt>
            <dd className="mt-2 text-[color:var(--color-text-secondary)]">
              A public, append-only ledger of every Bitcoin transaction ever made,
              stored as a chain of cryptographically linked blocks. Each block is sealed
              roughly every ten minutes by a miner who solves a proof-of-work puzzle.
              No single party controls it; anyone with a full node can verify the whole
              history independently.{' '}
              <em>Satoshi Nakamoto called it the &quot;timechain&quot;</em> — a chain of
              timestamped proofs. That name is this project&apos;s.
            </dd>
          </div>

          <div>
            <dt className="font-semibold text-[color:var(--color-text-primary)]">
              What is a Bitcoin halving?
            </dt>
            <dd className="mt-2 text-[color:var(--color-text-secondary)]">
              Every 210,000 blocks (roughly four years) the reward miners receive for
              finding a block is cut in half. At launch in 2009 it was 50 BTC per block;
              after four halvings it now stands at 3.125 BTC. The hard cap of 21 million
              bitcoin is enforced entirely by this schedule — the final satoshi will be
              issued around the year 2140.
            </dd>
          </div>

          <div>
            <dt className="font-semibold text-[color:var(--color-text-primary)]">
              Who is Satoshi Nakamoto?
            </dt>
            <dd className="mt-2 text-[color:var(--color-text-secondary)]">
              The pseudonymous individual or group who published the Bitcoin whitepaper
              on 31 October 2008 and launched the network on 3 January 2009. Satoshi
              mined roughly one million BTC in the earliest days and disappeared from
              public view in late 2010. Their identity has never been confirmed. The
              wallets associated with those early blocks are visible here — they have
              never moved.
            </dd>
          </div>

          <div>
            <dt className="font-semibold text-[color:var(--color-text-primary)]">
              How many Bitcoin wallets exist?
            </dt>
            <dd className="mt-2 text-[color:var(--color-text-secondary)]">
              There is no single authoritative count. Hundreds of millions of addresses
              have ever received bitcoin, but most are dust, one-time-use, or long spent.
              The most economically significant cohort — wallets that received at least
              1 BTC or made 100+ transactions — numbers in the low millions. That is
              the threshold for the Max tier this tool renders.
            </dd>
          </div>

          <div>
            <dt className="font-semibold text-[color:var(--color-text-primary)]">
              Can blockchain analysis identify me from my wallet?
            </dt>
            <dd className="mt-2 text-[color:var(--color-text-secondary)]">
              A Bitcoin address is not a name. The ledger records public keys and
              amounts — not identities. However, address reuse, UTXO-set heuristics, and
              cross-referencing with exchange KYC records can sometimes de-anonymise a
              wallet. Using a fresh address per transaction, running your own node, and
              not broadcasting your addresses to third parties all help preserve
              on-chain privacy.
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-16 border-t border-[color:var(--color-card-border)] pt-10">
        <h2 className="text-display text-2xl font-semibold">Still have a question?</h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-[color:var(--color-text-secondary)] md:text-lg">
          {SUPPORT_EMAIL ? (
            <>
              Reach us at{' '}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-[color:var(--color-gold)] underline-offset-4 hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>{' '}
              or open an issue on{' '}
            </>
          ) : (
            <>Open an issue on </>
          )}
          <a
            href={`${GITHUB_URL}/issues`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[color:var(--color-gold)] underline-offset-4 hover:underline"
          >
            GitHub
          </a>
          . Technical detail about the pipeline and privacy model lives in{' '}
          <Link
            href="/docs"
            className="text-[color:var(--color-gold)] underline-offset-4 hover:underline"
          >
            Docs
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
