'use client';

import { useTimegridStore } from '@/store/timegridStore';
import { WalletInspector } from '@/components/WalletInspector';

/**
 * MobileWalletSheet — tap-to-inspect bottom sheet for small screens (<lg).
 *
 * The desktop inspector column is `hidden lg:flex`, so on a phone a tap selects
 * a wallet with nowhere to show it — a dead-end. This sheet renders the same
 * WalletInspector anchored above the play bar, only when a wallet is selected,
 * with an explicit Close that clears the selection (the inspector's own ✕ only
 * minimizes). It subscribes to the store itself so selection changes never
 * re-render the heavy GraphCanvas / PixiJS tree.
 */
export function MobileWalletSheet() {
  const selectedWallet = useTimegridStore((s) => s.selectedWallet);
  const setSelectedWallet = useTimegridStore((s) => s.setSelectedWallet);
  if (!selectedWallet) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 flex justify-center px-3 lg:hidden">
      <div className="pointer-events-auto w-full max-w-md">
        <div className="mb-1 flex justify-end">
          <button
            type="button"
            onClick={() => setSelectedWallet(null)}
            aria-label="Close wallet inspector"
            className="brass-panel text-mono rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-secondary)] transition-colors hover:text-[color:var(--color-gold)]"
          >
            Close ✕
          </button>
        </div>
        <div className="max-h-[45vh] overflow-y-auto">
          <WalletInspector />
        </div>
      </div>
    </div>
  );
}
