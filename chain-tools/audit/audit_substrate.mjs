#!/usr/bin/env node
// Audit the NDJSON substrate produced by chain-tools/ingest/walk_chain_scalable.mjs.
//
// Verifies completeness and integrity of the retrieved chain data:
//   1. meta.tipBlock parses
//   2. wallets.jsonl — every line valid JSON with required fields
//   3. bonds.jsonl   — every line valid JSON with required fields
//   4. timestamps    — keys cover 0..tipBlock with no gaps
//   5. cross-checks  — bonds reference known wallets, block heights in
//                      range, firstSeen <= lastActive per wallet
//
// Streams large files via readline so memory stays bounded even when
// individual files exceed V8's ~512MB string limit.
//
// Usage:
//   node chain-tools/audit/audit_substrate.mjs
//   node chain-tools/audit/audit_substrate.mjs --sample-bonds 100000
//
// Exits 0 on PASS, 1 on FAIL.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'out');

const META_PATH = path.join(OUT_DIR, 'real-substrate-meta.json');
const WALLETS_PATH = path.join(OUT_DIR, 'real-substrate-wallets.jsonl');
const BONDS_PATH = path.join(OUT_DIR, 'real-substrate-bonds.jsonl');
const TIMESTAMPS_PATH = path.join(OUT_DIR, 'real-substrate-timestamps.json');

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i], process.argv[i + 1]);
}
const SAMPLE_BONDS = parseInt(args.get('--sample-bonds') ?? '0', 10) || 0;

const REQUIRED_WALLET_FIELDS = [
  'address', 'isMiner', 'firstSeenBlock', 'lastActiveBlock',
  'totalReceivedSats', 'txCount',
];
const REQUIRED_BOND_FIELDS = ['fromAddress', 'toAddress', 'sats', 'formationBlock'];
// v5 stores isMiner (boolean); the client derives the display role
// (satoshi/miner/whale/significant/dust) from the columns, so no role field here.

const failures = [];
const fail = (msg) => failures.push(msg);
const fmt = (n) => n.toLocaleString('en-US');

async function streamLines(filePath) {
  return readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
}

console.log('═══ Substrate audit ═══');
console.log(`out dir: ${OUT_DIR}\n`);

// ── 1. meta ─────────────────────────────────────────────────────────
let meta;
try {
  meta = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
} catch (err) {
  console.error(`FATAL: cannot parse meta: ${err.message}`);
  process.exit(1);
}

console.log(`[meta]    schema: ${meta.schema}`);
console.log(`[meta]    tipBlock: ${fmt(meta.tipBlock)}`);
console.log(`[meta]    generatedAt: ${meta.generatedAt}`);
if (meta.schema !== 'real-substrate/v5') fail(`meta.schema is not v5: ${meta.schema}`);
if (!Number.isInteger(meta.tipBlock) || meta.tipBlock < 0) fail(`meta.tipBlock not a non-negative integer: ${meta.tipBlock}`);
const tipBlock = meta.tipBlock;

// ── 2. wallets.jsonl ────────────────────────────────────────────────
console.log('\n[wallets] streaming ...');
const walletAddresses = new Set();
let walletCount = 0;
let walletBadJson = 0;
let walletMissingFields = 0;
let walletBadMiner = 0;
let walletInvariantViolations = 0;
let maxWalletLastActive = -1;
let minWalletFirstSeen = Number.MAX_SAFE_INTEGER;
let minerCount = 0;

{
  const rl = await streamLines(WALLETS_PATH);
  for await (const line of rl) {
    if (!line) continue;
    walletCount += 1;
    let w;
    try { w = JSON.parse(line); }
    catch { walletBadJson += 1; continue; }
    for (const f of REQUIRED_WALLET_FIELDS) {
      if (!(f in w)) { walletMissingFields += 1; break; }
    }
    if (typeof w.isMiner !== 'boolean') walletBadMiner += 1;
    if (w.firstSeenBlock > w.lastActiveBlock) walletInvariantViolations += 1;
    if (typeof w.lastActiveBlock === 'number' && w.lastActiveBlock > maxWalletLastActive) {
      maxWalletLastActive = w.lastActiveBlock;
    }
    if (typeof w.firstSeenBlock === 'number' && w.firstSeenBlock < minWalletFirstSeen) {
      minWalletFirstSeen = w.firstSeenBlock;
    }
    if (w.isMiner === true) minerCount += 1;
    walletAddresses.add(w.address);
  }
}

console.log(`[wallets] count: ${fmt(walletCount)}`);
console.log(`[wallets] miners: ${fmt(minerCount)} of ${fmt(walletCount)}`);
console.log(`[wallets] firstSeen range: [${fmt(minWalletFirstSeen)}, ${fmt(maxWalletLastActive)}]`);
if (walletBadJson) fail(`wallets: ${walletBadJson} bad-JSON lines`);
if (walletMissingFields) fail(`wallets: ${walletMissingFields} records missing required fields`);
if (walletBadMiner) fail(`wallets: ${walletBadMiner} records with non-boolean isMiner`);
if (walletInvariantViolations) fail(`wallets: ${walletInvariantViolations} records with firstSeen > lastActive`);
if (maxWalletLastActive > tipBlock) fail(`wallets: max lastActiveBlock=${maxWalletLastActive} > meta.tipBlock=${tipBlock}`);

// ── 3. bonds.jsonl ──────────────────────────────────────────────────
console.log('\n[bonds]   streaming ...');
let bondCount = 0;
let bondBadJson = 0;
let bondMissingFields = 0;
let bondUnknownFromAddr = 0;
let bondUnknownToAddr = 0;
let maxBondFormation = -1;
let bondsSampled = 0;

{
  const rl = await streamLines(BONDS_PATH);
  for await (const line of rl) {
    if (!line) continue;
    bondCount += 1;
    let b;
    try { b = JSON.parse(line); }
    catch { bondBadJson += 1; continue; }
    for (const f of REQUIRED_BOND_FIELDS) {
      if (!(f in b)) { bondMissingFields += 1; break; }
    }
    if (typeof b.formationBlock === 'number' && b.formationBlock > maxBondFormation) {
      maxBondFormation = b.formationBlock;
    }
    // Cross-check: from/to wallets must exist. Skip-sample if requested
    // for speed on huge bonds files.
    const sampleThis = SAMPLE_BONDS === 0 || bondsSampled < SAMPLE_BONDS;
    if (sampleThis) {
      if (!walletAddresses.has(b.fromAddress)) bondUnknownFromAddr += 1;
      if (!walletAddresses.has(b.toAddress)) bondUnknownToAddr += 1;
      bondsSampled += 1;
    }
  }
}

console.log(`[bonds]   count: ${fmt(bondCount)}`);
console.log(`[bonds]   max formationBlock: ${fmt(maxBondFormation)}`);
console.log(`[bonds]   cross-checked against wallet set: ${fmt(bondsSampled)} of ${fmt(bondCount)}`);
if (bondBadJson) fail(`bonds: ${bondBadJson} bad-JSON lines`);
if (bondMissingFields) fail(`bonds: ${bondMissingFields} records missing required fields`);
if (bondUnknownFromAddr) fail(`bonds: ${bondUnknownFromAddr} reference unknown fromAddress`);
if (bondUnknownToAddr) fail(`bonds: ${bondUnknownToAddr} reference unknown toAddress`);
if (maxBondFormation > tipBlock) fail(`bonds: max formationBlock=${maxBondFormation} > meta.tipBlock=${tipBlock}`);

// ── 4. timestamps ───────────────────────────────────────────────────
console.log('\n[ts]      reading ...');
let timestamps;
try {
  timestamps = JSON.parse(fs.readFileSync(TIMESTAMPS_PATH, 'utf8'));
} catch (err) {
  fail(`timestamps: parse error: ${err.message}`);
  timestamps = {};
}
const tsKeys = Object.keys(timestamps);
console.log(`[ts]      count: ${fmt(tsKeys.length)}`);

// Coverage check 0..tipBlock — find the largest contiguous prefix with
// timestamps and report any gaps.
let firstGap = -1;
const sample = [];
for (let h = 0; h <= tipBlock; h += 1) {
  if (!(String(h) in timestamps)) {
    if (firstGap < 0) firstGap = h;
    if (sample.length < 10) sample.push(h);
  }
}
if (firstGap >= 0) {
  fail(`timestamps: first gap at block ${firstGap}; sample missing blocks: ${sample.join(', ')}…`);
} else {
  console.log(`[ts]      coverage 0..${fmt(tipBlock)} — complete, no gaps`);
}

// ── 5. summary ──────────────────────────────────────────────────────
console.log('\n═══ Result ═══');
if (failures.length === 0) {
  console.log('PASS — substrate is internally consistent and covers 0..tipBlock with no gaps.');
  process.exit(0);
} else {
  console.log(`FAIL — ${failures.length} issue(s):`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
