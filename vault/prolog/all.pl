% Master loader — consult this file to load the full Bitcoin lattice fact base.
% Usage: swipl -t halt -g "consult('vault/prolog/all.pl'), halt"

:- consult('facts/wallets.pl').
:- consult('facts/bonds.pl').
:- consult('rules/transitive.pl').
:- consult('rules/clustering.pl').
:- consult('rules/miners.pl').
