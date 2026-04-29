---
kind: empire
seed: 1MockMiner005XXXXXXXXXXXXXXXXXXXXX
seedAlias: 1MockMin…XXXX
seedRole: miner
descendants: 49
maxHop: 4
tags: [empire, lineage, role/miner]
---

# 1MockMin…XXXX's empire

Downstream lineage of [[1MockMiner005XXXXXXXXXXXXXXXXXXXXX|1MockMin…XXXX]] (miner). Wallets connected to 1MockMin…XXXX through one or more bonded hops — a payout network or a custodial flow tree.

**49** wallets reachable across **4** hops from [[1MockMiner005XXXXXXXXXXXXXXXXXXXXX|1MockMin…XXXX]] in the v0.1 fixture bond graph.

## Hop 0 — the seed

- [[1MockMiner005XXXXXXXXXXXXXXXXXXXXX|1MockMin…XXXX]] · miner

## Hop 1 — 10 wallets

- [[1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa|Satoshi]] · satoshi
- [[1MockSig001XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig005XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig012XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig016XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig022XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockWhale002XXXXXXXXXXXXXXXXXXXXX|1MockWha…XXXX]] · whale
- [[1MockWhale005XXXXXXXXXXXXXXXXXXXXX|1MockWha…XXXX]] · whale
- [[1MockWhale006XXXXXXXXXXXXXXXXXXXXX|1MockWha…XXXX]] · whale
- [[1MockWhale009XXXXXXXXXXXXXXXXXXXXX|1MockWha…XXXX]] · whale

## Hop 2 — 19 wallets

- [[1MockDust005XXXXXXXXXXXXXXXXXXXXXX|1MockDus…XXXX]] · dust
- [[1MockMiner001XXXXXXXXXXXXXXXXXXXXX|1MockMin…XXXX]] · miner
- [[1MockMiner002XXXXXXXXXXXXXXXXXXXXX|1MockMin…XXXX]] · miner
- [[1MockMiner003XXXXXXXXXXXXXXXXXXXXX|1MockMin…XXXX]] · miner
- [[1MockMiner004XXXXXXXXXXXXXXXXXXXXX|1MockMin…XXXX]] · miner
- [[1MockSig002XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig004XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig008XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig013XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig019XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig020XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig023XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig024XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockWhale001XXXXXXXXXXXXXXXXXXXXX|1MockWha…XXXX]] · whale
- [[1MockWhale003XXXXXXXXXXXXXXXXXXXXX|1MockWha…XXXX]] · whale
- [[1MockWhale004XXXXXXXXXXXXXXXXXXXXX|1MockWha…XXXX]] · whale
- [[1MockWhale007XXXXXXXXXXXXXXXXXXXXX|1MockWha…XXXX]] · whale
- [[1MockWhale008XXXXXXXXXXXXXXXXXXXXX|1MockWha…XXXX]] · whale
- [[1MockWhale010XXXXXXXXXXXXXXXXXXXXX|1MockWha…XXXX]] · whale

## Hop 3 — 12 wallets

- [[1MockSig003XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig006XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig007XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig009XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig010XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig011XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig014XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig015XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig017XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig018XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig021XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant
- [[1MockSig025XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] · significant

## Hop 4 — 8 wallets

- [[1MockDust001XXXXXXXXXXXXXXXXXXXXXX|1MockDus…XXXX]] · dust
- [[1MockDust002XXXXXXXXXXXXXXXXXXXXXX|1MockDus…XXXX]] · dust
- [[1MockDust003XXXXXXXXXXXXXXXXXXXXXX|1MockDus…XXXX]] · dust
- [[1MockDust004XXXXXXXXXXXXXXXXXXXXXX|1MockDus…XXXX]] · dust
- [[1MockDust006XXXXXXXXXXXXXXXXXXXXXX|1MockDus…XXXX]] · dust
- [[1MockDust007XXXXXXXXXXXXXXXXXXXXXX|1MockDus…XXXX]] · dust
- [[1MockDust008XXXXXXXXXXXXXXXXXXXXXX|1MockDus…XXXX]] · dust
- [[1MockDust009XXXXXXXXXXXXXXXXXXXXXX|1MockDus…XXXX]] · dust

## Prolog query

Equivalent SWI-Prolog query (consult `prolog/all.pl` first):

```prolog
?- findall(W, sent_to_transitive('1MockMiner005XXXXXXXXXXXXXXXXXXXXX', W), Ws), length(Ws, N), format('~w descendants~n', [N]).
```
