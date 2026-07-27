/**
 * Custom rule definitions and evaluation system
 * Supports pattern-based, conditional, look-ahead, and weighted strategies
 */

import type { Board, Direction } from './types';
import { countEmptyTiles, countMerges, findMaxTile } from './boardUtils';

// ===== Rule Type Definitions =====

export type RuleType = 'evaluation' | 'pattern' | 'conditional' | 'lookahead' | 'weighted';

/** Maximum hard-override entries on an EvaluationRule (enforced by the validator). */
export const MAX_OVERRIDES = 3;

/**
 * A hard if-then entry on an EvaluationRule: when the condition holds, try
 * the action directions in order before falling back to weighted scoring.
 * Entries are checked in list order.
 */
export interface EvaluationOverride {
  when: ConditionType;
  params?: ConditionParams;
  action: Direction[];
}

/**
 * The single custom rule type users author (v2). Weighted scoring of each
 * candidate move, looking `depth` moves ahead (depth 1 scores the immediate
 * board — the old "weighted" rule), with optional hard overrides.
 */
export interface EvaluationRule {
  type: 'evaluation';
  weights: EvaluationWeights;
  depth: number; // 1-5
  overrides?: EvaluationOverride[];
}

export interface PatternRule {
  type: 'pattern';
  sequence: Direction[]; // e.g., ['left', 'down', 'right', 'down']
}

export interface ConditionalRule {
  type: 'conditional';
  condition: ConditionType;
  conditionParams?: ConditionParams;
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

export type CustomRule =
  | EvaluationRule
  | PatternRule
  | ConditionalRule
  | LookAheadRule
  | WeightedRule;

/** The rule types the app authors today; legacy types survive only as stored data. */
export type AuthoredRule = EvaluationRule | PatternRule;

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
    return countEmptyTiles(board);
  }

  /**
   * Get the maximum tile value and its position
   */
  static getMaxTile(board: Board): { value: number; row: number; col: number } {
    return findMaxTile(board);
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
      default:
        return false;
    }
  }

  /**
   * Count potential merges on the board.
   * Tiles separated only by empty cells can merge when the line slides
   * (e.g. [2, 0, 2] is one potential merge), so empties are looked through.
   */
  static countMerges(board: Board): number {
    return countMerges(board);
  }

  /**
   * Calculate monotonicity score (higher = more monotonic)
   * Measures how well tiles are arranged in ascending/descending order
   */
  static calculateMonotonicity(board: Board): number {
    return this.calculateRowMonotonicity(board) + this.calculateColMonotonicity(board);
  }

  /**
   * Row-only monotonicity score (max 12: 3 ordered pairs per row x 4 rows)
   */
  static calculateRowMonotonicity(board: Board): number {
    let score = 0;
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
    return score;
  }

  /**
   * Column-only monotonicity score (max 12: 3 ordered pairs per column x 4 columns)
   */
  static calculateColMonotonicity(board: Board): number {
    let score = 0;
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
        const monotonicity = BoardEvaluator.calculateRowMonotonicity(board);
        const threshold = params?.threshold;
        // Explicit threshold: strictly exceed it (so 0 means "any monotonicity").
        // Default: rows are fully monotonic (3 ordered pairs x 4 rows = 12).
        return threshold !== undefined ? monotonicity > threshold : monotonicity >= 12;
      }

      case 'monotonic_cols': {
        const monotonicity = BoardEvaluator.calculateColMonotonicity(board);
        const threshold = params?.threshold;
        return threshold !== undefined ? monotonicity > threshold : monotonicity >= 12;
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

  static validateEvaluationRule(rule: EvaluationRule): string | null {
    if (!rule.weights) {
      return 'Weights are required';
    }
    if (!Number.isFinite(rule.depth) || rule.depth < 1 || rule.depth > 5) {
      return 'Depth must be between 1 and 5';
    }
    if (rule.overrides) {
      if (rule.overrides.length > MAX_OVERRIDES) {
        return `At most ${MAX_OVERRIDES} overrides are allowed`;
      }
      const validDirections: Direction[] = ['up', 'down', 'left', 'right'];
      const validConditions: ConditionType[] = [
        'max_tile_in_corner',
        'max_tile_on_edge',
        'empty_cells_count',
        'merge_available',
        'monotonic_rows',
        'monotonic_cols',
      ];
      for (const override of rule.overrides) {
        if (!validConditions.includes(override.when)) {
          return `Unknown override condition: ${String(override.when)}`;
        }
        if (!override.action || override.action.length === 0) {
          return 'Override actions cannot be empty';
        }
        for (const direction of override.action) {
          if (!validDirections.includes(direction)) {
            return `Invalid direction: ${direction}`;
          }
        }
      }
    }
    return null;
  }

  static validateRule(rule: CustomRule): string | null {
    switch (rule.type) {
      case 'evaluation':
        return this.validateEvaluationRule(rule);
      case 'pattern':
        return this.validatePatternRule(rule);
      case 'conditional':
        return this.validateConditionalRule(rule);
      case 'lookahead':
        return this.validateLookAheadRule(rule);
      case 'weighted':
        return this.validateWeightedRule(rule);
      default: {
        // Exhaustiveness guard: adding a new CustomRule variant without a
        // case above makes this assignment a compile error.
        const unhandled: never = rule;
        void unhandled;
        return 'Unknown rule type';
      }
    }
  }
}

// ===== Weight normalization & legacy migration =====

/**
 * Fill missing/non-finite weight keys with 0 so a partial weights object
 * (e.g. from an AI response that omitted "smoothness") never rejects the
 * whole configuration.
 */
export function normalizeWeights(partial: Partial<EvaluationWeights> | undefined | null): EvaluationWeights {
  const keys: (keyof EvaluationWeights)[] = [
    'emptyTiles',
    'maxTileValue',
    'maxTileCorner',
    'mergeCount',
    'monotonicity',
    'smoothness',
  ];
  const weights = {} as EvaluationWeights;
  for (const key of keys) {
    const value = partial?.[key];
    weights[key] = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }
  return weights;
}

/**
 * Upgrade a stored rule list to the consolidated model (evaluation/pattern):
 * - evaluation / pattern: unchanged
 * - weighted:   evaluation at depth 1 (lossless — identical runtime)
 * - lookahead:  evaluation with the same depth and weights
 * - conditional: an override on an evaluation rule (DEFAULT_WEIGHTS, depth 1)
 * - multi-rule chains: folded into ONE evaluation rule — conditionals become
 *   overrides sorted by their old priority (capped at MAX_OVERRIDES), and the
 *   first evaluator in the chain supplies weights/depth. The old runtime made
 *   every rule after the first evaluator unreachable, so this is faithful.
 * Pattern-only strategies stay pattern.
 */
export function migrateCustomRules(rules: CustomRule[]): { rules: CustomRule[]; converted: boolean } {
  const isNew = rules.every((r) => r.type === 'evaluation' || r.type === 'pattern');
  if (isNew) {
    return { rules, converted: false };
  }

  const conditionals = rules.filter((r): r is ConditionalRule => r.type === 'conditional');
  const evaluator = rules.find(
    (r): r is EvaluationRule | LookAheadRule | WeightedRule =>
      r.type === 'evaluation' || r.type === 'lookahead' || r.type === 'weighted'
  );
  const firstPattern = rules.find((r): r is PatternRule => r.type === 'pattern');

  // Pattern-only legacy chain (pattern + conditionals with no evaluator):
  // the pattern was the terminal strategy, keep it if there's nothing else.
  if (!evaluator && conditionals.length === 0 && firstPattern) {
    return { rules: [firstPattern], converted: true };
  }

  const overrides: EvaluationOverride[] = [...conditionals]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_OVERRIDES)
    .map((rule) => ({
      when: rule.condition,
      ...(rule.conditionParams ? { params: rule.conditionParams } : {}),
      action: rule.action,
    }));

  const base: EvaluationRule =
    evaluator?.type === 'evaluation'
      ? evaluator
      : evaluator?.type === 'lookahead'
        ? { type: 'evaluation', weights: normalizeWeights(evaluator.evaluationWeights), depth: evaluator.depth }
        : evaluator?.type === 'weighted'
          ? { type: 'evaluation', weights: normalizeWeights(evaluator.weights), depth: 1 }
          : { type: 'evaluation', weights: { ...DEFAULT_WEIGHTS }, depth: 1 };

  const mergedOverrides = [...overrides, ...(base.overrides ?? [])].slice(0, MAX_OVERRIDES);

  return {
    rules: [
      {
        ...base,
        ...(mergedOverrides.length > 0 ? { overrides: mergedOverrides } : {}),
      },
    ],
    converted: true,
  };
}
