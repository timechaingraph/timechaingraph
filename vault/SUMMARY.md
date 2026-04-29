---
kind: summary
walletsTotal: 50
bondsTotal: 121
lifetimeReceivedBtc: 58193
tipBlock: 876000
tipSupplyBtcApprox: 19800003
tags: [summary]
---

# Vault Summary

A bird's-eye view of the v0.1 fixture vault. Regenerated on every `node chain-tools/vault/generate.mjs`.

## Fixture cohort (50 wallets)

- **Satoshi**: 1
- **Miners**: 5
- **Whales**: 10
- **Significant**: 25
- **Dust**: 9

Lifetime received across all fixture wallets: **58,193 BTC**.

## Bond graph

- **Total bonds**: 121 (deterministic from FREE_TIER_50_BONDS via djb2 partner-picking)
- **Average degree**: 4.84 (each bond contributes to two endpoints)

## Time axis

- **Genesis**: block 0 → [[wallets/satoshi/1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa|Satoshi]]
- **Newest birth in fixture**: block 423,800 → [[wallets/dust/1MockDust009XXXXXXXXXXXXXXXXXXXXXX|1MockDus…XXXX]]
- **Tip**: block 876,000 (~19,800,003.125 BTC issued)
- **Halvings crossed**: 4 ([[blocks/genesis|genesis]] → [[blocks/halvings/0210000|h1]] → [[blocks/halvings/0420000|h2]] → [[blocks/halvings/0630000|h3]] → [[blocks/halvings/0840000|h4]])

## Per-block sidecars

170 sidecars written (one per block where wallet-spawn, bond-form, or halving event occurred). Block range: 0 – 876000.

## Prolog query starting points

From `vault/` root:

```bash
swipl -t halt -g "consult('prolog/all.pl'), findall(M, miner(M), Ms), length(Ms, N), format('~w miners~n', [N])."
```

See `prolog/rules/transitive.pl` for flow tracing, `clustering.pl` for common-input heuristic (v0.2 stub), `miners.pl` for pool detection.

## Regeneration

Re-run `node chain-tools/vault/generate.mjs` after any fixture edit. Output is deterministic — same fixture in, same vault out.
