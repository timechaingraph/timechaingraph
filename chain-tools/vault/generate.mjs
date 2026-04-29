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
import {
  SATS_PER_BTC,
  HALVING_BLOCKS,
  TIP_BLOCK,
  epochAt,
  subsidyBtcAt,
  cumulativeSupplyBtcAt,
  dateApproxAt,
} from '../lib/chain.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const VAULT_ROOT = path.join(REPO_ROOT, 'vault');

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

// ---------- emit: synapse markdown (first-class bonds) -----------------------
//
// The brain metaphor wants synapses-as-nodes — neurons don't connect
// directly, they connect via synapses. Each bond becomes a markdown
// note that wikilinks to both endpoints; in Obsidian's graph view the
// topology is wallet ↔ synapse ↔ wallet (vs the plain wallet ↔ wallet
// edges of the wikilink-only model). Density doubles; the wiring
// reads as anatomy rather than as a tangle of point-to-point lines.
//
// Filename uses the lexicographically-sorted endpoint pair joined
// by `--` so both directions resolve to the same file (bonds are
// undirected in the data model even though the type has from/to).

function bondMarkdown(bond, formationBlock) {
  const from = byAddr.get(bond.fromAddress);
  const to = byAddr.get(bond.toAddress);
  const fromAlias = aliasFor(from);
  const toAlias = aliasFor(to);
  const sats = bond.sats;
  const btc = sats / SATS_PER_BTC;
  const lastActive = Math.max(from.lastActiveBlock, to.lastActiveBlock);
  // Role-pair tag for Obsidian color groups; sort lexicographically
  // so order-symmetric (`miner-whale` regardless of from/to direction).
  const roles = [from.role, to.role].sort();
  const rolePairTag = `synapse/${roles[0]}-${roles[1]}`;
  const headline = `${fromAlias} ↔ ${toAlias}`;
  const fm = [
    '---',
    `kind: bond`,
    `from: ${bond.fromAddress}`,
    `to: ${bond.toAddress}`,
    `fromAlias: ${fromAlias}`,
    `toAlias: ${toAlias}`,
    `fromRole: ${from.role}`,
    `toRole: ${to.role}`,
    `sats: ${sats}`,
    `btc: ${btc}`,
    `formationBlock: ${formationBlock}`,
    `lastActiveBlock: ${lastActive}`,
    `tags: [bond, synapse, ${rolePairTag}]`,
    '---',
    '',
  ].join('\n');
  const formationEpoch = epochAt(formationBlock);
  return [
    fm,
    `# ${headline}`,
    '',
    `Synapse between [[${bond.fromAddress}|${fromAlias}]] (${from.role}) and [[${bond.toAddress}|${toAlias}]] (${to.role}). Aggregate weight ${btc.toLocaleString()} BTC; formed at block ${formationBlock.toLocaleString()} (epoch ${formationEpoch}, subsidy ${subsidyBtcAt(formationBlock)} BTC).`,
    '',
    '## Endpoints',
    '',
    `- [[${bond.fromAddress}|${fromAlias}]] — ${from.role}`,
    `- [[${bond.toAddress}|${toAlias}]] — ${to.role}`,
    '',
    '## Activity',
    '',
    `- Formation block: ${formationBlock.toLocaleString()}`,
    `- Last active (max of endpoints): ${lastActive.toLocaleString()}`,
    `- Aggregate sats: ${sats.toLocaleString()}`,
    `- Aggregate BTC: ${btc.toLocaleString()}`,
    '',
    '## Cross-references',
    '',
    `- [[epochs/epoch-${String(formationEpoch).padStart(4, '0')}|Epoch ${formationEpoch}]] (formation)`,
    formationBlock === 0
      ? '- [[blocks/genesis|Block 0 (Genesis)]]'
      : null,
    '',
  ].filter((l) => l !== null).join('\n');
}

// Compute formation blocks once; reuse for both bond markdown and
// activity sidecar emission below.
const bondFormationByBond = new Map();
for (const b of FREE_TIER_50_BONDS) {
  bondFormationByBond.set(b, bondFormationBlock(b));
}

// Build the slug for a bond filename — lexicographic pair joined by
// `--`. Bond is undirected in the data model so order-canonicalising
// here gives a stable filename regardless of from/to.
function bondSlug(bond) {
  const [a, b] = [bond.fromAddress, bond.toAddress].sort();
  return `${a}--${b}`;
}

let bondFilesWritten = 0;
for (const b of FREE_TIER_50_BONDS) {
  const formationBlock = bondFormationByBond.get(b);
  writeFile(`bonds/${bondSlug(b)}.md`, bondMarkdown(b, formationBlock));
  bondFilesWritten++;
}

// ---------- emit: empire markdown (BFS lineage from a seed wallet) -----------
//
// An empire is the set of wallets reachable from a seed via the bond
// graph, layered by hop-count. Satoshi's empire is the lineage tree
// rooted at the genesis recipient — every wallet that ever transitively
// transacted with the chain's origin. Miners' empires are their downstream
// payout networks. The brain reads its own lineage.
//
// Each empire note carries a layered descendant list:
//   - hop 0: the seed itself
//   - hop 1: direct counterparties
//   - hop 2: counterparties of counterparties
//   - ...
//
// At fixture scale (50 wallets, dense bond graph) most empires reach
// every wallet within 3 hops. Real chain-tools data will sparsify this
// considerably — the layered structure becomes more meaningful when
// 10k+ wallets aren't all 3 hops apart.
//
// Backed in Prolog by `satoshi_descendant/1` (queries.pl) — the empire
// note is the human-readable surface of that query.

function bfsFrom(seedAddress) {
  const distances = new Map();
  distances.set(seedAddress, 0);
  const queue = [seedAddress];
  while (queue.length > 0) {
    const current = queue.shift();
    const currentDist = distances.get(current);
    for (const neighbor of neighborsByAddr.get(current) || []) {
      if (!distances.has(neighbor)) {
        distances.set(neighbor, currentDist + 1);
        queue.push(neighbor);
      }
    }
  }
  return distances;
}

function empireMarkdown(seed) {
  const distances = bfsFrom(seed.address);
  const byHop = new Map();
  for (const [addr, dist] of distances) {
    if (!byHop.has(dist)) byHop.set(dist, []);
    byHop.get(dist).push(addr);
  }
  const sortedHops = [...byHop.keys()].sort((a, b) => a - b);
  const totalDescendants = distances.size - 1; // exclude seed itself
  const maxHop = sortedHops[sortedHops.length - 1];
  const seedAlias = aliasFor(seed);
  const fm = [
    '---',
    `kind: empire`,
    `seed: ${seed.address}`,
    `seedAlias: ${seedAlias}`,
    `seedRole: ${seed.role}`,
    `descendants: ${totalDescendants}`,
    `maxHop: ${maxHop}`,
    `tags: [empire, lineage, role/${seed.role}]`,
    '---',
    '',
  ].join('\n');
  const seedDescription = (() => {
    if (seed.role === 'satoshi') {
      return `The chain's origin lineage. Every wallet that ever transitively transacted with [[${seed.address}|Satoshi]] — direct miners, downstream whales, the network thickening outward from the genesis coinbase.`;
    }
    return `Downstream lineage of [[${seed.address}|${seedAlias}]] (${seed.role}). Wallets connected to ${seedAlias} through one or more bonded hops — a payout network or a custodial flow tree.`;
  })();
  const lines = [
    fm,
    `# ${seedAlias}'s empire`,
    '',
    seedDescription,
    '',
    `**${totalDescendants}** wallet${totalDescendants === 1 ? '' : 's'} reachable across **${maxHop}** hop${maxHop === 1 ? '' : 's'} from [[${seed.address}|${seedAlias}]] in the v0.1 fixture bond graph.`,
    '',
  ];
  for (const hop of sortedHops) {
    const addrs = byHop.get(hop).sort();
    if (hop === 0) {
      lines.push(`## Hop 0 — the seed`);
      lines.push('');
      const w = byAddr.get(addrs[0]);
      lines.push(`- [[${w.address}|${aliasFor(w)}]] · ${w.role}`);
      lines.push('');
    } else {
      lines.push(`## Hop ${hop} — ${addrs.length} wallet${addrs.length === 1 ? '' : 's'}`);
      lines.push('');
      for (const addr of addrs) {
        const w = byAddr.get(addr);
        if (!w) continue;
        lines.push(`- [[${w.address}|${aliasFor(w)}]] · ${w.role}`);
      }
      lines.push('');
    }
  }
  lines.push('## Prolog query');
  lines.push('');
  lines.push('Equivalent SWI-Prolog query (consult `prolog/all.pl` first):');
  lines.push('');
  lines.push('```prolog');
  if (seed.role === 'satoshi') {
    lines.push("?- findall(W, satoshi_descendant(W), Ws), length(Ws, N), format('~w descendants~n', [N]).");
  } else {
    lines.push(`?- findall(W, sent_to_transitive('${seed.address}', W), Ws), length(Ws, N), format('~w descendants~n', [N]).`);
  }
  lines.push('```');
  lines.push('');
  return lines.join('\n');
}

// Empire seeds: Satoshi (always) + every miner (their downstream payout
// networks). Adding more seeds is a one-line append to this list.
const EMPIRE_SEEDS = FREE_TIER_50.filter(
  (w) => w.role === 'satoshi' || w.role === 'miner',
);

function empireSlug(wallet) {
  if (wallet.role === 'satoshi') return 'satoshi';
  return wallet.address;
}

let empireFilesWritten = 0;
for (const seed of EMPIRE_SEEDS) {
  writeFile(`empires/${empireSlug(seed)}.md`, empireMarkdown(seed));
  empireFilesWritten++;
}

// ---------- emit: halving block markdown files -------------------------------

// The actual Bitcoin genesis-block coinbase scriptSig contains a hidden
// message — Satoshi's public commentary at the moment of mining block 0.
// Decoded from hex (0x04ffff001d0104455468652054696d65732030332f4a616e2f...):
const GENESIS_COINBASE_QUOTE =
  'The Times 03/Jan/2009 Chancellor on brink of second bailout for banks';

function halvingMarkdown(height) {
  const epoch = epochAt(height);
  const subsidyBtc = subsidyBtcAt(height);
  const dateApprox = dateApproxAt(height);
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
    ? 'The genesis block. Mined on January 3rd 2009 by [[1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa|Satoshi]]. The coinbase output (50 BTC) is **unspendable by the protocol** — Satoshi hardcoded a quirk into the genesis transaction so the reward could never be moved. Every projection of the timechain anchors here.'
    : `The ${epoch}${epoch === 1 ? 'st' : epoch === 2 ? 'nd' : epoch === 3 ? 'rd' : 'th'} halving block. From this block forward the coinbase subsidy drops to **${subsidyBtc} BTC** per block. Halvings are the timechain's metronome — every 210,000 blocks (~4 years) the issuance schedule contracts.`;
  return [
    fm,
    title,
    '',
    description,
    '',
    height === 0
      ? `## Coinbase quote\n\nSatoshi embedded a public commentary in the block-0 coinbase scriptSig. Decoded from the hex:\n\n> ${GENESIS_COINBASE_QUOTE}\n\nA timestamp anchor against any backdated-genesis claim, and a thesis statement about the financial system Bitcoin was built against.\n`
      : '',
    '## Subsidy',
    '',
    `- **From this block forward**: ${subsidyBtc} BTC per coinbase`,
    `- **Epoch number**: ${epoch}`,
    `- **Approx date**: ${dateApprox} (10-min average from genesis)`,
    '',
    height === 0 ? '## Wallets present at genesis\n\n- [[1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa|Satoshi]] (satoshi)\n' : '',
  ].filter(Boolean).join('\n');
}

// (Subsidy + cumulative supply now imported from
// `../lib/chain.mjs` — single source of truth for both
// vault generators.)

writeFile('blocks/genesis.md', halvingMarkdown(0));
let halvingFilesWritten = 1;
for (const h of HALVING_BLOCKS.slice(1)) {
  writeFile(`blocks/halvings/${String(h).padStart(7, '0')}.md`, halvingMarkdown(h));
  halvingFilesWritten++;
}

// ---------- emit: notable non-halving blocks --------------------------------
//
// A small curated set of historically significant blocks beyond
// halvings. These are the points in chain history a casual reader
// would recognise — first peer-to-peer transaction, Mt.Gox halt,
// SegWit activation, Taproot lock-in. Vault becomes more
// narratively rich; Obsidian's graph view shows these as additional
// hubs around the temporal axis.
//
// Future tooling can extend this list — each entry is a pure
// (height, slug, title, body) tuple with no fixture dependency, so
// the chain-tools pipeline can append more notable blocks per epoch
// without changing the generator's shape.
const NOTABLE_BLOCKS = [
  {
    height: 170,
    slug: 'first-p2p-tx',
    title: 'First peer-to-peer Bitcoin transaction',
    body:
      'Block 170 contains the first non-coinbase Bitcoin transaction: 10 BTC sent from [[1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa|Satoshi]] to Hal Finney on January 12, 2009. The transaction proved the protocol worked end-to-end — coins could be transferred between addresses without any intermediary. Hal had downloaded the v0.1 client a few days earlier; the test send was both a working-as-designed verification and a quiet inauguration of a peer-to-peer monetary network.',
    tags: ['block', 'notable', 'epoch/0', 'milestone/first-tx'],
  },
  {
    height: 277_316,
    slug: 'mtgox-halt',
    title: 'Mt. Gox halts withdrawals',
    body:
      'On February 7, 2014, Mt. Gox — at the time handling ~70% of all Bitcoin trading volume — suspended withdrawals citing "transaction malleability" issues. Block 277,316 is approximately the height when the halt notice spread; the price dropped from ~$830 to ~$130 over the following weeks. The exchange filed for bankruptcy on February 28, 2014, with ~850,000 BTC missing. The event reshaped the ecosystem — custody risk became visible, exchange diversity grew, and "not your keys, not your coins" entered common parlance.',
    tags: ['block', 'notable', 'epoch/1', 'milestone/mt-gox'],
  },
  {
    height: 481_824,
    slug: 'segwit-activation',
    title: 'SegWit activation',
    body:
      'Block 481,824 (August 24, 2017) was the first block produced under SegWit (BIP-141) — Segregated Witness, the soft-fork upgrade that moved signature data outside the transaction body and fixed transaction malleability (the same issue Mt. Gox had cited). SegWit unlocked ~75% throughput gains within the existing 1MB block limit and laid the groundwork for the Lightning Network. Activation came after a year-long signaling battle (the "scaling debate"); the New York Agreement, BIP-148 user-activated soft-fork threats, and the Bitcoin Cash hard fork all preceded it.',
    tags: ['block', 'notable', 'epoch/2', 'milestone/segwit'],
  },
  {
    height: 689_832,
    slug: 'taproot-lockin',
    title: 'Taproot signaling lock-in',
    body:
      'Block 689,832 (June 12, 2021) confirmed that 90% of blocks in the previous difficulty period had signalled support for Taproot (BIP-340/341/342) — the activation lock-in. The actual upgrade went live at block 709,632 in November 2021. Taproot brought Schnorr signatures (smaller + privacy-friendly multi-sig), MAST (Merkelized Abstract Syntax Trees for cheaper complex scripts), and improved fungibility — multi-sig and complex contracts now look identical to a regular spend on-chain.',
    tags: ['block', 'notable', 'epoch/3', 'milestone/taproot'],
  },
];

function notableMarkdown(notable) {
  const epoch = epochAt(notable.height);
  const subsidyBtc = subsidyBtcAt(notable.height);
  const supplyBtc = cumulativeSupplyBtcAt(notable.height);
  const dateApprox = dateApproxAt(notable.height);
  const fm = [
    '---',
    `block: ${notable.height}`,
    `kind: notable`,
    `slug: ${notable.slug}`,
    `epoch: ${epoch}`,
    `subsidyBtc: ${subsidyBtc}`,
    `supplyBtcApprox: ${Math.round(supplyBtc)}`,
    `dateApprox: ${dateApprox}`,
    `tags: [${notable.tags.join(', ')}]`,
    '---',
    '',
  ].join('\n');
  return [
    fm,
    `# ${notable.title}`,
    '',
    notable.body,
    '',
    '## Block context',
    '',
    `- **Height**: ${notable.height.toLocaleString()}`,
    `- **Epoch**: ${epoch} (subsidy ${subsidyBtc} BTC/block at this height)`,
    `- **Cumulative supply (approx)**: ${Math.round(supplyBtc).toLocaleString()} BTC`,
    `- **Approx date**: ${dateApprox}`,
    '',
    '## Cross-references',
    '',
    `- [[blocks/halvings/${String(epoch * 210_000).padStart(7, '0')}|Epoch ${epoch} start]]`,
    `- [[epochs/epoch-${String(epoch).padStart(4, '0')}|Epoch ${epoch} summary]]`,
    '',
  ].join('\n');
}

let notableFilesWritten = 0;
for (const n of NOTABLE_BLOCKS) {
  writeFile(
    `blocks/notable/${String(n.height).padStart(7, '0')}-${n.slug}.md`,
    notableMarkdown(n),
  );
  notableFilesWritten++;
}

// ---------- emit: epoch markdown summaries -----------------------------------

function epochMarkdown(epoch) {
  const startBlock = epoch * 210_000;
  const endBlock = (epoch + 1) * 210_000 - 1;
  const subsidyBtc = subsidyBtcAt(startBlock);
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
  const block = bondFormationByBond.get(b);
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
  const filename = `block-${String(block).padStart(7, '0')}.json`;
  writeFile(
    `activity/${filename}`,
    JSON.stringify(
      {
        block,
        epoch: epochAt(block),
        subsidyBtc: subsidyBtcAt(block),
        cumulativeSupplyBtc: cumulativeSupplyBtcAt(block),
        events,
      },
      null,
      2,
    ) + '\n',
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

// ---------- emit: Obsidian graph-view config --------------------------------
//
// Pre-configured `.obsidian/graph.json` so the vault renders with
// correct color groups OOTB. Obsidian reads this on first open —
// no manual setup required. Colors match the web canvas's ROLE_COLOR
// (brass-gold satoshi, red miners, gold whales, cyan significant,
// grey dust). Obsidian uses RGB-as-int: (R << 16) | (G << 8) | B.
//
// Obsidian uses dashed JSON keys (collapse-filter, etc.); we emit
// the same shape so re-saving inside Obsidian doesn't churn the diff.
const obsidianColorGroups = [
  { query: 'tag:#role/satoshi', color: { a: 1, rgb: 16766720 } }, // FFD700
  { query: 'tag:#role/whale', color: { a: 1, rgb: 16766720 } }, // FFD700
  { query: 'tag:#role/miner', color: { a: 1, rgb: 15680580 } }, // EF4444
  { query: 'tag:#role/significant', color: { a: 1, rgb: 54527 } }, // 00D4FF
  { query: 'tag:#role/dust', color: { a: 1, rgb: 6574475 } }, // 64748B
  { query: 'tag:#block OR tag:#halving', color: { a: 1, rgb: 11700051 } }, // B28553
  { query: 'tag:#epoch', color: { a: 1, rgb: 14728767 } }, // E0A656
];

writeFile(
  '.obsidian/graph.json',
  JSON.stringify(
    {
      'collapse-filter': false,
      search: '',
      showTags: false,
      showAttachments: false,
      hideUnresolved: false,
      showOrphans: true,
      'collapse-color-groups': false,
      colorGroups: obsidianColorGroups,
      'collapse-display': false,
      showArrow: false,
      textFadeMultiplier: 0,
      nodeSizeMultiplier: 1.5,
      lineSizeMultiplier: 1,
      'collapse-forces': false,
      centerStrength: 0.518713248970312,
      repelStrength: 10,
      linkStrength: 1,
      linkDistance: 250,
      scale: 0.7,
    },
    null,
    2,
  ) + '\n',
);

// Sensible app defaults — open files in new tab, default to graph view.
writeFile(
  '.obsidian/app.json',
  JSON.stringify(
    {
      promptDelete: false,
      alwaysUpdateLinks: true,
      newFileLocation: 'folder',
      newFileFolderPath: 'wallets',
    },
    null,
    2,
  ) + '\n',
);

// Master loader file so a SWI-Prolog session can `consult('all.pl')`.
// Order matters: facts must load before rules; rules with cross-file
// dependencies (queries.pl uses transitive + miners + temporal) load last.
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
    ":- consult('rules/temporal.pl').",
    ":- consult('rules/queries.pl').",
    '',
  ].join('\n'),
);

// ---------- emit: vault SUMMARY.md aggregate ---------------------------------

function summaryMarkdown() {
  const roleCounts = FREE_TIER_50.reduce((acc, w) => {
    acc[w.role] = (acc[w.role] || 0) + 1;
    return acc;
  }, {});
  const totalSats = FREE_TIER_50.reduce(
    (acc, w) => acc + w.totalReceivedSats,
    0n,
  );
  const totalBtcWhole = totalSats / SATS_PER_BTC;
  const oldestWallet = FREE_TIER_50.reduce((a, b) =>
    a.firstSeenBlock < b.firstSeenBlock ? a : b,
  );
  const newestWallet = FREE_TIER_50.reduce((a, b) =>
    a.firstSeenBlock > b.firstSeenBlock ? a : b,
  );
  const tipSupplyBtc = cumulativeSupplyBtcAt(TIP_BLOCK);
  const fm = [
    '---',
    `kind: summary`,
    `walletsTotal: ${FREE_TIER_50.length}`,
    `bondsTotal: ${FREE_TIER_50_BONDS.length}`,
    `lifetimeReceivedBtc: ${totalBtcWhole}`,
    `tipBlock: ${TIP_BLOCK}`,
    `tipSupplyBtcApprox: ${Math.round(tipSupplyBtc)}`,
    `tags: [summary]`,
    '---',
    '',
  ].join('\n');
  return [
    fm,
    '# Vault Summary',
    '',
    'A bird\'s-eye view of the v0.1 fixture vault. Regenerated on every `node chain-tools/vault/generate.mjs`.',
    '',
    '## Fixture cohort (50 wallets)',
    '',
    `- **Satoshi**: ${roleCounts.satoshi || 0}`,
    `- **Miners**: ${roleCounts.miner || 0}`,
    `- **Whales**: ${roleCounts.whale || 0}`,
    `- **Significant**: ${roleCounts.significant || 0}`,
    `- **Dust**: ${roleCounts.dust || 0}`,
    '',
    `Lifetime received across all fixture wallets: **${totalBtcWhole.toLocaleString()} BTC**.`,
    '',
    '## Bond graph',
    '',
    `- **Total bonds**: ${FREE_TIER_50_BONDS.length} (deterministic from FREE_TIER_50_BONDS via djb2 partner-picking)`,
    `- **Average degree**: ${(2 * FREE_TIER_50_BONDS.length / FREE_TIER_50.length).toFixed(2)} (each bond contributes to two endpoints)`,
    '',
    '## Time axis',
    '',
    `- **Genesis**: block ${oldestWallet.firstSeenBlock} → [[wallets/${ROLE_FOLDER[oldestWallet.role]}/${oldestWallet.address}|${aliasFor(oldestWallet)}]]`,
    `- **Newest birth in fixture**: block ${newestWallet.firstSeenBlock.toLocaleString()} → [[wallets/${ROLE_FOLDER[newestWallet.role]}/${newestWallet.address}|${aliasFor(newestWallet)}]]`,
    `- **Tip**: block ${TIP_BLOCK.toLocaleString()} (~${tipSupplyBtc.toLocaleString()} BTC issued)`,
    `- **Halvings crossed**: 4 ([[blocks/genesis|genesis]] → [[blocks/halvings/0210000|h1]] → [[blocks/halvings/0420000|h2]] → [[blocks/halvings/0630000|h3]] → [[blocks/halvings/0840000|h4]])`,
    '',
    '## Per-block sidecars',
    '',
    `${activityByBlock.size} sidecars written (one per block where wallet-spawn, bond-form, or halving event occurred). Block range: ${oldestWallet.firstSeenBlock} – ${TIP_BLOCK}.`,
    '',
    '## Prolog query starting points',
    '',
    'From `vault/` root:',
    '',
    '```bash',
    "swipl -t halt -g \"consult('prolog/all.pl'), findall(M, miner(M), Ms), length(Ms, N), format('~w miners~n', [N]).\"",
    '```',
    '',
    'See `prolog/rules/transitive.pl` for flow tracing, `clustering.pl` for common-input heuristic (v0.2 stub), `miners.pl` for pool detection.',
    '',
    '## Regeneration',
    '',
    'Re-run `node chain-tools/vault/generate.mjs` after any fixture edit. Output is deterministic — same fixture in, same vault out.',
    '',
  ].join('\n');
}

writeFile('SUMMARY.md', summaryMarkdown());

// ---------- emit: vault wallets/INDEX.md navigation aid ---------------------

function walletsIndexMarkdown() {
  const byRole = (role) =>
    FREE_TIER_50
      .filter((w) => w.role === role)
      .sort((a, b) => a.firstSeenBlock - b.firstSeenBlock);
  const renderList = (role) => {
    const list = byRole(role);
    if (list.length === 0) return '_(none)_';
    return list
      .map(
        (w) =>
          `- [[${ROLE_FOLDER[w.role]}/${w.address}|${aliasFor(w)}]] · first seen block ${w.firstSeenBlock.toLocaleString()} · ${w.txCount.toLocaleString()} txs`,
      )
      .join('\n');
  };
  return [
    '---',
    'kind: index',
    'tags: [index, wallets]',
    '---',
    '',
    '# Wallets — Index',
    '',
    'All 50 fixture wallets, grouped by role and ordered by `firstSeenBlock`. Click through for full metadata + bonded counterparties.',
    '',
    '## Satoshi',
    '',
    renderList('satoshi'),
    '',
    '## Miners',
    '',
    renderList('miner'),
    '',
    '## Whales',
    '',
    renderList('whale'),
    '',
    '## Significant',
    '',
    renderList('significant'),
    '',
    '## Dust',
    '',
    renderList('dust'),
    '',
  ].join('\n');
}

writeFile('wallets/INDEX.md', walletsIndexMarkdown());

// ---------- summary ----------------------------------------------------------

const summary = {
  walletFiles: walletFilesWritten,
  bondFiles: bondFilesWritten,
  empireFiles: empireFilesWritten,
  halvingFiles: halvingFilesWritten,
  notableBlockFiles: notableFilesWritten,
  epochFiles: epochFilesWritten,
  activitySidecars: sidecarsWritten,
  prologFactsWritten: 2,
  totalWallets: FREE_TIER_50.length,
  totalBonds: FREE_TIER_50_BONDS.length,
};
console.log('Vault generated:');
for (const [k, v] of Object.entries(summary)) console.log(`  ${k}: ${v}`);
