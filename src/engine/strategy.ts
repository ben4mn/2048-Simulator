/**
 * Strategy system for automated 2048 gameplay
 */

import type { Board, Direction } from './types';
import { GameEngine } from './gameEngine';

export interface Strategy {
  id: string;
  name: string;
  selectMove(engine: GameEngine): Direction | null;
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
    const state = engine.getState();
    const maxTile = this.getMaxTile(state.board);
    const cornerPos = this.getCornerPosition();

    // Check if max tile is in the corner
    const maxInCorner = state.board[cornerPos.row][cornerPos.col] === maxTile;

    // If max tile is in corner, prefer moves that keep it there
    if (maxInCorner) {
      const safeMoves = this.getCornerSafeMoves();
      for (const direction of safeMoves) {
        if (engine.isValidMove(direction)) {
          return direction;
        }
      }
    }

    // Otherwise, use directional priority to move it toward corner
    for (const direction of this.priority) {
      if (engine.isValidMove(direction)) {
        return direction;
      }
    }

    return null;
  }

  private getMaxTile(board: Board): number {
    let max = 0;
    for (const row of board) {
      for (const tile of row) {
        if (tile > max) max = tile;
      }
    }
    return max;
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

  private getCornerSafeMoves(): Direction[] {
    // Moves that don't disturb the corner position
    switch (this.corner) {
      case 'bottom-left':
        return ['left', 'down'];
      case 'bottom-right':
        return ['right', 'down'];
      case 'top-left':
        return ['left', 'up'];
      case 'top-right':
        return ['right', 'up'];
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
    let maxMerges = -1;

    for (const direction of directions) {
      if (!engine.isValidMove(direction)) continue;

      const merges = this.countPotentialMerges(engine.getState().board, direction);
      if (merges > maxMerges) {
        maxMerges = merges;
        bestDirection = direction;
      }
    }

    return bestDirection;
  }

  private countPotentialMerges(board: Board, direction: Direction): number {
    // Simplified: count adjacent matching tiles in the direction of movement
    let count = 0;

    if (direction === 'left' || direction === 'right') {
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 3; col++) {
          if (board[row][col] !== 0 && board[row][col] === board[row][col + 1]) {
            count++;
          }
        }
      }
    } else {
      for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 3; row++) {
          if (board[row][col] !== 0 && board[row][col] === board[row + 1][col]) {
            count++;
          }
        }
      }
    }

    return count;
  }
}

/**
 * Random Strategy (Baseline)
 */
export class RandomStrategy implements Strategy {
  id = 'random';
  name = 'Random';

  selectMove(engine: GameEngine): Direction | null {
    const validMoves = engine.getValidMoves();
    if (validMoves.length === 0) return null;

    return validMoves[Math.floor(Math.random() * validMoves.length)];
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
    this.rules = rules.sort((a, b) => b.priority - a.priority); // Higher priority first
    this.name = name || 'Conditional';
    this.fallback = new DirectionalPriorityStrategy();
  }

  selectMove(engine: GameEngine): Direction | null {
    const board = engine.getState().board;

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
    this.depth = Math.max(1, Math.min(depth, 3)); // Clamp to 1-3
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
    // Create a temporary engine to simulate
    const tempEngine = new GameEngine(engine.getSeed());
    const currentState = engine.getState();

    // Replay moves to get to current state
    // NOTE: This is simplified - in production you'd want to clone state more efficiently
    for (const move of currentState.moves) {
      const moveMap: Record<string, Direction> = { U: 'up', D: 'down', L: 'left', R: 'right' };
      tempEngine.move(moveMap[move]);
    }

    // Make the test move
    if (!tempEngine.move(direction)) {
      return -Infinity;
    }

    // If we've reached target depth, evaluate
    if (depth === 1) {
      return this.evaluateBoard(tempEngine.getState().board);
    }

    // Otherwise, recursively evaluate next moves (expectimax style)
    const directions: Direction[] = ['up', 'down', 'left', 'right'];
    let totalScore = 0;
    let validMoves = 0;

    for (const nextDir of directions) {
      if (tempEngine.isValidMove(nextDir)) {
        totalScore += this.evaluateMove(tempEngine, nextDir, depth - 1);
        validMoves++;
      }
    }

    return validMoves > 0 ? totalScore / validMoves : this.evaluateBoard(tempEngine.getState().board);
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

      // Evaluate the board after this move
      const tempEngine = new GameEngine(engine.getSeed());
      const currentState = engine.getState();

      // Replay to current state
      for (const move of currentState.moves) {
        const moveMap: Record<string, Direction> = { U: 'up', D: 'down', L: 'left', R: 'right' };
        tempEngine.move(moveMap[move]);
      }

      // Make the test move
      if (tempEngine.move(direction)) {
        const score = this.evaluateBoard(tempEngine.getState().board);
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
 * Strategy Factory
 */
export function createStrategy(type: string, params?: any): Strategy {
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
      return new DirectionalPriorityStrategy();
  }
}

/**
 * Run a complete game with a strategy
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
  const engine = new GameEngine(seed);
  let moveCount = 0;

  while (!engine.getState().gameOver && moveCount < maxMoves) {
    const move = strategy.selectMove(engine);
    if (!move) break;

    engine.move(move);
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
