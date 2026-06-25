'use client';

import { useMemo, useState } from 'react';
import { useTimegridStore } from '@/store/timegridStore';
import { getActiveSubstrate } from '@/data/substrate';
import { ROLE_CSS } from '@/lib/role-visuals';
import type { WalletData } from '@/types/wallet';

const MAX_HUBS = 5;

function shortAddress(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

interface HubEntry {
  wallet: WalletData;
  count: number;
}

/**
 * TopHubsChip — shows the top MAX_HUBS most-connected wallets at the current
 * scrubber block. Bond counts are computed from bonds whose formationBlock is
 * at or before currentBlock (bonds with no formationBlock are always included).
 * Clicking a hub selects it in the inspector. Dismissible.
 */
export function TopHubsChip() {
  const currentBlock = useTimegridStore((s) => s.currentBlock);
  const latestBlock = useTimegridStore((s) => s.latestBlock);
  const setSelectedWallet = useTimegridStore((s) => s.setSelectedWallet);
  const [dismissed, setDismissed] = useState(false);

  const topHubs = useMemo((): HubEntry[] => {
    if (!latestBlock) return [];
    const sub = getActiveSubstrate();
    const bondCounts = new Map<string, number>();
    for (const bond of sub.bonds) {
      if (bond.formationBlock !== undefined && bond.formationBlock > currentBlock) continue;
      bondCounts.set(bond.fromAddress, (bondCounts.get(bond.fromAddress) ?? 0) + 1);
      bondCounts.set(bond.toAddress, (bondCounts.get(bond.toAddress) ?? 0) + 1);
    }
    return [...bondCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_HUBS)
      .flatMap(([addr, count]) => {
        const wallet = sub.walletByAddress(addr);
        return wallet ? [{ wallet, count }] : [];
      });
  }, [currentBlock, latestBlock]);

  if (dismissed || topHubs.length === 0) return null;

  return (
    <div className="brass-panel rounded-lg p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-text-muted)]">
          Top hubs
        </span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss top hubs"
          className="-mr-0.5 text-mono text-xs leading-none text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-gold)]"
        >
          ✕
        </button>
      </div>
      <ol className="space-y-1.5">
        {topHubs.map(({ wallet, count }, i) => (
          <li key={wallet.address}>
            <button
              type="button"
              onClick={() => setSelectedWallet(wallet.address)}
              aria-label={`Select hub ${i + 1}: ${wallet.address}`}
              className="flex w-full items-center gap-2 text-left text-mono text-[10px] text-[color:var(--color-text-secondary)] transition-colors hover:text-[color:var(--color-text-primary)]"
            >
              <span className="w-3 shrink-0 text-[9px] tabular-nums text-[color:var(--color-text-faint)]">
                {i + 1}
              </span>
              <span
                aria-hidden
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: ROLE_CSS[wallet.role] }}
              />
              <span className="flex-1 truncate">{shortAddress(wallet.address)}</span>
              <span className="shrink-0 tabular-nums text-[color:var(--color-amber)]">
                {count}↔
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
