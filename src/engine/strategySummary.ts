/**
 * Deterministic plain-English descriptions of custom strategies.
 * Derived ONLY from the rule configuration — never from AI prose — so the
 * summary always matches what the simulation actually runs.
 */

import type { CustomRule, EvaluationRule, EvaluationWeights } from './customRules';
import { migrateCustomRules } from './customRules';

const WEIGHT_TRAITS: Record<keyof EvaluationWeights, { phrase: string; nameWord: string }> = {
  emptyTiles: { phrase: 'keeping cells open', nameWord: 'Open Board' },
  maxTileValue: { phrase: 'growing the biggest tile', nameWord: 'Tile Grower' },
  maxTileCorner: { phrase: 'keeping the biggest tile in a corner', nameWord: 'Corner Keeper' },
  mergeCount: { phrase: 'setting up merges', nameWord: 'Merge Hunter' },
  monotonicity: { phrase: 'keeping rows and columns ordered', nameWord: 'Orderly' },
  smoothness: { phrase: 'keeping neighboring tiles similar', nameWord: 'Smooth Operator' },
};

const CONDITION_PHRASES: Record<string, string> = {
  max_tile_in_corner: 'the biggest tile is in the corner',
  max_tile_on_edge: 'the biggest tile is on an edge',
  empty_cells_count: 'there are enough empty cells',
  merge_available: 'a merge is available',
  monotonic_rows: 'rows are well ordered',
  monotonic_cols: 'columns are well ordered',
};

function topWeights(weights: EvaluationWeights, count: number): (keyof EvaluationWeights)[] {
  return (Object.keys(WEIGHT_TRAITS) as (keyof EvaluationWeights)[])
    .filter((key) => weights[key] > 0)
    .sort((a, b) => weights[b] - weights[a])
    .slice(0, count);
}

function describeEvaluation(rule: EvaluationRule): string {
  const parts: string[] = [];

  for (const override of rule.overrides ?? []) {
    const condition = CONDITION_PHRASES[override.when] ?? override.when;
    const cornerNote = override.params?.corner ? ` (${override.params.corner})` : '';
    parts.push(
      `When ${condition}${cornerNote}, move ${override.action.join(' then ')}.`
    );
  }

  const traits = topWeights(rule.weights, 3).map((key) => WEIGHT_TRAITS[key].phrase);
  const focus =
    traits.length > 0
      ? `Otherwise, picks the move that scores best on ${traits.join(', ')}`
      : 'Otherwise, picks any valid move';
  const depthNote =
    rule.depth > 1 ? `, looking ${rule.depth} moves ahead` : ', judging the immediate board';
  parts.push(`${focus}${depthNote}.`);

  return parts.join(' ');
}

export function summarizeRules(rules: CustomRule[]): string {
  if (rules.length === 0) return 'No rules configured yet.';

  const { rules: migrated } = migrateCustomRules(rules);
  const rule = migrated[0];

  if (rule.type === 'pattern') {
    return `Repeats the sequence ${rule.sequence.join(' → ')}, skipping blocked moves.`;
  }
  if (rule.type === 'evaluation') {
    return describeEvaluation(rule);
  }
  return 'Custom strategy.';
}

/** Short deterministic display name for an unnamed strategy. */
export function autoName(rules: CustomRule[]): string {
  const { rules: migrated } = migrateCustomRules(rules);
  const rule = migrated[0];
  if (!rule) return 'Custom Strategy';

  if (rule.type === 'pattern') {
    const initials = rule.sequence.map((d) => d[0].toUpperCase()).join('-');
    return `Repeat ${initials}`;
  }
  if (rule.type === 'evaluation') {
    const top = topWeights(rule.weights, 1)[0];
    const base = top ? WEIGHT_TRAITS[top].nameWord : 'Balanced';
    return rule.depth > 1 ? `${base} (depth ${rule.depth})` : base;
  }
  return 'Custom Strategy';
}
