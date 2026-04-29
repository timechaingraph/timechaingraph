//! Spatial index for k-NN queries during force-directed simulation.
//!
//! For each wallet, we need the K nearest neighbors to compute repulsion
//! forces (F_repel = -k_r / |pos[w] - pos[v]|^2). With ~1-3M wallets, the
//! naive O(N^2) approach is infeasible (~10^13 operations per tick).
//!
//! A k-d tree gives O(N log N) build and O(log N) per query, making each
//! simulation tick O(N log N). At 880k blocks × 20 ticks × N log N this
//! is tractable in hours on a workstation.
//!
//! Rebuild every tick: positions change continuously, so the tree is short-
//! lived. Rebuild cost dominated by sort, parallelizable with rayon.

#![allow(dead_code)]

use std::cmp::Ordering;

#[derive(Debug, Clone, Copy)]
pub struct Point {
    pub idx: u32,   // wallet index
    pub x: f32,
    pub y: f32,
}

#[derive(Debug)]
pub enum KdNode {
    Leaf(Point),
    Branch {
        axis: u8,        // 0 = x, 1 = y
        split: f32,
        left: Box<KdNode>,
        right: Box<KdNode>,
    },
}

impl KdNode {
    /// Build a balanced k-d tree from a slice of points. O(N log N).
    pub fn build(points: &mut [Point]) -> Option<KdNode> {
        Self::build_recursive(points, 0)
    }

    fn build_recursive(points: &mut [Point], depth: u32) -> Option<KdNode> {
        match points.len() {
            0 => None,
            1 => Some(KdNode::Leaf(points[0])),
            _ => {
                let axis = (depth % 2) as u8;
                points.sort_by(|a, b| {
                    let av = if axis == 0 { a.x } else { a.y };
                    let bv = if axis == 0 { b.x } else { b.y };
                    av.partial_cmp(&bv).unwrap_or(Ordering::Equal)
                });
                let mid = points.len() / 2;
                let split = if axis == 0 { points[mid].x } else { points[mid].y };
                let (left_slice, right_slice) = points.split_at_mut(mid);
                let left = Self::build_recursive(left_slice, depth + 1).map(Box::new);
                let right = Self::build_recursive(right_slice, depth + 1).map(Box::new);

                // Both sides should always exist for len >= 2.
                Some(KdNode::Branch {
                    axis,
                    split,
                    left: left.expect("left subtree"),
                    right: right.expect("right subtree"),
                })
            }
        }
    }

    /// Find the k nearest neighbors to `query` (excluding `query` itself).
    /// TODO: implement bounded-heap descent.
    pub fn knn(&self, _query: Point, _k: usize) -> Vec<Point> {
        unimplemented!("k-NN descent not yet implemented")
    }
}
