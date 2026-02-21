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
  score: number;
  moved: boolean; // Did the board change?
  merged: number; // Points gained from merges
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

export interface StrategyConfig {
  id: string;
  name: string;
  type: 'directional' | 'corner_anchor' | 'hybrid' | 'random' | 'custom_rule';
  params: Record<string, any>;
}

// ---- Rule Set System ----

export type BoardCheck =
  | { type: 'highest_tile_in'; positions: [number, number][] }
  | { type: 'merge_available'; direction: Direction }
  | { type: 'empty_cells_above'; threshold: number }
  | { type: 'empty_cells_below'; threshold: number };

export type RuleCondition =
  | { type: 'always' }
  | { type: 'fallback'; whenUnavailable: Direction[] }
  | { type: 'board'; check: BoardCheck };

export interface Rule {
  id: string;
  direction: Direction;
  condition: RuleCondition;
  priority: number;
}

export interface RuleSet {
  id: string;
  name: string;
  description?: string;
  rules: Rule[];
  fallbackDirection?: Direction;
  source: 'manual' | 'arrow_keys' | 'llm';
}
