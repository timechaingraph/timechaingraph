# Serving the heavy assets from R2

Cloudflare Pages rejects any single file **> 25 MB**. After the tier removal,
the **only** assets over that limit are the two DuckDB-Wasm runtime modules:

| Asset | Size | Why it can't ship in `out/` |
|---|---|---|
| `duckdb-mvp.wasm` | 39 MB | DuckDB-Wasm runtime (MVP build) |
| `duckdb-eh.wasm` | 34 MB | DuckDB-Wasm runtime (exception-handling build) |

These live in our own **Cloudflare R2** bucket and the browser fetches them
cross-origin. The privacy posture holds: R2 is Cloudflare (same provider as
Pages), it's *our* bucket, and there's no third-party CDN in the request path.

> **The parquet bundle no longer needs R2.** It's now ~12 MB total (largest
> file `timestamps.parquet` 6.6 MB, well under 25 MB) since we dropped the tiered
> `pro.parquet` (was 97 MB). So `public/data/v0.1.0/` **ships same-origin** in the
> Pages upload — one less thing to host. (To move it to R2 later anyway: export
> `NEXT_PUBLIC_DATA_BASE_URL` and re-add the `rm -rf out/data` strip in
> `scripts/deploy.sh`.)

## What stays vs moves

- **Stays same-origin (ships in `out/`):**
  - everything under 25 MB, including the **parquet bundle** (`data/v0.1.0/`);
  - the DuckDB **worker** `.js` files (`duckdb-browser-*.worker.js`, ~800 KB).
    This is not optional — `new Worker(url)` refuses cross-origin scripts, so the
    worker *must* be same-origin. Only the `.wasm` it loads (via `fetch`) is R2.
- **Moves to R2:** `duckdb-*.wasm` (the two files above) — nothing else.

`scripts/deploy.sh` strips exactly the `.wasm` from `out/` before upload and
fails if any >25 MB file remains.

## Runtime wiring (already in the code)

Next inlines `NEXT_PUBLIC_*` at build time:

- `NEXT_PUBLIC_DUCKDB_WASM_BASE` — origin for the `.wasm` (e.g.
  `https://data.timechaingraph.com`). The loader fetches
  `${BASE}/duckdb/duckdb-eh.wasm`. **Empty ⇒ same-origin**, which only works in
  dev — in prod the wasm is stripped, so this MUST be set or `/graph` breaks.
  See `src/data/duckdb.ts`.
- `NEXT_PUBLIC_DATA_BASE_URL` — *optional.* Full versioned base for the parquet
  bundle. **Leave unset** — the bundle ships same-origin (`/data/v0.1.0`). Only
  set it if you later move the parquet to R2. See `src/data/substrate.ts`.

Dev (`npm run dev`) leaves both unset → everything served same-origin from
`public/` → no R2 needed locally.

## One-time setup (operator — needs Cloudflare auth)

```bash
# 1. Authenticate wrangler with your Cloudflare account.
npx wrangler login

# 2. Create the bucket (suggested name; override with BUCKET=… in step 4).
npx wrangler r2 bucket create timechaingraph-data
```

**3. Public serving method — pick one (operator decision):**
- **Custom domain `data.timechaingraph.com` (recommended).** Brand-consistent,
  observably-ours, keeps the privacy audit trivially clean. Cloudflare dashboard
  → R2 bucket → Settings → Custom Domains. **This is a DNS change.**
- **Managed `r2.dev` subdomain.** Zero DNS, but an opaque `pub-<hash>.r2.dev`
  hostname (still ours). Enable "Public access" on the bucket. If you use this,
  set `NEXT_PUBLIC_DUCKDB_WASM_BASE` to that hostname instead.

## Upload the wasm + CORS (scripted)

Once the bucket exists and `wrangler` is authed, one script does the rest
(upload both `.wasm` to the `duckdb/` prefix + apply `r2-cors.json`):

```bash
./scripts/r2-upload-wasm.sh                 # bucket: timechaingraph-data
# or: BUCKET=my-bucket ./scripts/r2-upload-wasm.sh
```

It's idempotent — re-run it after a `@duckdb/duckdb-wasm` version bump. CORS
rules live in `r2-cors.json` (GET/HEAD from our origins + localhost).

## Deploy

```bash
export NEXT_PUBLIC_DUCKDB_WASM_BASE="https://data.timechaingraph.com"
npm run deploy           # → scripts/deploy.sh (build, strip wasm, audit, deploy)
```

(No `NEXT_PUBLIC_DATA_BASE_URL` needed — the parquet ships in the upload.)

## Verify

- DevTools → Network on `/graph`: the `duckdb-*.wasm` requests resolve to
  `data.timechaingraph.com` (200), the `*.worker.js` + `*.parquet` to the page
  origin (200/206).
- `npm run privacy-audit` stays green (our domain isn't third-party).
- The lattice renders real chain data (block count climbs to the tip).
