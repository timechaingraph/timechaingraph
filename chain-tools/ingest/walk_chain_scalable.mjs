#!/usr/bin/env node
// chain-tools/ingest/walk_chain_scalable.mjs
//
// SCALABLE full-chain walker (supersedes walk_chain.mjs, which holds the
// whole substrate in V8 heap and OOMs mid-chain). Same extraction logic
// (shared via ../lib/extract.mjs + ../lib/rpc.mjs — proven on the cutover)
// but a *combiner* aggregation:
//
//   - Aggregate a bounded block-WINDOW in memory (Maps of wallet/bond
//     partials), then FLUSH the pre-aggregated partial to disk and clear.
//   - Memory is bounded by distinct keys *per window*, never per chain.
//   - A separate reducer (reduce_substrate.py, DuckDB) merges the partials
//     out-of-core into the final real-substrate-{wallets,bonds}.jsonl that
//     build_bundle.py already consumes — pipeline downstream is unchanged.
//
// Crash-safe / resumable WITHOUT transactions: part files are named by
// their block range (part-<start>-<end>.jsonl). A re-walked window is
// deterministic (identical inserts → identical flush points → identical
// filename), so resume OVERWRITES rather than duplicating. meta.json
// records lastFlushedBlock; we resume at lastFlushedBlock+1.
//
// No per-block snapshot/sidecar files (the old walker wrote ~1M tiny
// JSONs + read each back — millions of fs ops). Per-block stats can be
// re-derived into one parquet later if the scrubber needs them.
//
// Usage:
//   node chain-tools/ingest/walk_chain_scalable.mjs              # resume → chain tip
//   node chain-tools/ingest/walk_chain_scalable.mjs --max 2000   # +2000 blocks this run
//   node chain-tools/ingest/walk_chain_scalable.mjs --from 0 --to 1999   # explicit window
//   FLUSH_INTERVAL=1000 MAX_AGG_ENTRIES=4000000 node …          # tune memory/IO
//
// Recommended for the full walk (raise V8 heap; the box is a workstation):
//   node --max-old-space-size=12288 chain-tools/ingest/walk_chain_scalable.mjs

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { createRpcClient } from '../lib/rpc.mjs';
import { createCombiner } from '../lib/combiner.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
// CHAIN_OUT_DIR override lets a stress/validation run write to a scratch dir
// without disturbing the real out/agg resume state.
const OUT_DIR = process.env.CHAIN_OUT_DIR
  ? path.resolve(process.env.CHAIN_OUT_DIR)
  : path.join(REPO_ROOT, 'chain-tools', 'out');
const AGG_DIR = path.join(OUT_DIR, 'agg');
const WALLETS_DIR = path.join(AGG_DIR, 'wallets');
const BONDS_DIR = path.join(AGG_DIR, 'bonds');
const TS_DIR = path.join(AGG_DIR, 'timestamps');
const META_PATH = path.join(AGG_DIR, 'meta.json');
const SCHEMA = 'real-substrate-agg/v5';

// ---------- tunables (env-overridable) --------------------------------------
const envInt = (name, fallback) => {
  const v = parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};
// Window size: blocks aggregated in memory before a boundary flush. Smaller =
// less peak memory, more (smaller) part files. 1000 is comfortable for the
// busy modern era under a 12 GB heap.
const FLUSH_INTERVAL = envInt('FLUSH_INTERVAL', 1000);
// Hard cap on combined Map entries before an emergency (mid-window) flush —
// the real memory guardrail, independent of how busy a window is.
const MAX_AGG_ENTRIES = envInt('MAX_AGG_ENTRIES', 4_000_000);
// Max input×output pairs before a tx is treated as a consolidation/mixer and
// gets the star fallback (inputs → single largest output) instead of full
// bipartite. Normal txs are far below this; preserves the validated look.
const BOND_PAIR_CAP = envInt('WALKER_BOND_PAIR_CAP', 10_000);
// Optional per-block cooldown (ms) to ease SSD/thermal load. 0 by default.
const BLOCK_DELAY_MS = envInt('WALKER_BLOCK_DELAY_MS', 0);

// ---------- arg parsing ------------------------------------------------------
const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  if (i >= 0 && i + 1 < args.length) return args[i + 1];
  return fallback;
}
const explicitFrom = arg('from', null);
const explicitTo = arg('to', null);
const maxNew = arg('max', null);

const rpc = createRpcClient();

// ---------- meta (resume state) ---------------------------------------------
function loadMeta() {
  if (!fs.existsSync(META_PATH)) {
    return { schema: SCHEMA, tipBlock: -1, lastFlushedBlock: -1, parts: 0 };
  }
  return JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
}
function saveMeta(meta) {
  fs.mkdirSync(AGG_DIR, { recursive: true });
  fs.writeFileSync(META_PATH + '.tmp', JSON.stringify(meta, null, 2) + '\n');
  fs.renameSync(META_PATH + '.tmp', META_PATH);
}

// ---------- combiner state ---------------------------------------------------
// Wallet + bond window aggregation lives in the combiner (../lib/combiner.mjs,
// unit-tested); timestamps stay here (trivial). The walker is the I/O + RPC + flush
// shell around the pure aggregation.
const combiner = createCombiner({ bondPairCap: BOND_PAIR_CAP });
let tsBuf = []; // { b:height, t:isoString }

// ---------- flush ------------------------------------------------------------
function pad7(n) {
  return String(n).padStart(7, '0');
}

// Gzip the partials: they're transient but large; JSONL compresses ~6× and
// DuckDB reads *.jsonl.gz transparently. Frees critical SSD headroom.
async function writeJsonl(filePath, iterable, toObj) {
  const tmp = filePath + '.tmp';
  const gz = zlib.createGzip();
  const out = fs.createWriteStream(tmp);
  gz.pipe(out);
  for (const item of iterable) {
    if (!gz.write(JSON.stringify(toObj(item)) + '\n')) await once(gz, 'drain');
  }
  gz.end();
  await new Promise((res, rej) => {
    out.on('finish', res);
    out.on('error', rej);
    gz.on('error', rej);
  });
  fs.renameSync(tmp, filePath);
}

async function flush(windowStart, lastBlock, meta) {
  if (combiner.size === 0 && tsBuf.length === 0) return;
  fs.mkdirSync(WALLETS_DIR, { recursive: true });
  fs.mkdirSync(BONDS_DIR, { recursive: true });
  fs.mkdirSync(TS_DIR, { recursive: true });
  const suffix = `part-${pad7(windowStart)}-${pad7(lastBlock)}.jsonl.gz`;

  await writeJsonl(path.join(WALLETS_DIR, suffix), combiner.wallets, ([address, w]) => ({
    address,
    firstSeenBlock: w.f,
    lastActiveBlock: w.l,
    totalReceivedSats: w.r.toString(),
    txCount: w.c,
    isMiner: w.m,
  }));
  await writeJsonl(path.join(BONDS_DIR, suffix), combiner.bonds.values(), (b) => ({
    fromAddress: b.x,
    toAddress: b.y,
    sats: b.s.toString(),
    formationBlock: b.f,
  }));
  await writeJsonl(path.join(TS_DIR, suffix), tsBuf, (e) => e);

  const wn = combiner.walletCount;
  const bn = combiner.bondCount;
  combiner.reset();
  tsBuf = [];

  meta.tipBlock = lastBlock;
  meta.lastFlushedBlock = lastBlock;
  meta.parts = (meta.parts || 0) + 1;
  meta.generatedAt = new Date().toISOString();
  saveMeta(meta);
  return { wn, bn, suffix };
}

// ---------- main loop --------------------------------------------------------
async function main() {
  const meta = loadMeta();
  const chainTip = await rpc.getBlockCount();

  const startBlock =
    explicitFrom !== null ? parseInt(explicitFrom, 10) : meta.lastFlushedBlock + 1;
  let endBlock;
  if (explicitTo !== null) endBlock = parseInt(explicitTo, 10);
  else if (maxNew !== null) endBlock = startBlock + parseInt(maxNew, 10) - 1;
  else endBlock = chainTip;
  if (endBlock > chainTip) endBlock = chainTip;

  if (startBlock > endBlock) {
    console.log(`Nothing to do: start ${startBlock} > end ${endBlock} (chain tip ${chainTip}).`);
    return;
  }

  console.log(`Scalable walk: blocks ${startBlock} → ${endBlock} (chain tip ${chainTip}, resuming from flushed ${meta.lastFlushedBlock}).`);
  console.log(`Tunables: FLUSH_INTERVAL=${FLUSH_INTERVAL}, MAX_AGG_ENTRIES=${MAX_AGG_ENTRIES.toLocaleString()}, BOND_PAIR_CAP=${BOND_PAIR_CAP.toLocaleString()}.`);

  let windowStart = startBlock;
  let walked = 0;
  let runStart = Date.now();
  let lastLogBlock = startBlock;
  let lastLogTime = runStart;

  for (let h = startBlock; h <= endBlock; h++) {
    try {
      const hash = await rpc.blockHashAt(h);
      const { header, txs } = await rpc.fetchBlock(hash);
      if (BLOCK_DELAY_MS) await sleep(BLOCK_DELAY_MS);

      tsBuf.push({ b: h, t: new Date(header.timestamp * 1000).toISOString() });
      combiner.processBlock(h, txs);
      walked += 1;

      const boundary = (h + 1) % FLUSH_INTERVAL === 0;
      const pressure = combiner.size >= MAX_AGG_ENTRIES;
      if (boundary || pressure) {
        const info = await flush(windowStart, h, meta);
        windowStart = h + 1;
        const now = Date.now();
        const bps = (h - lastLogBlock) / Math.max(1, (now - lastLogTime) / 1000);
        const etaSec = bps > 0 ? (endBlock - h) / bps : 0;
        const etaH = (etaSec / 3600).toFixed(1);
        const reason = pressure ? 'PRESSURE' : 'boundary';
        console.log(
          `  [flush ${reason}] ${info?.suffix ?? ''} — ${info?.wn?.toLocaleString() ?? 0} wallets, ${info?.bn?.toLocaleString() ?? 0} bonds | tip ${h.toLocaleString()}/${endBlock.toLocaleString()} | ${bps.toFixed(1)} blk/s | ETA ${etaH}h`,
        );
        lastLogBlock = h;
        lastLogTime = now;
      }
    } catch (err) {
      console.error(`  block ${h} ERROR: ${err.message}`);
      // Flush whole completed window? No — partial window is non-deterministic
      // to resume. Just record progress up to lastFlushedBlock and rethrow;
      // resume re-walks from there (idempotent overwrite).
      throw err;
    }
  }

  // Final flush for the trailing (sub-FLUSH_INTERVAL) window.
  const info = await flush(windowStart, endBlock, meta);
  if (info) {
    console.log(`  [flush final] ${info.suffix} — ${info.wn.toLocaleString()} wallets, ${info.bn.toLocaleString()} bonds`);
  }

  const totalSec = (Date.now() - runStart) / 1000;
  console.log(`\nDone. Walked ${walked.toLocaleString()} blocks in ${(totalSec / 60).toFixed(1)} min (${(walked / Math.max(1, totalSec)).toFixed(1)} blk/s).`);
  console.log(`Flushed through block ${meta.lastFlushedBlock.toLocaleString()}. Parts: ${meta.parts}. Next: reduce_substrate.py → build_bundle.py.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
