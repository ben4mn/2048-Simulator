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
  onEditSaved?: (id: string) => void;
  excludeCreate?: boolean;
  onCreate?: () => void;
  customStrategyName?: string;
}

const BUILT_INS: Array<{
  type: StrategyType;
  title: string;
  blurb: string;
  glyph: string;
  tag: string;
}> = [
  {
    type: 'directional_priority',
    title: 'Directional Priority',
    blurb: 'Try left, down, right, then up.',
    glyph: '← ↓',
    tag: 'Simple',
  },
  {
    type: 'corner_anchor',
    title: 'Corner Anchor',
    blurb: 'Keep your biggest tile in a corner.',
    glyph: '↙',
    tag: 'Position',
  },
  {
    type: 'merge_max',
    title: 'Merge Maximization',
    blurb: 'Choose the move with most merges.',
    glyph: '2+2',
    tag: 'Greedy',
  },
  {
    type: 'random',
    title: 'Random',
    blurb: 'A reproducible baseline to beat.',
    glyph: '⤨',
    tag: 'Baseline',
  },
  {
    type: 'pattern',
    title: 'Repeat Sequence',
    blurb: 'Cycle through your own move order.',
    glyph: '↻',
    tag: 'Sequence',
  },
];

export function StrategyPicker({
  strategyType,
  onSelect,
  isRunning,
  savedStrategies = [],
  onDeleteSaved,
  onEditSaved,
  excludeCreate = false,
  onCreate,
  customStrategyName,
}: StrategyPickerProps) {
  const tileClass = (selected: boolean) =>
    `strategy-tile relative rounded-xl border p-3.5 text-left transition-colors ${selected ? 'border-accent/80 bg-accent/10' : 'border-dark-border bg-surface-raised/60 hover:border-text-muted/60 hover:bg-surface-raised'} disabled:opacity-50 disabled:cursor-not-allowed`;
  return (
    <div className="space-y-3">
      <div
        className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2.5"
        aria-label="Strategies"
      >
        {BUILT_INS.map((option) => (
          <button
            key={option.type}
            onClick={() => onSelect(option.type)}
            disabled={isRunning}
            aria-pressed={strategyType === option.type}
            className={tileClass(strategyType === option.type)}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                aria-hidden="true"
                className={`font-mono text-lg leading-none ${strategyType === option.type ? 'text-accent' : 'text-text-muted'}`}
              >
                {option.glyph}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-text-muted">
                {strategyType === option.type ? '● Selected' : option.tag}
              </span>
            </div>
            <div className="font-semibold text-sm text-text-primary">
              {option.title}
            </div>
            <div className="text-xs leading-relaxed text-text-muted mt-1">
              {option.blurb}
            </div>
          </button>
        ))}
        {!excludeCreate && (
          <button
            onClick={onCreate}
            disabled={isRunning}
            className={`${tileClass(false)} border-dashed border-accent/40 bg-accent/5 hover:border-accent`}
          >
            <div
              aria-hidden="true"
              className="text-accent text-xl leading-none mb-3"
            >
              ＋
            </div>
            <div className="font-semibold text-sm text-accent">
              Build your own
            </div>
            <div className="text-xs leading-relaxed text-text-muted mt-1">
              Start with a preset, tune it, test it.
            </div>
          </button>
        )}
      </div>
      {(savedStrategies.length > 0 || customStrategyName) && (
        <div className="pt-3 border-t border-dark-border space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Your strategy library
          </p>
          {savedStrategies.map((strategy) => {
            const selected = strategyType === `saved:${strategy.id}`;
            return (
              <div
                key={strategy.id}
                className={`flex items-center rounded-lg border overflow-hidden ${selected ? 'border-accent/80 bg-accent/10' : 'border-dark-border bg-surface-raised/60'}`}
              >
                <button
                  onClick={() => onSelect(`saved:${strategy.id}`)}
                  disabled={isRunning}
                  aria-pressed={selected}
                  className="min-w-0 flex-1 px-3 py-2.5 text-left disabled:opacity-50"
                >
                  <div className="text-sm font-semibold truncate text-text-primary">
                    {strategy.name}
                  </div>
                  <div className="text-[11px] text-text-muted mt-0.5">
                    {selected ? 'Selected · ' : ''}Saved on this device
                    {strategy.params?.converted ? ' · upgraded' : ''}
                  </div>
                </button>
                {onEditSaved && (
                  <button
                    onClick={() => onEditSaved(strategy.id)}
                    disabled={isRunning}
                    aria-label={`Edit strategy ${strategy.name}`}
                    className="px-2 py-3 text-xs text-text-muted hover:text-accent disabled:opacity-50"
                  >
                    Edit
                  </button>
                )}
                {onDeleteSaved && (
                  <button
                    onClick={() => onDeleteSaved(strategy.id)}
                    disabled={isRunning}
                    aria-label={`Delete strategy ${strategy.name}`}
                    className="px-3 py-3 text-lg text-text-muted hover:text-danger disabled:opacity-50"
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
              aria-pressed={strategyType === 'custom'}
              className={`${tileClass(strategyType === 'custom')} w-full`}
            >
              <div className="font-semibold text-sm">{customStrategyName}</div>
              <div className="text-xs text-text-muted mt-1">Current draft</div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default StrategyPicker;
