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

export interface ManualRuleBuilderProps {
  rules: CustomRule[];
  onRulesChange: (rules: CustomRule[]) => void;
}

const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];
const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
const CONDITIONS: Array<{ value: ConditionType; label: string }> = [
  { value: 'max_tile_in_corner', label: 'Max tile in corner' },
  { value: 'max_tile_on_edge', label: 'Max tile on edge' },
  { value: 'empty_cells_count', label: 'Empty cells count' },
  { value: 'merge_available', label: 'Merge available' },
  { value: 'monotonic_rows', label: 'Monotonic rows' },
  { value: 'monotonic_cols', label: 'Monotonic columns' },
];

export function ManualRuleBuilder({ rules, onRulesChange }: ManualRuleBuilderProps) {
  const [selectedType, setSelectedType] = useState<RuleType>('pattern');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const [patternSequence, setPatternSequence] = useState<Direction[]>(['left', 'down']);
  const [conditionType, setConditionType] = useState<ConditionType>('max_tile_in_corner');
  const [conditionCorner, setConditionCorner] = useState<typeof CORNERS[number]>('bottom-left');
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
        newRule = { type: 'pattern', sequence: [...patternSequence] };
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
        alert(validationError);
        return;
      }

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

  const toggleDirection = (direction: Direction, list: Direction[], setter: (d: Direction[]) => void) => {
    if (list.includes(direction)) {
      setter(list.filter((d) => d !== direction));
    } else {
      setter([...list, direction]);
    }
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
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">
              Move Sequence (in order)
            </label>
            <div className="flex flex-wrap gap-2">
              {DIRECTIONS.map((dir) => (
                <button
                  key={dir}
                  onClick={() => setPatternSequence([...patternSequence, dir])}
                  className="px-4 py-2 bg-amber-500/20 text-amber-100 rounded-lg hover:bg-amber-500/30 capitalize font-medium"
                >
                  + {dir}
                </button>
              ))}
            </div>
          </div>
          <div className="p-3 bg-surface-raised rounded-lg border border-dark-border">
            <div className="text-sm font-medium text-text-primary mb-2">Current Sequence:</div>
            <div className="flex flex-wrap gap-2">
              {patternSequence.map((dir, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-accent text-gray-950 rounded-lg capitalize font-semibold"
                >
                  {dir}
                  <button
                    onClick={() => setPatternSequence(patternSequence.filter((_, i) => i !== index))}
                    className="text-gray-900 hover:text-red-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedType === 'conditional' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">Condition</label>
            <select
              value={conditionType}
              onChange={(e) => setConditionType(e.target.value as ConditionType)}
              className="w-full px-4 py-2 border border-dark-border bg-surface-raised text-text-primary rounded-lg focus:ring-2 focus:ring-accent"
            >
              {CONDITIONS.map((cond) => (
                <option key={cond.value} value={cond.value}>
                  {cond.label}
                </option>
              ))}
            </select>
          </div>

          {conditionType === 'max_tile_in_corner' && (
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">Corner</label>
              <select
                value={conditionCorner}
                onChange={(e) => setConditionCorner(e.target.value as typeof CORNERS[number])}
                className="w-full px-4 py-2 border border-dark-border bg-surface-raised text-text-primary rounded-lg focus:ring-2 focus:ring-accent"
              >
                {CORNERS.map((corner) => (
                  <option key={corner} value={corner}>
                    {corner}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(conditionType === 'empty_cells_count' ||
            conditionType === 'monotonic_rows' ||
            conditionType === 'monotonic_cols') && (
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">Threshold</label>
              <input
                type="number"
                value={conditionThreshold}
                onChange={(e) => setConditionThreshold(parseInt(e.target.value) || 0)}
                min="0"
                max="16"
                className="w-full px-4 py-2 border border-dark-border bg-surface-raised text-text-primary rounded-lg focus:ring-2 focus:ring-accent"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">
              Actions (when condition is true)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {DIRECTIONS.map((dir) => (
                <button
                  key={dir}
                  onClick={() => toggleDirection(dir, conditionActions, setConditionActions)}
                  className={`px-4 py-2 rounded-lg capitalize font-medium transition-colors ${
                    conditionActions.includes(dir)
                      ? 'bg-accent text-gray-950'
                      : 'bg-surface-raised text-text-primary border border-dark-border hover:bg-surface-elevated'
                  }`}
                >
                  {dir}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">
              Priority (higher = evaluated first)
            </label>
            <input
              type="number"
              value={conditionPriority}
              onChange={(e) => setConditionPriority(parseInt(e.target.value) || 0)}
              min="1"
              max="100"
              className="w-full px-4 py-2 border border-dark-border bg-surface-raised text-text-primary rounded-lg focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>
      )}

      {selectedType === 'lookahead' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">
              Look-Ahead Depth: {lookAheadDepth}
            </label>
            <input
              type="range"
              value={lookAheadDepth}
              onChange={(e) => setLookAheadDepth(parseInt(e.target.value))}
              min="1"
              max="3"
              className="w-full accent-accent"
            />
            <p className="text-xs text-text-muted mt-1">
              Higher depth = better moves but slower simulation
            </p>
          </div>

          <WeightEditor weights={lookAheadWeights} onChange={setLookAheadWeights} />
        </div>
      )}

      {selectedType === 'weighted' && (
        <div className="space-y-4">
          <WeightEditor weights={weightedWeights} onChange={setWeightedWeights} />
        </div>
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
                key={index}
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
                    className="px-2 py-1 text-sm bg-surface-elevated rounded border border-dark-border hover:bg-surface disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMoveRule(index, 'down')}
                    disabled={index === rules.length - 1}
                    className="px-2 py-1 text-sm bg-surface-elevated rounded border border-dark-border hover:bg-surface disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => handleRemoveRule(index)}
                    className="px-3 py-1 text-sm bg-red-500/20 text-red-200 rounded hover:bg-red-500/30"
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

function WeightEditor({
  weights,
  onChange,
}: {
  weights: EvaluationWeights;
  onChange: (w: EvaluationWeights) => void;
}) {
  const updateWeight = (key: keyof EvaluationWeights, value: number) => {
    onChange({ ...weights, [key]: value });
  };

  const weightConfig: Array<{ key: keyof EvaluationWeights; label: string; max: number; step: number }> = [
    { key: 'emptyTiles', label: 'Empty Tiles', max: 10, step: 0.1 },
    { key: 'maxTileValue', label: 'Max Tile Value', max: 5, step: 0.1 },
    { key: 'maxTileCorner', label: 'Max Tile in Corner', max: 10, step: 0.1 },
    { key: 'mergeCount', label: 'Merge Count', max: 10, step: 0.1 },
    { key: 'monotonicity', label: 'Monotonicity', max: 10, step: 0.1 },
    { key: 'smoothness', label: 'Smoothness', max: 5, step: 0.1 },
  ];

  return (
    <div className="space-y-3 rounded-lg border border-dark-border bg-surface-raised p-4">
      <p className="text-sm text-text-muted">Adjust evaluation criteria weights:</p>
      {weightConfig.map((config) => (
        <div key={config.key}>
          <label className="block text-sm font-medium text-text-primary mb-1">
            {config.label}: {weights[config.key].toFixed(1)}
          </label>
          <input
            type="range"
            value={weights[config.key]}
            onChange={(e) => updateWeight(config.key, parseFloat(e.target.value))}
            min="0"
            max={config.max}
            step={config.step}
            className="w-full accent-accent"
          />
        </div>
      ))}
    </div>
  );
}
