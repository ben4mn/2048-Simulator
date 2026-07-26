/**
 * Strategy system for automated 2048 gameplay
 */

import type { Board, CornerPosition, Direction } from './types';
import { GameEngine } from './gameEngine';
import { runGame } from './gameRunner';
import { SeededRNG } from './rng';

export interface Strategy {
  id: string;
  name: string;
  selectMove(engine: GameEngine): Direction | null;
  /**
   * Optional per-game reset hook. Stateful strategies (pattern cursor, seeded
   * RNG stream) implement this so a reused instance behaves identically to a
   * fresh one. Called by playGameWithStrategy (and the worker loop) with the
   * seed of the game about to start.
   */
  reset?(seed: string): void;
}

/**
 * Directional Priority Strategy
 * Tries moves in a fixed priority order
 */
export class DirectionalPriorityStrategy implements Strategy {
  id = 'directional_priority';
  name = 'Directional Priority';
  private priority: Direction[];

  constructor(priority: Direction[] = ['left', 'down', 'right', 'up']) {
    this.priority = priority;
  }

  selectMove(engine: GameEngine): Direction | null {
    for (const direction of this.priority) {
      if (engine.isValidMove(direction)) {
        return direction;
      }
    }
    return null;
  }
}

/**
 * Corner Anchor Strategy
 * Tries to keep the highest tile in a specific corner
 * Uses directional priority biased toward the corner
 */
export class CornerAnchorStrategy implements Strategy {
  id = 'corner_anchor';
  name: string;
  private corner: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  private priority: Direction[];

  constructor(corner: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' = 'bottom-left') {
    this.corner = corner;
    this.name = `Corner Anchor (${corner})`;

    // Set directional priority based on corner
    switch (corner) {
      case 'bottom-left':
        this.priority = ['left', 'down', 'right', 'up'];
        break;
      case 'bottom-right':
        this.priority = ['right', 'down', 'left', 'up'];
        break;
      case 'top-left':
        this.priority = ['left', 'up', 'right', 'down'];
        break;
      case 'top-right':
        this.priority = ['right', 'up', 'left', 'down'];
        break;
    }
  }

  selectMove(engine: GameEngine): Direction | null {
    const board = engine.getBoardView();
    const maxTile = engine.getMaxTileValue();
    const cornerPos = this.getCornerPosition();

    // Check if max tile is in the corner
    const maxInCorner = board[cornerPos.row][cornerPos.col] === maxTile;

    // If max tile is in corner, prefer moves verified (by simulation) to keep
    // it there: after the move, the corner cell must still hold the board's
    // maximum tile.
    if (maxInCorner) {
      for (const direction of this.priority) {
        if (!engine.isValidMove(direction)) continue;
        if (this.keepsMaxInCorner(engine, direction, cornerPos)) {
          return direction;
        }
      }
    }

    // Otherwise (or when no corner-safe move exists), use directional
    // priority to move it toward the corner.
    for (const direction of this.priority) {
      if (engine.isValidMove(direction)) {
        return direction;
      }
    }

    return null;
  }

  /**
   * Simulate the move on a clone and check the corner cell still holds the
   * board's maximum tile afterwards (spawns included — the clone shares the
   * engine's RNG stream, so the simulated spawn matches the real one).
   */
  private keepsMaxInCorner(
    engine: GameEngine,
    direction: Direction,
    cornerPos: { row: number; col: number }
  ): boolean {
    const clone = engine.clone();
    if (!clone.move(direction)) return false;
    const after = clone.getBoardView();
    return after[cornerPos.row][cornerPos.col] === clone.getMaxTileValue();
  }

  private getCornerPosition(): { row: number; col: number } {
    switch (this.corner) {
      case 'bottom-left':
        return { row: 3, col: 0 };
      case 'bottom-right':
        return { row: 3, col: 3 };
      case 'top-left':
        return { row: 0, col: 0 };
      case 'top-right':
        return { row: 0, col: 3 };
    }
  }
}

/**
 * Merge Maximization Strategy
 * Prefers moves that create the most merges
 */
export class MergeMaxStrategy implements Strategy {
  id = 'merge_max';
  name = 'Merge Maximization';

  selectMove(engine: GameEngine): Direction | null {
    const directions: Direction[] = ['up', 'down', 'left', 'right'];
    let bestDirection: Direction | null = null;
    let bestMergeScore = -1;

    for (const direction of directions) {
      if (!engine.isValidMove(direction)) continue;

      // Simulate the move on a clone and measure the REAL merge points
      // gained (score delta), rather than approximating with adjacency
      // counts. Ties keep the earlier direction in the list.
      const clone = engine.clone();
      const before = clone.getScore();
      if (!clone.move(direction)) continue;
      const mergeScore = clone.getScore() - before;

      if (mergeScore > bestMergeScore) {
        bestMergeScore = mergeScore;
        bestDirection = direction;
      }
    }

    return bestDirection;
  }
}

/**
 * Random Strategy (Baseline)
 * Uses a seeded RNG derived from the engine's seed so that the same seed
 * always produces the same game (deterministic, reproducible baselines).
 */
export class RandomStrategy implements Strategy {
  id = 'random';
  name = 'Random';
  private rng: SeededRNG | null = null;
  private rngSeed: string | null = null;

  reset(seed: string): void {
    this.rngSeed = seed;
    // Derive a distinct stream from the game seed so strategy choices don't
    // correlate with the engine's own spawn RNG.
    this.rng = new SeededRNG(`${seed}:strategy`);
  }

  selectMove(engine: GameEngine): Direction | null {
    const validMoves = engine.getValidMoves();
    if (validMoves.length === 0) return null;

    // Lazily (re)initialize when used directly against a new engine/seed.
    const seed = engine.getSeed();
    if (!this.rng || this.rngSeed !== seed) {
      this.reset(seed);
    }

    return this.rng!.choice(validMoves);
  }
}

/**
 * Pattern Strategy
 * Repeats a fixed sequence of moves
 */
export class PatternStrategy implements Strategy {
  id = 'pattern';
  name: string;
  private pattern: Direction[];
  private currentIndex: number = 0;

  constructor(pattern: Direction[], name?: string) {
    this.pattern = pattern;
    this.name = name || `Pattern (${pattern.join('-')})`;
  }

  reset(): void {
    this.currentIndex = 0;
  }

  selectMove(engine: GameEngine): Direction | null {
    // Try moves in pattern order, cycling through
    const startIndex = this.currentIndex;

    do {
      const direction = this.pattern[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % this.pattern.length;

      if (engine.isValidMove(direction)) {
        return direction;
      }
    } while (this.currentIndex !== startIndex);

    return null; // No valid moves
  }
}

/**
 * Conditional Strategy
 * Executes rules based on board conditions
 */
export class ConditionalStrategy implements Strategy {
  id = 'conditional';
  name: string;
  private rules: Array<{
    condition: (board: Board) => boolean;
    actions: Direction[];
    priority: number;
  }>;
  private fallback: Strategy;

  constructor(
    rules: Array<{ condition: (board: Board) => boolean; actions: Direction[]; priority: number }>,
    name?: string
  ) {
    // Copy before sorting: the caller's array must not be reordered in place.
    this.rules = [...rules].sort((a, b) => b.priority - a.priority); // Higher priority first
    this.name = name || 'Conditional';
    this.fallback = new DirectionalPriorityStrategy();
  }

  selectMove(engine: GameEngine): Direction | null {
    const board = engine.getBoardView() as Board;

    // Evaluate rules in priority order
    for (const rule of this.rules) {
      if (rule.condition(board)) {
        // Try actions in order
        for (const direction of rule.actions) {
          if (engine.isValidMove(direction)) {
            return direction;
          }
        }
      }
    }

    // Fallback to directional priority
    return this.fallback.selectMove(engine);
  }
}

/**
 * Look-Ahead Strategy
 * Evaluates moves by looking N moves ahead
 */
export class LookAheadStrategy implements Strategy {
  id = 'lookahead';
  name: string;
  private depth: number;
  private evaluateBoard: (board: Board) => number;

  constructor(depth: number, evaluateBoard: (board: Board) => number, name?: string) {
    // Honor every depth RuleValidator accepts (1-5); clamp only out-of-range input.
    this.depth = Math.max(1, Math.min(depth, 5));
    this.evaluateBoard = evaluateBoard;
    this.name = name || `Look-Ahead (depth ${this.depth})`;
  }

  selectMove(engine: GameEngine): Direction | null {
    const directions: Direction[] = ['up', 'down', 'left', 'right'];
    let bestDirection: Direction | null = null;
    let bestScore = -Infinity;

    for (const direction of directions) {
      if (!engine.isValidMove(direction)) continue;

      // Simulate the move
      const score = this.evaluateMove(engine, direction, this.depth);
      if (score > bestScore) {
        bestScore = score;
        bestDirection = direction;
      }
    }

    return bestDirection;
  }

  private evaluateMove(engine: GameEngine, direction: Direction, depth: number): number {
    // Clone the engine (board + score + exact RNG stream position) instead of
    // replaying the full move history on a fresh engine — O(1) vs O(moves).
    const tempEngine = engine.clone();

    // Make the test move
    if (!tempEngine.move(direction)) {
      return -Infinity;
    }

    // If we've reached target depth, evaluate
    if (depth === 1) {
      return this.evaluateBoard(tempEngine.getBoardView() as Board);
    }

    // Otherwise, recursively evaluate next moves. The player chooses the
    // follow-up move, so each candidate is credited with the BEST reachable
    // outcome (max over follow-ups), not the average.
    const directions: Direction[] = ['up', 'down', 'left', 'right'];
    let bestScore = -Infinity;

    for (const nextDir of directions) {
      if (tempEngine.isValidMove(nextDir)) {
        const score = this.evaluateMove(tempEngine, nextDir, depth - 1);
        if (score > bestScore) bestScore = score;
      }
    }

    return bestScore !== -Infinity ? bestScore : this.evaluateBoard(tempEngine.getBoardView() as Board);
  }
}

/**
 * Weighted Strategy
 * Scores each move based on weighted criteria
 */
export class WeightedStrategy implements Strategy {
  id = 'weighted';
  name: string;
  private evaluateBoard: (board: Board) => number;

  constructor(evaluateBoard: (board: Board) => number, name?: string) {
    this.evaluateBoard = evaluateBoard;
    this.name = name || 'Weighted Evaluation';
  }

  selectMove(engine: GameEngine): Direction | null {
    const directions: Direction[] = ['up', 'down', 'left', 'right'];
    let bestDirection: Direction | null = null;
    let bestScore = -Infinity;

    for (const direction of directions) {
      if (!engine.isValidMove(direction)) continue;

      // Evaluate the board after this move by cloning (board + RNG position)
      // instead of replaying the entire move history on a fresh engine.
      const tempEngine = engine.clone();

      // Make the test move
      if (tempEngine.move(direction)) {
        const score = this.evaluateBoard(tempEngine.getBoardView() as Board);
        if (score > bestScore) {
          bestScore = score;
          bestDirection = direction;
        }
      }
    }

    return bestDirection;
  }
}

/**
 * Custom Strategy
 * Container that executes multiple rules in priority order
 */
export class CustomStrategy implements Strategy {
  id = 'custom';
  name: string;
  private strategies: Strategy[];

  constructor(strategies: Strategy[], name?: string) {
    this.strategies = strategies;
    this.name = name || 'Custom Strategy';
  }

  reset(seed: string): void {
    for (const strategy of this.strategies) {
      strategy.reset?.(seed);
    }
  }

  selectMove(engine: GameEngine): Direction | null {
    // Try each strategy in order
    for (const strategy of this.strategies) {
      const move = strategy.selectMove(engine);
      if (move !== null) {
        return move;
      }
    }
    return null;
  }
}

/**
 * Parameters accepted by the strategy factory. Each strategy type reads the
 * subset of fields relevant to it (see StrategyConfig in types.ts for the
 * per-type discriminated union).
 */
export interface StrategyFactoryParams {
  name?: string;
  priority?: Direction[];
  corner?: CornerPosition;
  pattern?: Direction[];
  rules?: Array<{ condition: (board: Board) => boolean; actions: Direction[]; priority: number }>;
  depth?: number;
  evaluateBoard?: (board: Board) => number;
  strategies?: Strategy[];
}

/**
 * Strategy Factory
 */
export function createStrategy(type: string, params?: StrategyFactoryParams): Strategy {
  switch (type) {
    case 'directional_priority':
      return new DirectionalPriorityStrategy(params?.priority);
    case 'corner_anchor':
      return new CornerAnchorStrategy(params?.corner || 'bottom-left');
    case 'merge_max':
      return new MergeMaxStrategy();
    case 'random':
      return new RandomStrategy();
    case 'pattern':
      return new PatternStrategy(params?.pattern || ['left', 'down'], params?.name);
    case 'conditional':
      return new ConditionalStrategy(params?.rules || [], params?.name);
    case 'lookahead':
      return new LookAheadStrategy(
        params?.depth || 2,
        params?.evaluateBoard || (() => 0),
        params?.name
      );
    case 'weighted':
      return new WeightedStrategy(params?.evaluateBoard || (() => 0), params?.name);
    case 'custom':
      return new CustomStrategy(params?.strategies || [], params?.name);
    default:
      throw new Error(`Unknown strategy type: ${type}`);
  }
}

/**
 * Run a complete game with a strategy.
 * Thin alias over the shared loop in gameRunner.ts (also used by the
 * simulation worker), kept for API stability.
 */
export function playGameWithStrategy(
  seed: string,
  strategy: Strategy,
  maxMoves: number = 10000
): {
  moves: string;
  score: number;
  maxTile: number;
  won: boolean;
  moveCount: number;
} {
  return runGame(seed, strategy, maxMoves);
}
