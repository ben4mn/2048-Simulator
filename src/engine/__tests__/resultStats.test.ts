import { describe, expect, it } from 'vitest';
import { computeAggregateStats, computeComparison } from '../resultStats';
import type { GameResult } from '../types';

function makeGame(overrides: Partial<GameResult> = {}): GameResult {
  return {
    id: overrides.id ?? `g-${Math.random()}`,
    seed: overrides.seed ?? 'SEED0001',
    strategyId: overrides.strategyId ?? 'strategy-1',
    batchId: overrides.batchId ?? 'batch-1',
    moves: overrides.moves ?? 'LDLDRRU',
    finalScore: overrides.finalScore ?? 100,
    maxTile: overrides.maxTile ?? 128,
    moveCount: overrides.moveCount ?? 7,
    result: overrides.result ?? 'loss',
    timestamp: overrides.timestamp ?? Date.now(),
    durationMs: overrides.durationMs ?? 1000,
    ...overrides,
  };
}

describe('computeAggregateStats', () => {
  it('returns zeroed stats for an empty result set', () => {
    const stats = computeAggregateStats([]);
    expect(stats).toEqual({
      games: 0,
      winRate: 0,
      avgScore: 0,
      medianScore: 0,
      bestTile: 0,
      maxTileDistribution: [],
    });
  });

  it('computes win rate, avg/median score, best tile for a mixed set', () => {
    const results = [
      makeGame({ finalScore: 100, maxTile: 64, result: 'loss' }),
      makeGame({ finalScore: 200, maxTile: 128, result: 'loss' }),
      makeGame({ finalScore: 2048, maxTile: 2048, result: 'win' }),
    ];

    const stats = computeAggregateStats(results);
    expect(stats.games).toBe(3);
    expect(stats.winRate).toBeCloseTo(1 / 3);
    expect(stats.avgScore).toBeCloseTo((100 + 200 + 2048) / 3);
    expect(stats.medianScore).toBe(200);
    expect(stats.bestTile).toBe(2048);
  });

  it('computes median correctly for an even-length set (average of middle two)', () => {
    const results = [
      makeGame({ finalScore: 100 }),
      makeGame({ finalScore: 200 }),
      makeGame({ finalScore: 300 }),
      makeGame({ finalScore: 400 }),
    ];
    expect(computeAggregateStats(results).medianScore).toBe(250);
  });

  it('builds a max-tile distribution sorted descending by tile value', () => {
    const results = [
      makeGame({ maxTile: 64 }),
      makeGame({ maxTile: 128 }),
      makeGame({ maxTile: 128 }),
      makeGame({ maxTile: 256 }),
    ];
    expect(computeAggregateStats(results).maxTileDistribution).toEqual([
      { tile: 256, count: 1 },
      { tile: 128, count: 2 },
      { tile: 64, count: 1 },
    ]);
  });

  it('treats a 100% win rate and 0% win rate correctly', () => {
    const allWins = [makeGame({ result: 'win' }), makeGame({ result: 'win' })];
    expect(computeAggregateStats(allWins).winRate).toBe(1);

    const allLosses = [makeGame({ result: 'loss' }), makeGame({ result: 'loss' })];
    expect(computeAggregateStats(allLosses).winRate).toBe(0);
  });
});

describe('computeComparison', () => {
  it('pairs games by identical seed and determines a winner per seed', () => {
    const resultsA: GameResult[] = [
      makeGame({ seed: 'S1', finalScore: 500 }),
      makeGame({ seed: 'S2', finalScore: 100 }),
      makeGame({ seed: 'S3', finalScore: 300 }),
    ];
    const resultsB: GameResult[] = [
      makeGame({ seed: 'S1', finalScore: 200 }),
      makeGame({ seed: 'S2', finalScore: 400 }),
      makeGame({ seed: 'S3', finalScore: 300 }),
    ];

    const comparison = computeComparison(resultsA, resultsB);

    expect(comparison.rows).toHaveLength(3);
    expect(comparison.winsA).toBe(1); // S1
    expect(comparison.winsB).toBe(1); // S2
    expect(comparison.ties).toBe(1); // S3

    const s1 = comparison.rows.find((r) => r.seed === 'S1')!;
    expect(s1).toMatchObject({ scoreA: 500, scoreB: 200, delta: 300, winner: 'A' });

    const s3 = comparison.rows.find((r) => r.seed === 'S3')!;
    expect(s3.winner).toBe('tie');
  });

  it('rows are sorted by seed for stable rendering', () => {
    const resultsA = [makeGame({ seed: 'B' }), makeGame({ seed: 'A' })];
    const resultsB = [makeGame({ seed: 'B' }), makeGame({ seed: 'A' })];
    const comparison = computeComparison(resultsA, resultsB);
    expect(comparison.rows.map((r) => r.seed)).toEqual(['A', 'B']);
  });

  it('ignores seeds present on only one side', () => {
    const resultsA = [makeGame({ seed: 'A' }), makeGame({ seed: 'ONLY_A' })];
    const resultsB = [makeGame({ seed: 'A' }), makeGame({ seed: 'ONLY_B' })];
    const comparison = computeComparison(resultsA, resultsB);
    expect(comparison.rows).toHaveLength(1);
    expect(comparison.rows[0].seed).toBe('A');
  });

  it('includes full aggregate stats for each side', () => {
    const resultsA = [makeGame({ seed: 'A', finalScore: 100, maxTile: 64 })];
    const resultsB = [makeGame({ seed: 'A', finalScore: 200, maxTile: 128 })];
    const comparison = computeComparison(resultsA, resultsB);
    expect(comparison.statsA.avgScore).toBe(100);
    expect(comparison.statsB.avgScore).toBe(200);
    expect(comparison.statsA.bestTile).toBe(64);
    expect(comparison.statsB.bestTile).toBe(128);
  });

  it('returns zero wins/ties for empty inputs', () => {
    const comparison = computeComparison([], []);
    expect(comparison.rows).toEqual([]);
    expect(comparison.winsA).toBe(0);
    expect(comparison.winsB).toBe(0);
    expect(comparison.ties).toBe(0);
  });
});
