---
kind: cluster
id: cluster-000
size: 41
seedAddress: 1MockSig009XXXXXXXXXXXXXXXXXXXXXXX
roleProfile: [significant:25, whale:10, miner:5, satoshi:1]
tags: [cluster]
---

# Cluster 1 — 41 wallets

Connected via shared-counterparty heuristic (>= 2 shared bonded peers). The cluster's defining property: wallets in this group transact with the same partners more than not. Real common-input clustering from multi-input transactions ships in v0.2 — this is the structural placeholder.

**Role distribution**: significant:25, whale:10, miner:5, satoshi:1

**Seed wallet**: [[1MockSig009XXXXXXXXXXXXXXXXXXXXXXX|1MockSig…XXXX]] (significant)

## Members

- [[1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa|Satoshi]] · satoshi
- [[1MockMiner001XXXXXXXXXXXXXXXXXXXXX|1MockMin…XXXX]] · miner
- [[1MockMiner002XXXXXXXXXXXXXXXXXXXXX|1MockMin…XXXX]] · miner
- [[1MockMiner003XXXXXXXXXXXXXXXXXXXXX|1MockMin…XXXX]] · miner
- [[1MockMiner004XXXXXXXXXXXXXXXXXXXXX|1MockMin…XXXX]] · miner
- [[1MockMiner005XXXXXXXXXXXXXXXXXXXXX|1MockMin…XXXX]] · miner
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

## Prolog query

Equivalent SWI-Prolog query (heuristic — no current rule for shared-counterparty clusters; see `prolog/rules/clustering.pl` for the future common-input version):

```prolog
% Cluster members are reachable from any seed via shared peers;
% no exact equivalent until clustering.pl gains a shared_peers/3
% rule. For now, listing here matches the markdown.
```
