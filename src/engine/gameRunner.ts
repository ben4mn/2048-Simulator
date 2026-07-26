/**
 * Shared headless game loop.
 *
 * Both playGameWithStrategy (strategy.ts) and the batch simulation worker
 * (src/workers/simulationWorker.ts) drive games through this single function,
 * so the loop semantics — reset stateful strategies per game, stop on null,
 * stop on a rejected move, honor maxMoves — cannot drift between them again.
 */

import { GameEngine } from './gameEngine';
import type { Strategy } from './strategy';

export interface GameRunOutcome {
  moves: string;
  score: number;
  maxTile: number;
  won: boolean;
  moveCount: number;
}

export function runGame(
  seed: string,
  strategy: Strategy,
  maxMoves: number = 10000
): GameRunOutcome {
  const engine = new GameEngine(seed);
  let moveCount = 0;

  // Reset stateful strategies so a reused instance plays like a fresh one.
  strategy.reset?.(seed);

  while (!engine.isGameOver() && moveCount < maxMoves) {
    const move = strategy.selectMove(engine);
    if (!move) break;

    // A rejected move means the strategy is stuck (or buggy); the board did
    // not change, so continuing would spin forever on the same position.
    if (!engine.move(move)) break;
    moveCount++;
  }

  const state = engine.getState();
  return {
    moves: state.moves.join(''),
    score: state.score,
    maxTile: state.maxTile,
    won: state.won,
    moveCount: state.moves.length,
  };
}
