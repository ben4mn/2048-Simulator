/**
 * Determinism guarantees: same seed + same moves = same game, and
 * strategy runs must be reproducible and independent per game.
 */
import { describe, expect, it } from 'vitest';
import { GameEngine } from '../gameEngine';
import { createStrategy, playGameWithStrategy } from '../strategy';
import type { Direction } from '../types';

describe('engine replay determinism', () => {
  it('two engines with the same seed start with identical boards', () => {
    const a = new GameEngine('DET-SEED-1');
    const b = new GameEngine('DET-SEED-1');
    expect(a.getState().board).toEqual(b.getState().board);
  });

  it('identical move lists on the same seed produce identical games', () => {
    const seed = 'DET-SEED-2';
    const priority: Direction[] = ['left', 'down', 'right', 'up'];

    // Play engine A to completion with a deterministic policy, recording moves.
    const a = new GameEngine(seed);
    const played: Direction[] = [];
    let guard = 20000;
    while (!a.getState().gameOver && guard-- > 0) {
      const dir = priority.find(d => a.isValidMove(d));
      if (!dir) break;
      a.move(dir);
      played.push(dir);
    }

    // Replay the recorded moves on engine B.
    const b = new GameEngine(seed);
    for (const dir of played) {
      expect(b.move(dir)).toBe(true);
    }

    const sa = a.getState();
    const sb = b.getState();
    expect(sb.board).toEqual(sa.board);
    expect(sb.score).toBe(sa.score);
    expect(sb.moves.join('')).toBe(sa.moves.join(''));
    expect(sb.maxTile).toBe(sa.maxTile);
    expect(sb.gameOver).toBe(sa.gameOver);
  });

  it('reset() restores a replayable game (same seed, same spawns)', () => {
    const engine = new GameEngine('DET-RESET');
    const initial = engine.getState().board;
    engine.move(engine.getValidMoves()[0]);
    engine.reset();
    expect(engine.getState().board).toEqual(initial);
    expect(engine.getState().moves).toEqual([]);
  });

  it('playGameWithStrategy is reproducible for a deterministic strategy', () => {
    const seed = 'DET-SEED-3';
    const r1 = playGameWithStrategy(seed, createStrategy('directional_priority'));
    const r2 = playGameWithStrategy(seed, createStrategy('directional_priority'));
    expect(r2.moves).toBe(r1.moves);
    expect(r2.score).toBe(r1.score);
    expect(r2.maxTile).toBe(r1.maxTile);
    expect(r2.moveCount).toBe(r1.moveCount);
  });
});

describe('strategy run reproducibility (known bugs)', () => {
  // KNOWN BUG (RED): RandomStrategy uses Math.random (strategy.ts:198)
  // instead of the seeded RNG, so two runs of the same seed diverge.
  // DESIRED: same seed => identical game, for every strategy including random.
  it('random strategy is idempotent for a given seed (pins strategy.ts:198 Math.random)', () => {
    const seed = 'RANDOM-IDEMPOTENT';
    const r1 = playGameWithStrategy(seed, createStrategy('random'));
    const r2 = playGameWithStrategy(seed, createStrategy('random'));
    expect(r2.moves).toBe(r1.moves);
    expect(r2.score).toBe(r1.score);
    expect(r2.maxTile).toBe(r1.maxTile);
  });

  // KNOWN BUG (RED): PatternStrategy keeps `currentIndex` across games
  // (strategy.ts:210), and the worker reuses ONE strategy instance for the
  // whole batch (simulationWorker.ts:38-41 creates it once, then loops seeds).
  // So game N's result depends on where game N-1 left the pattern cursor.
  // DESIRED: per-game independence — the same seed run through the same
  // strategy instance twice must yield identical results.
  // Seed 'PAT-0' was verified to expose the divergence (scores 2432 vs 1388).
  it('pattern strategy gives identical results when the instance is reused across games (pins shared currentIndex, strategy.ts:210 + simulationWorker.ts:38-41)', () => {
    const strategy = createStrategy('pattern', {
      pattern: ['left', 'down', 'right', 'up'],
    });

    // Model the worker loop: one strategy instance, same seed twice.
    const seeds = ['PAT-0', 'PAT-0'];
    const results = seeds.map(seed => playGameWithStrategy(seed, strategy));

    expect(results[1].moves).toBe(results[0].moves);
    expect(results[1].score).toBe(results[0].score);
    expect(results[1].maxTile).toBe(results[0].maxTile);
    expect(results[1].moveCount).toBe(results[0].moveCount);
  });

  it('pattern strategy reused across DIFFERENT seeds still gives each seed its fresh-instance result', () => {
    // Same worker-loop model, but assert against fresh-instance baselines.
    const mkStrategy = () =>
      createStrategy('pattern', { pattern: ['left', 'down', 'right', 'up'] });

    const seeds = ['PAT-0', 'PAT-1', 'PAT-2'];
    const baselines = seeds.map(seed => playGameWithStrategy(seed, mkStrategy()));

    const shared = mkStrategy();
    const batch = seeds.map(seed => playGameWithStrategy(seed, shared));

    for (let i = 0; i < seeds.length; i++) {
      expect(batch[i].moves, `seed ${seeds[i]}`).toBe(baselines[i].moves);
      expect(batch[i].score, `seed ${seeds[i]}`).toBe(baselines[i].score);
    }
  });
});


describe('history-free search snapshots', () => {
  it('keeps RNG, board, score and flags identical while omitting prior history', () => {
    const engine = new GameEngine('SEARCH-SNAPSHOT');
    for (let i = 0; i < 30 && !engine.isGameOver(); i++) engine.move(engine.getValidMoves()[0]);
    const full = engine.clone();
    const search = engine.clone({ includeHistory: false });
    const initialHistory = engine.getState().moves;
    expect(search.getState().moves).toEqual([]);
    for (let i = 0; i < 20 && !full.isGameOver(); i++) {
      const direction = full.getValidMoves()[0];
      expect(search.move(direction)).toBe(full.move(direction));
      expect({ ...search.getState(), moves: [] }).toEqual({ ...full.getState(), moves: [] });
    }
    expect(engine.getState().moves).toEqual(initialHistory);
  });
});
