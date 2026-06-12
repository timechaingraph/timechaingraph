/**
 * /api/tip — same-origin live chain-tip relay (Cloudflare Pages Function).
 *
 * The privacy covenant forbids the VISITOR's browser from calling third-party
 * APIs, so the browser polls THIS endpoint on our own domain and the upstream
 * fetch happens server-side at the edge. Responses are edge-cached ~30s, so
 * upstream load is ~2 req/min per colo regardless of traffic, and visitors
 * leak nothing to anyone but us.
 *
 * Upstream: esplora-compatible sources, tried in order. Server-side only —
 * never referenced in client code (privacy-audit stays green).
 */
const SOURCES = [
  'https://mempool.space/api/v1/blocks',
  'https://blockstream.info/api/blocks',
];

const CACHE_SECONDS = 30;

export async function onRequestGet(ctx) {
  const cache = caches.default;
  const cacheKey = new Request(new URL('/api/tip', ctx.request.url).toString());
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  for (const src of SOURCES) {
    try {
      const r = await fetch(src, {
        signal: AbortSignal.timeout(5000),
        headers: { accept: 'application/json' },
      });
      if (!r.ok) continue;
      const blocks = await r.json();
      const tip = Array.isArray(blocks) ? blocks[0] : null;
      if (!tip || typeof tip.height !== 'number') continue;
      const body = JSON.stringify({
        height: tip.height,
        timestamp: tip.timestamp ?? null,
        asOf: Math.floor(Date.now() / 1000),
      });
      const res = new Response(body, {
        headers: {
          'content-type': 'application/json',
          'cache-control': `public, max-age=15, s-maxage=${CACHE_SECONDS}`,
        },
      });
      ctx.waitUntil(cache.put(cacheKey, res.clone()));
      return res;
    } catch {
      // try the next source
    }
  }
  return new Response(JSON.stringify({ height: null }), {
    status: 503,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
