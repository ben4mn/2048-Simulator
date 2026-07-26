/**
 * Fixed-pattern rule form: build a repeating sequence of moves.
 */

import type { Direction } from '../../engine/types';

const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];

export interface PatternRuleFormProps {
  sequence: Direction[];
  onAppend: (direction: Direction) => void;
  onRemoveAt: (index: number) => void;
}

export function PatternRuleForm({ sequence, onAppend, onRemoveAt }: PatternRuleFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-muted mb-2">
          Move Sequence (in order)
        </label>
        <div className="flex flex-wrap gap-2">
          {DIRECTIONS.map((dir) => (
            <button
              key={dir}
              onClick={() => onAppend(dir)}
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
          {sequence.map((dir, index) => (
            <span
              key={`${index}-${dir}`}
              className="inline-flex items-center gap-2 px-3 py-1 bg-accent text-gray-950 rounded-lg capitalize font-semibold"
            >
              {dir}
              <button
                onClick={() => onRemoveAt(index)}
                aria-label={`Remove step ${index + 1} (${dir})`}
                className="text-gray-900 hover:text-red-800"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PatternRuleForm;
