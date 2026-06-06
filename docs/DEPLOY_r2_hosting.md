# Serving the heavy assets from R2

Cloudflare Pages rejects any single file **> 25 MB**. Three of our static
assets blow past that:

| Asset | Size | Why it can't ship in `out/` |
|---|---|---|
| `duckdb-mvp.wasm` | 39 MB | DuckDB-Wasm runtime (MVP build) |
| `duckdb-eh.wasm` | 34 MB | DuckDB-Wasm runtime (exception-handling build) |
| `data/v0.1.0/wallets.parquet` + `bonds.parquet` | 40 MB+ | the public chain dataset |

So these live in our own **Cloudflare R2** bucket and the browser fetches them
cross-origin. The privacy posture holds: R2 is Cloudflare (same provider as
Pages), it's *our* bucket, and there's no third-party CDN in the request path.

## What stays vs moves

- **Stays same-origin (ships in `out/`):** everything under 25 MB, including the
  DuckDB **worker** `.js` files (`duckdb-browser-*.worker.js`, ~800 KB). This is
  not optional — `new Worker(url)` refuses cross-origin scripts, so the worker
  *must* be same-origin. Only the `.wasm` it loads (via `fetch`) comes from R2.
- **Moves to R2:** `duckdb-*.wasm` and the whole `data/` parquet bundle.

`scripts/deploy.sh` strips exactly these from `out/` before upload and fails if
any >25 MB file remains.

## Runtime wiring (already in the code)

The runtime reads three build-time env vars (Next inlines `NEXT_PUBLIC_*`):

- `NEXT_PUBLIC_DUCKDB_WASM_BASE` — origin for the `.wasm` (e.g.
  `https://data.timechaingraph.com`). Empty ⇒ same-origin (dev). See
  `src/data/duckdb.ts`.
- `NEXT_PUBLIC_DATA_BASE_URL` — full versioned base for the parquet bundle (e.g.
  `https://data.timechaingraph.com/data/v0.1.0`). Empty ⇒ `/data/v0.1.0`. See
  `src/data/substrate.ts`.

Dev (`npm run dev`) leaves them unset → everything served same-origin from
`public/` → no R2 needed locally.

## One-time setup — DECISIONS NEEDED

1. **Bucket name.** Suggested: `timechaingraph-data`.
   ```bash
   npx wrangler r2 bucket create timechaingraph-data
   ```
2. **Public serving method — pick one:**
   - **Custom domain `data.timechaingraph.com` (recommended).** Brand-consistent,
     observably-ours, and keeps the privacy audit trivially clean. Needs a DNS
     record (Cloudflare dashboard → R2 bucket → Settings → Custom Domains, or a
     CNAME). **This is a DNS change — operator decision.**
   - **Managed `r2.dev` subdomain.** Zero DNS, but an opaque `pub-<hash>.r2.dev`
     hostname (still Cloudflare/ours, just less clean). Enable "Public access"
     on the bucket.
3. **CORS** (DuckDB range-reads the parquet + fetches the wasm cross-origin):
   ```json
   [
     {
       "AllowedOrigins": [
         "https://timechaingraph.com",
         "https://timechaingrid.com",
         "http://localhost:3000"
       ],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedHeaders": ["range", "content-type"],
       "ExposeHeaders": ["content-range", "content-length", "accept-ranges"],
       "MaxAgeSeconds": 86400
     }
   ]
   ```
   ```bash
   npx wrangler r2 bucket cors put timechaingraph-data --rules ./r2-cors.json
   ```

## Uploading

The DuckDB **wasm** is static and can be uploaded any time after the bucket
exists. The **parquet bundle** should wait until the full-chain walk + reduce +
`build_bundle.py` produce the real `public/data/v0.1.0/` (see the in-flight walk
memory). Object keys must mirror the same-origin paths.

```bash
# wasm (once):
npx wrangler r2 object put timechaingraph-data/duckdb/duckdb-mvp.wasm --file public/duckdb/duckdb-mvp.wasm
npx wrangler r2 object put timechaingraph-data/duckdb/duckdb-eh.wasm  --file public/duckdb/duckdb-eh.wasm

# data bundle (after the full-chain build_bundle.py), e.g. with rclone for the tree:
#   rclone copy public/data  r2:timechaingraph-data/data  --progress
```

## Deploy

```bash
export NEXT_PUBLIC_DUCKDB_WASM_BASE="https://data.timechaingraph.com"
export NEXT_PUBLIC_DATA_BASE_URL="https://data.timechaingraph.com/data/v0.1.0"
npm run deploy           # → scripts/deploy.sh (build, strip >25MB, audit, deploy)
```

## Verify

- DevTools → Network on `/graph`: the `.wasm` + `*.parquet` requests resolve to
  `data.timechaingraph.com` (200/206), the `*.worker.js` to the page origin.
- `npm run privacy-audit` stays green (our domain isn't third-party).
