import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, type Batch } from '../db';
import type { GameResult } from '../../engine/types';

function makeGame(overrides: Partial<GameResult> = {}): GameResult {
  return {
    id: overrides.id ?? 'game-1',
    batchId: overrides.batchId ?? 'batch-1',
    strategyId: overrides.strategyId ?? 'strategy-1',
    seed: overrides.seed ?? 'SEED0001',
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

function makeBatch(overrides: Partial<Batch> = {}): Batch {
  return {
    id: overrides.id ?? 'batch-1',
    strategyIds: overrides.strategyIds ?? ['strategy-1'],
    gameCount: overrides.gameCount ?? 10,
    status: overrides.status ?? 'pending',
    seedMode: overrides.seedMode ?? 'random',
    seeds: overrides.seeds ?? ['SEED0001'],
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    ...overrides,
  };
}

describe('Database (IndexedDB storage layer)', () => {
  beforeEach(async () => {
    // Reset the fake IndexedDB between tests so each test starts clean.
    (globalThis as any).indexedDB = new IDBFactory();
    await db.init();
  });

  it('init creates the games, batches, and strategies object stores', async () => {
    // Access the private db field indirectly via a round-trip operation on each store.
    const batch = makeBatch();
    await db.saveBatch(batch);
    await expect(db.getBatch(batch.id)).resolves.toEqual(batch);

    const game = makeGame();
    await db.saveGame(game);
    await expect(db.getGame(game.id)).resolves.toEqual(game);

    const strategy = {
      id: 'strategy-1',
      name: 'Test Strategy',
      type: 'directional',
      params: {},
      stats: {
        gamesPlayed: 0,
        winRate: 0,
        avgScore: 0,
        avgMoves: 0,
        bestScore: 0,
      },
    };
    await db.saveStrategy(strategy);
    await expect(db.getStrategy(strategy.id)).resolves.toEqual(strategy);
  });

  it('saveBatch/getBatch roundtrips a batch record', async () => {
    const batch = makeBatch({ id: 'batch-roundtrip', status: 'complete' });
    await db.saveBatch(batch);

    const fetched = await db.getBatch('batch-roundtrip');
    expect(fetched).toEqual(batch);
  });

  it('getBatch returns null for a missing id', async () => {
    await expect(db.getBatch('does-not-exist')).resolves.toBeNull();
  });

  it('saveGames/getGamesByBatch roundtrips multiple game records', async () => {
    const games = [
      makeGame({ id: 'g1', batchId: 'batch-x' }),
      makeGame({ id: 'g2', batchId: 'batch-x' }),
      makeGame({ id: 'g3', batchId: 'batch-y' }),
    ];

    await db.saveGames(games);

    const batchXGames = await db.getGamesByBatch('batch-x');
    expect(batchXGames).toHaveLength(2);
    expect(batchXGames.map((g) => g.id).sort()).toEqual(['g1', 'g2']);

    const batchYGames = await db.getGamesByBatch('batch-y');
    expect(batchYGames).toHaveLength(1);
    expect(batchYGames[0].id).toBe('g3');
  });

  it('deleteBatch removes the batch record', async () => {
    const batch = makeBatch({ id: 'batch-to-delete' });
    await db.saveBatch(batch);
    await expect(db.getBatch('batch-to-delete')).resolves.toEqual(batch);

    await db.deleteBatch('batch-to-delete');
    await expect(db.getBatch('batch-to-delete')).resolves.toBeNull();
  });

  it('deleteGamesByBatch removes all games for a batch without affecting others', async () => {
    const games = [
      makeGame({ id: 'g1', batchId: 'batch-del' }),
      makeGame({ id: 'g2', batchId: 'batch-del' }),
      makeGame({ id: 'g3', batchId: 'batch-keep' }),
    ];
    await db.saveGames(games);

    await db.deleteGamesByBatch('batch-del');

    await expect(db.getGamesByBatch('batch-del')).resolves.toEqual([]);
    const keptGames = await db.getGamesByBatch('batch-keep');
    expect(keptGames).toHaveLength(1);
    expect(keptGames[0].id).toBe('g3');
  });

  // KNOWN BUG (db.ts:91-105): saveGames([]) never resolves because the
  // forEach loop body never runs, so `completed === games.length` is never
  // checked and the returned promise hangs forever. This test intentionally
  // pins that bug and is expected to FAIL (timeout) until fixed.
  it(
    'resolves promptly when saveGames is called with an empty array',
    { timeout: 2000 },
    async () => {
      await expect(db.saveGames([])).resolves.toBeUndefined();
    }
  );
});
