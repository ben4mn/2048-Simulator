/**
 * Custom Strategy Factory
 * Converts stored CustomRule configurations into executable Strategy
 * instances. Legacy rule lists (weighted / lookahead / conditional /
 * multi-rule chains) are migrated to the consolidated evaluation model
 * first, so the worker runs every strategy through the same runtime.
 */

import type { CustomRule } from './customRules';
import { migrateCustomRules } from './customRules';
import { EvaluationStrategy, PatternStrategy, type Strategy } from './strategy';

export class CustomStrategyFactory {
  /**
   * Create a strategy from custom rules. After migration a strategy is
   * exactly one rule (evaluation or pattern); extra rules are ignored.
   */
  static createFromRules(rules: CustomRule[], name?: string): Strategy {
    const { rules: migrated } = migrateCustomRules(rules);
    const rule = migrated[0];

    if (!rule) {
      throw new Error('Custom strategy has no rules');
    }

    switch (rule.type) {
      case 'pattern':
        return new PatternStrategy(rule.sequence, name);
      case 'evaluation':
        return new EvaluationStrategy(rule, name);
      default:
        throw new Error(`Unsupported rule type after migration: ${rule.type}`);
    }
  }
}
