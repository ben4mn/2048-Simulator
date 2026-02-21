/**
 * Custom rule definitions and evaluation system
 * Supports pattern-based, conditional, look-ahead, and weighted strategies
 */

import type { Board, Direction } from './types';

// ===== Rule Type Definitions =====

export type RuleType = 'pattern' | 'conditional' | 'lookahead' | 'weighted';

export interface PatternRule {
  type: 'pattern';
  sequence: Direction[]; // e.g., ['left', 'down', 'right', 'down']
}

export interface ConditionalRule {
  type: 'conditional';
  condition: ConditionType;
  conditionParams?: any;
  action: Direction[];
  priority: number; // Higher = evaluated first
}

export interface LookAheadRule {
  type: 'lookahead';
  depth: number; // How many moves to look ahead (1-3 recommended)
  evaluationWeights: EvaluationWeights;
}

export interface WeightedRule {
  type: 'weighted';
  weights: EvaluationWeights;
}

export type CustomRule = PatternRule | ConditionalRule | LookAheadRule | WeightedRule;

// ===== Condition Types =====

export type ConditionType =
  | 'max_tile_in_corner'
  | 'max_tile_on_edge'
  | 'empty_cells_count'
  | 'merge_available'
  | 'monotonic_rows'
  | 'monotonic_cols';

export interface ConditionParams {
  corner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  threshold?: number;
  direction?: 'horizontal' | 'vertical';
}

// ===== Evaluation Weights =====

export interface EvaluationWeights {
  emptyTiles: number; // Weight for number of empty cells
  maxTileValue: number; // Weight for highest tile value
  maxTileCorner: number; // Weight for max tile being in corner
  mergeCount: number; // Weight for number of possible merges
  monotonicity: number; // Weight for monotonic rows/columns
  smoothness: number; // Weight for adjacent tile similarity
}

export const DEFAULT_WEIGHTS: EvaluationWeights = {
  emptyTiles: 2.7,
  maxTileValue: 1.0,
  maxTileCorner: 4.0,
  mergeCount: 1.5,
  monotonicity: 3.0,
  smoothness: 0.5,
};

// ===== Board Evaluation Functions =====

export class BoardEvaluator {
  /**
   * Count empty tiles on the board
   */
  static countEmptyTiles(board: Board): number {
    let count = 0;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        if (board[row][col] === 0) count++;
      }
    }
    return count;
  }

  /**
   * Get the maximum tile value and its position
   */
  static getMaxTile(board: Board): { value: number; row: number; col: number } {
    let maxValue = 0;
    let maxRow = 0;
    let maxCol = 0;

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        if (board[row][col] > maxValue) {
          maxValue = board[row][col];
          maxRow = row;
          maxCol = col;
        }
      }
    }

    return { value: maxValue, row: maxRow, col: maxCol };
  }

  /**
   * Check if max tile is in a corner
   */
  static isMaxTileInCorner(board: Board): boolean {
    const { row, col } = this.getMaxTile(board);
    return (
      (row === 0 && col === 0) ||
      (row === 0 && col === 3) ||
      (row === 3 && col === 0) ||
      (row === 3 && col === 3)
    );
  }

  /**
   * Check if max tile is in a specific corner
   */
  static isMaxTileInSpecificCorner(
    board: Board,
    corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  ): boolean {
    const { row, col } = this.getMaxTile(board);
    switch (corner) {
      case 'top-left':
        return row === 0 && col === 0;
      case 'top-right':
        return row === 0 && col === 3;
      case 'bottom-left':
        return row === 3 && col === 0;
      case 'bottom-right':
        return row === 3 && col === 3;
    }
  }

  /**
   * Count potential merges on the board
   */
  static countMerges(board: Board): number {
    let count = 0;

    // Horizontal merges
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        if (board[row][col] !== 0 && board[row][col] === board[row][col + 1]) {
          count++;
        }
      }
    }

    // Vertical merges
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 3; row++) {
        if (board[row][col] !== 0 && board[row][col] === board[row + 1][col]) {
          count++;
        }
      }
    }

    return count;
  }

  /**
   * Calculate monotonicity score (higher = more monotonic)
   * Measures how well tiles are arranged in ascending/descending order
   */
  static calculateMonotonicity(board: Board): number {
    let score = 0;

    // Check rows
    for (let row = 0; row < 4; row++) {
      let increasing = 0;
      let decreasing = 0;
      for (let col = 0; col < 3; col++) {
        const current = board[row][col];
        const next = board[row][col + 1];
        if (current === 0 || next === 0) continue;

        if (current < next) increasing++;
        if (current > next) decreasing++;
      }
      score += Math.max(increasing, decreasing);
    }

    // Check columns
    for (let col = 0; col < 4; col++) {
      let increasing = 0;
      let decreasing = 0;
      for (let row = 0; row < 3; row++) {
        const current = board[row][col];
        const next = board[row + 1][col];
        if (current === 0 || next === 0) continue;

        if (current < next) increasing++;
        if (current > next) decreasing++;
      }
      score += Math.max(increasing, decreasing);
    }

    return score;
  }

  /**
   * Calculate smoothness score (higher = smoother)
   * Measures how similar adjacent tiles are
   */
  static calculateSmoothness(board: Board): number {
    let smoothness = 0;

    // Horizontal smoothness
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        const current = board[row][col];
        const next = board[row][col + 1];
        if (current === 0 || next === 0) continue;

        smoothness -= Math.abs(Math.log2(current) - Math.log2(next));
      }
    }

    // Vertical smoothness
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 3; row++) {
        const current = board[row][col];
        const next = board[row + 1][col];
        if (current === 0 || next === 0) continue;

        smoothness -= Math.abs(Math.log2(current) - Math.log2(next));
      }
    }

    return smoothness;
  }

  /**
   * Evaluate board with weighted criteria
   */
  static evaluateBoard(board: Board, weights: EvaluationWeights): number {
    const emptyTiles = this.countEmptyTiles(board);
    const maxTile = this.getMaxTile(board);
    const maxTileInCorner = this.isMaxTileInCorner(board) ? 1 : 0;
    const mergeCount = this.countMerges(board);
    const monotonicity = this.calculateMonotonicity(board);
    const smoothness = this.calculateSmoothness(board);

    return (
      weights.emptyTiles * emptyTiles +
      weights.maxTileValue * Math.log2(maxTile.value || 1) +
      weights.maxTileCorner * maxTileInCorner * 100 +
      weights.mergeCount * mergeCount * 10 +
      weights.monotonicity * monotonicity +
      weights.smoothness * smoothness
    );
  }
}

// ===== Condition Evaluators =====

export class ConditionEvaluator {
  static evaluate(
    board: Board,
    condition: ConditionType,
    params?: ConditionParams
  ): boolean {
    switch (condition) {
      case 'max_tile_in_corner':
        if (params?.corner) {
          return BoardEvaluator.isMaxTileInSpecificCorner(board, params.corner);
        }
        return BoardEvaluator.isMaxTileInCorner(board);

      case 'max_tile_on_edge': {
        const { row, col } = BoardEvaluator.getMaxTile(board);
        return row === 0 || row === 3 || col === 0 || col === 3;
      }

      case 'empty_cells_count': {
        const count = BoardEvaluator.countEmptyTiles(board);
        return params?.threshold !== undefined ? count >= params.threshold : count > 2;
      }

      case 'merge_available': {
        const merges = BoardEvaluator.countMerges(board);
        return merges > 0;
      }

      case 'monotonic_rows': {
        const monotonicity = BoardEvaluator.calculateMonotonicity(board);
        return monotonicity > (params?.threshold || 12); // Arbitrary threshold
      }

      case 'monotonic_cols': {
        const monotonicity = BoardEvaluator.calculateMonotonicity(board);
        return monotonicity > (params?.threshold || 12);
      }

      default:
        return false;
    }
  }
}

// ===== Rule Validators =====

export class RuleValidator {
  static validatePatternRule(rule: PatternRule): string | null {
    if (!rule.sequence || rule.sequence.length === 0) {
      return 'Pattern sequence cannot be empty';
    }

    const validDirections: Direction[] = ['up', 'down', 'left', 'right'];
    for (const direction of rule.sequence) {
      if (!validDirections.includes(direction)) {
        return `Invalid direction: ${direction}`;
      }
    }

    return null; // Valid
  }

  static validateConditionalRule(rule: ConditionalRule): string | null {
    if (!rule.condition) {
      return 'Condition type is required';
    }

    if (!rule.action || rule.action.length === 0) {
      return 'Action directions cannot be empty';
    }

    const validDirections: Direction[] = ['up', 'down', 'left', 'right'];
    for (const direction of rule.action) {
      if (!validDirections.includes(direction)) {
        return `Invalid direction: ${direction}`;
      }
    }

    return null;
  }

  static validateLookAheadRule(rule: LookAheadRule): string | null {
    if (rule.depth < 1 || rule.depth > 5) {
      return 'Look-ahead depth must be between 1 and 5';
    }

    if (!rule.evaluationWeights) {
      return 'Evaluation weights are required';
    }

    return null;
  }

  static validateWeightedRule(rule: WeightedRule): string | null {
    if (!rule.weights) {
      return 'Weights are required';
    }

    return null;
  }

  static validateRule(rule: CustomRule): string | null {
    switch (rule.type) {
      case 'pattern':
        return this.validatePatternRule(rule);
      case 'conditional':
        return this.validateConditionalRule(rule);
      case 'lookahead':
        return this.validateLookAheadRule(rule);
      case 'weighted':
        return this.validateWeightedRule(rule);
      default:
        return 'Unknown rule type';
    }
  }
}
