'use client';

import { useState } from 'react';

type State = 'idle' | 'submitting' | 'success' | 'error';
type PreState = 'idle' | 'saved';

/**
 * InsightsSignup — email capture for the Timechain Insights free newsletter.
 *
 * When subscribeUrl is set: live double-opt-in form (POSTs to same-origin
 * /api/subscribe CF Pages Function → listmonk; listmonk sends the confirm email).
 * When subscribeUrl is empty: "coming soon" with optional localStorage pre-capture
 * so early visitors who click before listmonk is provisioned still convert.
 *
 * Privacy: /api/subscribe is same-origin — the listmonk URL never appears in
 * client code; privacy-audit stays green.
 */
export function InsightsSignup({ subscribeUrl }: { subscribeUrl: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [preEmail, setPreEmail] = useState('');
  const [preState, setPreState] = useState<PreState>('idle');

  if (!subscribeUrl) {
    const handlePreCapture = (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = preEmail.trim();
      if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return;
      try {
        localStorage.setItem('insights_pre_capture', trimmed);
      } catch {
        // SSR or storage denied — proceed anyway
      }
      setPreState('saved');
    };

    if (preState === 'saved') {
      return (
        <div className="brass-panel rounded-lg p-6">
          <p className="text-display text-xl font-semibold" style={{ color: 'var(--color-gold)' }}>
            Got it
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
            We&apos;ll notify{' '}
            <span className="text-mono text-[color:var(--color-amber)]">{preEmail}</span>{' '}
            when the first issue ships. No tracking, one click to unsubscribe.
          </p>
        </div>
      );
    }

    return (
      <div className="brass-panel rounded-lg p-6">
        <p className="text-mono text-base uppercase tracking-[0.28em] text-[color:var(--color-amber)]">
          Coming soon
        </p>
        <p className="mt-3 text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
          Free newsletter shipping soon — weekly on-chain analysis: wallet-graph
          topology shifts, epoch stats, halving milestones, and government holdings
          changes. Self-hosted, no tracking, no ads.
        </p>
        <form onSubmit={handlePreCapture} noValidate className="mt-4">
          <label
            htmlFor="insights-pre-email"
            className="text-mono block text-[11px] uppercase tracking-[0.28em] text-[color:var(--color-text-muted)]"
          >
            Notify me when it launches
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="insights-pre-email"
              type="email"
              required
              autoComplete="email"
              value={preEmail}
              onChange={(e) => setPreEmail(e.target.value)}
              placeholder="you@example.com"
              className="text-mono min-w-0 flex-1 rounded-md border border-[color:var(--color-card-border)] bg-[color:var(--color-background-light)] px-3 py-2 text-sm text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-muted)] focus:border-[color:var(--color-amber)]/60 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!preEmail.trim()}
              className="text-mono shrink-0 rounded-md px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-background)] transition-opacity disabled:opacity-50"
              style={{
                background: 'radial-gradient(ellipse at center, var(--color-accent-deep) 0%, var(--color-accent) 100%)',
              }}
            >
              Notify me
            </button>
          </div>
        </form>
        <p className="text-mono mt-4 text-[10px] text-[color:var(--color-text-muted)]">
          Self-hosted listmonk — your email stays on our server only.
        </p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState('submitting');
    setErrorMsg('');
    try {
      const res = await fetch(subscribeUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.ok) {
        setState('success');
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg((data as { message?: string }).message ?? 'Subscription failed — try again.');
        setState('error');
      }
    } catch {
      setErrorMsg('Network error — please try again.');
      setState('error');
    }
  }

  if (state === 'success') {
    return (
      <div className="brass-panel rounded-lg p-6">
        <p
          className="text-display text-xl font-semibold"
          style={{ color: 'var(--color-gold)' }}
        >
          Check your inbox
        </p>
        <p className="mt-3 text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
          A confirmation link is on its way to{' '}
          <span className="text-mono text-[color:var(--color-amber)]">{email}</span>.
          Click it to confirm — then the first issue lands when it ships.
        </p>
      </div>
    );
  }

  return (
    <div className="brass-panel rounded-lg p-6">
      <form onSubmit={handleSubmit} noValidate>
        <label
          htmlFor="insights-email"
          className="text-mono block text-[11px] uppercase tracking-[0.28em] text-[color:var(--color-text-muted)]"
        >
          Your email
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="insights-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={state === 'submitting'}
            className="text-mono min-w-0 flex-1 rounded-md border border-[color:var(--color-card-border)] bg-[color:var(--color-background-light)] px-3 py-2 text-sm text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-muted)] focus:border-[color:var(--color-amber)]/60 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={state === 'submitting' || !email.trim()}
            className="text-mono shrink-0 rounded-md px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-background)] transition-opacity disabled:opacity-50"
            style={{
              background: 'radial-gradient(ellipse at center, var(--color-accent-deep) 0%, var(--color-accent) 100%)',
            }}
          >
            {state === 'submitting' ? 'Subscribing…' : 'Subscribe free'}
          </button>
        </div>
        {state === 'error' && (
          <p
            role="alert"
            className="text-mono mt-2 text-[11px] text-[color:var(--color-warning,#ef4444)]"
          >
            {errorMsg}
          </p>
        )}
        <p className="text-mono mt-3 text-[10px] leading-relaxed text-[color:var(--color-text-muted)]">
          Double opt-in · no tracking · your email stored on our server only · unsubscribe any time.
        </p>
      </form>
    </div>
  );
}
