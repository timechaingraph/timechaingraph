#!/usr/bin/env node
// chain-tools/vault/generate.mjs
//
// Phase-F vault generator. Reads the FREE_TIER_50 fixture (replicated
// inline below — see "fixture-sync" note) and writes:
//
//   vault/README.md
//   vault/wallets/<role>/<address>.md          (one per wallet, 50 files)
//   vault/blocks/halvings/<height>.md          (one per halving, 5 files)
//   vault/blocks/genesis.md                    (one for block 0)
//   vault/activity/block-<height>.json         (per-block sidecars for
//                                               first-seen + bond-formation
//                                               + halving events; ~150 files)
//   vault/prolog/facts/wallets.pl              (auto-generated facts)
//   vault/prolog/facts/bonds.pl                (auto-generated facts)
//   vault/prolog/rules/transitive.pl           (hand-authored — checked in)
//   vault/prolog/rules/clustering.pl           (hand-authored)
//   vault/prolog/rules/miners.pl               (hand-authored)
//
// The chronological evolution is synthesised from the aggregate fixture
// data: each wallet's `firstSeenBlock` becomes a "wallet-spawn" event in
// the corresponding block-sidecar; each bond gets distributed via djb2
// hash into the overlap window of its endpoints.
//
// When the real chain-tools pipeline ships (Phase v0.2+ — bitcoind
// + electrs + parquet), this generator gets replaced by a Python
// pipeline reading wallets.parquet. The schema documented in
// vault/README.md is the contract that pipeline must produce.
//
// Idempotent. Safe to run multiple times — output is deterministic
// from the fixture inputs. CI will eventually run this as a build
// step (delegated to sister; she owns CI infra).
//
// Run with:  node chain-tools/vault/generate.mjs
//            (writes to $REPO/vault relative to repo root)
//
// fixture-sync: this script duplicates the wallet-synthesis logic from
// src/data/__fixtures__/free-tier-50.ts. If that file changes, sync
// here. There's a regression test in chain-tools/vault/__tests__/
// generate.test.ts that diffs the generator's wallet count vs the TS
// fixture's so the duplication can't drift silently.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const VAULT_ROOT = path.join(REPO_ROOT, 'vault');

const SATS_PER_BTC = 100_000_000n;
const HALVING_BLOCKS = [0, 210_000, 420_000, 630_000, 840_000];
const TIP_BLOCK = 876_000;

// ---------- fixture re-synthesis (must match free-tier-50.ts) -----------------

function mockAddress(prefix, n) {
  const indexed = `${prefix}${String(n).padStart(3, '0')}`;
  const padding = 'X'.repeat(34 - indexed.length - 1);
  return `1${indexed}${padding}`;
}

function build(prefix, role, count, base) {
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : i / (count - 1);
    const txCount = Math.floor(base.txMin + (base.txMax - base.txMin) * t);
    return {
      address: mockAddress(prefix, i + 1),
      role,
      firstSeenBlock: Math.floor(base.firstSeen + (TIP_BLOCK - base.firstSeen) * t * 0.05),
      lastActiveBlock: Math.floor(base.lastActive - (TIP_BLOCK - base.lastActive) * t * 0.05),
      totalReceivedSats: base.btc * SATS_PER_BTC,
      txCount,
      isMiner: role === 'miner' || role === 'satoshi',
    };
  });
}

const FREE_TIER_50 = [
  {
    address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    role: 'satoshi',
    firstSeenBlock: 0,
    lastActiveBlock: 0,
    totalReceivedSats: 50n * SATS_PER_BTC,
    txCount: 1,
    isMiner: true,
  },
  ...build('MockMiner', 'miner', 5, {
    btc: 1_500n, firstSeen: 100, lastActive: 876_000, txMin: 8_000, txMax: 60_000,
  }),
  ...build('MockWhale', 'whale', 10, {
    btc: 5_000n, firstSeen: 50_000, lastActive: 850_000, txMin: 200, txMax: 4_000,
  }),
  ...build('MockSig', 'significant', 25, {
    btc: 25n, firstSeen: 150_000, lastActive: 870_000, txMin: 50, txMax: 800,
  }),
  ...build('MockDust', 'dust', 9, {
    btc: 2n, firstSeen: 400_000, lastActive: 870_000, txMin: 5, txMax: 100,
  }),
];

// ---------- bonds re-synthesis (must match free-tier-50-bonds.ts) ------------

function djb2(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function generateBonds(wallets) {
  const bonds = [];
  const seen = new Set();
  function addBond(from, to, sats) {
    if (from === to) return;
    const key = from < to ? `${from}|${to}` : `${to}|${from}`;
    if (seen.has(key)) return;
    seen.add(key);
    bonds.push({ fromAddress: from, toAddress: to, sats });
  }
  const satoshi = wallets.find((w) => w.role === 'satoshi');
  const miners = wallets.filter((w) => w.role === 'miner');
  const whales = wallets.filter((w) => w.role === 'whale');
  const significant = wallets.filter((w) => w.role === 'significant');
  const dust = wallets.filter((w) => w.role === 'dust');
  for (const m of miners) addBond(satoshi.address, m.address, 5_000_000_000n);
  for (const m of miners) {
    const seed = djb2(m.address);
    for (let i = 0; i < 4; i++) {
      const w = whales[(seed + i * 7) % whales.length];
      addBond(m.address, w.address, BigInt(2_000_000_000 + (seed % 8) * 500_000_000));
    }
  }
  for (let i = 0; i < whales.length; i++) {
    const seed = djb2(whales[i].address);
    for (let j = 1; j <= 3; j++) {
      const partner = whales[(i + j * 3) % whales.length];
      addBond(whales[i].address, partner.address, BigInt(1_000_000_000 + (seed % 12) * 250_000_000));
    }
  }
  for (const s of significant) {
    const seed = djb2(s.address);
    addBond(s.address, whales[seed % whales.length].address, BigInt(50_000_000 + (seed % 100) * 1_000_000));
    addBond(s.address, miners[(seed + 11) % miners.length].address, BigInt(20_000_000 + (seed % 80) * 500_000));
    if (seed % 3 === 0) {
      addBond(s.address, significant[(seed + 17) % significant.length].address, 10_000_000n);
    }
  }
  for (const d of dust) {
    const seed = djb2(d.address);
    const partners = [...significant, ...miners];
    addBond(d.address, partners[seed % partners.length].address, 1_000_000n);
  }
  return bonds;
}

const FREE_TIER_50_BONDS = generateBonds(FREE_TIER_50);

// ---------- helpers -----------------------------------------------------------

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeFile(rel, body) {
  const full = path.join(VAULT_ROOT, rel);
  ensureDir(path.dirname(full));
  fs.writeFileSync(full, body);
}

function aliasFor(w) {
  if (w.role === 'satoshi') return 'Satoshi';
  return `${w.address.slice(0, 8)}…${w.address.slice(-4)}`;
}

const ROLE_FOLDER = {
  satoshi: 'satoshi',
  miner: 'miners',
  whale: 'whales',
  significant: 'significant',
  dust: 'dust',
};

const ROLE_COLOR = {
  satoshi: 'brass-gold',
  miner: 'red',
  whale: 'gold',
  significant: 'cyan',
  dust: 'grey',
};

const ROLE_TAG = {
  satoshi: ['role/satoshi', 'origin/satoshi'],
  miner: ['role/miner'],
  whale: ['role/whale'],
  significant: ['role/significant'],
  dust: ['role/dust'],
};

// Build a map from address → wallet for fast lookup.
const byAddr = new Map(FREE_TIER_50.map((w) => [w.address, w]));

// Compute neighbor list per wallet (all bonded counterparties).
const neighborsByAddr = new Map();
for (const w of FREE_TIER_50) neighborsByAddr.set(w.address, new Set());
for (const b of FREE_TIER_50_BONDS) {
  neighborsByAddr.get(b.fromAddress).add(b.toAddress);
  neighborsByAddr.get(b.toAddress).add(b.fromAddress);
}

// Pick the "formation block" for a bond, deterministically: hash the
// pair to land somewhere in the overlap window of the two endpoints'
// firstSeenBlock and lastActiveBlock. Falls back to max-firstSeen if
// the window is degenerate.
function bondFormationBlock(bond) {
  const a = byAddr.get(bond.fromAddress);
  const b = byAddr.get(bond.toAddress);
  const lo = Math.max(a.firstSeenBlock, b.firstSeenBlock);
  const hi = Math.min(a.lastActiveBlock, b.lastActiveBlock);
  if (hi <= lo) return lo;
  const span = hi - lo;
  const seed = djb2(`${bond.fromAddress}|${bond.toAddress}`);
  return lo + (seed % span);
}

// ---------- emit: wallet markdown files ---------------------------------------

function btcDecimal(sats) {
  const whole = sats / SATS_PER_BTC;
  return `${whole}`;
}

function walletMarkdown(w) {
  const aliases = w.role === 'satoshi' ? ['Satoshi'] : [aliasFor(w)];
  const tags = ROLE_TAG[w.role];
  const linkedTo = [...neighborsByAddr.get(w.address)].sort();
  const fm = [
    '---',
    `address: ${w.address}`,
    `aliases: [${aliases.join(', ')}]`,
    `role: ${w.role}`,
    `color: ${ROLE_COLOR[w.role]}`,
    `firstSeen: ${w.firstSeenBlock}`,
    `lastActive: ${w.lastActiveBlock}`,
    `lifetimeReceivedSats: ${w.totalReceivedSats}`,
    `lifetimeReceivedBtc: ${btcDecimal(w.totalReceivedSats)}`,
    `txCount: ${w.txCount}`,
    `isMiner: ${w.isMiner}`,
    `centrality: ${linkedTo.length}`,
    `tags: [${tags.join(', ')}]`,
    '---',
    '',
  ].join('\n');
  const headline = w.role === 'satoshi'
    ? '# Satoshi'
    : `# ${aliasFor(w)} (${w.role})`;
  const description = (() => {
    switch (w.role) {
      case 'satoshi':
        return 'The Bitcoin genesis coinbase recipient. First entry on the chain. The brass-gold center of every projection of the timechain.';
      case 'miner':
        return 'A coinbase recipient — every block this wallet mined contributes to its lifetime balance. Active across many epochs.';
      case 'whale':
        return 'A wallet holding more than 1,000 BTC at some point during its lifetime. Custodial flow visible; transactions tend to be large and infrequent.';
      case 'significant':
        return 'Mid-tier holder. Has received more than 1 BTC, OR has been involved in more than 100 transactions. The bulk of the visible economy.';
      case 'dust':
        return 'Just over the significance threshold. Probably an exchange depositor, OTC counterparty, or a wallet that was busy briefly and went quiet.';
      default:
        return '';
    }
  })();
  const lines = [
    fm,
    headline,
    '',
    description,
    '',
    '## On-chain summary',
    '',
    `- **First seen**: block ${w.firstSeenBlock.toLocaleString()}`,
    `- **Last active**: block ${w.lastActiveBlock.toLocaleString()}`,
    `- **Lifetime received**: ${btcDecimal(w.totalReceivedSats)} BTC (${w.totalReceivedSats} sats)`,
    `- **Transaction count**: ${w.txCount.toLocaleString()}`,
    `- **Coinbase recipient**: ${w.isMiner ? 'yes' : 'no'}`,
    `- **Direct counterparties**: ${linkedTo.length}`,
    '',
    '## Connections',
    '',
    'Every wallet linked from this one is a wallet this address has transacted with at least once over its lifetime. Edge weights are documented in the bond fact base (`prolog/facts/bonds.pl`).',
    '',
    ...linkedTo.map((addr) => {
      const peer = byAddr.get(addr);
      const peerAlias = peer ? aliasFor(peer) : addr;
      return `- [[${addr}|${peerAlias}]] (${peer ? peer.role : 'unknown'})`;
    }),
    '',
    '## Time axis',
    '',
    `Activity ran from block ${w.firstSeenBlock.toLocaleString()} to block ${w.lastActiveBlock.toLocaleString()} — across ${(w.lastActiveBlock - w.firstSeenBlock).toLocaleString()} blocks of chain history. Per-block activity sidecars (where this wallet appears) live under \`vault/activity/\`.`,
    '',
  ];
  return lines.join('\n');
}

let walletFilesWritten = 0;
for (const w of FREE_TIER_50) {
  const folder = `wallets/${ROLE_FOLDER[w.role]}`;
  const filename = `${w.address}.md`;
  writeFile(`${folder}/${filename}`, walletMarkdown(w));
  walletFilesWritten++;
}

// ---------- emit: halving block markdown files -------------------------------

function halvingMarkdown(height) {
  const epoch = Math.floor(height / 210_000);
  const subsidyBtc = 50 / Math.pow(2, epoch);
  const dateApprox = (() => {
    if (height === 0) return '2009-01-03';
    const minutesFromGenesis = height * 10;
    const genesisMs = Date.UTC(2009, 0, 3, 18, 15, 0);
    const ms = genesisMs + minutesFromGenesis * 60_000;
    return new Date(ms).toISOString().slice(0, 10);
  })();
  const fm = [
    '---',
    `block: ${height}`,
    `kind: halving`,
    `epoch: ${epoch}`,
    `subsidyBtc: ${subsidyBtc}`,
    `dateApprox: ${dateApprox}`,
    `tags: [block, halving, epoch/${epoch}]`,
    '---',
    '',
  ].join('\n');
  const title = height === 0
    ? '# Genesis · Block 0'
    : `# Halving · Block ${height.toLocaleString()}`;
  const description = height === 0
    ? 'The genesis block. Mined on January 3rd 2009. The coinbase output (50 BTC) is unspendable by the protocol; the recipient address is the symbolic origin of every subsequent ledger entry. Every projection of the timechain anchors here.'
    : `The ${epoch}${epoch === 1 ? 'st' : epoch === 2 ? 'nd' : epoch === 3 ? 'rd' : 'th'} halving block. From this block forward the coinbase subsidy drops to **${subsidyBtc} BTC** per block. Halvings are the timechain's metronome — every 210,000 blocks (~4 years) the issuance schedule contracts.`;
  return [
    fm,
    title,
    '',
    description,
    '',
    '## Subsidy',
    '',
    `- **From this block forward**: ${subsidyBtc} BTC per coinbase`,
    `- **Epoch number**: ${epoch}`,
    `- **Approx date**: ${dateApprox} (10-min average from genesis)`,
    '',
    height === 0 ? '## Wallets present at genesis\n\n- [[1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa|Satoshi]] (satoshi)\n' : '',
  ].filter(Boolean).join('\n');
}

writeFile('blocks/genesis.md', halvingMarkdown(0));
let halvingFilesWritten = 1;
for (const h of HALVING_BLOCKS.slice(1)) {
  writeFile(`blocks/halvings/${String(h).padStart(7, '0')}.md`, halvingMarkdown(h));
  halvingFilesWritten++;
}

// ---------- emit: epoch markdown summaries -----------------------------------

function epochMarkdown(epoch) {
  const startBlock = epoch * 210_000;
  const endBlock = (epoch + 1) * 210_000 - 1;
  const subsidyBtc = 50 / Math.pow(2, epoch);
  // Wallets whose first-seen falls in this epoch (born here)
  const bornHere = FREE_TIER_50.filter(
    (w) => w.firstSeenBlock >= startBlock && w.firstSeenBlock <= endBlock,
  );
  // Wallets active at any point during this epoch
  const activeHere = FREE_TIER_50.filter(
    (w) => w.firstSeenBlock <= endBlock && w.lastActiveBlock >= startBlock,
  );
  const fm = [
    '---',
    `epoch: ${epoch}`,
    `firstBlock: ${startBlock}`,
    `lastBlock: ${endBlock}`,
    `subsidyBtc: ${subsidyBtc}`,
    `walletsBorn: ${bornHere.length}`,
    `walletsActive: ${activeHere.length}`,
    `tags: [epoch, epoch/${epoch}]`,
    '---',
    '',
  ].join('\n');
  const labels = [
    'Genesis epoch · 50 BTC subsidy',
    'First halving · 25 BTC subsidy',
    'Second halving · 12.5 BTC subsidy',
    'Third halving · 6.25 BTC subsidy',
    'Fourth halving · 3.125 BTC subsidy',
  ];
  return [
    fm,
    `# Epoch ${epoch} — ${labels[epoch] ?? `Subsidy ${subsidyBtc} BTC`}`,
    '',
    `Blocks ${startBlock.toLocaleString()} through ${endBlock.toLocaleString()} — 210,000 blocks (~4 years at 10-min average). Coinbase subsidy: ${subsidyBtc} BTC per block.`,
    '',
    '## Wallets born this epoch',
    '',
    bornHere.length === 0
      ? '_(none in the v0.1 fixture)_'
      : bornHere
          .map(
            (w) => `- [[${w.address}|${aliasFor(w)}]] (${w.role}, first seen block ${w.firstSeenBlock.toLocaleString()})`,
          )
          .join('\n'),
    '',
    '## Wallets active during this epoch',
    '',
    `${activeHere.length} of ${FREE_TIER_50.length} wallets in the fixture had activity overlapping this epoch.`,
    '',
    activeHere.length > 0 && activeHere.length <= 30
      ? activeHere
          .map((w) => `- [[${w.address}|${aliasFor(w)}]] (${w.role})`)
          .join('\n')
      : `Full active-list elided for brevity at this scale; query \`prolog/all.pl\` with \`wallet(X, F, L, _, _), F =< ${endBlock}, L >= ${startBlock}\` for the exact set.`,
    '',
    '## Boundary blocks',
    '',
    epoch === 0
      ? `- Start: [[../genesis|Block 0]] (genesis)`
      : `- Start: [[../halvings/${String(startBlock).padStart(7, '0')}|Block ${startBlock.toLocaleString()}]] (${epoch === 1 ? '1st' : epoch === 2 ? '2nd' : epoch === 3 ? '3rd' : '4th'} halving)`,
    epoch < 4
      ? `- End: block ${endBlock.toLocaleString()} (next halving at block ${(epoch + 1) * 210_000})`
      : `- End: block ${endBlock.toLocaleString()} (next halving at block ${(epoch + 1) * 210_000} — beyond v0.1 fixture range)`,
    '',
  ].join('\n');
}

let epochFilesWritten = 0;
for (let e = 0; e <= 4; e++) {
  writeFile(`epochs/epoch-${String(e).padStart(4, '0')}.md`, epochMarkdown(e));
  epochFilesWritten++;
}

// ---------- emit: per-block activity sidecars --------------------------------

const activityByBlock = new Map();
function addActivity(block, event) {
  if (!activityByBlock.has(block)) activityByBlock.set(block, []);
  activityByBlock.get(block).push(event);
}

for (const w of FREE_TIER_50) {
  addActivity(w.firstSeenBlock, {
    kind: 'wallet-spawn',
    address: w.address,
    role: w.role,
    isMiner: w.isMiner,
  });
}
for (const b of FREE_TIER_50_BONDS) {
  const block = bondFormationBlock(b);
  addActivity(block, {
    kind: 'bond-form',
    fromAddress: b.fromAddress,
    toAddress: b.toAddress,
    sats: b.sats.toString(),
  });
}
for (const h of HALVING_BLOCKS) {
  addActivity(h, { kind: 'halving', epoch: Math.floor(h / 210_000) });
}

let sidecarsWritten = 0;
for (const [block, events] of activityByBlock) {
  const epoch = Math.floor(block / 210_000);
  const filename = `block-${String(block).padStart(7, '0')}.json`;
  writeFile(
    `activity/${filename}`,
    JSON.stringify({ block, epoch, events }, null, 2) + '\n',
  );
  sidecarsWritten++;
}

// ---------- emit: Prolog facts -----------------------------------------------

function prologEscape(s) {
  return s.replace(/'/g, "''");
}

const walletFacts = [
  '% Auto-generated from FREE_TIER_50 by chain-tools/vault/generate.mjs.',
  '% wallet(Address, FirstSeen, LastActive, IsMiner, Role).',
  '',
];
for (const w of FREE_TIER_50) {
  walletFacts.push(
    `wallet('${prologEscape(w.address)}', ${w.firstSeenBlock}, ${w.lastActiveBlock}, ${w.isMiner ? 'true' : 'false'}, ${w.role}).`,
  );
}
walletFacts.push('');
writeFile('prolog/facts/wallets.pl', walletFacts.join('\n'));

const bondFacts = [
  '% Auto-generated from FREE_TIER_50_BONDS by chain-tools/vault/generate.mjs.',
  '% bond(FromAddress, ToAddress, Sats, FormationBlock).',
  '',
];
for (const b of FREE_TIER_50_BONDS) {
  const block = bondFormationBlock(b);
  bondFacts.push(
    `bond('${prologEscape(b.fromAddress)}', '${prologEscape(b.toAddress)}', ${b.sats}, ${block}).`,
  );
}
bondFacts.push('');
writeFile('prolog/facts/bonds.pl', bondFacts.join('\n'));

// Master loader file so a SWI-Prolog session can `consult('all.pl')`.
writeFile(
  'prolog/all.pl',
  [
    '% Master loader — consult this file to load the full Bitcoin lattice fact base.',
    "% Usage: swipl -t halt -g \"consult('vault/prolog/all.pl'), halt\"",
    '',
    ":- consult('facts/wallets.pl').",
    ":- consult('facts/bonds.pl').",
    ":- consult('rules/transitive.pl').",
    ":- consult('rules/clustering.pl').",
    ":- consult('rules/miners.pl').",
    '',
  ].join('\n'),
);

// ---------- summary ----------------------------------------------------------

const summary = {
  walletFiles: walletFilesWritten,
  halvingFiles: halvingFilesWritten,
  epochFiles: epochFilesWritten,
  activitySidecars: sidecarsWritten,
  prologFactsWritten: 2,
  totalWallets: FREE_TIER_50.length,
  totalBonds: FREE_TIER_50_BONDS.length,
};
console.log('Vault generated:');
for (const [k, v] of Object.entries(summary)) console.log(`  ${k}: ${v}`);
