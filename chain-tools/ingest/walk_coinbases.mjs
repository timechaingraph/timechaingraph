// chain-tools/ingest/walk_coinbases.mjs
//
// Per-block coinbase-recipient walker — emits the ONE chain fact the Grid's
// coin-ownership layer needs: who mined (and therefore first owns) each block's
// newly-issued coins. Everything else about a coin (its value via the subsidy
// schedule, its spiral coordinate) is protocol-deterministic and derived
// client-side, so we never store the ~19.5M coins — just ~952k (block, address)
// rows.
//
// One `getblock` verbosity-2 call per block; the block's miner is the
// highest-value addressed coinbase output (skips the segwit-commitment
// OP_RETURN). Concurrent (pool) + resumable at chunk granularity. Duplicate
// rows on crash-resume are harmless — the bundle build dedups by block.
//
// Output (on the external SSD via chain-tools/out symlink):
//   out/block-miners.jsonl        {block, address}\n  (block order within chunk)
//   out/block-miners.meta.json    { lastBlock, target }   resume cursor
//
// Run:  node chain-tools/ingest/walk_coinbases.mjs
//   tunables: COINBASE_TARGET (default 952351 — the bundle tip),
//             COINBASE_CHUNK (2000), COINBASE_CONCURRENCY (12),
//             CHAIN_OUT_DIR (default chain-tools/out)

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRpcClient } from '../lib/rpc.mjs';
import { extractAddresses } from '../lib/extract.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.env.CHAIN_OUT_DIR || path.resolve(HERE, '..', 'out');
const TARGET = Number(process.env.COINBASE_TARGET || 952_351);
const CHUNK = Number(process.env.COINBASE_CHUNK || 2_000);
const CONCURRENCY = Number(process.env.COINBASE_CONCURRENCY || 8);
const OUT_FILE = path.join(OUT_DIR, 'block-miners.jsonl');
const META_FILE = path.join(OUT_DIR, 'block-miners.meta.json');

function readMeta() {
  try {
    return JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
  } catch {
    return { lastBlock: -1, target: TARGET };
  }
}

/** The block's miner = the highest-value addressed coinbase output. Uses the
 *  SAME extractAddresses() the wallet walk used, so the derived address (incl.
 *  P2PK pubkey → address for pre-2012 blocks, where there's no scriptPubKey
 *  .address) matches the wallet substrate exactly — required for the
 *  coin → owner → wallet-role lookup. */
function coinbaseRecipient(block) {
  const cb = block.txs && block.txs[0]; // adaptBlock() → { header, txs }
  if (!cb) return null;
  const { outputs } = extractAddresses(cb);
  let best = null;
  for (const o of outputs) {
    if (!best || o.sats > best.sats) best = o;
  }
  return best ? best.address : null;
}

/** Run `fn` over `items` with at most `n` in flight; preserves input order. */
async function mapPool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const idx = next++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

async function main() {
  const rpc = createRpcClient();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const meta = readMeta();
  const start = meta.lastBlock + 1;
  if (start > TARGET) {
    console.log(`block-miners already complete through ${TARGET}.`);
    return;
  }
  console.log(
    `coinbase walk: blocks ${start} → ${TARGET} (chunk ${CHUNK}, concurrency ${CONCURRENCY})`,
  );
  const t0 = Date.now();
  let missing = 0;

  for (let lo = start; lo <= TARGET; lo += CHUNK) {
    const hi = Math.min(lo + CHUNK - 1, TARGET);
    const heights = [];
    for (let h = lo; h <= hi; h++) heights.push(h);

    const rows = await mapPool(heights, CONCURRENCY, async (h) => {
      const hash = await rpc.blockHashAt(h);
      const blk = await rpc.fetchBlock(hash); // v3 + adaptBlock → addrs match wallets
      const address = coinbaseRecipient(blk);
      if (!address) missing++;
      return { block: h, address };
    });

    fs.appendFileSync(OUT_FILE, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
    fs.writeFileSync(META_FILE, JSON.stringify({ lastBlock: hi, target: TARGET }));

    const done = hi - start + 1;
    const pct = ((done / (TARGET - start + 1)) * 100).toFixed(1);
    const rate = done / ((Date.now() - t0) / 1000);
    const eta = rate > 0 ? ((TARGET - hi) / rate / 60).toFixed(0) : '?';
    console.log(`  ${hi}/${TARGET} (${pct}%)  ~${rate.toFixed(0)} blk/s  ETA ~${eta}m  missing=${missing}`);
  }
  console.log(`coinbase walk complete through ${TARGET}. missing-address blocks: ${missing}`);
}

main().catch((err) => {
  console.error('coinbase walk failed:', err);
  process.exit(1);
});
