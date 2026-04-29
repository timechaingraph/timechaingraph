---
kind: empire
seed: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa
seedAlias: Satoshi
seedRole: satoshi
descendants: 49
maxHop: 3
tags: [empire, lineage, role/satoshi]
---

# Satoshi's empire

The chain's origin lineage. Every wallet that ever transitively transacted with [[1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa|Satoshi]] — direct miners, downstream whales, the network thickening outward from the genesis coinbase.

**49** wallets reachable across **3** hops from [[1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa|Satoshi]] in the v0.1 fixture bond graph.

## Hop 0 — the seed

- [[1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa|Satoshi]] · satoshi

## Hop 1 — 5 wallets

- [[1MockMiner001XXXXXXXXXXXXXXXXXXXXX|1MockMin…XXXX]] · miner
- [[1MockMiner002XXXXXXXXXXXXXXXXXXXXX|1MockMin…XXXX]] · miner
- [[1MockMiner003XXXXXXXXXXXXXXXXXXXXX|1MockMin…XXXX]] · miner
- [[1MockMiner004XXXXXXXXXXXXXXXXXXXXX|1MockMin…XXXX]] · miner
- [[1MockMiner005XXXXXXXXXXXXXXXXXXXXX|1MockMin…XXXX]] · miner

## Hop 2 — 35 wallets

- [[1MockSig001XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig002XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig003XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig004XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig005XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig006XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig007XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig008XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig009XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig010XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig011XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig012XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig013XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig014XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig015XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig016XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig017XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig018XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig019XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig020XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig021XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig022XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig023XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig024XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig025XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockWhale001XXXXXXXXXXXXXXXXXXXXX|1MockWha…XXXX]] · whale
- [[1MockWhale002XXXXXXXXXXXXXXXXXXXXX|1MockWha…XXXX]] · whale
- [[1MockWhale003XXXXXXXXXXXXXXXXXXXXX|1MockWha…XXXX]] · whale
- [[1MockWhale004XXXXXXXXXXXXXXXXXXXXX|1MockWha…XXXX]] · whale
- [[1MockWhale005XXXXXXXXXXXXXXXXXXXXX|1MockWha…XXXX]] · whale
- [[1MockWhale006XXXXXXXXXXXXXXXXXXXXX|1MockWha…XXXX]] · whale
- [[1MockWhale007XXXXXXXXXXXXXXXXXXXXX|1MockWha…XXXX]] · whale
- [[1MockWhale008XXXXXXXXXXXXXXXXXXXXX|1MockWha…XXXX]] · whale
- [[1MockWhale009XXXXXXXXXXXXXXXXXXXXX|1MockWha…XXXX]] · whale
- [[1MockWhale010XXXXXXXXXXXXXXXXXXXXX|1MockWha…XXXX]] · whale

## Hop 3 — 9 wallets

- [[1MockDust001XXXXXXXXXXXXXXXXXXXXXX|1MockDus…XXXX]] · dust
- [[1MockDust002XXXXXXXXXXXXXXXXXXXXXX|1MockDus…XXXX]] · dust
- [[1MockDust003XXXXXXXXXXXXXXXXXXXXXX|1MockDus…XXXX]] · dust
- [[1MockDust004XXXXXXXXXXXXXXXXXXXXXX|1MockDus…XXXX]] · dust
- [[1MockDust005XXXXXXXXXXXXXXXXXXXXXX|1MockDus…XXXX]] · dust
- [[1MockDust006XXXXXXXXXXXXXXXXXXXXXX|1MockDus…XXXX]] · dust
- [[1MockDust007XXXXXXXXXXXXXXXXXXXXXX|1MockDus…XXXX]] · dust
- [[1MockDust008XXXXXXXXXXXXXXXXXXXXXX|1MockDus…XXXX]] · dust
- [[1MockDust009XXXXXXXXXXXXXXXXXXXXXX|1MockDus…XXXX]] · dust

## Prolog query

Equivalent SWI-Prolog query (consult `prolog/all.pl` first):

```prolog
?- findall(W, satoshi_descendant(W), Ws), length(Ws, N), format('~w descendants~n', [N]).
```
