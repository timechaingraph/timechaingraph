#!/usr/bin/env node
// One-shot migration: real-substrate.json (single 500MB+ JSON file that
// can no longer be JSON.stringify/parse'd because it exceeds V8's ~512MB
// string limit) → split files:
//
//   real-substrate-meta.json        small: schema, tipBlock, generatedAt
//   real-substrate-wallets.jsonl    one wallet per line (NDJSON)
//   real-substrate-bonds.jsonl      one bond per line (NDJSON)
//   real-substrate-timestamps.json  blockTimestamps map (~10MB, fits)
//
// Streams the existing pretty-printed JSON line-by-line. Relies on the
// known shape produced by the v1 walker: each wallet record is the
// 11-line block bounded by `    {` and `    }` or `    },`; each bond
// record is similar. blockTimestamps is one key:value pair per line.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(REPO_ROOT, 'chain-tools', 'out');

const SRC = path.join(OUT_DIR, 'real-substrate.json');
const META_OUT = path.join(OUT_DIR, 'real-substrate-meta.json');
const WALLETS_OUT = path.join(OUT_DIR, 'real-substrate-wallets.jsonl');
const BONDS_OUT = path.join(OUT_DIR, 'real-substrate-bonds.jsonl');
const TS_OUT = path.join(OUT_DIR, 'real-substrate-timestamps.json');

if (!fs.existsSync(SRC)) {
  console.error(`source not found: ${SRC}`);
  process.exit(1);
}

const meta = { schema: 'real-substrate/v2', tipBlock: -1, generatedAt: null };
const blockTimestamps = {};

const walletsStream = fs.createWriteStream(WALLETS_OUT);
const bondsStream = fs.createWriteStream(BONDS_OUT);

const rl = readline.createInterface({
  input: fs.createReadStream(SRC, { encoding: 'utf8' }),
  crlfDelay: Infinity,
});

let state = 'header';
let buffer = [];
let wcount = 0;
let bcount = 0;
let tcount = 0;

function flushRecord(arr, stream, kind) {
  // strip leading `    ` + trailing `,` from the buffered lines, parse
  // the remaining JSON object, then emit a compact line.
  const text = arr.join('\n').replace(/,\s*$/, '');
  let rec;
  try {
    rec = JSON.parse(text);
  } catch (err) {
    console.error(`parse error on ${kind} record near line: ${text.slice(0, 200)}…`);
    throw err;
  }
  stream.write(JSON.stringify(rec) + '\n');
}

console.log(`[migrate] reading ${SRC} …`);

for await (const line of rl) {
  if (state === 'header') {
    // Capture top-level scalars until we hit `  "wallets": [`
    const m = line.match(/^  "(schema|tipBlock|generatedAt)":\s*(.+?),?\s*$/);
    if (m) {
      try {
        meta[m[1]] = JSON.parse(m[2].replace(/,$/, ''));
      } catch {
        // tolerate trailing comma stripped above; fallback raw
        meta[m[1]] = m[2].replace(/^"|"$/g, '');
      }
      continue;
    }
    if (line === '  "wallets": [') {
      state = 'wallets';
      continue;
    }
    continue;
  }

  if (state === 'wallets') {
    if (line === '  ],') { state = 'between'; continue; }
    if (line === '    {') { buffer = ['{']; continue; }
    if (line === '    },' || line === '    }') {
      buffer.push('}');
      flushRecord(buffer, walletsStream, 'wallet');
      wcount += 1;
      buffer = [];
      if (wcount % 10000 === 0) console.log(`[migrate] wallets: ${wcount}`);
      continue;
    }
    buffer.push(line.trimStart());
    continue;
  }

  if (state === 'between') {
    if (line === '  "bonds": [') { state = 'bonds'; continue; }
    continue;
  }

  if (state === 'bonds') {
    if (line === '  ],') { state = 'between2'; continue; }
    if (line === '    {') { buffer = ['{']; continue; }
    if (line === '    },' || line === '    }') {
      buffer.push('}');
      flushRecord(buffer, bondsStream, 'bond');
      bcount += 1;
      buffer = [];
      if (bcount % 10000 === 0) console.log(`[migrate] bonds: ${bcount}`);
      continue;
    }
    buffer.push(line.trimStart());
    continue;
  }

  if (state === 'between2') {
    if (line === '  "blockTimestamps": {') { state = 'timestamps'; continue; }
    continue;
  }

  if (state === 'timestamps') {
    if (line === '  }' || line === '}') { state = 'done'; continue; }
    // Lines like:   "BLOCK": "ISO",   (last has no trailing comma)
    const m = line.match(/^\s*"(\d+)":\s*"([^"]+)",?\s*$/);
    if (m) {
      blockTimestamps[m[1]] = m[2];
      tcount += 1;
      if (tcount % 20000 === 0) console.log(`[migrate] timestamps: ${tcount}`);
    }
    continue;
  }
}

await new Promise((res) => walletsStream.end(res));
await new Promise((res) => bondsStream.end(res));

fs.writeFileSync(META_OUT, JSON.stringify(meta, null, 2) + '\n');
fs.writeFileSync(TS_OUT, JSON.stringify(blockTimestamps, null, 2) + '\n');

console.log(`[migrate] wrote ${wcount} wallets → ${WALLETS_OUT}`);
console.log(`[migrate] wrote ${bcount} bonds → ${BONDS_OUT}`);
console.log(`[migrate] wrote ${tcount} timestamps → ${TS_OUT}`);
console.log(`[migrate] meta: ${JSON.stringify(meta)}`);
console.log(`[migrate] done.`);
