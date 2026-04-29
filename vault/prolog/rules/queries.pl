% Higher-level queries — combine facts + temporal + transitive into
% the questions a curious viewer would actually ask.
%
% These rules build on transitive.pl, miners.pl, temporal.pl and
% facts/{wallets,bonds}.pl. Loaded by all.pl after their dependencies.

% A descendant of Satoshi: any wallet that received from Satoshi
% directly or transitively. (The chain of custody from genesis.)
satoshi_descendant(Address) :-
    sent_to_transitive('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', Address).

% A wallet's degree — count of distinct counterparties.
degree(Address, Count) :-
    wallet(Address, _, _, _, _),
    findall(P,
            (bond(Address, P, _, _) ; bond(P, Address, _, _)),
            Peers),
    list_to_set(Peers, Unique),
    length(Unique, Count).

% Hub wallets — degree above the threshold N. Useful to find clusters
% of high-connectivity activity (exchanges, mixers, central nodes).
hub(Address, N) :-
    degree(Address, D),
    D >= N.

% Total sats received by a wallet (sum across incoming bonds).
% Note: this counts bond aggregate sats, not the lifetimeReceivedSats
% from the wallet's own frontmatter — those are different views of
% the same data.
incoming_sats(Address, Total) :-
    findall(S, bond(_, Address, S, _), Incoming),
    sum_list(Incoming, Total).

% Wallets with incoming greater than N sats — useful for "find
% addresses that received >X BTC."
heavy_recipient(Address, MinSats) :-
    incoming_sats(Address, Total),
    Total >= MinSats.

% Bond density of an epoch — count bonds that formed in [E*210k, (E+1)*210k).
bonds_formed_in_epoch(Epoch, Count) :-
    Lo is Epoch * 210000,
    Hi is (Epoch + 1) * 210000,
    findall(b(F,T), (bond(F, T, _, B), B >= Lo, B < Hi), Bs),
    length(Bs, Count).

% Wallets born in epoch E — useful for showing the lattice at any
% point in history.
wallets_born_in_epoch(Epoch, Wallets) :-
    Lo is Epoch * 210000,
    Hi is (Epoch + 1) * 210000 - 1,
    findall(A, born_in(A, Lo, Hi), Wallets).

% A "miner with longevity" — coinbase recipient that spans 2+ halving
% epochs (almost certainly a mining pool, not a solo miner).
mining_pool_with_span(Address, Span) :-
    pool_candidate(Address),
    miner_epoch_span(Address, Span),
    Span >= 2.

% Top-K wallets by total received, alive at block H.
% Returns a list of pair(Address, Sats) sorted descending.
% Usage: ?- richest_alive_at(K, H, Top).
richest_alive_at(K, H, TopK) :-
    findall(A-S, (alive_at(A, H), incoming_sats(A, S)), Pairs),
    sort(2, @>=, Pairs, Sorted),
    length(Sorted, Total),
    K1 is min(K, Total),
    length(TopK, K1),
    append(TopK, _, Sorted).
