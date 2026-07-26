/**
 * Strategy type picker grid used by BatchConfigPanel.
 */

export type StrategyType = 'directional_priority' | 'corner_anchor' | 'merge_max' | 'random' | 'custom';

export interface StrategyPickerProps {
  strategyType: string;
  onSelect: (type: StrategyType) => void;
  isRunning: boolean;
  customRuleCount: number;
}

const OPTIONS: Array<{ type: StrategyType; title: string; blurb: string; wide?: boolean }> = [
  { type: 'directional_priority', title: 'Directional Priority', blurb: 'L→D→R→U order' },
  { type: 'corner_anchor', title: 'Corner Anchor', blurb: 'Keep max in corner' },
  { type: 'merge_max', title: 'Merge Maximization', blurb: 'Prioritize merges' },
  { type: 'random', title: 'Random', blurb: 'Baseline comparison' },
  {
    type: 'custom',
    title: 'Custom Strategy',
    blurb: 'Build your own with manual rules or AI assistance',
    wide: true,
  },
];

export function StrategyPicker({
  strategyType,
  onSelect,
  isRunning,
  customRuleCount,
}: StrategyPickerProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-muted mb-3">Choose Strategy</label>
      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map((option) => (
          <button
            key={option.type}
            onClick={() => onSelect(option.type)}
            disabled={isRunning}
            className={`${option.wide ? 'col-span-2' : ''} p-4 rounded-xl border-2 text-left transition-all ${
              strategyType === option.type
                ? 'border-accent bg-amber-500/15'
                : 'border-dark-border bg-surface-raised hover:border-accent/60 hover:bg-surface-elevated'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="flex items-start">
              <div className="flex-1">
                <div className="font-semibold text-text-primary">{option.title}</div>
                <div className="text-xs text-text-muted mt-1">{option.blurb}</div>
              </div>
              {option.type === 'custom' && customRuleCount > 0 && (
                <div className="px-3 py-1 bg-accent text-gray-950 text-xs font-semibold rounded-full">
                  {customRuleCount} rule{customRuleCount !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default StrategyPicker;
