'use client';

import { useTimegridStore } from '@/store/timegridStore';
import { FIXTURE_SUBSTRATE } from '@/data/substrate';
import { ROLE_LABEL, ROLE_CSS } from '@/lib/role-visuals';
import type { WalletData } from '@/types/wallet';

/**
 * WalletInspector — read-only side panel that shows metadata for the
 * currently selected wallet. Both Grid and Graph views can mount this
 * alongside their canvas; selection is driven by the shared
 * `useTimegridStore.selectedWallet` slice.
 *
 * Reads through the `ChainSubstrate` contract (`FIXTURE_SUBSTRATE` in
 * v0.1, R2/parquet-backed in v0.2+). Substrate accessors are O(1) via
 * precomputed address indices, so this panel renders in constant time
 * regardless of total coin/bond count.
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

function findNeighbors(address: string): WalletData[] {
  const bonds = FIXTURE_SUBSTRATE.bondsForAddress(address);
  const neighborAddrs = new Set<string>();
  for (const bond of bonds) {
    if (bond.fromAddress === address) neighborAddrs.add(bond.toAddress);
    else if (bond.toAddress === address) neighborAddrs.add(bond.fromAddress);
  }
  const result: WalletData[] = [];
  for (const addr of neighborAddrs) {
    const w = FIXTURE_SUBSTRATE.walletByAddress(addr);
    if (w) result.push(w);
  }
  return result;
}

const MAX_NEIGHBORS_SHOWN = 5;

export function WalletInspector() {
  const selectedAddress = useTimegridStore((s) => s.selectedWallet);
  const wallet = selectedAddress
    ? FIXTURE_SUBSTRATE.walletByAddress(selectedAddress)
    : undefined;
  const neighbors = wallet ? findNeighbors(wallet.address) : [];
  // v0.1 invariant: ownerAddress === minterAddress (no transfers).
  // v0.2+ this becomes "coins held at tipBlock" once the multi-input
  // pipeline updates ownership per spend.
  const coinsOwned = wallet
    ? FIXTURE_SUBSTRATE.coinsOwnedBy(wallet.address).length
    : 0;

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
      {coinsOwned > 0 && (
        <p className="mt-4 text-mono text-xs">
          <span className="text-[color:var(--color-text-muted)]">
            Coins owned (demo roster):{' '}
          </span>
          <span className="font-semibold text-[color:var(--color-amber)]">
            {coinsOwned.toLocaleString()}
          </span>
        </p>
      )}
      {neighbors.length > 0 && (
        <div className="mt-5 border-t border-[color:var(--color-card-border)] pt-4">
          <p className="text-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-text-muted)]">
            Connections ({neighbors.length})
          </p>
          <ul className="mt-3 space-y-1.5 text-mono text-[10px]">
            {neighbors.slice(0, MAX_NEIGHBORS_SHOWN).map((n) => (
              <li key={n.address} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: ROLE_CSS[n.role] }}
                />
                <span
                  className="truncate text-[color:var(--color-text-secondary)]"
                  title={n.address}
                >
                  {n.address.slice(0, 8)}…{n.address.slice(-4)}
                </span>
                <span className="ml-auto shrink-0 text-[color:var(--color-text-muted)]">
                  {ROLE_LABEL[n.role]}
                </span>
              </li>
            ))}
            {neighbors.length > MAX_NEIGHBORS_SHOWN && (
              <li className="pt-1 text-[9px] text-[color:var(--color-text-muted)]">
                + {neighbors.length - MAX_NEIGHBORS_SHOWN} more
              </li>
            )}
          </ul>
        </div>
      )}
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
