/**
 * /api/subscribe — same-origin newsletter subscription relay (Cloudflare Pages Function).
 *
 * The browser POSTs to this endpoint (our own domain), keeping the privacy
 * audit clean — the listmonk instance URL never appears in client code.
 *
 * Env vars (set in Cloudflare Pages → Settings → Environment Variables):
 *   LISTMONK_URL        e.g. https://insights.timechaingraph.com
 *   LISTMONK_LIST_UUID  the UUID of the free-tier list in listmonk
 *
 * If the env vars are not set, returns 503 {"status":"coming_soon"}.
 */

const ALLOWED_ORIGIN = 'timechaingraph.com';

function isAllowedOrigin(origin) {
  try {
    const host = new URL(origin).hostname.toLowerCase().replace(/\.$/, '');
    return host === ALLOWED_ORIGIN || host.endsWith(`.${ALLOWED_ORIGIN}`);
  } catch {
    return false;
  }
}

function corsHeaders(origin) {
  return {
    'access-control-allow-origin': isAllowedOrigin(origin) ? origin : `https://${ALLOWED_ORIGIN}`,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}

export async function onRequestOptions(ctx) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(ctx.request.headers.get('origin') ?? ''),
  });
}

export async function onRequestPost(ctx) {
  const origin = ctx.request.headers.get('origin') ?? '';
  const headers = { 'content-type': 'application/json', ...corsHeaders(origin) };

  const { LISTMONK_URL, LISTMONK_LIST_UUID } = ctx.env ?? {};
  if (!LISTMONK_URL || !LISTMONK_LIST_UUID) {
    return new Response(JSON.stringify({ status: 'coming_soon' }), { status: 503, headers });
  }

  let email;
  try {
    const body = await ctx.request.json();
    email = (body?.email ?? '').trim();
  } catch {
    return new Response(JSON.stringify({ message: 'Invalid request body.' }), { status: 400, headers });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ message: 'A valid email address is required.' }), { status: 400, headers });
  }

  // Use listmonk's public subscription form endpoint (no API key required).
  // Sends a double-opt-in confirmation email automatically.
  const form = new URLSearchParams();
  form.set('email', email);
  form.set('l', LISTMONK_LIST_UUID);

  try {
    const res = await fetch(`${LISTMONK_URL}/subscription/form`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      return new Response(JSON.stringify({ status: 'pending_confirmation' }), { status: 200, headers });
    }

    const text = await res.text().catch(() => '');
    return new Response(
      JSON.stringify({ message: `Subscription service error (${res.status}). Please try again.`, detail: text }),
      { status: 502, headers },
    );
  } catch {
    return new Response(
      JSON.stringify({ message: 'Could not reach the subscription service. Please try again.' }),
      { status: 503, headers },
    );
  }
}
