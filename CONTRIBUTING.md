# Contributing to Timechain Graph

Thanks for your interest. Contributions are welcome — bug fixes, performance
improvements, accessibility work, new visualisations, documentation, anything
that strengthens the project without compromising its privacy posture.

## The privacy rule

This project's most important contract with its users is that the browser
makes **zero third-party requests at runtime**. Before submitting any PR that
adds a dependency, fetches a resource, or imports a module, run:

```bash
npm run build && npm run privacy-audit
```

Both must succeed. The audit script ([`scripts/privacy-audit.sh`](scripts/privacy-audit.sh))
greps the build output for forbidden third-party hosts; CI re-runs it on
every push. If a new resource is genuinely needed, self-host it (vendor it
into `/public/` or `node_modules` so it ships in the same-origin bundle).

## Setup

```bash
git clone https://github.com/timechaingraph/timechaingraph.git
cd timechaingraph
npm install
npm run dev          # http://localhost:3000
```

Node 20+ is required (matches the Cloudflare Pages build environment).

## Workflow

1. **Fork** the repo and create a feature branch:

   ```bash
   git checkout -b feat/your-thing
   ```

2. **Make changes.** Follow the existing patterns. Conventions:
   - Path alias: `@/*` maps to `./src/*`
   - Components in `src/components/`, utilities in `src/lib/`, types in `src/types/`
   - Strict TypeScript; no `any` without justification
   - Tests in `__tests__/` directories or `*.test.ts(x)` files
   - System fonts only (no Google Fonts or other external font hosts)

3. **Verify locally** before opening a PR:

   ```bash
   npm run typecheck    # tsc --noEmit, must be 0 errors
   npm run lint         # eslint, must be 0 errors
   npm run test:run     # vitest single run, all green
   npm run build        # next build, must succeed
   npm run privacy-audit  # zero third-party leaks in out/
   ```

4. **Commit** in atomic logical chunks. The repo follows
   [Conventional Commits](https://www.conventionalcommits.org/) loosely:

   ```
   feat(graph): brief description of what changed
   fix(graph): the problem and how it was fixed
   chore(comms): repo-housekeeping work
   docs(readme): documentation only
   ```

5. **Push** and open a PR against `main`. Describe what you changed and why.
   Link any related issue.

## Testing

The test bed is Vitest 4 + React Testing Library. There are 21 test files
covering physics, fixtures, the snapshot client, the Zustand store, and key
components. Add tests for any new behavior — especially around the physics
engine (`src/lib/forceLayout.ts`), data adapters (`src/data/*`), and pure
utilities in `src/lib/`.

## Style

- Default to **no comments**. Only explain *why* when the *why* is non-obvious.
  Don't explain *what* the code does; well-named identifiers do that.
- Don't add backwards-compatibility shims for code that doesn't exist yet.
- YAGNI: build for the requirement, not the hypothetical.
- Three similar lines is better than a premature abstraction.

## What we're looking for

- **v0.2 work**: real BitcoinChainAdapter (DuckDB-Wasm + parquet pipeline)
- **Physics scaling**: Barnes-Hut quad-tree decomposition for 10k+ wallets
- **Mobile UX**: pinch-zoom, tap-to-open WalletInspector
- **Accessibility**: keyboard navigation, ARIA improvements, reduced-motion
- **Performance**: profiling and optimization of the PixiJS render loop
- **Documentation**: clearer onboarding, more examples, video walkthroughs

## What we're not looking for

- Third-party analytics (any kind)
- Tracking pixels, fingerprinting, or per-viewer telemetry
- Google Fonts or any font CDN that hits a third-party host at runtime
- "Sign in with X" or wallet-connect features (this is a viewer, not a wallet)
- Maintenance traps: half-finished refactors that leave the codebase in a
  worse state than before

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE).
