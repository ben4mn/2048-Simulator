/**
 * Conditional rule form: pick a board condition, optional params, and the
 * action(s) to take when it's true.
 */

import type { ConditionType } from '../../engine/customRules';
import type { Direction } from '../../engine/types';

const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];
const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
type Corner = (typeof CORNERS)[number];

const CONDITIONS: Array<{ value: ConditionType; label: string }> = [
  { value: 'max_tile_in_corner', label: 'Max tile in corner' },
  { value: 'max_tile_on_edge', label: 'Max tile on edge' },
  { value: 'empty_cells_count', label: 'Empty cells count' },
  { value: 'merge_available', label: 'Merge available' },
  { value: 'monotonic_rows', label: 'Monotonic rows' },
  { value: 'monotonic_cols', label: 'Monotonic columns' },
];

export interface ConditionalRuleFormProps {
  conditionType: ConditionType;
  onConditionTypeChange: (value: ConditionType) => void;
  corner: Corner;
  onCornerChange: (value: Corner) => void;
  threshold: number;
  onThresholdChange: (value: number) => void;
  actions: Direction[];
  onToggleAction: (direction: Direction) => void;
  priority: number;
  onPriorityChange: (value: number) => void;
}

export function ConditionalRuleForm({
  conditionType,
  onConditionTypeChange,
  corner,
  onCornerChange,
  threshold,
  onThresholdChange,
  actions,
  onToggleAction,
  priority,
  onPriorityChange,
}: ConditionalRuleFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-muted mb-2">Condition</label>
        <select
          value={conditionType}
          onChange={(e) => onConditionTypeChange(e.target.value as ConditionType)}
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
            value={corner}
            onChange={(e) => onCornerChange(e.target.value as Corner)}
            className="w-full px-4 py-2 border border-dark-border bg-surface-raised text-text-primary rounded-lg focus:ring-2 focus:ring-accent"
          >
            {CORNERS.map((c) => (
              <option key={c} value={c}>
                {c}
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
            value={threshold}
            onChange={(e) => onThresholdChange(parseInt(e.target.value) || 0)}
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
              onClick={() => onToggleAction(dir)}
              className={`px-4 py-2 rounded-lg capitalize font-medium transition-colors ${
                actions.includes(dir)
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
          value={priority}
          onChange={(e) => onPriorityChange(parseInt(e.target.value) || 0)}
          min="1"
          max="100"
          className="w-full px-4 py-2 border border-dark-border bg-surface-raised text-text-primary rounded-lg focus:ring-2 focus:ring-accent"
        />
      </div>
    </div>
  );
}

export default ConditionalRuleForm;
