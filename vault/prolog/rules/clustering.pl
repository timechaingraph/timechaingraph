% Common-input clustering heuristic. Two addresses appearing as
% inputs to the same transaction probably belong to the same owner —
% you have to control the private keys for both inputs to sign the
% same tx. This is the foundation of every chain-analysis service.
%
% v0.1 fixture mock: we don't yet model multi-input transactions. Once
% the chain-tools pipeline writes spends_input/2 facts (the actual
% multi-input data from bitcoind), the rule below activates. The
% structural shape of the rule is checked in to document the intent;
% applying it requires real transaction data.

% spends_input(TxHash, Address) — declares that Address provided one
% of the inputs to TxHash. Populated from bitcoind via electrs in
% v0.2+.

% Two addresses share an owner if they ever co-spent in a transaction.
same_owner(A, B) :-
    spends_input(H, A),
    spends_input(H, B),
    A \= B.

% Transitive closure of co-spend — the cluster is the equivalence
% class under same_owner. Used by the wallet-empire highlighting
% feature in v0.3.
in_same_cluster(A, B) :- same_owner(A, B).
in_same_cluster(A, B) :- same_owner(A, X), in_same_cluster(X, B).

% Stub the predicate so consult succeeds even with no v0.2 data.
% Once spends_input/2 facts arrive, this stub becomes overshadowed
% by real ground facts and the rules above start returning bindings.
spends_input(_, _) :- fail.
