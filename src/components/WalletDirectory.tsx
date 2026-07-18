'use client';

/**
 * WalletDirectory — the off-screen, keyboard/SR-focusable wallet list (the
 * UX#5 follow-up). The canvas wallet sprites aren't in the DOM and TopHubsChip
 * surfaces only the top 5; this visually-hidden (`sr-only`) nav lists the most
 * significant wallets so screen-reader + keyboard users can reach far more of
 * them. Activating an entry selects that wallet in the inspector.
 *
 * Bounded to the top MAX by lifetime received: rendering all ~12k wallets as
 * hidden focusable buttons would bloat the DOM and make SR-traversal
 * impractical; the top MAX covers every whale + major hub — the meaningful set.
 */
import { useMemo } from 'react';
import { useTimegridStore } from '@/store/timegridStore';
import { getActiveSubstrate } from '@/data/substrate';

const MAX = 200;

export function WalletDirectory() {
  const latestBlock = useTimegridStore((s) => s.latestBlock);
  const setSelectedWallet = useTimegridStore((s) => s.setSelectedWallet);

  const wallets = useMemo(() => {
    if (!latestBlock) return [];
    const sub = getActiveSubstrate();
    return [...sub.wallets]
      .sort((a, b) =>
        b.totalReceivedSats > a.totalReceivedSats ? 1 :
        b.totalReceivedSats < a.totalReceivedSats ? -1 : 0,
      )
      .slice(0, MAX);
  }, [latestBlock]);

  if (wallets.length === 0) return null;

  return (
    <nav
      className="sr-only"
      aria-label="Wallet directory — top wallets, keyboard and screen-reader accessible"
    >
      <ul>
        {wallets.map((w, i) => (
          <li key={w.address}>
            <button
              type="button"
              onClick={() => setSelectedWallet(w.address)}
              aria-label={`Wallet ${i + 1} of ${wallets.length}: ${w.address}`}
            >
              {w.address}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
