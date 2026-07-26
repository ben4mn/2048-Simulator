/**
 * Coarse performance smoke test.
 *
 * Before GameEngine.clone(), LookAheadStrategy evaluated every candidate node
 * by constructing a fresh engine and replaying the ENTIRE move history
 * (O(moves^2) per game, multiplied by the branching factor). A full depth-3
 * game took seconds-to-minutes depending on length. With clone() it completes
 * in well under a second; the 10s bound below is deliberately generous so this
 * never flakes on slow CI, while still catching a regression to full-history
 * replay (which scales far worse than 10s for long games).
 */
import { describe, expect, it } from 'vitest';
import { LookAheadStrategy, playGameWithStrategy } from '../strategy';
import { BoardEvaluator, DEFAULT_WEIGHTS } from '../customRules';
import type { Board } from '../types';

describe('perf smoke', () => {
  it('depth-3 look-ahead strategy completes a full game in under 10s', { timeout: 15000 }, () => {
    const strategy = new LookAheadStrategy(3, (board: Board) =>
      BoardEvaluator.evaluateBoard(board, DEFAULT_WEIGHTS)
    );

    const start = performance.now();
    const result = playGameWithStrategy('PERF-LA-3', strategy);
    const elapsed = performance.now() - start;

    // Sanity: it actually played a real game.
    expect(result.moveCount).toBeGreaterThan(50);
    expect(elapsed).toBeLessThan(10000);
  });
});
