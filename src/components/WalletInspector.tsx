'use client';

import { useTimegridStore } from '@/store/timegridStore';
import { FREE_TIER_50 } from '@/data/__fixtures__/free-tier-50';
import { ROLE_LABEL, ROLE_CSS } from '@/lib/role-visuals';

/**
 * WalletInspector — read-only side panel that shows metadata for the
 * currently selected wallet. Both Grid and Graph views can mount this
 * alongside their canvas; selection is driven by the shared
 * `useTimegridStore.selectedWallet` slice.
 *
 * Looks up the address in `FREE_TIER_50` for now; once the
 * BitcoinChainAdapter ships, this component will pull from the adapter
 * cache instead.
 */

const SATS_PER_BTC = 100_000_000n;

function btcFromSats(sats: bigint): string {
  const whole = sats / SATS_PER_BTC;
  const remainder = sats % SATS_PER_BTC;
  const frac = String(remainder).padStart(8, '0').slice(0, 4);
  return `${whole}.${frac}`;
}

function shortAddress(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

export function WalletInspector() {
  const selectedAddress = useTimegridStore((s) => s.selectedWallet);
  const wallet = selectedAddress
    ? FREE_TIER_50.find((w) => w.address === selectedAddress)
    : null;

  if (!wallet) {
    return (
      <div className="brass-panel rounded-lg p-5">
        <p className="text-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-text-muted)]">
          Inspector
        </p>
        <p className="mt-3 text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
          Hover or click a wallet on the lattice to inspect its
          metadata. The selection persists until you pick another.
        </p>
      </div>
    );
  }

  return (
    <div className="brass-panel rounded-lg p-5">
      <div className="flex items-baseline justify-between gap-3">
        <span
          className="text-mono text-[10px] uppercase tracking-[0.22em]"
          style={{ color: ROLE_CSS[wallet.role] }}
        >
          {ROLE_LABEL[wallet.role]}
        </span>
        {wallet.isMiner && (
          <span className="text-mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-faint)]">
            coinbase recipient
          </span>
        )}
      </div>
      <p
        className="mt-3 text-mono text-sm font-medium text-[color:var(--color-text-primary)] break-all"
        title={wallet.address}
      >
        {shortAddress(wallet.address)}
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-mono text-xs">
        <Field label="Total received" value={`${btcFromSats(wallet.totalReceivedSats)} BTC`} />
        <Field label="Tx count" value={wallet.txCount.toLocaleString()} />
        <Field label="First seen" value={`block ${wallet.firstSeenBlock.toLocaleString()}`} />
        <Field label="Last active" value={`block ${wallet.lastActiveBlock.toLocaleString()}`} />
      </dl>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
        {label}
      </dt>
      <dd className="mt-1 text-[color:var(--color-text-primary)]">{value}</dd>
    </div>
  );
}
