//! lattice-physics — pre-baked force-directed sim for the Timechain Lattice.
//!
//! Reads `wallets.parquet` and `activity/epoch-*.parquet` (output of
//! `chain-tools/ingest/`). For each block in the requested range, advances
//! a 2D force simulation:
//!
//!   F_origin   = G * mass[w] / |pos[w]|^2          (toward origin)
//!   F_repel    = -k_r / |pos[w] - pos[v]|^2        (k-NN limited)
//!   F_bond     = -k_s * (|pos[a] - pos[b]| - L_0)  (Hooke for active tx bonds)
//!   F_damping  = -c * vel[w]
//!
//!   pos[w] += vel[w] * dt; vel[w] += F_total * dt
//!
//! Mass per block is `log(holdings_sats + 1) + activity_score(window)`.
//! Bonds decay over 10 blocks.
//!
//! Snapshots all positions every `--keyframe-interval` blocks (default 1000).
//! The browser interpolates between adjacent keyframes during scrubbing.
//!
//! Output: `keyframes/<NNNNNN>.parquet` — one file per keyframe, columns
//! (address: dictionary<string>, x: int16, y: int16). Quantized to int16
//! after scaling pos to [-32k, 32k] for compact storage.

use clap::Parser;
use std::path::PathBuf;

mod spatial_index;

#[derive(Parser, Debug)]
#[command(version, about = "Pre-bake force-directed wallet positions to keyframe parquet.")]
struct Args {
    /// Input wallets.parquet from extract_wallets.py
    #[arg(long)]
    wallets: PathBuf,

    /// Input directory of epoch-NNNN.parquet from extract_activity.py
    #[arg(long)]
    activity_dir: PathBuf,

    /// Output directory for keyframes/<NNNNNN>.parquet
    #[arg(long)]
    out_dir: PathBuf,

    /// First block height to simulate (default: 0).
    #[arg(long, default_value_t = 0)]
    start_height: u32,

    /// Last block height to simulate (default: latest in activity_dir).
    #[arg(long)]
    end_height: Option<u32>,

    /// Snapshot positions every N blocks (default: 1000).
    #[arg(long, default_value_t = 1000)]
    keyframe_interval: u32,

    /// Force-simulation ticks per block (default: 20).
    #[arg(long, default_value_t = 20)]
    ticks_per_block: u32,
}

fn main() {
    let args = Args::parse();

    eprintln!("lattice-physics — skeleton mode");
    eprintln!("  wallets:           {}", args.wallets.display());
    eprintln!("  activity_dir:      {}", args.activity_dir.display());
    eprintln!("  out_dir:           {}", args.out_dir.display());
    eprintln!("  start_height:      {}", args.start_height);
    eprintln!("  end_height:        {:?}", args.end_height);
    eprintln!("  keyframe_interval: {}", args.keyframe_interval);
    eprintln!("  ticks_per_block:   {}", args.ticks_per_block);

    // TODO: Load wallets.parquet — get address list, holdings (initial mass).
    // TODO: For each block in [start, end]:
    //         - Load activity for this block from activity_dir
    //         - Update masses (holdings + activity score)
    //         - Add transient bonds (decay over 10 blocks)
    //         - Run ticks_per_block force-sim ticks (parallelize over wallets via rayon)
    //         - If block % keyframe_interval == 0:
    //             quantize positions to int16, write keyframes/<height>.parquet
    // TODO: Spatial index in spatial_index.rs (k-d tree) for k-NN repulsion.

    eprintln!("Not implemented — see README.md.");
    std::process::exit(2);
}
