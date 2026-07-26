/**
 * List of saved custom strategies with load/delete actions,
 * used by BatchConfigPanel.
 */

import type { Strategy } from '../storage/db';
import type { CustomRule } from '../engine/customRules';

export interface SavedStrategiesListProps {
  strategies: Strategy[];
  onLoad: (strategy: { name: string; customRules: CustomRule[] }) => void;
  onDelete: (id: string) => void;
}

const getCustomRules = (strategy: Strategy): CustomRule[] =>
  (strategy.params.customRules as CustomRule[] | undefined) ?? [];

export function SavedStrategiesList({ strategies, onLoad, onDelete }: SavedStrategiesListProps) {
  if (strategies.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-text-muted">Saved Strategies</h3>
      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {strategies.map((strategy) => {
          const rules = getCustomRules(strategy);
          return (
            <div
              key={strategy.id}
              className="flex items-center justify-between p-3 bg-surface-raised rounded-lg border border-dark-border"
            >
              <button
                onClick={() => onLoad({ name: strategy.name, customRules: rules })}
                className="flex-1 text-left"
              >
                <div className="font-medium text-text-primary text-sm">{strategy.name}</div>
                <div className="text-xs text-text-muted">
                  {rules.length} rule{rules.length !== 1 ? 's' : ''}
                </div>
              </button>
              <button
                onClick={() => onDelete(strategy.id)}
                className="ml-2 p-1.5 text-danger hover:text-red-200 hover:bg-red-500/15 rounded-sm transition-colors"
                title="Delete strategy"
                aria-label={`Delete strategy ${strategy.name}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SavedStrategiesList;
