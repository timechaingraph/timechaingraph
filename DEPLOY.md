# Deploy — Timechain Graph → timechaingraph.com

Steps to wire `timechaingraph.com` to a Cloudflare Pages project hosting
this repo's static export. Run these once at first deploy; subsequent
deploys are `npm run deploy` (or auto-trigger from `git push origin main`
once GitHub integration is configured).

## 0. Prerequisites

| Required | Notes |
|----------|-------|
| Cloudflare account | Free tier is sufficient. |
| Domain on Cloudflare | `timechaingraph.com` must already be registered through Cloudflare or have its nameservers delegated to Cloudflare. If still elsewhere, transfer or update nameservers first. |
| Wrangler CLI | `npx wrangler --version` should work — `wrangler@^4` is in this project's devDependencies. `npx wrangler login` once to authenticate. |
| GitHub repo | `https://github.com/timechaingraph/timechaingraph` (private; MIT-licensed code). |

Do NOT install `gcloud`, `vercel`, `netlify-cli`, or any other CLI — this
project deploys to Cloudflare and only Cloudflare.

## 1. Create the Cloudflare Pages project

**Option A — via Cloudflare dashboard (recommended for first-time setup
because it walks the GitHub OAuth flow):**

1. Go to <https://dash.cloudflare.com/> → **Workers & Pages** → **Create
   application** → **Pages** → **Connect to Git**.
2. Select GitHub provider, authorize access to
   `timechaingraph/timechaingraph`, click **Begin setup**.
3. Project configuration:
   - **Project name:** `timechaingraph` (lowercase, no spaces — the
     deploy script in `package.json` references this exact name).
   - **Production branch:** `main`.
   - **Framework preset:** None (we use a custom build).
   - **Build command:** `npm run build`
   - **Build output directory:** `out`
   - **Root directory:** `/` (default).
   - **Environment variables:** none required for the static viewer.
   - **Node version:** 20 or later (set via env var `NODE_VERSION=20` in
     the dashboard if the default is older).
4. Click **Save and Deploy**. The first build runs immediately. Watch
   the build log — it should match what `npm run build` prints locally
   (~1 s compile, 1.2 s typecheck, 11 static pages).

**Option B — via Wrangler CLI** (manual deploys; no GitHub integration):

```bash
cd $REPO
npx wrangler login                    # one-time browser auth
npx wrangler pages project create timechaingraph --production-branch main
npm run deploy                        # build + push out/ to Pages
```

This works fine but you'll need to `npm run deploy` after every push
yourself. Option A auto-deploys on `git push origin main`.

## 2. Bind the custom domain

In the dashboard, on the `timechaingraph` Pages project:

1. **Custom domains** tab → **Set up a custom domain**.
2. Enter `timechaingraph.com` (apex) → **Continue** → **Activate
   domain**. Cloudflare auto-provisions a CNAME and an SSL cert.
3. Repeat for `www.timechaingraph.com` if you want www → apex
   redirect (recommended; CF handles the redirect automatically once
   both are bound).
4. Wait 1–5 min for SSL "Active" status. The cert is Universal SSL
   (Let's Encrypt or Google Trust); free, auto-renewing.

DNS records the dashboard will create automatically:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | `timechaingraph.com` | `timechaingraph.pages.dev` | Proxied (orange cloud) |
| CNAME | `www` | `timechaingraph.pages.dev` | Proxied |

If the domain is on a different registrar with NS pointing to CF, those
records appear in the **DNS** tab of the timechaingraph.com zone.

## 3. Verify the deploy

```bash
# Check the live domain serves the right hash
curl -sI https://timechaingraph.com | head -5

# Confirm "Bitcoin Visualised" is in the served HTML
curl -s https://timechaingraph.com | grep -o "Bitcoin Visualised"

# Visual check — open in browser
open https://timechaingraph.com
open https://timechaingraph.com/graph
```

Run a privacy audit against the live domain:

```bash
# Pulls the live built bundle and re-runs the local audit against it.
# Easier: build locally, audit out/, push only if clean.
npm run build && npm run privacy-audit
```

## 4. Recurring deploys

After step 1A (GitHub-connected): every push to `main` triggers a CF
Pages build automatically. Preview deploys spin up for branches and
PRs at `<branch>.timechaingraph.pages.dev`.

After step 1B (Wrangler-only): `npm run deploy` from the repo root.

## 5. Privacy posture in production

The CI workflow at `.github/workflows/ci.yml` runs the privacy audit on
every push and PR — if any third-party domain reference leaks into
`out/`, the build fails before deploy. Live deployment can additionally
be verified manually:

```bash
# DevTools → Network tab → filter by "Other origin"
# Should show ZERO requests outside timechaingraph.com (CSS, JS, fonts
# are all self-served from the same origin).
```

If anything ever shows up there, regress to the commit before it
appeared and re-audit — the privacy boundary is non-negotiable.

## 6. Sister project deploy

The sister project at `$SISTER_REPO/` deploys to
`timechaingrid.com` via the same process — substitute names everywhere:

| This repo | Sister repo |
|-----------|-------------|
| Project: `timechaingraph` | Project: `timechaingrid` |
| Domain: `timechaingraph.com` | Domain: `timechaingrid.com` |
| GitHub: `timechaingraph/timechaingraph` | `timechaingraph/timechaingrid` |
| Accent: gold | Accent: cyan |

Both projects deploy independently. They share no infrastructure —
each has its own Pages project, its own SSL cert, its own GitHub repo.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Build fails on Cloudflare with "Cannot find module 'pixi.js'" | Node version too old; missing devDeps | Set `NODE_VERSION=20` env var; ensure `npm ci` (not `npm install`) is the install command |
| Privacy audit fails on Cloudflare | Build inadvertently pulled a third-party URL | Run `npm run privacy-audit` locally; identify the offending file with `grep -r "<domain>" out/` |
| 404 on `/graph` after deploy | `output: 'export'` mis-configured | Verify `next.config.ts` has `output: 'export'` and `images: { unoptimized: true }` |
| Custom domain stuck on "Pending" SSL | DNS propagation | Wait up to 24 h; verify `dig timechaingraph.com` shows CF nameservers |
| Wrangler deploy auth error | Token expired | `npx wrangler logout && npx wrangler login` |

---

**Single command to redeploy after a code change:**

```bash
git push origin main          # if GitHub-integrated; CF auto-deploys
# OR
npm run deploy                # if using Wrangler
```
