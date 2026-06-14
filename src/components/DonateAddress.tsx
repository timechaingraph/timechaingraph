'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { bip21Uri, DUST_FLOOR_SATS } from '@/lib/bip21';

/**
 * DonateAddress — the live on-chain block: amount presets + QR + address + copy.
 *
 * Preset buttons (10k / 50k / 100k sats / custom) regenerate the QR as a BIP21
 * URI with the amount prefilled — the click-an-amount flow, with zero backend.
 * The QR is rendered client-side by the BUNDLED `qrcode` package (an SVG
 * string, no canvas, no network) so the privacy posture is untouched. With no
 * amount selected the QR encodes the bare address and copy copies the bare
 * address — identical to the original behavior.
 *
 * Clipboard can throw in an insecure context; the address stays visible and
 * selectable, so a failed copy degrades gracefully (button just doesn't flip
 * to "Copied").
 */

const PRESETS: { sats: number; label: string }[] = [
  { sats: 10_000, label: '10k sats' },
  { sats: 50_000, label: '50k sats' },
  { sats: 100_000, label: '100k sats' },
];

export function DonateAddress({ address, label }: { address: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [preset, setPreset] = useState<number | 'custom' | null>(null);
  const [customSats, setCustomSats] = useState('');
  const [qrSvg, setQrSvg] = useState('');

  const parsedCustom = Number.parseInt(customSats, 10);
  const sats =
    preset === 'custom'
      ? Number.isInteger(parsedCustom) && parsedCustom >= DUST_FLOOR_SATS
        ? parsedCustom
        : undefined
      : (preset ?? undefined);

  // Amount selected → full BIP21 URI (amount + label); none → bare address.
  const payload = sats ? bip21Uri(address, { sats, label }) : address;

  useEffect(() => {
    let live = true;
    QRCode.toString(payload, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
      .then((svg) => {
        if (live) setQrSvg(svg);
      })
      .catch(() => {
        // QR render failed (pathological payload) — the address text remains.
      });
    return () => {
      live = false;
    };
  }, [payload]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (insecure context / permission denied) — the
      // address is still on screen and selectable; nothing to surface.
    }
  }

  const pill = (active: boolean) =>
    [
      'text-mono rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.14em] transition-colors',
      active
        ? 'border-[color:var(--color-gold)]/70 bg-[color:var(--color-gold)]/10 text-[color:var(--color-gold)]'
        : 'border-[color:var(--color-card-border)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-gold)]/40 hover:text-[color:var(--color-text-secondary)]',
    ].join(' ');

  return (
    <div className="mt-4">
      {/* Amount presets — toggle on/off; off = bare-address QR. */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Donation amount presets">
        {PRESETS.map((p) => (
          <button
            key={p.sats}
            type="button"
            aria-pressed={preset === p.sats}
            onClick={() => setPreset(preset === p.sats ? null : p.sats)}
            className={pill(preset === p.sats)}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={preset === 'custom'}
          onClick={() => setPreset(preset === 'custom' ? null : 'custom')}
          className={pill(preset === 'custom')}
        >
          Custom
        </button>
        {preset === 'custom' && (
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            value={customSats}
            onChange={(e) => setCustomSats(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder={`≥ ${DUST_FLOOR_SATS} sats`}
            aria-label="Custom amount in sats"
            className="text-mono w-32 rounded-md border border-[color:var(--color-card-border)] bg-[color:var(--color-background-light)] px-2 py-1 text-xs text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-muted)] focus:border-[color:var(--color-gold)]/60 focus:outline-none"
          />
        )}
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        {qrSvg ? (
          // eslint-disable-next-line @next/next/no-img-element -- locally generated data URL on a static export; SVG-as-img cannot execute scripts
          <img
            src={`data:image/svg+xml;utf8,${encodeURIComponent(qrSvg)}`}
            alt={
              sats
                ? `QR code requesting ${sats.toLocaleString()} sats to the donation address`
                : 'QR code for the on-chain Bitcoin donation address'
            }
            width={128}
            height={128}
            className="h-[128px] w-[128px] shrink-0 rounded-md border border-[color:var(--color-card-border)] bg-white p-2"
          />
        ) : (
          <div
            aria-hidden
            className="h-[128px] w-[128px] shrink-0 rounded-md border border-[color:var(--color-card-border)] bg-white p-2"
          />
        )}
        <div className="min-w-0 flex-1">
          <code className="text-mono block break-all rounded-md border border-[color:var(--color-card-border)] bg-[color:var(--color-background-light)] px-3 py-2 text-sm text-[color:var(--color-gold)]">
            {address}
          </code>
          <button
            type="button"
            onClick={copy}
            aria-live="polite"
            className="text-mono mt-2 inline-flex items-center gap-1.5 rounded-md border border-[color:var(--color-card-border)] px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-secondary)] transition-colors hover:border-[color:var(--color-gold)]/60 hover:text-[color:var(--color-gold)]"
          >
            {copied ? '✓ Copied' : sats ? 'Copy payment URI' : 'Copy address'}
          </button>
          {sats ? (
            <p className="text-mono mt-2 text-[11px] text-[color:var(--color-text-muted)]">
              QR requests {sats.toLocaleString()} sats — scan with any wallet.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
