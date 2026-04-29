---
kind: concepts
tags: [concepts, vision]
---

# The Bitcoin Brain

This vault is one half of a two-surface project. The other half is
the live web canvas at `timechaingraph.com/graph`. Together they
project the Bitcoin blockchain as a **brain** — a neuronal network
where each wallet is a neuron, each transaction is a synapse, and
each block is a pulse of time.

The sibling project at `timechaingrid.com` projects the same chain
as **2D real estate** — a stationary panopticon where every wallet
sits at a deterministic coordinate forever. Two views of one
substrate; the brain is alive and growing, the panopticon is fixed
and surveyable.

## The metaphor, mapped

| Brain | Bitcoin |
|-------|---------|
| **Neuron** | A wallet (address). Mass = log of holdings + activity. Pre-birth neurons are dormant; born neurons are active; post-active neurons are dim but still wired. |
| **Synapse** | A transaction-bond (`bond/4` fact). Spring force ∝ log(sats). Synapses fade across the next 10 blocks past last endpoint activity, like a memory decaying. |
| **Pulse** | A block. ~10 minutes apart. Each block fires the wallets that transacted in it; the activity sidecar (`vault/activity/block-N.json`) is the firing log for that pulse. |
| **Learning** | The chain's evolution. As blocks accumulate, neurons spawn, synapses form, the wiring diagram thickens. Watch genesis to tip and the brain assembles itself in front of you. |
| **Reflexes** | Halving cycles. Every 210,000 blocks the issuance reflex contracts — the brain's metabolism slows on a 4-year clock, never deviating. |
| **Memory** | The Prolog fact base. `wallet/5`, `bond/4`, `coinbase/3` are the brain's recall. `transitive`, `clustering`, `miner`, `temporal`, `queries` rules are how it reasons about its own history. |
| **Lineage** | An empire — the BFS descendant tree from a seed wallet through the bond graph. Satoshi's empire is the chain's origin lineage (everyone reachable from genesis). Each miner has their own empire of downstream counterparties. The brain reads its own ancestry. |
| **Synapse** | A `vault/bonds/<from>--<to>.md` note. First-class anatomy: neurons connect *via* synapses, not directly. The Obsidian graph view shows wallet ↔ synapse ↔ wallet — density doubles, the wiring reads as a brain. |

## Why both surfaces matter

The web canvas is where the brain is *played* — drag a node, scrub
the timeline, watch synapses fire across the lattice. It's the
rendering of "what does the chain look like *right now*."

The vault is where the brain is *read* — open in Obsidian, follow a
wallet's wikilinks, query Prolog, find the answer to "every wallet
that ever transacted with Satoshi" in finite time. It's the
rendering of "what does the chain *know*."

Same substrate. Different reading modes. A reader of one becomes a
viewer of the other; a viewer wants the reader's depth.

## Sister project — 2D real estate

The 2D real estate view at `timechaingrid.com` is the brain's
**reference frame**. Every wallet sits at a fixed coordinate derived
deterministically from its address. The lattice doesn't move; the
geometry is the contract. You can bookmark a wallet's location and
return to it across every load, every block, every halving.

If the brain view is "what does activity look like right now,"
the panopticon is "where does this wallet *live*." Together they
let you switch between dynamic and static interpretations of the
same data — without ever losing your place.

## Animation contract — what the brain shows

The web canvas is built around three layered behaviours:

1. **Force-directed equilibrium.** Velocity-Verlet physics with
   gravity (toward origin) + repulsion (between all neurons) +
   springs (Hooke per synapse). Mass scales with log of holdings;
   spring strength scales with log of bond sats. The lattice
   self-organises into clusters that match real economic
   relationships.

2. **Temporal evolution.** Pre-birth neurons are pinned at their
   seed position with alpha 0 (invisible but in physics).
   Just-born neurons pop in from the seed. Gone-dark neurons stay
   in the simulation but fade to alpha 0.3. Synapses fade per
   project spec: `alpha = max(0, 1 − (currentBlock − lastActive) / 10)`.

3. **Interaction.** Drag any neuron to pull it through the layout
   (the rest of the system reacts physically). Pan empty space.
   Wheel to zoom. Click to lock the spotlight on a neuron — its
   neighbourhood stays bright, the rest dims to 15%. ESC clears.
   Reset re-seeds the layout.

## Block-by-block playback

The auto-play scrubber turns the chain into a documentary. Hit
play and `currentBlock` advances at the configured rate — every
tick triggers the scrubber subscription path which:

- Fades in newly-born neurons from their seed positions
- Activates synapse springs for newly-formed bonds
- Dims neurons whose `lastActiveBlock` falls behind the scrubber
- Updates the cumulative-supply readout in the HUD

At fixture scale (50 wallets, 121 bonds, 170 sidecars) the entire
chain plays through in ~30 seconds. At v0.2+ scale (10k+ wallets,
millions of sidecars) playback will stream from the parquet/R2
adapter rather than buffering the full history.

## Prolog as reasoning layer

The vault's `prolog/` directory is the brain's introspection
toolkit. Every wallet is a `wallet/5` fact; every bond is a
`bond/4`. Rules build on top:

- `transitive.pl` — flow tracing: who can reach whom, in how many hops
- `clustering.pl` — common-input heuristic for owner-bundle inference
- `miners.pl` — coinbase-recipient detection, pool-span analysis

The richer the rule set, the more nuanced the questions the brain
can answer about its own history. v0.1 ships the foundational rules;
v0.2+ adds temporal predicates (active-at-block-N, richest-K-at-N)
and chain-of-custody reasoning over the spends_input/2 facts the
real chain-tools pipeline will populate.

## What this vault commits to

The schema you see here is the public interface for downstream
tooling. Anything ground in a frontmatter field, a Prolog arity, or
a sidecar key is **forward-compatible** — future versions add
fields, never rename or remove existing ones without a major-version
bump.

Treat this vault as a contract. Build readers, queriers, plugins,
visualisers on top. The brain is open.
