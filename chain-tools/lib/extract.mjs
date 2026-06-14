// chain-tools/lib/extract.mjs
//
// Pure wallet/bond extraction primitives used by the walker
// (walk_chain_scalable.mjs). No I/O, no module state — every function
// here is a deterministic transform of its inputs, so block reading
// stays consistent.
//
// The proven cutover logic:
//   - bitcoind getblock(verbosity 3) → mempool.space-shaped {header, txs}
//   - P2PK pubkey → P2PKH address derivation (base58check)
//   - per-tx (outputs, inputs, isCoinbase) extraction
//   - canonical bond key

import * as crypto from 'node:crypto';

// --- bitcoind getblock(v3) → mempool.space-shaped {header, txs} --------------
// v3 decodes every tx and resolves vin.prevout (spent address + value) from
// undo data. bitcoind reports values as BTC floats; convert to integer sats
// (round kills float drift).
export function btcToSats(btc) {
  return Math.round((btc || 0) * 1e8);
}

export function adaptVout(v) {
  const spk = v.scriptPubKey || {};
  return {
    value: btcToSats(v.value),
    scriptpubkey_address: spk.address,
    scriptpubkey_type: spk.type === 'pubkey' ? 'p2pk' : spk.type, // only p2pk is special-cased downstream
    scriptpubkey: spk.hex,
  };
}

export function adaptBlock(blk) {
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

// --- canonical bond key ------------------------------------------------------
export function bondKey(fromAddr, toAddr) {
  return fromAddr < toAddr ? `${fromAddr}|${toAddr}` : `${toAddr}|${fromAddr}`;
}

// --- P2PK → P2PKH address derivation -----------------------------------------
// Genesis-era outputs use P2PK (Pay-to-PubKey) — the script pushes a 65-byte
// uncompressed (or 33-byte compressed) pubkey + OP_CHECKSIG, with no canonical
// "address." We derive the equivalent P2PKH address so Satoshi's genesis
// recipient renders as the famous 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa.

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58Encode(buffer) {
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

export function hash160(buffer) {
  const sha256 = crypto.createHash('sha256').update(buffer).digest();
  return crypto.createHash('ripemd160').update(sha256).digest();
}

export function p2pkhFromHash160(hash160Buffer) {
  const versioned = Buffer.concat([Buffer.from([0x00]), hash160Buffer]);
  const c1 = crypto.createHash('sha256').update(versioned).digest();
  const c2 = crypto.createHash('sha256').update(c1).digest();
  const checksum = c2.subarray(0, 4);
  return base58Encode(Buffer.concat([versioned, checksum]));
}

export function p2pkAddressFromScript(scriptHex) {
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

export function addressFromOutput(vout) {
  if (vout.scriptpubkey_address) return vout.scriptpubkey_address;
  if (vout.scriptpubkey_type === 'p2pk') {
    return p2pkAddressFromScript(vout.scriptpubkey);
  }
  // p2ms (multisig with no canonical address), op_return, etc. — skip.
  return null;
}

export function extractAddresses(tx) {
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
