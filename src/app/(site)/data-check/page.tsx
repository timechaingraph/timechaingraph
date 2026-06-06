'use client';

/**
 * /data-check — pipeline validation page (not linked in nav).
 *
 * Loads the v0.1.0 parquet bundle in the browser via self-hosted
 * DuckDB-Wasm and shows what came back: proof that R2 parquet → DuckDB-Wasm →
 * ChainSubstrate works end-to-end with real chain data, before wiring the
 * PixiJS GraphView (M5). r2-substrate is dynamically imported inside the
 * effect so the WASM module graph never enters SSR/prerender.
 */
import { useEffect, useState } from 'react';
import type { WalletRole } from '@/types/wallet';

interface CheckResult {
  tipBlock: number;
  wallets: number;
  bonds: number;
  roles: Record<string, number>;
  top: { address: string; btc: string; role: WalletRole }[];
  ms: number;
}

export default function DataCheck() {
  const [status, setStatus] = useState('Booting DuckDB-Wasm + fetching parquet…');
  const [res, setRes] = useState<CheckResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t0 = performance.now();
        const { R2ChainSubstrate } = await import('@/data/r2-substrate');
        const sub = await new R2ChainSubstrate().init();
        if (cancelled) return;
        const roles: Record<string, number> = {};
        for (const w of sub.wallets) roles[w.role] = (roles[w.role] ?? 0) + 1;
        const top = [...sub.wallets]
          .sort((a, b) => (b.totalReceivedSats > a.totalReceivedSats ? 1 : -1))
          .slice(0, 10)
          .map((w) => ({
            address: w.address,
            btc: (Number(w.totalReceivedSats) / 1e8).toLocaleString(undefined, { maximumFractionDigits: 0 }),
            role: w.role,
          }));
        setRes({
          tipBlock: sub.tipBlock,
          wallets: sub.wallets.length,
          bonds: sub.bonds.length,
          roles,
          top,
          ms: Math.round(performance.now() - t0),
        });
        setStatus('');
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="py-12">
      <h1 className="text-display hero-gradient text-4xl font-bold">DuckDB-Wasm data check</h1>
      <p className="mt-3 max-w-2xl text-pretty leading-relaxed text-[color:var(--color-text-secondary)]">
        Loads the <code>v0.1.0</code> parquet bundle in your browser via self-hosted
        DuckDB-Wasm — end-to-end proof of the data pipeline (parquet → DuckDB → ChainSubstrate),
        with no third-party requests.
      </p>

      {err && (
        <p className="mt-8 text-mono text-sm text-[color:var(--color-amber)]">Error: {err}</p>
      )}
      {!res && !err && <p className="mt-8 text-mono text-sm text-[color:var(--color-brass-bright)]">{status}</p>}

      {res && (
        <div className="mt-8 space-y-5 text-mono text-sm">
          <p className="text-[color:var(--color-text-secondary)]">
            tip block <b className="text-[color:var(--color-gold)]">{res.tipBlock.toLocaleString()}</b>{' · '}
            wallets <b className="text-[color:var(--color-gold)]">{res.wallets.toLocaleString()}</b>{' · '}
            bonds <b className="text-[color:var(--color-gold)]">{res.bonds.toLocaleString()}</b>{' · '}
            loaded in {res.ms} ms
          </p>
          <p className="text-[color:var(--color-text-secondary)]">
            roles:{' '}
            {Object.entries(res.roles)
              .map(([r, n]) => `${r}=${n.toLocaleString()}`)
              .join('  ·  ')}
          </p>
          <table className="w-full max-w-2xl border-collapse text-xs">
            <thead>
              <tr className="text-left text-[color:var(--color-text-muted)]">
                <th className="pb-2 pr-4 font-normal">top 10 by BTC received</th>
                <th className="pb-2 pr-4 font-normal">BTC</th>
                <th className="pb-2 font-normal">role</th>
              </tr>
            </thead>
            <tbody>
              {res.top.map((w) => (
                <tr key={w.address} className="border-t border-[color:var(--color-card-border)]">
                  <td className="py-1.5 pr-4">{w.address}</td>
                  <td className="pr-4 text-[color:var(--color-gold)]">{w.btc}</td>
                  <td>{w.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
