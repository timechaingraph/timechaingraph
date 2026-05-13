import type { Coin } from './coin';
import type { WalletBond, WalletData } from './wallet';

/**
 * ChainSubstrate — the shared chain-data contract that any source
 * (fixture, parquet bundle from R2, real bitcoind RPC) must satisfy
 * for downstream consumers (snapshot generators, Prolog fact
 * emitters, the web canvas, the API server) to read.
 *
 * Both projections in this two-repo cooperative system consume
 * a `ChainSubstrate`:
 *   - **Graph projection** (Timechain Graph) reads `wallets` +
 *     `bonds`, emits per-wallet + per-bond records.
 *   - **Grid projection** (Timechain Grid) reads `coins`, emits
 *     per-coin + per-block + per-subgrid records.
 *
 * The substrate is the raw digest at a snapshot. v0.1 implementation
 * is fixture-backed (`src/data/substrate.ts`); v0.2+ wraps the
 * BitcoinChainAdapter's R2-served parquet bundles. The interface
 * doesn't change between fixture and production — that's the point
 * of naming it.
 *
 * Schema-stability commitment: any new field lands as an additive
 * extension. Existing fields don't get renamed or removed without a
 * major-version bump documented in the schema README.
 */
export interface ChainSubstrate {
  /**
   * Latest known block height in this digest. Acts as the implicit
   * "as-of" stamp; consumers treat all data as a snapshot at this
   * height.
   */
  readonly tipBlock: number;

  /**
   * All wallets known to the digest. Order is implementation-defined
   * but stable across calls — consumers rely on iteration order for
   * deterministic output.
   */
  readonly wallets: readonly WalletData[];

  /**
   * All transaction-bonds (aggregated wallet-pair edges) known to
   * the digest.
   */
  readonly bonds: readonly WalletBond[];

  /**
   * All coins (UTXOs / coinbase outputs) minted up through tipBlock.
   * Companion's CoinRoster fixture is the authority here in v0.1; v0.2+
   * the operator's chain-tools pipeline emits this from real bitcoind
   * data.
   */
  readonly coins: readonly Coin[];

  /**
   * O(1) lookup of a wallet by its address. Returns undefined if the
   * address isn't in the digest (e.g., not yet ingested in the
   * current snapshot).
   */
  walletByAddress(address: string): WalletData | undefined;

  /**
   * All bonds touching the given address — either side. Empty array
   * if no bonds. Order is implementation-defined.
   */
  bondsForAddress(address: string): readonly WalletBond[];

  /**
   * All coins currently owned by the given address. v0.1 invariant:
   * `ownerAddress === minterAddress` (no transfers tracked yet);
   * v0.2+ this becomes "owner at `tipBlock`" once the multi-input
   * pipeline updates ownership per spend.
   */
  coinsOwnedBy(address: string): readonly Coin[];
}
