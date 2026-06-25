'use client';

import { useState } from 'react';
import { ROLE_CSS, ROLE_LABEL } from '@/lib/role-visuals';
import type { WalletRole } from '@/types/wallet';

// Ordered from rarest/most-significant to most-common, matching the graph's
// visual hierarchy. Satoshi is omitted — it's a unique node at the origin,
// self-explaining via its size and central position.
const LEGEND_ROLES: { role: WalletRole; threshold: string }[] = [
  { role: 'miner', threshold: 'coinbase recipient' },
  { role: 'whale', threshold: '> 1,000 BTC ever' },
  { role: 'significant', threshold: '> 1 BTC or ≥ 100 txs' },
  { role: 'dust', threshold: '< 1 BTC, < 100 txs' },
];

export function WalletLegend() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="brass-panel rounded-lg px-3.5 py-3 text-left">
      <div className="mb-2 flex items-center justify-between gap-4">
        <span className="text-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-brass-bright)]">
          Wallet types
        </span>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss legend"
          className="text-mono text-[10px] text-[color:var(--color-text-secondary)] transition-colors hover:text-[color:var(--color-gold)]"
        >
          ×
        </button>
      </div>
      <ul className="space-y-1.5">
        {LEGEND_ROLES.map(({ role, threshold }) => (
          <li key={role} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: ROLE_CSS[role] }}
            />
            <span className="text-mono text-[11px] text-[color:var(--color-text-primary)]">
              {ROLE_LABEL[role]}
            </span>
            <span className="text-mono text-[10px] text-[color:var(--color-text-secondary)]">
              — {threshold}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
