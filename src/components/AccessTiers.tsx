/**
 * AccessTiers — three data-resolution tiers. ALL FREE; the tier is a density
 * choice (browser perf vs node count), never a paywall.
 *
 * Free  → only "whale" wallets and major miners (~10k nodes visible)
 * Pro   → relaxed holdings + midsize miners (~500k nodes)
 * Max   → full database — every miner + every significant wallet (~1-3M)
 *
 * Every tier sees the same canvas, scrubber, and physics; what changes is how
 * dense the lattice gets. No payment, no sign-in — funded by donations.
 */

const TIERS: Array<{
  id: 'free' | 'pro' | 'max';
  name: string;
  price: string;
  cap: string;
  threshold: string;
  visible: string;
  bullets: string[];
}> = [
  {
    id: 'free',
    name: 'Free',
    price: '0 sats',
    cap: '~10k nodes',
    threshold: '> 1,000 BTC ever held · top miners',
    visible: 'Whales + major mining pools',
    bullets: [
      'Block-by-block scrubber across all of history',
      'Full hover + click-to-inspect on visible nodes',
      'Halving epoch quick-jumps',
      'Live current-block tail',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '0 sats',
    cap: '~500k nodes',
    threshold: '> 10 BTC ever held · midsize miners',
    visible: 'Relaxed holdings · midsize miners',
    bullets: [
      'Everything in Free',
      'Search any address in the visible set',
      'Wallet activity timeline (full history)',
      'Pre-baked physics keyframes — fluid scrubbing',
    ],
  },
  {
    id: 'max',
    name: 'Max',
    price: '0 sats',
    cap: '~1–3M nodes',
    threshold: '> 1 BTC OR > 100 lifetime txs · all miners',
    visible: 'Full database — every significant wallet',
    bullets: [
      'Everything in Pro',
      'Common-input ownership clustering',
      'Click-to-highlight wallet empires',
      'Bond density unlimited — see every tx edge',
      'Tor onion access',
    ],
  },
];

export function AccessTiers() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {TIERS.map((t) => (
        <article
          key={t.id}
          className="brass-panel relative flex flex-col gap-5 rounded-xl p-7 transition-colors"
        >
          <Header tier={t} />
          <Threshold tier={t} />
          <ul className="flex-1 space-y-2.5 text-sm text-[color:var(--color-text-secondary)]">
            {t.bullets.map((b) => (
              <li key={b} className="flex gap-2.5 leading-relaxed">
                <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[color:var(--color-brass-bright)]" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <Footer tier={t} />
        </article>
      ))}
    </div>
  );
}

function Header({ tier }: { tier: (typeof TIERS)[number] }) {
  const accent =
    tier.id === 'max'
      ? 'var(--color-gold)'
      : tier.id === 'pro'
        ? 'var(--color-amber)'
        : 'var(--color-accent-cyan)';
  return (
    <header className="flex items-baseline justify-between">
      <span
        className="text-display text-2xl font-semibold tracking-tight"
        style={{ color: accent }}
      >
        {tier.name}
      </span>
      <span className="text-mono text-xs text-[color:var(--color-text-muted)]">
        {tier.cap}
      </span>
    </header>
  );
}

function Threshold({ tier }: { tier: (typeof TIERS)[number] }) {
  return (
    <div className="border-t border-[color:var(--color-brass-border)] pt-4">
      <p className="text-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
        Visibility threshold
      </p>
      <p className="mt-2 text-mono text-xs text-[color:var(--color-text-secondary)]">
        {tier.threshold}
      </p>
    </div>
  );
}

function Footer({ tier }: { tier: (typeof TIERS)[number] }) {
  return (
    <footer className="mt-auto border-t border-[color:var(--color-brass-border)] pt-5">
      <div className="flex items-baseline justify-between">
        <span className="text-mono text-sm text-[color:var(--color-text-primary)]">
          {tier.price}
        </span>
        <span className="text-mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
          v0.1
        </span>
      </div>
      <p className="mt-2 text-mono text-[10px] text-[color:var(--color-text-faint)]">
        no sign-in · no KYC · funded by donations
      </p>
    </footer>
  );
}
