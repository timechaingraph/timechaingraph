'use client';

import { useState } from 'react';
import { useTimegridStore } from '@/store/timegridStore';
import { getActiveSubstrate } from '@/data/substrate';
import { ROLE_LABEL, ROLE_CSS } from '@/lib/role-visuals';
import { blockDate, formatBlockDate } from '@/lib/blockDate';
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

/** Compact BTC for the bond list: whole BTC with thousands commas (≥1 BTC),
 *  else up to 4 trimmed decimals. */
function btcCompact(sats: bigint): string {
  const whole = sats / SATS_PER_BTC;
  if (whole > 0n) return whole.toLocaleString();
  const frac = String(sats % SATS_PER_BTC).padStart(8, '0').slice(0, 4).replace(/0+$/, '');
  return frac ? `0.${frac}` : '0';
}

function shortAddress(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

interface BondView {
  counterpartyAddr: string;
  counterpartyRole: WalletData['role'] | null;
  sats: bigint;
  formationBlock?: number;
}

/**
 * The wallet's bonds, resolved to counterparty + size + (real) formation
 * block, sorted strongest-first. The aggregated substrate carries one bond
 * per wallet-pair, so each entry is a distinct connection. `formationBlock`
 * is present for the parquet substrate (the wired column) and absent for the
 * fixture — the UI shows the formation date only when it's known.
 */
function topBondsFor(address: string): BondView[] {
  const sub = getActiveSubstrate();
  const views: BondView[] = sub.bondsForAddress(address).map((b) => {
    const other = b.fromAddress === address ? b.toAddress : b.fromAddress;
    return {
      counterpartyAddr: other,
      counterpartyRole: sub.walletByAddress(other)?.role ?? null,
      sats: b.sats,
      formationBlock: b.formationBlock,
    };
  });
  views.sort((a, b) => (b.sats > a.sats ? 1 : b.sats < a.sats ? -1 : 0));
  return views;
}

const MAX_BONDS_SHOWN = 6;

/** ✕ — minimizes the panel to a small chip (screen real estate on the kiosk). */
function MinimizeButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Minimize inspector"
      className="text-mono -mr-1 -mt-1 rounded px-1.5 text-sm leading-none text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-gold)]"
    >
      ✕
    </button>
  );
}

export function WalletInspector() {
  const selectedAddress = useTimegridStore((s) => s.selectedWallet);
  const [collapsed, setCollapsed] = useState(false);
  const wallet = selectedAddress
    ? getActiveSubstrate().walletByAddress(selectedAddress)
    : undefined;
  const bonds = wallet ? topBondsFor(wallet.address) : [];
  // v0.1 invariant: ownerAddress === minterAddress (no transfers).
  // v0.2+ this becomes "coins held at tipBlock" once the multi-input
  // pipeline updates ownership per spend.
  const coinsOwned = wallet
    ? getActiveSubstrate().coinsOwnedBy(wallet.address).length
    : 0;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        aria-label="Restore inspector"
        className="brass-panel text-mono ml-auto block rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-secondary)] transition-colors hover:text-[color:var(--color-gold)]"
      >
        ◧ Inspector
      </button>
    );
  }

  if (!wallet) {
    return (
      <div className="brass-panel rounded-lg p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-text-muted)]">
            Inspector
          </p>
          <MinimizeButton onClick={() => setCollapsed(true)} />
        </div>
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
        <span className="flex items-center gap-2">
          {wallet.isMiner && (
            <span className="text-mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-faint)]">
              coinbase recipient
            </span>
          )}
          <MinimizeButton onClick={() => setCollapsed(true)} />
        </span>
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
      {bonds.length > 0 && (
        <div className="mt-5 border-t border-[color:var(--color-card-border)] pt-4">
          <p className="text-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-text-muted)]">
            Strongest bonds ({bonds.length})
          </p>
          <ul className="mt-3 space-y-2 text-mono text-[10px]">
            {bonds.slice(0, MAX_BONDS_SHOWN).map((b) => {
              const formed =
                b.formationBlock !== undefined
                  ? formatBlockDate(blockDate(b.formationBlock).date)
                  : null;
              return (
                <li key={b.counterpartyAddr} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{
                        background: b.counterpartyRole
                          ? ROLE_CSS[b.counterpartyRole]
                          : 'var(--color-text-faint)',
                      }}
                    />
                    <span
                      className="truncate text-[color:var(--color-text-secondary)]"
                      title={b.counterpartyAddr}
                    >
                      {shortAddress(b.counterpartyAddr)}
                    </span>
                    <span className="ml-auto shrink-0 tabular-nums text-[color:var(--color-text-primary)]">
                      {btcCompact(b.sats)} BTC
                    </span>
                  </div>
                  {formed && (
                    <span className="pl-3.5 text-[9px] tabular-nums text-[color:var(--color-text-faint)]">
                      formed {formed}
                    </span>
                  )}
                </li>
              );
            })}
            {bonds.length > MAX_BONDS_SHOWN && (
              <li className="pt-1 text-[9px] text-[color:var(--color-text-muted)]">
                + {bonds.length - MAX_BONDS_SHOWN} more
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
