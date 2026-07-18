# perf#2 — fold the coinbase-proven miner set into `wallets.is_miner`

**Status:** code landed + tested; **STAGED behind `manifest.minersFolded`**. Inert
on the live bundle (which has no flag). Activation requires an operator bundle
rebuild (see "Deploy prerequisite"). Deploy is human-gated.

**Goal:** drop the ~9 MB `block-miners.parquet` fetch (~45% of the Graph's
critical parquet) from cold load by making `wallets.is_miner` authoritative.

## Files changed
| File | Change |
|------|--------|
| `chain-tools/export/build_bundle.py` | `load_coinbase_miners()` reads `block-miners.jsonl` once → the DISTINCT per-block coinbase-recipient set; `is_miner` is written from that set when present (**inclusion still uses the walker heuristic → node set unchanged**); manifest gains `minersFolded`. |
| `src/data/minerFold.ts` (new) | Pure `minersFolded(manifest)` flag helper (fail-closed: only explicit `true`). |
| `src/data/r2-substrate.ts` | When `minersFolded`, skip the `block-miners.parquet` register + `DISTINCT` scan and read `is_miner` directly. Absent/false → unchanged fetch-and-override. |
| `chain-tools/lib/schemas.py`, `chain-tools/CONTRACT.md` | Document the tightened `is_miner` semantic under the flag. |
| `chain-tools/export/__tests__/build_bundle.test.mjs` (new) | Fixture test via the venv: proves `is_miner` = coinbase-proven (a heuristic-only "TAINT" address → corrected to `false`), node set preserved, `minersFolded` stamped. |
| `src/data/__tests__/minerFold.test.ts` (new) | Flag helper truth table. |

## Behavior change
- **Runtime, flagged bundle:** no `block-miners.parquet` request; `is_miner` read straight from `wallets.parquet`. Rendered miner colors identical to today (today's runtime already displays exactly the coinbase-proven set).
- **Runtime, live/unflagged bundle:** byte-for-byte the current behavior. **No user-visible change ships from this commit.**
- **Data-semantics caveat (review this):** `is_miner` tightens from "any coinbase-output recipient" (walker heuristic) to "proven block coinbase recipient". Field name + `bool` type unchanged → additive/forward-compatible, but the *value* differs for downstream `is_miner` consumers (brain-vault generator, Prolog). Verify those want the tighter set before the rebuild goes live.

## Verification (this commit)
- `build_bundle.test.mjs` + `minerFold.test.ts` green (venv: pyarrow 24.0.0).
- Graph gate green: `typecheck` clean · **352 tests** (was 347) · `build` OK · `privacy-audit` clean.

## Deploy prerequisite (activation)
Rebuild the bundle on the next SSD-mounted pipeline session with
`block-miners.jsonl` present (it is — `walk_coinbases.mjs` produces it). The
rebuild stamps `minersFolded: true`; then the ~9 MB fetch is gone. To also stop
*shipping* the 9 MB file to the Graph origin, drop `block-miners.parquet` from
the Graph deploy (still needed by the Grid coin view — keep it there).

## Rollback
Single flag. Revert by rebuilding without the fold (or set `minersFolded:false`
in the manifest) → the browser resumes fetching `block-miners.parquet` and
overriding `is_miner`. Code revert: `git revert <this commit>` (no data
migration; the live bundle never carried the flag).
