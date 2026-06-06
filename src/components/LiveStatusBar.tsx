/**
 * LiveStatusBar — cyber-steampunk dashboard strip.
 *
 * Mock metrics for the in-development landing. Numbers are static but
 * styled to feel alive (subtle status pulse, monospace ticker font,
 * brass-framed segments). Future: replace values with real data from
 * the BitcoinChainAdapter.
 */

const SEGMENTS: Array<{ label: string; value: string; tone: 'amber' | 'gold' }> = [
  { label: 'Block height', value: '~876,500', tone: 'amber' },
  { label: 'Cycle', value: '~10 min', tone: 'gold' },
  { label: 'Halvings', value: '4 / ∞', tone: 'gold' },
  { label: 'Wallets indexed', value: '1.0M – 3.0M', tone: 'amber' },
  { label: 'Live tail', value: 'P2P', tone: 'amber' },
];

const TONE_COLOR: Record<'amber' | 'gold', string> = {
  amber: 'var(--color-amber)',
  gold: 'var(--color-gold)',
};

export function LiveStatusBar() {
  return (
    <div className="brass-panel rounded-md px-1 py-0.5">
      <div className="flex items-center divide-x divide-[color:var(--color-brass-border)] overflow-x-auto">
        <Indicator />
        {SEGMENTS.map((seg) => (
          <div
            key={seg.label}
            className="flex shrink-0 flex-col gap-0.5 px-4 py-2 md:px-5"
          >
            <span className="text-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
              {seg.label}
            </span>
            <span
              className="text-mono text-sm font-medium"
              style={{ color: TONE_COLOR[seg.tone] }}
            >
              {seg.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Indicator() {
  return (
    <div className="flex shrink-0 items-center gap-2 px-4 py-2 md:px-5">
      <span className="status-dot" aria-hidden />
      <span className="text-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-text-secondary)]">
        Network
      </span>
      <span className="text-mono text-xs text-[color:var(--color-accent)]">
        Mainnet
      </span>
    </div>
  );
}
