# Timechain Graph — Obsidian Vault

The Bitcoin blockchain rendered as a literal Obsidian vault. Every
economically meaningful wallet is a markdown note; every transaction
between wallets is a wikilink; every halving is a block-note. Open
this folder in [Obsidian](https://obsidian.md/) and the built-in
graph view shows the chain as a network of money.

This vault is a **parallel artifact** alongside the web canvas at
[timechaingraph.com](https://timechaingraph.com). The web canvas reads
the same upstream data and renders it as a force-directed lattice
with brass-gold Satoshi at the center; this vault renders it as
notes-and-backlinks. Two surfaces, one substrate.

## Status

**v0.1 — fixture-driven.** The wallets, bonds, and per-block sidecars
in this vault are synthesised from `FREE_TIER_50` (the 50-wallet mock
fixture used during development before the real bitcoind pipeline is
online). Schemas are stable; volumes will grow ~200× when the real
pipeline ships in v0.2+.

## Layout

```
vault/
├── README.md                     ← this file
├── wallets/
│   ├── INDEX.md                  ← all wallets grouped by role + first-seen
│   ├── satoshi/                  ← 1 file: the genesis recipient
│   ├── miners/                   ← coinbase recipients (5 in v0.1)
│   ├── whales/                   ← > 1,000 BTC ever held (10)
│   ├── significant/              ← > 1 BTC OR > 100 txs (25)
│   └── dust/                     ← just-over-threshold (9)
├── bonds/                        ← synapses — first-class notes per bond
│   └── <from>--<to>.md           ← 121 files; wikilinks to both endpoints
├── empires/                      ← BFS lineage trees from seeds
│   ├── satoshi.md                ← 49 descendants, 3 hops max
│   └── 1MockMinerNNN.md          ← 5 files; each miner's downstream network
├── blocks/
│   ├── genesis.md                ← block 0 + the famous Times quote
│   ├── halvings/
│   │   ├── 0210000.md → 0840000.md  (4 halvings)
│   └── notable/
│       ├── 0000170-first-p2p-tx.md       ← Satoshi → Hal Finney
│       ├── 0277316-mtgox-halt.md         ← Mt. Gox 2014
│       ├── 0481824-segwit-activation.md
│       └── 0689832-taproot-lockin.md
├── epochs/                       ← per-halving-epoch summary notes
│   └── epoch-0000.md → epoch-0004.md  (5 epochs)
├── activity/
│   └── block-NNNNNNN.json        ← per-block sidecars (170 files in
│                                   v0.1; one per block where something
│                                   happens — wallet-spawn, bond-form,
│                                   halving — with subsidyBtc +
│                                   cumulativeSupplyBtc enrichment)
├── prolog/
│   ├── all.pl                    ← consult this in SWI-Prolog
│   ├── facts/
│   │   ├── wallets.pl            ← auto-generated wallet/5 facts
│   │   └── bonds.pl              ← auto-generated bond/4 facts
│   └── rules/
│       ├── transitive.pl         ← flow tracing (sent_to_transitive)
│       ├── clustering.pl         ← common-input heuristic (v0.2 stub)
│       ├── miners.pl             ← mining-pool detection (pool_candidate)
│       ├── temporal.pl           ← block-range reasoning (alive_at, born_in)
│       └── queries.pl            ← composed questions (satoshi_descendant,
│                                   hub, heavy_recipient, richest_alive_at)
├── .obsidian/                    ← graph + app config (color groups
│                                   matching the web canvas's ROLE_COLOR)
├── CONCEPTS.md                   ← the brain metaphor + animation contract
├── SUMMARY.md                    ← aggregate stats (auto-regenerated)
└── README.md                     ← this file
```

## Wallet schema

Each `wallets/<role>/<address>.md` carries this frontmatter:

```yaml
---
address: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa
aliases: [Satoshi]
role: satoshi          # one of: satoshi | miner | whale | significant | dust
color: brass-gold      # Obsidian color group hint
firstSeen: 0           # block height
lastActive: 0
lifetimeReceivedSats: 5000000000
lifetimeReceivedBtc: 50
txCount: 1
isMiner: true
centrality: 5          # number of distinct counterparties
tags: [role/satoshi, origin/satoshi]
---
```

Body contains a one-paragraph description, an on-chain summary list,
a Connections section with `[[<address>|<alias>]]` wikilinks for
every bonded counterparty, and a time-axis pointer.

## Bonds and centrality

A "bond" is the aggregated transaction edge between two wallets — an
undirected `(A, B)` pair with a `sats` weight (sum across all txs)
and a `formationBlock` (the synthesised block the pair is
attributed to in v0.1; in v0.2+ this becomes a real first-tx-block).

Obsidian's built-in graph view counts wikilinks but doesn't read
edge weights — its layout is unweighted. For weighted force-directed
geometry, see the web canvas at `timechaingraph.com/graph`. The
[Juggl](https://github.com/HEmile/juggl) Obsidian plugin can read
the `centrality` frontmatter for hub-size scaling if you want
weighted layout inside Obsidian.

## Color encoding (Obsidian color groups)

Configure Obsidian's graph view → Groups:

| Group query | Color |
|-------------|-------|
| `tag:#role/satoshi` | brass-gold (`#FFD700` deepened) |
| `tag:#role/miner` | red (`#EF4444`) |
| `tag:#role/whale` | gold (`#FFD700`) |
| `tag:#role/significant` | cyan (`#00D4FF`) |
| `tag:#role/dust` | grey (`#64748B`) |

These match the web canvas exactly.

## Time and per-block sidecars

The blockchain is fundamentally chronological — every fact has a
block-height stamp. The vault preserves chronology in two places:

1. **`firstSeen` / `lastActive`** in each wallet's frontmatter — the
   active range for that address.
2. **`activity/block-NNNNNNN.json`** sidecars — per-block event logs.
   A sidecar exists only for blocks where something happened. Each
   file is a JSON object with `block`, `epoch`, and an `events`
   array of `wallet-spawn` / `bond-form` / `halving` records.

The web canvas reads the activity sidecars to animate the lattice
in real time as the user scrubs through history. Obsidian doesn't
read JSON sidecars natively, but tooling could be built (community
plugin) to overlay block-time on the graph view.

## Bonds (synapses) and empires

The brain metaphor wants synapses-as-nodes — neurons don't connect
directly, they connect via synapses. Each bond in `vault/bonds/` is
a markdown note with wikilinks to both endpoint wallets, the
aggregate satoshis transferred, and the formation block. Open the
vault in Obsidian: the graph view shows wallet ↔ synapse ↔ wallet
topology, not plain wallet ↔ wallet edges. Density doubles; the
wiring reads as anatomy.

Empires (`vault/empires/`) are BFS lineage trees from a seed wallet
through the bond graph. `satoshi.md` is the chain's origin lineage —
49 descendants across 3 hops (every wallet in v0.1 is in Satoshi's
empire). Each miner has their own empire showing their downstream
payout network.

## Querying with Prolog

The vault ships with a [SWI-Prolog](https://www.swi-prolog.org/)
fact base and rule library. Run from the vault root:

```bash
swipl prolog/all.pl

% Coinbase + mining
?- miner(X).                                 % all coinbase recipients
?- pool_candidate(X).                        % miners spanning >1 epoch
?- mining_pool_with_span(P, S).              % pools + their epoch span

% Satoshi lineage
?- findall(W, satoshi_descendant(W), Ws), length(Ws, N).
                                             % count of Satoshi descendants

% Transitive flow
?- sent_to_transitive(X, '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa').
                                             % anyone who ever sent to Satoshi
?- reachable(X, '1MockWhale001XXXXXXXXXXXXXXXXXXXX').
                                             % connected component of a whale

% Hub + degree
?- hub(W, 5).                                % wallets with degree >= 5
?- degree('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', D).

% Temporal queries
?- alive_at(W, 100000).                      % wallets alive at block 100k
?- born_in(W, 200000, 400000).               % wallets born in window
?- richest_alive_at(10, 840000, Top).        % top-10 incoming-sats at h4
```

The `clustering.pl` rules require multi-input transaction data
(`spends_input/2` facts) which arrives in v0.2+ — the rule shape is
checked in now so the v0.2 implementer has a contract to populate.

## Regeneration

To rebuild the vault from the current fixture:

```bash
node chain-tools/vault/generate.mjs
```

This is idempotent — the script writes deterministic output from
the same input, safe to re-run after fixture edits. CI will eventually
run this on every fixture change (delegated to the Grid sister agent
who owns CI infra; coordinated via `internal session files/sibling-outbox.md`).

## Distribution

For v0.1, this vault lives inside the
[`timechaingraph`](https://github.com/timechaingraph/timechaingraph)
private repo. Once the schema is settled, a public read-only mirror at
`github.com/<user>/timechaingraph-vault` will expose it for direct
`git clone` into Obsidian. Update cadence: per epoch (every 2,016
blocks, ~2 weeks) on the real pipeline.

## Schema stability commitment

Anything in the wallet frontmatter, the bond schema, or the Prolog
fact arities is **forward-compatible**: future versions may add
fields, add facts, add rules — but won't remove or rename existing
ones without a major-version bump. Treat these as the public-API
contract for downstream tooling.

— Generated by `chain-tools/vault/generate.mjs`
