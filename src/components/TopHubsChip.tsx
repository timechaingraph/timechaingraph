'use client';

import { useMemo, useState } from 'react';
import { useTimegridStore } from '@/store/timegridStore';
import { getActiveSubstrate } from '@/data/substrate';
import { ROLE_CSS } from '@/lib/role-visuals';
import type { WalletData } from '@/types/wallet';

const MAX_ROWS = 5;

function shortAddress(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

function formatBtcReceived(sats: bigint): string {
  const btc = Number(sats / 100_000_000n);
  if (btc >= 1_000_000) return `${(btc / 1_000_000).toFixed(1)}M`;
  if (btc >= 1_000) return `${Math.round(btc / 1_000)}K`;
  return btc.toLocaleString();
}

interface HubRow { wallet: WalletData; metric: string }

/**
 * TopHubsChip — dual-mode scoreboard panel:
 * - "Hubs" view: top wallets by bond count (connections), filtered to
 *   bonds formed at or before currentBlock (historically accurate).
 * - "Whales" view: top wallets by total BTC received (cumulative lifetime
 *   inflow; can exceed 21M for reused hot wallets).
 *
 * Dismissible; clicking a row selects that wallet in the inspector.
 */
export function TopHubsChip() {
  const currentBlock = useTimegridStore((s) => s.currentBlock);
  const latestBlock = useTimegridStore((s) => s.latestBlock);
  const setSelectedWallet = useTimegridStore((s) => s.setSelectedWallet);
  const [dismissed, setDismissed] = useState(false);
  const [view, setView] = useState<'hubs' | 'whales'>('hubs');

  const topHubs = useMemo((): HubRow[] => {
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
      .slice(0, MAX_ROWS)
      .flatMap(([addr, count]) => {
        const wallet = sub.walletByAddress(addr);
        return wallet ? [{ wallet, metric: `${count}↔` }] : [];
      });
  }, [currentBlock, latestBlock]);

  const topWhales = useMemo((): HubRow[] => {
    if (!latestBlock) return [];
    const sub = getActiveSubstrate();
    return [...sub.wallets]
      .sort((a, b) =>
        b.totalReceivedSats > a.totalReceivedSats ? 1 :
        b.totalReceivedSats < a.totalReceivedSats ? -1 : 0,
      )
      .slice(0, MAX_ROWS)
      .map((wallet) => ({
        wallet,
        metric: `${formatBtcReceived(wallet.totalReceivedSats)} BTC`,
      }));
  }, [latestBlock]);

  const rows = view === 'hubs' ? topHubs : topWhales;

  if (dismissed || rows.length === 0) return null;

  return (
    <div className="brass-panel rounded-lg p-3">
      {/* Header: toggle tabs + dismiss */}
      <div className="mb-2 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setView('hubs')}
          aria-pressed={view === 'hubs'}
          className={[
            'text-mono text-[10px] uppercase tracking-[0.18em] transition-colors',
            view === 'hubs'
              ? 'text-[color:var(--color-amber)]'
              : 'text-[color:var(--color-text-faint)] hover:text-[color:var(--color-text-muted)]',
          ].join(' ')}
        >
          Hubs
        </button>
        <span className="text-[color:var(--color-text-faint)] text-[10px]">·</span>
        <button
          type="button"
          onClick={() => setView('whales')}
          aria-pressed={view === 'whales'}
          className={[
            'text-mono text-[10px] uppercase tracking-[0.18em] transition-colors',
            view === 'whales'
              ? 'text-[color:var(--color-amber)]'
              : 'text-[color:var(--color-text-faint)] hover:text-[color:var(--color-text-muted)]',
          ].join(' ')}
        >
          Whales
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss scoreboard"
          className="-mr-0.5 text-mono text-xs leading-none text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-gold)]"
        >
          ✕
        </button>
      </div>

      {/* Rows */}
      <ol className="space-y-1.5">
        {rows.map(({ wallet, metric }, i) => (
          <li key={wallet.address}>
            <button
              type="button"
              onClick={() => setSelectedWallet(wallet.address)}
              aria-label={`Select rank ${i + 1}: ${wallet.address}`}
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
                {metric}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
