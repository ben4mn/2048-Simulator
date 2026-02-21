/**
 * Custom Strategy Factory
 * Converts CustomRule configurations into executable Strategy instances
 */

import type { CustomRule } from './customRules';
import { BoardEvaluator, ConditionEvaluator } from './customRules';
import {
  PatternStrategy,
  ConditionalStrategy,
  LookAheadStrategy,
  WeightedStrategy,
  CustomStrategy,
  type Strategy,
} from './strategy';
import type { Board } from './types';

export class CustomStrategyFactory {
  /**
   * Create a strategy from custom rules
   */
  static createFromRules(rules: CustomRule[], name?: string): Strategy {
    const strategies: Strategy[] = [];

    for (const rule of rules) {
      const strategy = this.createStrategyFromRule(rule);
      if (strategy) {
        strategies.push(strategy);
      }
    }

    // If only one rule, return it directly
    if (strategies.length === 1) {
      return strategies[0];
    }

    // Otherwise, wrap in CustomStrategy
    return new CustomStrategy(strategies, name || 'Custom Strategy');
  }

  /**
   * Create a single strategy from a rule
   */
  private static createStrategyFromRule(rule: CustomRule): Strategy | null {
    switch (rule.type) {
      case 'pattern':
        return new PatternStrategy(rule.sequence);

      case 'conditional':
        return new ConditionalStrategy(
          [
            {
              condition: (board: Board) =>
                ConditionEvaluator.evaluate(board, rule.condition, rule.conditionParams),
              actions: rule.action,
              priority: rule.priority,
            },
          ],
          `Conditional: ${rule.condition}`
        );

      case 'lookahead':
        return new LookAheadStrategy(
          rule.depth,
          (board: Board) => BoardEvaluator.evaluateBoard(board, rule.evaluationWeights),
          `Look-Ahead (depth ${rule.depth})`
        );

      case 'weighted':
        return new WeightedStrategy(
          (board: Board) => BoardEvaluator.evaluateBoard(board, rule.weights),
          'Weighted Evaluation'
        );

      default:
        return null;
    }
  }
}
