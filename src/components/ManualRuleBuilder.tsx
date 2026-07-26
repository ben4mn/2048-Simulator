/**
 * Manual Rule Builder - Form-based rule creation interface
 */

import { useState } from 'react';
import type {
  CustomRule,
  RuleType,
  ConditionType,
  EvaluationWeights,
} from '../engine/customRules';
import { DEFAULT_WEIGHTS, RuleValidator } from '../engine/customRules';
import type { Direction } from '../engine/types';
import { PatternRuleForm } from './rule-forms/PatternRuleForm';
import { ConditionalRuleForm } from './rule-forms/ConditionalRuleForm';
import { LookAheadRuleForm } from './rule-forms/LookAheadRuleForm';
import { WeightedRuleForm } from './rule-forms/WeightedRuleForm';

export interface ManualRuleBuilderProps {
  rules: CustomRule[];
  onRulesChange: (rules: CustomRule[]) => void;
}

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface PatternStep {
  id: string;
  direction: Direction;
}

const makeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;

// Stable per-rule keys that survive reordering: since `rules` doesn't carry
// an id field (CustomRule is a plain config union), cache an id per rule
// object reference at module scope. Reordering swaps the same references, so
// ids move with their rule; only genuinely new rule objects get a new id.
const ruleIds = new WeakMap<CustomRule, string>();
const getRuleId = (rule: CustomRule) => {
  let id = ruleIds.get(rule);
  if (!id) {
    id = makeId();
    ruleIds.set(rule, id);
  }
  return id;
};

export function ManualRuleBuilder({ rules, onRulesChange }: ManualRuleBuilderProps) {
  const [selectedType, setSelectedType] = useState<RuleType>('pattern');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [patternSteps, setPatternSteps] = useState<PatternStep[]>([
    { id: makeId(), direction: 'left' },
    { id: makeId(), direction: 'down' },
  ]);
  const [conditionType, setConditionType] = useState<ConditionType>('max_tile_in_corner');
  const [conditionCorner, setConditionCorner] = useState<Corner>('bottom-left');
  const [conditionThreshold, setConditionThreshold] = useState(2);
  const [conditionActions, setConditionActions] = useState<Direction[]>(['left', 'down']);
  const [conditionPriority, setConditionPriority] = useState(10);
  const [lookAheadDepth, setLookAheadDepth] = useState(2);
  const [lookAheadWeights, setLookAheadWeights] = useState<EvaluationWeights>(DEFAULT_WEIGHTS);
  const [weightedWeights, setWeightedWeights] = useState<EvaluationWeights>(DEFAULT_WEIGHTS);

  const handleAddRule = () => {
    let newRule: CustomRule | null = null;

    switch (selectedType) {
      case 'pattern':
        newRule = { type: 'pattern', sequence: patternSteps.map((step) => step.direction) };
        break;

      case 'conditional':
        newRule = {
          type: 'conditional',
          condition: conditionType,
          conditionParams:
            conditionType === 'max_tile_in_corner'
              ? { corner: conditionCorner }
              : conditionType === 'empty_cells_count' ||
                conditionType === 'monotonic_rows' ||
                conditionType === 'monotonic_cols'
              ? { threshold: conditionThreshold }
              : undefined,
          action: [...conditionActions],
          priority: conditionPriority,
        };
        break;

      case 'lookahead':
        newRule = {
          type: 'lookahead',
          depth: lookAheadDepth,
          evaluationWeights: { ...lookAheadWeights },
        };
        break;

      case 'weighted':
        newRule = {
          type: 'weighted',
          weights: { ...weightedWeights },
        };
        break;
    }

    if (newRule) {
      const validationError = RuleValidator.validateRule(newRule);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError(null);
      if (editingIndex !== null) {
        const updatedRules = [...rules];
        updatedRules[editingIndex] = newRule;
        onRulesChange(updatedRules);
        setEditingIndex(null);
      } else {
        onRulesChange([...rules, newRule]);
      }
    }
  };

  const handleRemoveRule = (index: number) => {
    onRulesChange(rules.filter((_, i) => i !== index));
  };

  const handleMoveRule = (index: number, direction: 'up' | 'down') => {
    const newRules = [...rules];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex >= 0 && targetIndex < rules.length) {
      [newRules[index], newRules[targetIndex]] = [newRules[targetIndex], newRules[index]];
      onRulesChange(newRules);
    }
  };

  const toggleConditionAction = (direction: Direction) => {
    setConditionActions((list) =>
      list.includes(direction) ? list.filter((d) => d !== direction) : [...list, direction]
    );
  };

  const appendPatternStep = (direction: Direction) => {
    setPatternSteps((steps) => [...steps, { id: makeId(), direction }]);
  };

  const removePatternStepAt = (index: number) => {
    setPatternSteps((steps) => steps.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-text-muted mb-2">Rule Type</label>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as RuleType)}
          className="w-full px-4 py-2 border border-dark-border bg-surface-raised text-text-primary rounded-lg focus:ring-2 focus:ring-accent"
        >
          <option value="pattern">Fixed Pattern</option>
          <option value="conditional">Conditional</option>
          <option value="lookahead">Look-Ahead Evaluation</option>
          <option value="weighted">Weighted Scoring</option>
        </select>
      </div>

      {selectedType === 'pattern' && (
        <PatternRuleForm
          sequence={patternSteps.map((step) => step.direction)}
          onAppend={appendPatternStep}
          onRemoveAt={removePatternStepAt}
        />
      )}

      {selectedType === 'conditional' && (
        <ConditionalRuleForm
          conditionType={conditionType}
          onConditionTypeChange={setConditionType}
          corner={conditionCorner}
          onCornerChange={setConditionCorner}
          threshold={conditionThreshold}
          onThresholdChange={setConditionThreshold}
          actions={conditionActions}
          onToggleAction={toggleConditionAction}
          priority={conditionPriority}
          onPriorityChange={setConditionPriority}
        />
      )}

      {selectedType === 'lookahead' && (
        <LookAheadRuleForm
          depth={lookAheadDepth}
          onDepthChange={setLookAheadDepth}
          weights={lookAheadWeights}
          onWeightsChange={setLookAheadWeights}
        />
      )}

      {selectedType === 'weighted' && (
        <WeightedRuleForm weights={weightedWeights} onWeightsChange={setWeightedWeights} />
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <button
        onClick={handleAddRule}
        className="w-full px-6 py-3 bg-accent text-gray-950 font-semibold rounded-lg hover:bg-accent-strong transition-colors"
      >
        {editingIndex !== null ? 'Update Rule' : 'Add Rule'}
      </button>

      {rules.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-medium text-text-primary mb-4">Rules (in priority order)</h3>
          <div className="space-y-2">
            {rules.map((rule, index) => (
              <div
                key={getRuleId(rule)}
                className="flex items-center gap-3 p-4 bg-surface-raised rounded-lg border border-dark-border"
              >
                <span className="flex-1">
                  <span className="font-medium text-text-primary capitalize">{rule.type}</span>
                  <span className="text-text-muted">
                    {rule.type === 'pattern' && ` - ${rule.sequence.join(' → ')}`}
                    {rule.type === 'conditional' && ` - ${rule.condition} (priority ${rule.priority})`}
                    {rule.type === 'lookahead' && ` - Depth ${rule.depth}`}
                    {rule.type === 'weighted' && ' - Weighted scoring'}
                  </span>
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleMoveRule(index, 'up')}
                    disabled={index === 0}
                    aria-label={`Move rule ${index + 1} up`}
                    className="px-2 py-1 text-sm bg-surface-elevated rounded-sm border border-dark-border hover:bg-surface disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMoveRule(index, 'down')}
                    disabled={index === rules.length - 1}
                    aria-label={`Move rule ${index + 1} down`}
                    className="px-2 py-1 text-sm bg-surface-elevated rounded-sm border border-dark-border hover:bg-surface disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => handleRemoveRule(index)}
                    aria-label={`Remove rule ${index + 1}`}
                    className="px-3 py-1 text-sm bg-red-500/20 text-red-200 rounded-sm hover:bg-red-500/30"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ManualRuleBuilder;
