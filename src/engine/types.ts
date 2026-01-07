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
  type: 'directional' | 'corner_anchor' | 'hybrid' | 'random';
  params: Record<string, any>;
}
