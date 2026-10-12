/**
 * Tests for the consolidated custom-strategy model:
 * - EvaluationRule (weights + depth + capped overrides) as the single
 *   authoring rule type
 * - migrateCustomRules: lossless upgrade of legacy weighted/lookahead/
 *   conditional/multi-rule configurations
 * - EvaluationStrategy runtime behavior (overrides first, then scoring)
 * - Validation with weight-key defaulting
 */

import { describe, it, expect } from 'vitest';
import { GameEngine } from '../gameEngine';
import {
  DEFAULT_WEIGHTS,
  MAX_OVERRIDES,
  RuleValidator,
  normalizeWeights,
  migrateCustomRules,
  type CustomRule,
  type EvaluationRule,
} from '../customRules';
import { CustomStrategyFactory } from '../customStrategyFactory';
import { EvaluationStrategy, createStrategy, playGameWithStrategy } from '../strategy';

/** Same board-injection pattern as moveEffects.test.ts. */
function setBoard(engine: GameEngine, board: number[][]) {
  (engine as unknown as { state: { board: number[][] } }).state.board = board.map((row) => [
    ...row,
  ]);
}

const evalRule = (extra: Partial<EvaluationRule> = {}): EvaluationRule => ({
  type: 'evaluation',
  weights: DEFAULT_WEIGHTS,
  depth: 1,
  ...extra,
});

describe('EvaluationRule validation', () => {
  it('accepts a minimal evaluation rule', () => {
    expect(RuleValidator.validateRule(evalRule())).toBeNull();
  });

  it('rejects out-of-range depth', () => {
    expect(RuleValidator.validateRule(evalRule({ depth: 0 }))).not.toBeNull();
    expect(RuleValidator.validateRule(evalRule({ depth: 6 }))).not.toBeNull();
  });

  it('enforces the override cap in the validator, not just the UI', () => {
    const override = { when: 'merge_available' as const, action: ['left' as const] };
    expect(
      RuleValidator.validateRule(evalRule({ overrides: Array(MAX_OVERRIDES).fill(override) }))
    ).toBeNull();
    expect(
      RuleValidator.validateRule(evalRule({ overrides: Array(MAX_OVERRIDES + 1).fill(override) }))
    ).not.toBeNull();
  });

  it('rejects overrides with empty actions or unknown conditions', () => {
    expect(
      RuleValidator.validateRule(
        evalRule({ overrides: [{ when: 'merge_available', action: [] }] })
      )
    ).not.toBeNull();
    expect(
      RuleValidator.validateRule(
        evalRule({ overrides: [{ when: 'not_a_condition' as never, action: ['left'] }] })
      )
    ).not.toBeNull();
  });
});

describe('normalizeWeights', () => {
  it('defaults missing weight keys to 0 instead of rejecting', () => {
    const weights = normalizeWeights({ emptyTiles: 3 });
    expect(weights.emptyTiles).toBe(3);
    expect(weights.smoothness).toBe(0);
    expect(weights.monotonicity).toBe(0);
  });

  it('drops non-finite values to 0', () => {
    const weights = normalizeWeights({ emptyTiles: Number.NaN, mergeCount: Infinity });
    expect(weights.emptyTiles).toBe(0);
    expect(weights.mergeCount).toBe(0);
  });
});

describe('migrateCustomRules', () => {
  it('passes through evaluation and pattern rules unchanged', () => {
    const rules: CustomRule[] = [evalRule()];
    const { rules: migrated, converted } = migrateCustomRules(rules);
    expect(migrated).toEqual(rules);
    expect(converted).toBe(false);

    const pattern: CustomRule[] = [{ type: 'pattern', sequence: ['left', 'down'] }];
    expect(migrateCustomRules(pattern)).toEqual({ rules: pattern, converted: false });
  });

  it('migrates weighted → evaluation at depth 1 (lossless)', () => {
    const { rules, converted } = migrateCustomRules([
      { type: 'weighted', weights: DEFAULT_WEIGHTS },
    ]);
    expect(converted).toBe(true);
    expect(rules).toEqual([evalRule()]);
  });

  it('migrates lookahead → evaluation preserving depth and weights', () => {
    const { rules, converted } = migrateCustomRules([
      { type: 'lookahead', depth: 3, evaluationWeights: DEFAULT_WEIGHTS },
    ]);
    expect(converted).toBe(true);
    expect(rules).toEqual([evalRule({ depth: 3 })]);
  });

  it('migrates conditional → evaluation override with default weights', () => {
    const { rules, converted } = migrateCustomRules([
      {
        type: 'conditional',
        condition: 'max_tile_in_corner',
        conditionParams: { corner: 'bottom-left' },
        action: ['left', 'down'],
        priority: 10,
      },
    ]);
    expect(converted).toBe(true);
    expect(rules).toHaveLength(1);
    const rule = rules[0] as EvaluationRule;
    expect(rule.type).toBe('evaluation');
    expect(rule.overrides).toEqual([
      {
        when: 'max_tile_in_corner',
        params: { corner: 'bottom-left' },
        action: ['left', 'down'],
      },
    ]);
  });

  it('folds a multi-rule legacy chain into one evaluation rule (conditionals sorted by priority, capped)', () => {
    const { rules, converted } = migrateCustomRules([
      { type: 'conditional', condition: 'merge_available', action: ['up'], priority: 1 },
      { type: 'conditional', condition: 'max_tile_on_edge', action: ['right'], priority: 5 },
      { type: 'lookahead', depth: 2, evaluationWeights: DEFAULT_WEIGHTS },
      { type: 'conditional', condition: 'empty_cells_count', action: ['down'], priority: 3 },
      { type: 'conditional', condition: 'monotonic_rows', action: ['left'], priority: 0 },
    ]);
    expect(converted).toBe(true);
    expect(rules).toHaveLength(1);
    const rule = rules[0] as EvaluationRule;
    expect(rule.depth).toBe(2);
    expect(rule.overrides).toHaveLength(MAX_OVERRIDES);
    // Highest priority first; the lowest-priority conditional is dropped by the cap.
    expect(rule.overrides!.map((o) => o.when)).toEqual([
      'max_tile_on_edge',
      'empty_cells_count',
      'merge_available',
    ]);
  });
});

describe('EvaluationStrategy runtime', () => {
  it('plays a full deterministic game (same seed → identical outcome)', () => {
    const make = () => CustomStrategyFactory.createFromRules([evalRule()]);
    const a = playGameWithStrategy('A7X9K2M1', make());
    const b = playGameWithStrategy('A7X9K2M1', make());
    expect(a).toEqual(b);
    expect(a.moveCount).toBeGreaterThan(0);
  });

  it('override wins over scoring when its condition holds and action is valid', () => {
    // merge_available is true on this constructed board; the override should
    // force "left" regardless of what the evaluator prefers.
    const strategy = new EvaluationStrategy({
      type: 'evaluation',
      weights: { ...DEFAULT_WEIGHTS },
      depth: 1,
      overrides: [{ when: 'merge_available', action: ['left'] }],
    });
    const engine = new GameEngine('A7X9K2M1');
    setBoard(engine, [
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 4],
    ]);
    expect(strategy.selectMove(engine)).toBe('left');
  });

  it('falls through to weighted scoring when no override matches', () => {
    const strategy = new EvaluationStrategy({
      type: 'evaluation',
      weights: DEFAULT_WEIGHTS,
      depth: 1,
      overrides: [{ when: 'max_tile_in_corner', params: { corner: 'top-right' }, action: ['up'] }],
    });
    const engine = new GameEngine('B2C4D6E8');
    // Max tile placed away from top-right so the override never fires.
    setBoard(engine, [
      [0, 0, 0, 0],
      [0, 2, 0, 0],
      [0, 0, 2, 0],
      [8, 0, 0, 0],
    ]);
    const move = strategy.selectMove(engine);
    expect(move).not.toBeNull();
  });

  it('depth is honored 1-5 via the factory', () => {
    for (const depth of [1, 2, 3, 4, 5]) {
      const strategy = CustomStrategyFactory.createFromRules([evalRule({ depth })]);
      const engine = new GameEngine('C3D5E7F9');
      expect(strategy.selectMove(engine)).not.toBeNull();
    }
  });

  it('createStrategy factory exposes evaluation and no longer weighted', () => {
    expect(createStrategy('evaluation').id).toBe('evaluation');
    expect(() => createStrategy('weighted')).toThrow();
  });

  it('factory migrates legacy rules transparently (worker path)', () => {
    const strategy = CustomStrategyFactory.createFromRules([
      { type: 'weighted', weights: DEFAULT_WEIGHTS },
    ]);
    expect(strategy.id).toBe('evaluation');
    const outcome = playGameWithStrategy('D4E6F8A2', strategy);
    expect(outcome.moveCount).toBeGreaterThan(0);
  });
});


describe('malformed custom strategy runtime guards', () => {
  it('defaults omitted evaluation weights so a partial config still chooses a valid move', () => {
    const strategy = CustomStrategyFactory.createFromRules([{
      type: 'evaluation', depth: 1, weights: { emptyTiles: 3 } as EvaluationRule['weights'],
    }]);
    const engine = new GameEngine('PARTIAL-WEIGHTS');
    const move = strategy.selectMove(engine);
    expect(move).not.toBeNull();
    expect(engine.isValidMove(move!)).toBe(true);
  });

  it('rejects unknown rule types instead of silently turning them into a default evaluator', () => {
    expect(() => CustomStrategyFactory.createFromRules([{ type: 'typo' } as unknown as CustomRule])).toThrow(/Unknown rule/);
  });

  it('rejects malformed override actions and invalid depth before running a game', () => {
    expect(() => CustomStrategyFactory.createFromRules([evalRule({ depth: Infinity })])).toThrow(/Depth/);
    expect(() => CustomStrategyFactory.createFromRules([evalRule({ overrides: [{ when: 'merge_available', action: [] }] })])).toThrow(/actions/);
  });

  it('rejects an empty built-in move pattern', () => {
    expect(() => createStrategy('pattern', { pattern: [] })).toThrow(/at least one valid direction/);
  });
});
