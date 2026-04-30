#!/usr/bin/env node
// chain-tools/ingest/walk_chain.mjs
//
// Walks the Bitcoin blockchain block by block via the public
// Mempool.space API and accumulates a substrate snapshot — wallets +
// bonds + per-block activity sidecars — that the brain-vault generator
// consumes to populate `vault/` with real data.
//
// Operator-side third-party calls only. The browser never touches
// mempool.space; the operator runs this once + pushes the resulting
// JSON / parquet to R2; browsers fetch from R2 only. Privacy posture
// intact (per `vault/CONCEPTS.md` + master plan).
//
// Resumable: state is persisted to `chain-tools/out/real-substrate.json`
// every CHECKPOINT_INTERVAL blocks. Re-running the script picks up
// from `tipBlock + 1`. Use `--from 0 --max 200` to walk a specific
// window; default is "extend by 200 blocks past the existing tip."
//
// API rate-limit: 250 ms between requests = ~4 req/sec. Conservative
// with mempool.space's free tier; bump to lower delay if running
// against a self-hosted Esplora.
//
// Usage:
//   node chain-tools/ingest/walk_chain.mjs                 # +200 blocks
//   node chain-tools/ingest/walk_chain.mjs --max 500       # +500 blocks
//   node chain-tools/ingest/walk_chain.mjs --from 0 --max 1000  # restart

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(REPO_ROOT, 'chain-tools', 'out');
const SUBSTRATE_PATH = path.join(OUT_DIR, 'real-substrate.json');
const ACTIVITY_DIR = path.join(REPO_ROOT, 'vault', 'activity');

// Mempool.space free-tier endpoints. No auth required.
const API_BASE = 'https://mempool.space/api';
const REQ_DELAY_MS = 250;

const CHECKPOINT_INTERVAL = 25;       // save every 25 blocks
const DEFAULT_MAX_PER_RUN = 200;      // bump per invocation; resumable

// ---------- arg parsing ------------------------------------------------------
const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  if (i >= 0 && i + 1 < args.length) return args[i + 1];
  return fallback;
}
const explicitFrom = arg('from', null);
const maxNew = parseInt(arg('max', String(DEFAULT_MAX_PER_RUN)), 10);

// ---------- substrate state --------------------------------------------------

function loadSubstrate() {
  if (!fs.existsSync(SUBSTRATE_PATH)) {
    return {
      schema: 'real-substrate/v1',
      tipBlock: -1,
      generatedAt: new Date().toISOString(),
      wallets: {},      // address → wallet record (object, not array, for fast merging)
      bonds: {},        // bondKey → bond record
      blockTimestamps: {},
    };
  }
  const raw = JSON.parse(fs.readFileSync(SUBSTRATE_PATH, 'utf8'));
  // Convert arrays to maps for fast merging during walk.
  const wallets = {};
  for (const w of raw.wallets) wallets[w.address] = w;
  const bonds = {};
  for (const b of raw.bonds) bonds[bondKey(b.fromAddress, b.toAddress)] = b;
  return {
    schema: raw.schema,
    tipBlock: raw.tipBlock,
    generatedAt: raw.generatedAt,
    wallets,
    bonds,
    blockTimestamps: raw.blockTimestamps || {},
  };
}

function saveSubstrate(state) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // Convert maps back to arrays for stable JSON shape.
  const out = {
    schema: 'real-substrate/v1',
    tipBlock: state.tipBlock,
    generatedAt: new Date().toISOString(),
    wallets: Object.values(state.wallets).sort(
      (a, b) => a.firstSeenBlock - b.firstSeenBlock || a.address.localeCompare(b.address),
    ),
    bonds: Object.values(state.bonds).sort(
      (a, b) => a.formationBlock - b.formationBlock,
    ),
    blockTimestamps: state.blockTimestamps,
  };
  fs.writeFileSync(SUBSTRATE_PATH, JSON.stringify(out, null, 2) + '\n');
}

function bondKey(fromAddr, toAddr) {
  return fromAddr < toAddr ? `${fromAddr}|${toAddr}` : `${toAddr}|${fromAddr}`;
}

// ---------- HTTP fetch with backoff ------------------------------------------

async function apiGet(endpoint) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`);
      if (res.status === 429) {
        const wait = 2_000 * attempt;
        console.warn(`[rate-limit] retrying in ${wait}ms (attempt ${attempt})`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} on ${endpoint}: ${await res.text()}`);
      }
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) return res.json();
      return res.text();
    } catch (err) {
      if (attempt === 5) throw err;
      const wait = 1_000 * attempt;
      console.warn(`[fetch error] ${err.message}; retrying in ${wait}ms`);
      await sleep(wait);
    }
  }
}

// ---------- block walking ----------------------------------------------------

async function blockHashAt(height) {
  return apiGet(`/block-height/${height}`);
}

async function blockHeader(hash) {
  return apiGet(`/block/${hash}`);
}

// Mempool.space returns transactions paged at 25 per request. For early
// blocks there's just the coinbase; for late blocks pagination matters.
// Each /api/block/<hash>/txs[/<startIndex>] returns up to 25 tx; iterate
// until we get fewer than 25 back.
async function blockTransactions(hash) {
  const txs = [];
  let startIndex = 0;
  while (true) {
    const page = await apiGet(`/block/${hash}/txs/${startIndex}`);
    if (!Array.isArray(page) || page.length === 0) break;
    txs.push(...page);
    if (page.length < 25) break;
    startIndex += 25;
    await sleep(REQ_DELAY_MS);
  }
  return txs;
}

// ---------- wallet + bond extraction -----------------------------------------

function classifyRole(wallet, isCoinbaseRecipient, blockHeight) {
  // v0 heuristic — refines once we have full chain context. For now:
  //   - genesis-block coinbase recipient → satoshi
  //   - any other coinbase recipient → miner
  //   - everyone else → significant (refined by tx count + balance later)
  if (isCoinbaseRecipient && blockHeight === 0) return 'satoshi';
  if (isCoinbaseRecipient || wallet.isMiner) return 'miner';
  return 'significant';
}

// Genesis-era outputs use P2PK (Pay-to-PubKey) — the script pushes a
// 65-byte uncompressed (or 33-byte compressed) pubkey + OP_CHECKSIG,
// with no canonical "address." Mempool.space therefore doesn't return
// `scriptpubkey_address` for these. We derive the equivalent P2PKH
// address (HASH160 of pubkey + version byte + base58check) so the
// brain vault can render Satoshi's genesis recipient as the famous
// `1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa`.

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(buffer) {
  let num = BigInt('0x' + Buffer.from(buffer).toString('hex'));
  let encoded = '';
  while (num > 0n) {
    encoded = BASE58_ALPHABET[Number(num % 58n)] + encoded;
    num = num / 58n;
  }
  for (const byte of buffer) {
    if (byte === 0x00) encoded = '1' + encoded;
    else break;
  }
  return encoded;
}

function hash160(buffer) {
  const sha256 = crypto.createHash('sha256').update(buffer).digest();
  return crypto.createHash('ripemd160').update(sha256).digest();
}

function p2pkhFromHash160(hash160Buffer) {
  const versioned = Buffer.concat([Buffer.from([0x00]), hash160Buffer]);
  const c1 = crypto.createHash('sha256').update(versioned).digest();
  const c2 = crypto.createHash('sha256').update(c1).digest();
  const checksum = c2.subarray(0, 4);
  return base58Encode(Buffer.concat([versioned, checksum]));
}

function p2pkAddressFromScript(scriptHex) {
  // P2PK layout: <pushbyte> <pubkey-hex> ac
  // 0x41 push = 65-byte uncompressed pubkey
  // 0x21 push = 33-byte compressed pubkey
  if (!scriptHex || !scriptHex.endsWith('ac')) return null;
  const pushByte = parseInt(scriptHex.slice(0, 2), 16);
  if (pushByte !== 0x41 && pushByte !== 0x21) return null;
  const pubkeyLen = pushByte;
  const expectedLen = 2 + pubkeyLen * 2 + 2;
  if (scriptHex.length !== expectedLen) return null;
  const pubkeyHex = scriptHex.slice(2, 2 + pubkeyLen * 2);
  const pubkeyBuf = Buffer.from(pubkeyHex, 'hex');
  return p2pkhFromHash160(hash160(pubkeyBuf));
}

function addressFromOutput(vout) {
  if (vout.scriptpubkey_address) return vout.scriptpubkey_address;
  if (vout.scriptpubkey_type === 'p2pk') {
    return p2pkAddressFromScript(vout.scriptpubkey);
  }
  // p2ms (multisig with no canonical address), op_return, etc. — skip.
  return null;
}

function extractAddresses(tx) {
  const outputs = [];
  for (const vout of tx.vout || []) {
    const addr = addressFromOutput(vout);
    if (addr) outputs.push({ address: addr, sats: vout.value });
  }
  const inputs = [];
  for (const vin of tx.vin || []) {
    if (vin.prevout) {
      const addr = addressFromOutput(vin.prevout);
      if (addr) inputs.push({ address: addr, sats: vin.prevout.value });
    }
  }
  const isCoinbase = (tx.vin || []).some((v) => v.is_coinbase);
  return { outputs, inputs, isCoinbase };
}

function ensureWallet(state, address, blockHeight, blockTime, isMiner) {
  let w = state.wallets[address];
  if (!w) {
    w = {
      address,
      role: 'significant', // refined below
      firstSeenBlock: blockHeight,
      firstSeenTime: blockTime,
      lastActiveBlock: blockHeight,
      lastActiveTime: blockTime,
      totalReceivedSats: '0',
      txCount: 0,
      isMiner: false,
    };
    state.wallets[address] = w;
  }
  if (blockHeight < w.firstSeenBlock) {
    w.firstSeenBlock = blockHeight;
    w.firstSeenTime = blockTime;
  }
  if (blockHeight > w.lastActiveBlock) {
    w.lastActiveBlock = blockHeight;
    w.lastActiveTime = blockTime;
  }
  if (isMiner) w.isMiner = true;
  return w;
}

function ensureBond(state, fromAddr, toAddr, sats, formationBlock) {
  const key = bondKey(fromAddr, toAddr);
  let b = state.bonds[key];
  if (!b) {
    b = {
      fromAddress: fromAddr,
      toAddress: toAddr,
      sats: '0',
      formationBlock,
    };
    state.bonds[key] = b;
  }
  // Aggregate sats (BigInt math on stringified bigints).
  const newSats = BigInt(b.sats) + BigInt(sats);
  b.sats = newSats.toString();
  if (formationBlock < b.formationBlock) b.formationBlock = formationBlock;
  return b;
}

function processBlock(state, blockHeight, header, txs) {
  const blockTime = header.timestamp; // Unix seconds
  state.blockTimestamps[blockHeight] = new Date(blockTime * 1000).toISOString();

  const events = [];
  const seenWalletsThisBlock = new Set();
  const seenBondsThisBlock = new Set();

  for (const tx of txs) {
    const { outputs, inputs, isCoinbase } = extractAddresses(tx);

    // Outputs: every output address is "received sats" → may be a
    // wallet-spawn event if first time seen.
    for (const out of outputs) {
      const wasNew = !state.wallets[out.address];
      const w = ensureWallet(state, out.address, blockHeight, blockTime, isCoinbase);
      if (wasNew) {
        events.push({
          kind: 'wallet-spawn',
          address: out.address,
          firstSeenAsCoinbase: isCoinbase,
        });
        seenWalletsThisBlock.add(out.address);
      }
      // Aggregate received sats
      const newTotal = BigInt(w.totalReceivedSats) + BigInt(out.sats);
      w.totalReceivedSats = newTotal.toString();
      w.txCount += 1;
      w.lastActiveBlock = blockHeight;
      w.lastActiveTime = blockTime;
    }

    // Inputs: spenders. Bond formation happens between (input address,
    // output address) pairs. For coinbase tx, no inputs (skip bonds).
    if (!isCoinbase) {
      for (const inp of inputs) {
        ensureWallet(state, inp.address, blockHeight, blockTime, false);
        for (const out of outputs) {
          if (inp.address === out.address) continue;
          const k = bondKey(inp.address, out.address);
          const wasNew = !state.bonds[k];
          ensureBond(state, inp.address, out.address, out.sats, blockHeight);
          if (wasNew) {
            events.push({
              kind: 'bond-form',
              fromAddress: inp.address,
              toAddress: out.address,
              sats: String(out.sats),
            });
            seenBondsThisBlock.add(k);
          }
        }
      }
    }
  }

  // Halving event tag
  if (blockHeight > 0 && blockHeight % 210_000 === 0) {
    events.push({ kind: 'halving', epoch: Math.floor(blockHeight / 210_000) });
  }

  // Refine roles after this block — coinbase recipients become miners
  // (or satoshi for block 0). Significant wallets keep "significant"
  // until later thresholds are applied.
  for (const w of Object.values(state.wallets)) {
    if (w.firstSeenBlock === 0 && w.isMiner) w.role = 'satoshi';
    else if (w.isMiner) w.role = 'miner';
  }

  return events;
}

function writeActivitySidecar(blockHeight, header, events) {
  if (events.length === 0) return; // skip empty sidecars
  fs.mkdirSync(ACTIVITY_DIR, { recursive: true });
  const filename = `block-${String(blockHeight).padStart(7, '0')}.json`;
  const epoch = Math.floor(blockHeight / 210_000);
  const subsidyBtc = 50 / Math.pow(2, epoch);
  const cumSupplyBtc = (() => {
    let s = 0;
    for (let e = 0; e < epoch; e++) s += 210_000 * (50 / Math.pow(2, e));
    s += (blockHeight - epoch * 210_000 + 1) * subsidyBtc;
    return s;
  })();
  const sidecar = {
    block: blockHeight,
    blockHash: header.id,
    blockTime: new Date(header.timestamp * 1000).toISOString(),
    epoch,
    subsidyBtc,
    cumulativeSupplyBtc: cumSupplyBtc,
    txCount: header.tx_count,
    events,
  };
  fs.writeFileSync(
    path.join(ACTIVITY_DIR, filename),
    JSON.stringify(sidecar, null, 2) + '\n',
  );
}

// ---------- main loop --------------------------------------------------------

async function main() {
  const state = loadSubstrate();
  const startBlock =
    explicitFrom !== null ? parseInt(explicitFrom, 10) : state.tipBlock + 1;
  const endBlock = startBlock + maxNew - 1;

  console.log(`Walking blocks ${startBlock} → ${endBlock} (substrate currently at tip ${state.tipBlock})`);
  console.log(`Pre-walk: ${Object.keys(state.wallets).length} wallets, ${Object.keys(state.bonds).length} bonds`);

  let blocksWalked = 0;
  for (let h = startBlock; h <= endBlock; h++) {
    try {
      const hash = await blockHashAt(h);
      await sleep(REQ_DELAY_MS);
      const header = await blockHeader(hash);
      await sleep(REQ_DELAY_MS);
      const txs = await blockTransactions(hash);

      const events = processBlock(state, h, header, txs);
      writeActivitySidecar(h, header, events);

      state.tipBlock = h;
      blocksWalked += 1;

      if (events.length > 0) {
        console.log(`  block ${h.toString().padStart(7)} — ${events.length} events, ${txs.length} txs`);
      }

      if (blocksWalked % CHECKPOINT_INTERVAL === 0) {
        saveSubstrate(state);
        console.log(`  [checkpoint] saved substrate at tip ${h}`);
      }
    } catch (err) {
      console.error(`  block ${h} ERROR: ${err.message}`);
      // Save state before exiting so we can resume
      saveSubstrate(state);
      throw err;
    }
  }

  saveSubstrate(state);
  console.log(`\nDone. tipBlock=${state.tipBlock}, ${Object.keys(state.wallets).length} wallets, ${Object.keys(state.bonds).length} bonds.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
