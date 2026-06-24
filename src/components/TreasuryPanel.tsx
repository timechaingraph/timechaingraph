'use client';

import { useEffect, useState } from 'react';

// Infra cost constants — FIN role fills actual numbers before ship.
const MONTHLY_R2_COST_USD = 1;     // near $0 currently; rises with traffic
const MONTHLY_VM_COST_USD = 0;     // Oracle Always Free ARM VM
const YEARLY_DOMAIN_COST_USD = 40; // three domains × ~$13/yr

interface TreasuryStatus {
  generated_at: string;
  balance_sat: number;
  balance_btc: string;
  address_truncated: string;
  stale_after_days: number;
  btc_price_usd?: number;
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function runwayMonths(balanceBtc: string, priceUsd: number): number | null {
  const monthly =
    MONTHLY_R2_COST_USD + MONTHLY_VM_COST_USD + YEARLY_DOMAIN_COST_USD / 12;
  if (monthly <= 0) return null;
  return Math.floor((parseFloat(balanceBtc) * priceUsd) / monthly);
}

export function TreasuryPanel() {
  const [data, setData] = useState<TreasuryStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch('/treasury-status.json')
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<TreasuryStatus>;
      })
      .then((d) => {
        if (live) setData(d);
      })
      .catch(() => {
        console.warn('[TreasuryPanel] treasury-status.json unavailable');
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const age = data ? daysSince(data.generated_at) : 0;
  const stale = data ? age > data.stale_after_days : false;
  const runway =
    data?.btc_price_usd != null
      ? runwayMonths(data.balance_btc, data.btc_price_usd)
      : null;

  return (
    <div className="brass-panel mt-12 rounded-lg p-6">
      <p
        className="text-mono text-xs uppercase tracking-[0.28em]"
        style={{ color: 'var(--color-accent)' }}
      >
        Treasury
      </p>

      {!data && !failed && (
        <div
          className="mt-4 animate-pulse space-y-2"
          aria-busy="true"
          aria-label="Loading treasury data"
        >
          <div className="h-8 w-40 rounded bg-white/5" />
          <div className="h-4 w-56 rounded bg-white/5" />
          <div className="h-4 w-32 rounded bg-white/5" />
        </div>
      )}

      {failed && (
        <p className="mt-4 text-sm text-[color:var(--color-text-muted)]">
          Treasury data unavailable — check back soon.
        </p>
      )}

      {data && (
        <div className="mt-4 space-y-4">
          <div>
            <p
              className="text-mono text-3xl font-semibold"
              style={{ color: 'var(--color-accent)' }}
            >
              ₿ {data.balance_btc}
            </p>
            <p className="text-mono mt-1 text-sm text-[color:var(--color-text-muted)]">
              {data.address_truncated}
            </p>
            <p className="text-mono mt-1 text-xs text-[color:var(--color-text-faint)]">
              Last updated: {age} day{age !== 1 ? 's' : ''} ago
              {stale && (
                <span className="ml-2 text-[color:var(--color-text-muted)]">
                  — balance may be outdated
                </span>
              )}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-[color:var(--color-text-secondary)]">
              What donations fund:
            </p>
            <ul className="text-mono mt-2 space-y-1 text-xs text-[color:var(--color-text-muted)]">
              <li>• Chain data CDN (Cloudflare R2) ~${MONTHLY_R2_COST_USD}/mo</li>
              <li>
                • Self-custodial Lightning node (Oracle ARM VM) ${MONTHLY_VM_COST_USD}/mo
                (free tier)
              </li>
              <li>• Three domains ~${YEARLY_DOMAIN_COST_USD}/yr</li>
            </ul>
          </div>

          {runway !== null && (
            <div>
              <p className="text-sm text-[color:var(--color-text-secondary)]">
                Runway:{' '}
                <span
                  className="text-mono font-semibold"
                  style={{ color: 'var(--color-accent)' }}
                >
                  ~{runway} month{runway !== 1 ? 's' : ''}
                </span>{' '}
                at current burn
              </p>
              <p className="text-mono mt-1 text-xs text-[color:var(--color-text-faint)]">
                Balance ÷ monthly infrastructure cost. Excludes maintainer.
              </p>
            </div>
          )}

          <p className="text-xs leading-relaxed text-[color:var(--color-text-muted)]">
            Every sat donated funds the infrastructure that keeps this site free and
            private. Cloudflare R2 serves the chain data bundle; a self-hosted node
            handles donations. No maintainer salary is drawn until the treasury can
            sustain it.
          </p>
        </div>
      )}
    </div>
  );
}
