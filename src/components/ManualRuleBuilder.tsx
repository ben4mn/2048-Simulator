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

  // Pattern rule state
  const [patternSequence, setPatternSequence] = useState<Direction[]>(['left', 'down']);

  // Conditional rule state
  const [conditionType, setConditionType] = useState<ConditionType>('max_tile_in_corner');
  const [conditionCorner, setConditionCorner] = useState<typeof CORNERS[number]>('bottom-left');
  const [conditionThreshold, setConditionThreshold] = useState(2);
  const [conditionActions, setConditionActions] = useState<Direction[]>(['left', 'down']);
  const [conditionPriority, setConditionPriority] = useState(10);

  // Look-ahead rule state
  const [lookAheadDepth, setLookAheadDepth] = useState(2);
  const [lookAheadWeights, setLookAheadWeights] = useState<EvaluationWeights>(DEFAULT_WEIGHTS);

  // Weighted rule state
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
      {/* Rule Type Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Rule Type</label>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as RuleType)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        >
          <option value="pattern">Fixed Pattern</option>
          <option value="conditional">Conditional</option>
          <option value="lookahead">Look-Ahead Evaluation</option>
          <option value="weighted">Weighted Scoring</option>
        </select>
      </div>

      {/* Pattern Rule Configuration */}
      {selectedType === 'pattern' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Move Sequence (in order)
            </label>
            <div className="flex gap-2">
              {DIRECTIONS.map((dir) => (
                <button
                  key={dir}
                  onClick={() => setPatternSequence([...patternSequence, dir])}
                  className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 capitalize font-medium"
                >
                  + {dir}
                </button>
              ))}
            </div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-sm font-medium text-gray-700 mb-2">Current Sequence:</div>
            <div className="flex flex-wrap gap-2">
              {patternSequence.map((dir, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-amber-600 text-white rounded-lg capitalize font-medium"
                >
                  {dir}
                  <button
                    onClick={() => setPatternSequence(patternSequence.filter((_, i) => i !== index))}
                    className="text-white hover:text-red-200"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Conditional Rule Configuration */}
      {selectedType === 'conditional' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Condition</label>
            <select
              value={conditionType}
              onChange={(e) => setConditionType(e.target.value as ConditionType)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Corner</label>
              <select
                value={conditionCorner}
                onChange={(e) => setConditionCorner(e.target.value as typeof CORNERS[number])}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Threshold</label>
              <input
                type="number"
                value={conditionThreshold}
                onChange={(e) => setConditionThreshold(parseInt(e.target.value) || 0)}
                min="0"
                max="16"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Actions (when condition is true)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {DIRECTIONS.map((dir) => (
                <button
                  key={dir}
                  onClick={() => toggleDirection(dir, conditionActions, setConditionActions)}
                  className={`px-4 py-2 rounded-lg capitalize font-medium transition-colors ${
                    conditionActions.includes(dir)
                      ? 'bg-amber-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {dir}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority (higher = evaluated first)
            </label>
            <input
              type="number"
              value={conditionPriority}
              onChange={(e) => setConditionPriority(parseInt(e.target.value) || 0)}
              min="1"
              max="100"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>
      )}

      {/* Look-Ahead Rule Configuration */}
      {selectedType === 'lookahead' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Look-Ahead Depth: {lookAheadDepth}
            </label>
            <input
              type="range"
              value={lookAheadDepth}
              onChange={(e) => setLookAheadDepth(parseInt(e.target.value))}
              min="1"
              max="3"
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Higher depth = better moves but slower simulation
            </p>
          </div>

          <WeightEditor weights={lookAheadWeights} onChange={setLookAheadWeights} />
        </div>
      )}

      {/* Weighted Rule Configuration */}
      {selectedType === 'weighted' && (
        <div className="space-y-4">
          <WeightEditor weights={weightedWeights} onChange={setWeightedWeights} />
        </div>
      )}

      {/* Add Rule Button */}
      <button
        onClick={handleAddRule}
        className="w-full px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
      >
        {editingIndex !== null ? 'Update Rule' : 'Add Rule'}
      </button>

      {/* Rules List */}
      {rules.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Rules (in priority order)</h3>
          <div className="space-y-2">
            {rules.map((rule, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200"
              >
                <span className="flex-1">
                  <span className="font-medium text-gray-800 capitalize">{rule.type}</span>
                  {rule.type === 'pattern' && ` - ${rule.sequence.join(' → ')}`}
                  {rule.type === 'conditional' && ` - ${rule.condition} (priority ${rule.priority})`}
                  {rule.type === 'lookahead' && ` - Depth ${rule.depth}`}
                  {rule.type === 'weighted' && ` - Weighted scoring`}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleMoveRule(index, 'up')}
                    disabled={index === 0}
                    className="px-2 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMoveRule(index, 'down')}
                    disabled={index === rules.length - 1}
                    className="px-2 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => handleRemoveRule(index)}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
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
    <div className="space-y-3">
      <p className="text-sm text-gray-600">Adjust evaluation criteria weights:</p>
      {weightConfig.map((config) => (
        <div key={config.key}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {config.label}: {weights[config.key].toFixed(1)}
          </label>
          <input
            type="range"
            value={weights[config.key]}
            onChange={(e) => updateWeight(config.key, parseFloat(e.target.value))}
            min="0"
            max={config.max}
            step={config.step}
            className="w-full"
          />
        </div>
      ))}
    </div>
  );
}
