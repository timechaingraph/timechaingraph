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
import * as readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { epochAt, subsidyBtcAt, cumulativeSupplyBtcAt, isHalvingBlock } from '../lib/chain.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(REPO_ROOT, 'chain-tools', 'out');
// Substrate v2: split across four files because the v1 single-JSON dump
// exceeded V8's ~512MB string limit at ~130k blocks. Wallets and bonds
// are now newline-delimited JSON (streamed line-by-line on read/write);
// meta and blockTimestamps stay as small JSON objects.
const META_PATH = path.join(OUT_DIR, 'real-substrate-meta.json');
const WALLETS_PATH = path.join(OUT_DIR, 'real-substrate-wallets.jsonl');
const BONDS_PATH = path.join(OUT_DIR, 'real-substrate-bonds.jsonl');
const TIMESTAMPS_PATH = path.join(OUT_DIR, 'real-substrate-timestamps.json');
const ACTIVITY_DIR = path.join(REPO_ROOT, 'vault', 'activity');
const BLOCKS_OUT_DIR = path.join(REPO_ROOT, 'public', 'blocks');
const SHARD_SIZE = 1000;

// Local bitcoind JSON-RPC — cookie auth, no rate limit (fast local reads).
// Source of truth is the operator's own fully-synced node; nothing leaves the
// box. Override host/cookie via env for a different datadir.
const envInt = (name, fallback) => {
  const v = parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};
const RPC_URL = process.env.BITCOIND_RPC_URL || 'http://127.0.0.1:8332/';
const COOKIE_PATH =
  process.env.BITCOIND_COOKIE || '/Volumes/Timechaingraph/bitcoin/data/.cookie';
// Optional per-block cooldown (ms); 0 by default. Raise to ease SSD/thermal load.
const BLOCK_DELAY_MS = envInt('WALKER_BLOCK_DELAY_MS', 0);

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

async function loadSubstrate() {
  if (!fs.existsSync(META_PATH)) {
    return {
      schema: 'real-substrate/v2',
      tipBlock: -1,
      generatedAt: new Date().toISOString(),
      wallets: {},
      bonds: {},
      blockTimestamps: {},
    };
  }
  const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
  const blockTimestamps = fs.existsSync(TIMESTAMPS_PATH)
    ? JSON.parse(fs.readFileSync(TIMESTAMPS_PATH, 'utf8'))
    : {};

  const wallets = {};
  if (fs.existsSync(WALLETS_PATH)) {
    const rl = readline.createInterface({
      input: fs.createReadStream(WALLETS_PATH, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      if (!line) continue;
      const w = JSON.parse(line);
      wallets[w.address] = w;
    }
  }

  const bonds = {};
  if (fs.existsSync(BONDS_PATH)) {
    const rl = readline.createInterface({
      input: fs.createReadStream(BONDS_PATH, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      if (!line) continue;
      const b = JSON.parse(line);
      bonds[bondKey(b.fromAddress, b.toAddress)] = b;
    }
  }

  return {
    schema: meta.schema || 'real-substrate/v2',
    tipBlock: meta.tipBlock,
    generatedAt: meta.generatedAt,
    wallets,
    bonds,
    blockTimestamps,
  };
}

async function streamWriteSorted(filePath, items, compareFn) {
  // Write items NDJSON-style to a tmp file then atomic-rename, so a
  // crash mid-write never leaves a half-written substrate behind.
  const tmpPath = `${filePath}.tmp`;
  const sorted = items.slice().sort(compareFn);
  const stream = fs.createWriteStream(tmpPath, { encoding: 'utf8' });
  for (const item of sorted) {
    if (!stream.write(JSON.stringify(item) + '\n')) {
      await new Promise((res) => stream.once('drain', res));
    }
  }
  await new Promise((res, rej) => stream.end((err) => (err ? rej(err) : res())));
  fs.renameSync(tmpPath, filePath);
}

async function saveSubstrate(state) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const meta = {
    schema: 'real-substrate/v2',
    tipBlock: state.tipBlock,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(META_PATH + '.tmp', JSON.stringify(meta, null, 2) + '\n');
  fs.renameSync(META_PATH + '.tmp', META_PATH);

  fs.writeFileSync(TIMESTAMPS_PATH + '.tmp', JSON.stringify(state.blockTimestamps) + '\n');
  fs.renameSync(TIMESTAMPS_PATH + '.tmp', TIMESTAMPS_PATH);

  await streamWriteSorted(
    WALLETS_PATH,
    Object.values(state.wallets),
    (a, b) => a.firstSeenBlock - b.firstSeenBlock || a.address.localeCompare(b.address),
  );
  await streamWriteSorted(
    BONDS_PATH,
    Object.values(state.bonds),
    (a, b) => a.formationBlock - b.formationBlock,
  );
}

function bondKey(fromAddr, toAddr) {
  return fromAddr < toAddr ? `${fromAddr}|${toAddr}` : `${toAddr}|${fromAddr}`;
}

// ---------- bitcoind JSON-RPC ------------------------------------------------

function readCookieAuth() {
  // .cookie is "__cookie__:<password>" — HTTP Basic auth for RPC.
  const raw = fs.readFileSync(COOKIE_PATH, 'utf8').trim();
  return 'Basic ' + Buffer.from(raw).toString('base64');
}
const AUTH_HEADER = readCookieAuth();

async function rpcCall(method, params = []) {
  let attempt = 1;
  while (true) {
    try {
      const res = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'content-type': 'text/plain', authorization: AUTH_HEADER },
        body: JSON.stringify({ jsonrpc: '1.0', id: 'walk', method, params }),
      });
      if (!res.ok) throw new Error(`RPC HTTP ${res.status} on ${method}: ${await res.text()}`);
      const json = await res.json();
      if (json.error) throw new Error(`RPC error on ${method}: ${JSON.stringify(json.error)}`);
      return json.result;
    } catch (err) {
      if (attempt >= 5) {
        console.warn(`[rpc error] ${err.message}; sleeping 30s before resume`);
        await sleep(30_000);
        attempt = 1;
        continue;
      }
      const wait = 1_000 * attempt;
      console.warn(`[rpc error] ${err.message}; retrying in ${wait}ms (attempt ${attempt})`);
      await sleep(wait);
      attempt += 1;
    }
  }
}

// --- bitcoind getblock(verbosity 3) → mempool.space-shaped {header, txs} -----
// v3 decodes every tx and resolves vin.prevout (spent address + value) from
// undo data, so the extraction logic below is unchanged. bitcoind reports
// values as BTC floats; convert to integer sats (round kills float drift).
function btcToSats(btc) {
  return Math.round((btc || 0) * 1e8);
}
function adaptVout(v) {
  const spk = v.scriptPubKey || {};
  return {
    value: btcToSats(v.value),
    scriptpubkey_address: spk.address,
    scriptpubkey_type: spk.type === 'pubkey' ? 'p2pk' : spk.type, // only p2pk is special-cased downstream
    scriptpubkey: spk.hex,
  };
}
function adaptBlock(blk) {
  const header = { id: blk.hash, timestamp: blk.time, tx_count: blk.nTx };
  const txs = (blk.tx || []).map((tx) => ({
    vin: (tx.vin || []).map((vin) =>
      vin.coinbase !== undefined
        ? { is_coinbase: true }
        : { prevout: vin.prevout ? adaptVout(vin.prevout) : null },
    ),
    vout: (tx.vout || []).map(adaptVout),
  }));
  return { header, txs };
}

// ---------- block walking (bitcoind RPC) ------------------------------------

async function blockHashAt(height) {
  return rpcCall('getblockhash', [height]);
}

// One RPC call per block: getblock verbosity 3 returns header fields + every
// tx fully decoded WITH vin.prevout — everything extraction needs, adapted to
// the mempool.space shape so the wallet/bond logic below is unchanged.
async function fetchBlock(hash) {
  const blk = await rpcCall('getblock', [hash, 3]);
  return adaptBlock(blk);
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

// Per-block snapshot in the Grid-side `block-state/v1` shape, extended with
// real-data fields. Overwrites the synthetic placeholder produced by chain.mjs;
// blocks the walker hasn't reached yet keep their synthetic baseline. The
// existing schema name is preserved for forward-compat with v1 consumers.
function shardPathFor(blockHeight) {
  const shardId = Math.floor(blockHeight / SHARD_SIZE);
  const shardName = `shard-${String(shardId).padStart(3, '0')}`;
  const blockName = `${String(blockHeight).padStart(7, '0')}.json`;
  return path.join(BLOCKS_OUT_DIR, shardName, blockName);
}

function writeBlockSnapshot(blockHeight, header, txs, events) {
  const epoch = epochAt(blockHeight);
  const subsidy = subsidyBtcAt(blockHeight);
  const cumSupply = cumulativeSupplyBtcAt(blockHeight);

  // Real minter: first vout address of the coinbase tx.
  const coinbase = txs.find((tx) => (tx.vin || []).some((v) => v.is_coinbase));
  const coinbaseVout = coinbase?.vout?.[0];
  const minter =
    coinbaseVout?.scriptpubkey_address ||
    (coinbaseVout?.scriptpubkey_type === 'p2pk'
      ? p2pkAddressFromScript(coinbaseVout.scriptpubkey)
      : null);

  const walletSpawns = events.filter((e) => e.kind === 'wallet-spawn').length;
  const bondFormations = events.filter((e) => e.kind === 'bond-form').length;

  const snapshot = {
    schema: 'block-state/v1',
    block: blockHeight,
    blockHash: header.id,
    blockTime: new Date(header.timestamp * 1000).toISOString(),
    minter,
    subsidy,
    halving: isHalvingBlock(blockHeight),
    epoch,
    newCoinFromIndex: cumSupply - subsidy,
    newCoinCount: subsidy,
    cumulativeCoinCount: cumSupply,
    cumulativeSupplyBtc: cumSupply,
    txCount: header.tx_count,
    walletSpawns,
    bondFormations,
    realData: true,
  };

  const filePath = shardPathFor(blockHeight);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(snapshot) + '\n');
  return snapshot;
}

// Per-block control checkpoint. Reads the artifacts back from disk and confirms
// the data we just wrote is what we expect. Returns a list of issues; an empty
// list means the block is fully captured for both Graph and Grid consumption.
function validateBlock(blockHeight, header, events, state) {
  const issues = [];

  // (1) Per-shard snapshot file is present, parseable, and self-consistent.
  const filePath = shardPathFor(blockHeight);
  try {
    const written = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (written.block !== blockHeight) {
      issues.push(`snapshot block mismatch (expected ${blockHeight}, got ${written.block})`);
    }
    if (!written.blockHash) issues.push('snapshot missing blockHash');
    if (!written.realData) issues.push('snapshot missing realData flag');
    if (typeof written.cumulativeSupplyBtc !== 'number') {
      issues.push('snapshot missing cumulativeSupplyBtc');
    }
  } catch (e) {
    issues.push(`snapshot unreadable: ${e.message}`);
  }

  // (2) Substrate aggregation reflects this block.
  if (state.tipBlock !== blockHeight) {
    issues.push(`substrate tipBlock mismatch (expected ${blockHeight}, got ${state.tipBlock})`);
  }
  if (!state.blockTimestamps[blockHeight]) {
    issues.push('substrate missing blockTimestamp');
  }

  // (3) Activity sidecar present iff events exist.
  const sidecarPath = path.join(
    ACTIVITY_DIR,
    `block-${String(blockHeight).padStart(7, '0')}.json`,
  );
  if (events.length > 0 && !fs.existsSync(sidecarPath)) {
    issues.push(`activity sidecar missing despite ${events.length} events`);
  }

  return issues;
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
  const state = await loadSubstrate();
  const startBlock =
    explicitFrom !== null ? parseInt(explicitFrom, 10) : state.tipBlock + 1;
  const endBlock = startBlock + maxNew - 1;

  console.log(`Walking blocks ${startBlock} → ${endBlock} (substrate currently at tip ${state.tipBlock})`);
  console.log(`Pre-walk: ${Object.keys(state.wallets).length} wallets, ${Object.keys(state.bonds).length} bonds`);

  let blocksWalked = 0;
  for (let h = startBlock; h <= endBlock; h++) {
    try {
      const hash = await blockHashAt(h);
      const { header, txs } = await fetchBlock(hash);
      if (BLOCK_DELAY_MS) await sleep(BLOCK_DELAY_MS);

      const events = processBlock(state, h, header, txs);
      writeActivitySidecar(h, header, events);

      state.tipBlock = h;
      blocksWalked += 1;

      // Per-block control checkpoint: write extended snapshot, validate the
      // artifacts on disk, surface any issues immediately so a re-walk can
      // fix them rather than discovering corruption days later.
      writeBlockSnapshot(h, header, txs, events);
      const issues = validateBlock(h, header, events, state);
      if (issues.length > 0) {
        console.warn(`  [validation] block ${h}: ${issues.length} issue(s): ${issues.join('; ')}`);
      }

      if (events.length > 0) {
        const tag = issues.length > 0 ? ' [INVALID]' : '';
        console.log(`  block ${h.toString().padStart(7)} — ${events.length} events, ${txs.length} txs${tag}`);
      }

      if (blocksWalked % CHECKPOINT_INTERVAL === 0) {
        await saveSubstrate(state);
        console.log(`  [checkpoint] saved substrate at tip ${h} (${Object.keys(state.wallets).length} wallets, ${Object.keys(state.bonds).length} bonds)`);
      }
    } catch (err) {
      console.error(`  block ${h} ERROR: ${err.message}`);
      // Save state before exiting so we can resume
      await saveSubstrate(state);
      throw err;
    }
  }

  await saveSubstrate(state);
  console.log(`\nDone. tipBlock=${state.tipBlock}, ${Object.keys(state.wallets).length} wallets, ${Object.keys(state.bonds).length} bonds.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
