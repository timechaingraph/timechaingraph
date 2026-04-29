% Mining-pool detection. A wallet is a "miner" if it has received at
% least one coinbase output. Pools are detected via concentration:
% a miner that receives coinbase outputs across many epochs is
% structurally a pool (no individual hashrate persists for years).
%
% v0.1 mock: every wallet with role=miner OR role=satoshi has
% isMiner=true. Real coinbase counts arrive in v0.2+ via
% coinbase(Block, Miner, RewardSats) facts.

% A miner is a wallet flagged isMiner=true in the wallet/5 facts.
miner(Address) :- wallet(Address, _, _, true, _).

% Pool candidate: a miner active across more than one halving epoch.
% (A wallet that mined through a halving operationally must be a pool;
% an individual home-miner doesn't run for 4+ years on one address.)
pool_candidate(Address) :-
    miner(Address),
    wallet(Address, FirstSeen, LastActive, true, _),
    Epoch1 is FirstSeen // 210000,
    Epoch2 is LastActive // 210000,
    Epoch1 \= Epoch2.

% Number of halving epochs a miner spans.
miner_epoch_span(Address, Span) :-
    miner(Address),
    wallet(Address, FirstSeen, LastActive, true, _),
    Epoch1 is FirstSeen // 210000,
    Epoch2 is LastActive // 210000,
    Span is Epoch2 - Epoch1 + 1.

% List all miners (debug/exploration aid).
all_miners(Miners) :- findall(A, miner(A), Miners).

% List all pool candidates.
all_pool_candidates(Pools) :- findall(A, pool_candidate(A), Pools).
