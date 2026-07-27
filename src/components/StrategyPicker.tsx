/**
 * Strategy tile picker used by BatchConfigPanel.
 * One row of first-class tiles: built-in presets, a Repeat Sequence preset,
 * the user's saved strategies, and a "Create your own" tile that opens the
 * builder directly.
 *
 * Selection values: a built-in type, 'pattern', 'custom' (rules in hand from
 * the builder), or 'saved:<id>' for a saved strategy tile.
 */

import type { Strategy } from '../storage/db';

export type StrategyType =
  | 'directional_priority'
  | 'corner_anchor'
  | 'merge_max'
  | 'random'
  | 'pattern'
  | 'custom'
  | `saved:${string}`;

export interface StrategyPickerProps {
  strategyType: string;
  onSelect: (type: StrategyType) => void;
  isRunning: boolean;
  savedStrategies?: Strategy[];
  onDeleteSaved?: (id: string) => void;
  /** Hides the "Create your own" tile (Compare mode — saved tiles remain). */
  excludeCreate?: boolean;
  /** Called when the "Create your own" tile is clicked (opens the builder). */
  onCreate?: () => void;
  /** Label of the transient custom strategy built this session, if any. */
  customStrategyName?: string;
}

const BUILT_INS: Array<{ type: StrategyType; title: string; blurb: string }> = [
  { type: 'directional_priority', title: 'Directional Priority', blurb: 'L→D→R→U order' },
  { type: 'corner_anchor', title: 'Corner Anchor', blurb: 'Keep max in corner' },
  { type: 'merge_max', title: 'Merge Maximization', blurb: 'Prioritize merges' },
  { type: 'random', title: 'Random', blurb: 'Baseline comparison' },
  { type: 'pattern', title: 'Repeat Sequence', blurb: 'Cycle a fixed move pattern' },
];

export function StrategyPicker({
  strategyType,
  onSelect,
  isRunning,
  savedStrategies = [],
  onDeleteSaved,
  excludeCreate = false,
  onCreate,
  customStrategyName,
}: StrategyPickerProps) {
  const tileClass = (selected: boolean) =>
    `p-4 rounded-xl border-2 text-left transition-all ${
      selected
        ? 'border-accent bg-amber-500/15'
        : 'border-dark-border bg-surface-raised hover:border-accent/60 hover:bg-surface-elevated'
    } disabled:opacity-50 disabled:cursor-not-allowed`;

  return (
    <div>
      <label className="block text-sm font-medium text-text-muted mb-3">Choose Strategy</label>
      <div className="grid grid-cols-2 gap-3">
        {BUILT_INS.map((option) => (
          <button
            key={option.type}
            onClick={() => onSelect(option.type)}
            disabled={isRunning}
            className={tileClass(strategyType === option.type)}
          >
            <div className="font-semibold text-text-primary">{option.title}</div>
            <div className="text-xs text-text-muted mt-1">{option.blurb}</div>
          </button>
        ))}

        {savedStrategies.map((strategy) => {
          const value = `saved:${strategy.id}`;
          const converted = strategy.params?.converted === true;
          return (
            <div key={strategy.id} className="relative">
              <button
                onClick={() => onSelect(value as StrategyType)}
                disabled={isRunning}
                className={`${tileClass(strategyType === value)} w-full`}
              >
                <div className="font-semibold text-text-primary pr-6 truncate">
                  {strategy.name}
                </div>
                <div className="text-xs text-text-muted mt-1">
                  Saved strategy{converted ? ' · converted' : ''}
                </div>
              </button>
              {onDeleteSaved && (
                <button
                  onClick={() => onDeleteSaved(strategy.id)}
                  disabled={isRunning}
                  aria-label={`Delete strategy ${strategy.name}`}
                  title="Delete strategy"
                  className="absolute top-2 right-2 text-text-muted hover:text-danger text-sm leading-none p-1"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}

        {customStrategyName && (
          <button
            onClick={() => onSelect('custom')}
            disabled={isRunning}
            className={tileClass(strategyType === 'custom')}
          >
            <div className="font-semibold text-text-primary truncate">{customStrategyName}</div>
            <div className="text-xs text-text-muted mt-1">Unsaved draft from the builder</div>
          </button>
        )}

        {!excludeCreate && (
          <button
            onClick={() => (onCreate ? onCreate() : onSelect('custom'))}
            disabled={isRunning}
            className={`${tileClass(false)} col-span-2 border-dashed`}
          >
            <div className="font-semibold text-accent">+ Create your own</div>
            <div className="text-xs text-text-muted mt-1">
              Describe it to AI or tune the dials — then simulate it
            </div>
          </button>
        )}
      </div>
    </div>
  );
}

export default StrategyPicker;
