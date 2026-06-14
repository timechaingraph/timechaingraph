% Transitive flow tracing — given a target wallet T, find all wallets
% that have transferred sats to T directly or indirectly via any
% intermediate hop count. Useful for "who ever paid Satoshi?" /
% "trace this address back to a coinbase" style queries.
%
% Loaded from vault/prolog/all.pl. Depends on facts/bonds.pl having
% bond(From, To, Sats, FormationBlock) populated.

% Direct edge: A → B if there is a bond from A to B.
sent_to(A, B) :- bond(A, B, _, _).

% Symmetric variant — useful when bonds are conceptually undirected
% (e.g., custodial wallets that mix flow direction across a session).
% We model them as both directions for transitive closure purposes.
connected(A, B) :- bond(A, B, _, _).
connected(A, B) :- bond(B, A, _, _).

% Transitive closure of the directed graph.
% sent_to_transitive(A, B) — A transitively sent to B (via one or more hops).
sent_to_transitive(A, B) :- sent_to(A, B).
sent_to_transitive(A, B) :- sent_to(A, X), sent_to_transitive(X, B).

% Reachability across the undirected bond graph (cluster membership).
% reachable(A, B) — A and B are in the same connected component.
reachable(A, B) :- connected(A, B).
reachable(A, B) :- connected(A, X), reachable(X, B).

% Hop-bounded variant for performance — limit transitive search to
% N hops so the SWI-Prolog server can return inside the API timeout.
sent_to_within(A, B, N) :- N > 0, sent_to(A, B).
sent_to_within(A, B, N) :-
    N > 0,
    sent_to(A, X),
    N1 is N - 1,
    sent_to_within(X, B, N1).
