// chain-tools/lib/rpc.mjs
//
// Local bitcoind JSON-RPC client — cookie auth, no rate limit (fast
// local reads). Source of truth is the operator's own fully-synced
// node; nothing leaves the box. Shared by every walker so they speak
// to bitcoind identically (one getblock verbosity-3 call per block).

import * as fs from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { adaptBlock } from './extract.mjs';

const DEFAULT_RPC_URL = 'http://127.0.0.1:8332/';
const DEFAULT_COOKIE = '/Volumes/Timechaingraph/bitcoin/data/.cookie';

function readCookieAuth(cookiePath) {
  // .cookie is "__cookie__:<password>" — HTTP Basic auth for RPC.
  const raw = fs.readFileSync(cookiePath, 'utf8').trim();
  return 'Basic ' + Buffer.from(raw).toString('base64');
}

/**
 * Build an RPC client bound to one bitcoind instance.
 * @param {object} [opts]
 * @param {string} [opts.rpcUrl]      override via BITCOIND_RPC_URL
 * @param {string} [opts.cookiePath]  override via BITCOIND_COOKIE
 * @returns {{ rpcCall, blockHashAt, fetchBlock, getBlockCount }}
 */
export function createRpcClient(opts = {}) {
  const rpcUrl = opts.rpcUrl || process.env.BITCOIND_RPC_URL || DEFAULT_RPC_URL;
  const cookiePath =
    opts.cookiePath || process.env.BITCOIND_COOKIE || DEFAULT_COOKIE;
  const authHeader = readCookieAuth(cookiePath);

  async function rpcCall(method, params = []) {
    let attempt = 1;
    while (true) {
      try {
        const res = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'content-type': 'text/plain', authorization: authHeader },
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

  async function blockHashAt(height) {
    return rpcCall('getblockhash', [height]);
  }

  // One RPC call per block: getblock verbosity 3 returns header fields + every
  // tx fully decoded WITH vin.prevout — everything extraction needs, adapted to
  // the mempool.space shape so the wallet/bond logic is unchanged.
  async function fetchBlock(hash) {
    const blk = await rpcCall('getblock', [hash, 3]);
    return adaptBlock(blk);
  }

  async function getBlockCount() {
    return rpcCall('getblockcount', []);
  }

  return { rpcCall, blockHashAt, fetchBlock, getBlockCount };
}
