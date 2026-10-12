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
import { DEFAULT_WEIGHTS, MAX_OVERRIDES } from '../engine/customRules';
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

  const moveOverride = (index: number, delta: number) => {
    const next = [...(rule.overrides ?? [])];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange({ ...rule, overrides: next });
  };

  const overrides = rule.overrides ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-dark-border bg-surface-raised p-4">
        <div className="flex items-center justify-between gap-3 mb-1">
          <p className="text-sm font-semibold text-text-primary">What matters to this strategy?</p>
          <button type="button" onClick={() => onChange({ ...rule, weights: { ...DEFAULT_WEIGHTS } })} className="text-xs text-accent hover:text-amber-300">Reset weights</button>
        </div>
        <p className="text-xs text-text-muted mb-4">Raise a weight to favor that trait. Zero turns it off.</p>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-5">
        {WEIGHT_CONFIG.map((config) => (
          <div key={config.key}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label htmlFor={`weight-${config.key}`} className="block text-xs font-medium text-text-primary">{config.label}</label>
              <input type="number" aria-label={`${config.label} weight`} min={0} max={100} step={0.1} value={rule.weights[config.key]}
                onChange={(event) => { if (event.target.value !== '') updateWeight(config.key, Math.max(0, Math.min(100, Number(event.target.value)))); }}
                className="w-16 px-2 py-1 rounded-md border border-dark-border bg-surface text-right font-mono text-xs text-accent" />
            </div>
            <p className="text-xs text-text-muted mb-1">{config.caption}</p>
            <input
              id={`weight-${config.key}`}
              type="range"
              aria-label={config.label}
              value={rule.weights[config.key]}
              onChange={(e) => updateWeight(config.key, parseFloat(e.target.value))}
              min="0"
              max={Math.max(config.max, rule.weights[config.key])}
              step="0.1"
              className="w-full accent-accent"
            />
          </div>
        ))}
        </div>
      </div>

      <div className="rounded-lg border border-dark-border bg-surface-raised p-4">
        <label className="block text-sm font-medium text-text-primary mb-0.5">
          Look ahead: {rule.depth} move{rule.depth !== 1 ? 's' : ''}
        </label>
        <p className="text-xs text-text-muted mb-1">
          1 scores the next board. Higher depths explore more moves and take longer.
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
        <div className="flex justify-between text-[10px] text-text-muted"><span>1 · Fast</span><span>3 · Deeper</span><span>5 · Thorough</span></div>
        {rule.depth >= 3 && (
          <p className="text-xs text-amber-200 mt-1">
            Test depth {rule.depth} on a few games before starting a large batch.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-dark-border bg-surface-raised p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-text-primary">Hard rules (optional)</p>
            <p className="text-xs text-text-muted">
              Checked in order. First legal direction wins; otherwise use the weights. Up to {MAX_OVERRIDES}.
            </p>
          </div>
          <button
            type="button"
            onClick={addOverride}
            disabled={overrides.length >= MAX_OVERRIDES}
            className="px-3 py-1.5 text-sm bg-surface-elevated border border-dark-border rounded-lg text-text-primary hover:bg-surface disabled:opacity-50"
          >
            + Add
          </button>
        </div>

        {overrides.map((override, index) => (
          <div key={index} className="rounded-lg border border-dark-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-text-muted">Rule {index + 1}</span>
              <div className="flex gap-2">
                <button type="button" disabled={index === 0} aria-label={`Move override ${index + 1} earlier`} onClick={() => moveOverride(index, -1)} className="text-xs text-text-muted hover:text-accent disabled:opacity-30">↑</button>
                <button type="button" disabled={index === overrides.length - 1} aria-label={`Move override ${index + 1} later`} onClick={() => moveOverride(index, 1)} className="text-xs text-text-muted hover:text-accent disabled:opacity-30">↓</button>
              </div>
            </div>
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
                        : e.target.value === 'empty_cells_count'
                          ? { threshold: 3 }
                          : e.target.value === 'monotonic_rows' || e.target.value === 'monotonic_cols'
                            ? { threshold: 8 }
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
                type="button"
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

            {(override.when === 'empty_cells_count' || override.when === 'monotonic_rows' || override.when === 'monotonic_cols') && (
              <label className="flex items-center gap-3 text-xs text-text-muted">
                {override.when === 'empty_cells_count' ? 'At least this many empty cells' : 'Ordered-pair score greater than'}
                <input type="number" aria-label={`Override ${index + 1} threshold`} min={0} max={override.when === 'empty_cells_count' ? 16 : 12} step={1}
                  value={override.params?.threshold ?? (override.when === 'empty_cells_count' ? 3 : 11)}
                  onChange={(event) => { if (event.target.value !== '') updateOverride(index, { ...override, params: { threshold: Math.max(0, Math.min(override.when === 'empty_cells_count' ? 16 : 12, Math.round(Number(event.target.value)))) } }); }}
                  className="w-16 rounded-md border border-dark-border bg-surface-elevated px-2 py-1.5 text-text-primary" />
              </label>
            )}

            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted shrink-0">try</span>
              {DIRECTIONS.map((direction) => (
                <button
                  type="button"
                  key={direction}
                  onClick={() => toggleActionDirection(index, direction)}
                  aria-pressed={override.action.includes(direction)}
                  aria-label={`Override ${index + 1}: ${direction}`}
                  className={`px-2.5 py-1 text-xs rounded-md border capitalize ${
                    override.action.includes(direction)
                      ? 'bg-accent text-gray-950 border-accent font-semibold'
                      : 'bg-surface-elevated text-text-muted border-dark-border'
                  }`}
                >
                  {override.action.includes(direction) && <span className="mr-1 opacity-70">{override.action.indexOf(direction) + 1}.</span>}{direction}
                </button>
              ))}
            </div>
            {override.action.length > 1 && <p className="text-[10px] text-text-muted">Priority: {override.action.join(' → ')}. Remove and re-add a direction to move it last.</p>}
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
