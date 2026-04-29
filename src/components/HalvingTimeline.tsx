'use client';

import { useTimegridStore } from '@/store/timegridStore';

/**
 * HalvingTimeline — visual ribbon of Bitcoin's halving events.
 *
 * Six waypoints from genesis to the projected fifth halving. Each marker
 * is a clickable button: tapping a marker scrubs the lattice to that
 * block via `useTimegridStore.setCurrentBlock`. The current block in
 * the store is highlighted (brighter dot, brass ring).
 */

const HALVINGS: Array<{
  height: number;
  year: string;
  reward: string;
  label: string;
}> = [
  { height: 0,        year: '2009',  reward: '50 BTC',     label: 'Genesis' },
  { height: 210000,   year: '2012',  reward: '25 BTC',     label: 'First halving' },
  { height: 420000,   year: '2016',  reward: '12.5 BTC',   label: 'Second halving' },
  { height: 630000,   year: '2020',  reward: '6.25 BTC',   label: 'Third halving' },
  { height: 840000,   year: '2024',  reward: '3.125 BTC',  label: 'Fourth halving' },
  { height: 1050000,  year: '~2028', reward: '1.5625 BTC', label: 'Fifth halving' },
];

export function HalvingTimeline() {
  const currentBlock = useTimegridStore((s) => s.currentBlock);
  const latestBlock = useTimegridStore((s) => s.latestBlock);
  const setCurrentBlock = useTimegridStore((s) => s.setCurrentBlock);

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

      <div className="relative mt-8 h-px w-full bg-gradient-to-r from-transparent via-[color:var(--color-brass)] to-transparent" />

      <div className="relative -mt-3 grid grid-cols-6 gap-2 md:gap-4">
        {HALVINGS.map((h, i) => (
          <Marker
            key={h.height}
            halving={h}
            index={i}
            isLast={i === HALVINGS.length - 1}
            isActive={isActiveHalving(currentBlock, h.height, HALVINGS, i)}
            disabled={latestBlock > 0 && h.height > latestBlock}
            onSelect={() => setCurrentBlock(h.height)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Highlight the marker corresponding to the current epoch:
 *   active = the highest halving whose height ≤ currentBlock
 */
function isActiveHalving(
  currentBlock: number,
  height: number,
  all: typeof HALVINGS,
  index: number,
): boolean {
  // The active marker is the latest halving at or below currentBlock.
  // For index i, it's active iff: height[i] ≤ currentBlock AND
  // (i is last OR height[i+1] > currentBlock).
  const next = all[index + 1];
  return height <= currentBlock && (!next || next.height > currentBlock);
}

function Marker({
  halving,
  index,
  isLast,
  isActive,
  disabled,
  onSelect,
}: {
  halving: (typeof HALVINGS)[number];
  index: number;
  isLast: boolean;
  isActive: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const isGenesis = index === 0;
  const baseColor = isGenesis
    ? 'var(--color-gold)'
    : isLast
      ? 'var(--color-accent-cyan-dim)'
      : 'var(--color-brass)';
  const dotColor = isActive ? 'var(--color-amber)' : baseColor;
  const labelColor = isLast
    ? 'var(--color-accent-cyan-dim)'
    : isActive
      ? 'var(--color-text-primary)'
      : 'var(--color-text-secondary)';

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      aria-label={`Scrub to ${halving.label} (block ${halving.height.toLocaleString()})`}
      aria-pressed={isActive}
      className="group flex flex-col items-center gap-2 rounded text-center transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
    >
      <span
        className="block h-3 w-3 rounded-full transition-transform group-hover:scale-125"
        style={{
          background: dotColor,
          boxShadow: `0 0 ${isActive ? 16 : 10}px ${dotColor}`,
          opacity: isLast && !isActive ? 0.55 : 1,
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
    </button>
  );
}
