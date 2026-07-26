/**
 * Pure aggregate / comparison math over GameResult[] records.
 *
 * Kept free of any React/store/IndexedDB concerns so it can be unit tested
 * in isolation and reused by both the single-batch summary strip and the
 * head-to-head comparison panel in ResultsView.
 */

import type { GameResult } from './types';

export interface MaxTileBucket {
  tile: number;
  count: number;
}

export interface AggregateStats {
  games: number;
  winRate: number; // 0..1
  avgScore: number;
  medianScore: number;
  bestTile: number;
  maxTileDistribution: MaxTileBucket[]; // sorted descending by tile value
}

const EMPTY_STATS: AggregateStats = {
  games: 0,
  winRate: 0,
  avgScore: 0,
  medianScore: 0,
  bestTile: 0,
  maxTileDistribution: [],
};

/** Computes win rate / score / max-tile aggregates over a set of games. */
export function computeAggregateStats(results: GameResult[]): AggregateStats {
  if (results.length === 0) {
    return { ...EMPTY_STATS, maxTileDistribution: [] };
  }

  const games = results.length;
  const wins = results.filter((r) => r.result === 'win').length;
  const scores = results.map((r) => r.finalScore).sort((a, b) => a - b);
  const totalScore = scores.reduce((sum, s) => sum + s, 0);
  const avgScore = totalScore / games;
  const medianScore = median(scores);
  const bestTile = results.reduce((max, r) => Math.max(max, r.maxTile), 0);

  const counts = new Map<number, number>();
  for (const r of results) {
    counts.set(r.maxTile, (counts.get(r.maxTile) || 0) + 1);
  }
  const maxTileDistribution = [...counts.entries()]
    .map(([tile, count]) => ({ tile, count }))
    .sort((a, b) => b.tile - a.tile);

  return {
    games,
    winRate: wins / games,
    avgScore,
    medianScore,
    bestTile,
    maxTileDistribution,
  };
}

function median(sortedValues: number[]): number {
  const n = sortedValues.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (sortedValues[mid - 1] + sortedValues[mid]) / 2 : sortedValues[mid];
}

export type SeedWinner = 'A' | 'B' | 'tie';

export interface SeedComparisonRow {
  seed: string;
  scoreA: number;
  scoreB: number;
  delta: number; // scoreA - scoreB
  winner: SeedWinner;
}

export interface ComparisonSummary {
  statsA: AggregateStats;
  statsB: AggregateStats;
  winsA: number;
  winsB: number;
  ties: number;
  rows: SeedComparisonRow[];
}

/**
 * Pairs two result sets by seed (batches run in 'shared' seed mode use
 * identical seeds for both sides) and computes a per-seed head-to-head
 * summary plus aggregate stats for each side.
 *
 * Seeds present in only one side are ignored for the per-seed comparison
 * (defensive: should not happen for a well-formed comparison pair, but a
 * partial/failed run should not crash the UI).
 */
export function computeComparison(
  resultsA: GameResult[],
  resultsB: GameResult[]
): ComparisonSummary {
  const bySeedA = new Map<string, GameResult>();
  for (const r of resultsA) bySeedA.set(r.seed, r);
  const bySeedB = new Map<string, GameResult>();
  for (const r of resultsB) bySeedB.set(r.seed, r);

  const sharedSeeds = [...bySeedA.keys()].filter((seed) => bySeedB.has(seed));

  const rows: SeedComparisonRow[] = sharedSeeds
    .sort((a, b) => a.localeCompare(b))
    .map((seed) => {
      const a = bySeedA.get(seed)!;
      const b = bySeedB.get(seed)!;
      const delta = a.finalScore - b.finalScore;
      const winner: SeedWinner = delta > 0 ? 'A' : delta < 0 ? 'B' : 'tie';
      return { seed, scoreA: a.finalScore, scoreB: b.finalScore, delta, winner };
    });

  const winsA = rows.filter((r) => r.winner === 'A').length;
  const winsB = rows.filter((r) => r.winner === 'B').length;
  const ties = rows.filter((r) => r.winner === 'tie').length;

  return {
    statsA: computeAggregateStats(resultsA),
    statsB: computeAggregateStats(resultsB),
    winsA,
    winsB,
    ties,
    rows,
  };
}
