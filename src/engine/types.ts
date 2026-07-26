/**
 * Core types for the 2048 game engine
 */

export type Direction = 'up' | 'down' | 'left' | 'right';
export type DirectionShort = 'U' | 'D' | 'L' | 'R';

export type Tile = number; // 0 = empty, 2, 4, 8, 16, etc.
export type Board = Tile[][]; // 4x4 grid

export interface Position {
  row: number;
  col: number;
}

export interface GameState {
  board: Board;
  score: number;
  moves: DirectionShort[];
  gameOver: boolean;
  won: boolean; // Reached 2048
  maxTile: number;
}

export interface MoveResult {
  board: Board;
  score: number; // Points gained from merges
  moved: boolean; // Did the board change?
}

export interface GameResult {
  id: string;
  seed: string;
  strategyId: string;
  batchId?: string;
  moves: string; // e.g., "LDLDRRUU..."
  finalScore: number;
  maxTile: number;
  moveCount: number;
  result: 'win' | 'loss';
  timestamp: number;
  durationMs: number;
}

export type CornerPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** Rule shape consumed by ConditionalStrategy. */
export interface ConditionalStrategyRule {
  condition: (board: Board) => boolean;
  actions: Direction[];
  priority: number;
}

/** Minimal structural view of a Strategy (avoids a runtime import cycle). */
interface StrategyLike {
  id: string;
  name: string;
}

/**
 * Discriminated union of strategy configurations, matching the types and
 * params accepted by createStrategy() in strategy.ts.
 */
export type StrategyConfig =
  | { id: string; name: string; type: 'directional_priority'; params?: { priority?: Direction[] } }
  | { id: string; name: string; type: 'corner_anchor'; params?: { corner?: CornerPosition } }
  | { id: string; name: string; type: 'merge_max' }
  | { id: string; name: string; type: 'random' }
  | { id: string; name: string; type: 'pattern'; params?: { pattern?: Direction[]; name?: string } }
  | { id: string; name: string; type: 'conditional'; params?: { rules?: ConditionalStrategyRule[]; name?: string } }
  | { id: string; name: string; type: 'lookahead'; params?: { depth?: number; evaluateBoard?: (board: Board) => number; name?: string } }
  | { id: string; name: string; type: 'weighted'; params?: { evaluateBoard?: (board: Board) => number; name?: string } }
  | { id: string; name: string; type: 'custom'; params?: { strategies?: StrategyLike[]; name?: string } };
