/**
 * Editor for the single custom rule type: an EvaluationRule.
 * Six weight sliders with plain-English captions, a look-ahead depth
 * control, and up to MAX_OVERRIDES hard if-then overrides.
 */

import type {
  ConditionType,
  EvaluationOverride,
  EvaluationRule,
  EvaluationWeights,
} from '../engine/customRules';
import { MAX_OVERRIDES } from '../engine/customRules';
import type { Direction } from '../engine/types';

export interface EvaluationEditorProps {
  rule: EvaluationRule;
  onChange: (rule: EvaluationRule) => void;
}

const WEIGHT_CONFIG: Array<{
  key: keyof EvaluationWeights;
  label: string;
  caption: string;
  max: number;
}> = [
  { key: 'emptyTiles', label: 'Empty Tiles', caption: 'Keep cells open to avoid gridlock', max: 10 },
  { key: 'maxTileValue', label: 'Max Tile Value', caption: 'Push the biggest tile higher', max: 5 },
  { key: 'maxTileCorner', label: 'Max Tile in Corner', caption: 'Anchor the biggest tile in a corner', max: 10 },
  { key: 'mergeCount', label: 'Merge Count', caption: 'Set up as many merges as possible', max: 10 },
  { key: 'monotonicity', label: 'Monotonicity', caption: 'Keep rows/columns ordered small → large', max: 10 },
  { key: 'smoothness', label: 'Smoothness', caption: 'Keep neighboring tiles close in value', max: 5 },
];

const CONDITIONS: Array<{ value: ConditionType; label: string }> = [
  { value: 'max_tile_in_corner', label: 'Biggest tile is in a corner' },
  { value: 'max_tile_on_edge', label: 'Biggest tile is on an edge' },
  { value: 'empty_cells_count', label: 'Enough empty cells' },
  { value: 'merge_available', label: 'A merge is available' },
  { value: 'monotonic_rows', label: 'Rows are well ordered' },
  { value: 'monotonic_cols', label: 'Columns are well ordered' },
];

const CORNERS = ['bottom-left', 'bottom-right', 'top-left', 'top-right'] as const;
const DIRECTIONS: Direction[] = ['left', 'down', 'right', 'up'];

export function EvaluationEditor({ rule, onChange }: EvaluationEditorProps) {
  const updateWeight = (key: keyof EvaluationWeights, value: number) => {
    onChange({ ...rule, weights: { ...rule.weights, [key]: value } });
  };

  const updateOverride = (index: number, next: EvaluationOverride) => {
    const overrides = [...(rule.overrides ?? [])];
    overrides[index] = next;
    onChange({ ...rule, overrides });
  };

  const addOverride = () => {
    const overrides = [
      ...(rule.overrides ?? []),
      { when: 'max_tile_in_corner' as ConditionType, params: { corner: 'bottom-left' as const }, action: ['left' as Direction, 'down' as Direction] },
    ];
    onChange({ ...rule, overrides });
  };

  const removeOverride = (index: number) => {
    const overrides = (rule.overrides ?? []).filter((_, i) => i !== index);
    onChange({ ...rule, overrides: overrides.length > 0 ? overrides : undefined });
  };

  const toggleActionDirection = (index: number, direction: Direction) => {
    const override = (rule.overrides ?? [])[index];
    const has = override.action.includes(direction);
    const action = has
      ? override.action.filter((d) => d !== direction)
      : [...override.action, direction];
    updateOverride(index, { ...override, action });
  };

  const overrides = rule.overrides ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-lg border border-dark-border bg-surface-raised p-4">
        <p className="text-sm font-medium text-text-primary">What matters to this strategy?</p>
        {WEIGHT_CONFIG.map((config) => (
          <div key={config.key}>
            <label className="block text-sm font-medium text-text-primary mb-0.5">
              {config.label}: {rule.weights[config.key].toFixed(1)}
            </label>
            <p className="text-xs text-text-muted mb-1">{config.caption}</p>
            <input
              type="range"
              aria-label={config.label}
              value={rule.weights[config.key]}
              onChange={(e) => updateWeight(config.key, parseFloat(e.target.value))}
              min="0"
              max={config.max}
              step="0.1"
              className="w-full accent-accent"
            />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-dark-border bg-surface-raised p-4">
        <label className="block text-sm font-medium text-text-primary mb-0.5">
          Look ahead: {rule.depth} move{rule.depth !== 1 ? 's' : ''}
        </label>
        <p className="text-xs text-text-muted mb-1">
          Slower but smarter. 1 judges the immediate board; 3+ is much slower on large batches.
        </p>
        <input
          type="range"
          aria-label="Look-ahead depth"
          value={rule.depth}
          onChange={(e) => onChange({ ...rule, depth: Number(e.target.value) })}
          min="1"
          max="5"
          step="1"
          className="w-full accent-accent"
        />
        {rule.depth >= 3 && (
          <p className="text-xs text-amber-200 mt-1">
            Depth {rule.depth} can make a 10,000-game batch take a long time.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-dark-border bg-surface-raised p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-text-primary">Hard rules (optional)</p>
            <p className="text-xs text-text-muted">
              Checked first, in order. Up to {MAX_OVERRIDES}.
            </p>
          </div>
          <button
            onClick={addOverride}
            disabled={overrides.length >= MAX_OVERRIDES}
            className="px-3 py-1.5 text-sm bg-surface-elevated border border-dark-border rounded-lg text-text-primary hover:bg-surface disabled:opacity-50"
          >
            + Add
          </button>
        </div>

        {overrides.map((override, index) => (
          <div key={index} className="rounded-lg border border-dark-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted shrink-0">When</span>
              <select
                aria-label={`Override ${index + 1} condition`}
                value={override.when}
                onChange={(e) =>
                  updateOverride(index, {
                    ...override,
                    when: e.target.value as ConditionType,
                    params:
                      e.target.value === 'max_tile_in_corner'
                        ? { corner: override.params?.corner ?? 'bottom-left' }
                        : undefined,
                  })
                }
                className="flex-1 px-2 py-1.5 text-sm border border-dark-border bg-surface-elevated text-text-primary rounded-md"
              >
                {CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => removeOverride(index)}
                aria-label={`Remove override ${index + 1}`}
                className="text-danger hover:text-red-200 px-2"
              >
                ×
              </button>
            </div>

            {override.when === 'max_tile_in_corner' && (
              <select
                aria-label={`Override ${index + 1} corner`}
                value={override.params?.corner ?? 'bottom-left'}
                onChange={(e) =>
                  updateOverride(index, {
                    ...override,
                    params: { corner: e.target.value as (typeof CORNERS)[number] },
                  })
                }
                className="w-full px-2 py-1.5 text-sm border border-dark-border bg-surface-elevated text-text-primary rounded-md"
              >
                {CORNERS.map((corner) => (
                  <option key={corner} value={corner}>
                    {corner}
                  </option>
                ))}
              </select>
            )}

            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted shrink-0">try</span>
              {DIRECTIONS.map((direction) => (
                <button
                  key={direction}
                  onClick={() => toggleActionDirection(index, direction)}
                  className={`px-2.5 py-1 text-xs rounded-md border capitalize ${
                    override.action.includes(direction)
                      ? 'bg-accent text-gray-950 border-accent font-semibold'
                      : 'bg-surface-elevated text-text-muted border-dark-border'
                  }`}
                >
                  {direction}
                </button>
              ))}
            </div>
            {override.action.length === 0 && (
              <p className="text-xs text-danger">Pick at least one direction.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default EvaluationEditor;
