/**
 * HalvingTimeline — visual ribbon of Bitcoin's halving events.
 *
 * Five major waypoints from genesis to projected next halving, each rendered
 * as a brass gear-icon over a horizontal track. Static for the in-development
 * landing; future: clicking a waypoint scrubs the lattice to that block.
 */

const HALVINGS: Array<{
  height: number;
  year: string;
  reward: string;
  label: string;
}> = [
  { height: 0,        year: '2009', reward: '50 BTC',     label: 'Genesis' },
  { height: 210000,   year: '2012', reward: '25 BTC',     label: 'First halving' },
  { height: 420000,   year: '2016', reward: '12.5 BTC',   label: 'Second halving' },
  { height: 630000,   year: '2020', reward: '6.25 BTC',   label: 'Third halving' },
  { height: 840000,   year: '2024', reward: '3.125 BTC',  label: 'Fourth halving' },
  { height: 1050000,  year: '~2028', reward: '1.5625 BTC', label: 'Fifth halving' },
];

export function HalvingTimeline() {
  return (
    <div className="brass-panel rounded-lg p-6 md:p-8">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-mono text-[10px] uppercase tracking-[0.24em] text-[color:var(--color-brass-bright)]">
          Halving epochs
        </span>
        <span className="text-mono text-[10px] tracking-wider text-[color:var(--color-text-muted)]">
          genesis → projected
        </span>
      </div>

      {/* Track */}
      <div className="relative mt-8 h-px w-full bg-gradient-to-r from-transparent via-[color:var(--color-brass)] to-transparent" />

      {/* Markers — overlap the track */}
      <div className="relative -mt-3 grid grid-cols-6 gap-2 md:gap-4">
        {HALVINGS.map((h, i) => (
          <Marker key={h.height} halving={h} index={i} isLast={i === HALVINGS.length - 1} />
        ))}
      </div>
    </div>
  );
}

function Marker({
  halving,
  index,
  isLast,
}: {
  halving: (typeof HALVINGS)[number];
  index: number;
  isLast: boolean;
}) {
  // The first 5 are real (past + current); the last is projected. The first
  // is genesis (gold), the rest are brass, the projected one is dimmed cyan.
  const isGenesis = index === 0;
  const dotColor = isGenesis
    ? 'var(--color-gold)'
    : isLast
      ? 'var(--color-accent-cyan-dim)'
      : 'var(--color-brass)';
  const labelColor = isLast
    ? 'var(--color-accent-cyan-dim)'
    : 'var(--color-text-secondary)';

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span
        className="block h-3 w-3 rounded-full"
        style={{
          background: dotColor,
          boxShadow: `0 0 10px ${dotColor}`,
          opacity: isLast ? 0.55 : 1,
        }}
      />
      <span
        className="text-mono text-xs font-medium md:text-sm"
        style={{ color: labelColor }}
      >
        {halving.year}
      </span>
      <span className="text-mono text-[10px] text-[color:var(--color-text-muted)] md:text-xs">
        {halving.reward}
      </span>
      <span
        className="hidden text-mono text-[9px] uppercase tracking-wider md:block"
        style={{ color: 'var(--color-text-faint)' }}
      >
        {halving.label}
      </span>
    </div>
  );
}
