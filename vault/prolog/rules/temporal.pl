% Temporal predicates — reasoning over block-height ranges.
%
% Bitcoin is a chronological substrate; every fact has a birth-block
% stamp. These rules let you ask "who was active at block N" /
% "what changed between blocks X and Y" / "richest K wallets at
% block N." They're how the brain interrogates its own history.

% A wallet exists at block H if it was born at or before H.
exists_at(Address, H) :- wallet(Address, FirstSeen, _, _, _), FirstSeen =< H.

% A wallet is alive at block H — born and not gone-dark yet.
alive_at(Address, H) :-
    wallet(Address, FirstSeen, LastActive, _, _),
    FirstSeen =< H,
    LastActive >= H.

% A wallet is gone-dark at block H — born but past last activity.
gone_dark_at(Address, H) :-
    wallet(Address, FirstSeen, LastActive, _, _),
    FirstSeen =< H,
    LastActive < H.

% A wallet was active across the window [From, To] inclusive — born
% before or during the window, and active at some point within it.
active_window(Address, From, To) :-
    wallet(Address, FirstSeen, LastActive, _, _),
    FirstSeen =< To,
    LastActive >= From.

% Born inside the window [From, To] inclusive.
born_in(Address, From, To) :-
    wallet(Address, FirstSeen, _, _, _),
    FirstSeen >= From,
    FirstSeen =< To.

% Bonds that formed at or before block H — bonds visible to a viewer
% scrubbed to that point in history.
bond_formed_by(From, To, Sats, Block, H) :-
    bond(From, To, Sats, Block),
    Block =< H.

% Halving epoch a wallet was born in.
born_in_epoch(Address, Epoch) :-
    wallet(Address, FirstSeen, _, _, _),
    Epoch is FirstSeen // 210000.

% Halving epoch a wallet was last active in.
last_active_epoch(Address, Epoch) :-
    wallet(Address, _, LastActive, _, _),
    Epoch is LastActive // 210000.

% Wallet straddles a halving — born one epoch, last-active a later one.
straddles_halving(Address) :-
    born_in_epoch(Address, E1),
    last_active_epoch(Address, E2),
    E1 \= E2.
