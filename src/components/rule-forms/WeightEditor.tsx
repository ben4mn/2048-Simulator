/**
 * Shared slider editor for board-evaluation weights, used by both the
 * look-ahead and weighted-scoring rule forms.
 */

import type { EvaluationWeights } from '../../engine/customRules';

export interface WeightEditorProps {
  weights: EvaluationWeights;
  onChange: (weights: EvaluationWeights) => void;
}

const WEIGHT_CONFIG: Array<{ key: keyof EvaluationWeights; label: string; max: number; step: number }> = [
  { key: 'emptyTiles', label: 'Empty Tiles', max: 10, step: 0.1 },
  { key: 'maxTileValue', label: 'Max Tile Value', max: 5, step: 0.1 },
  { key: 'maxTileCorner', label: 'Max Tile in Corner', max: 10, step: 0.1 },
  { key: 'mergeCount', label: 'Merge Count', max: 10, step: 0.1 },
  { key: 'monotonicity', label: 'Monotonicity', max: 10, step: 0.1 },
  { key: 'smoothness', label: 'Smoothness', max: 5, step: 0.1 },
];

export function WeightEditor({ weights, onChange }: WeightEditorProps) {
  const updateWeight = (key: keyof EvaluationWeights, value: number) => {
    onChange({ ...weights, [key]: value });
  };

  return (
    <div className="space-y-3 rounded-lg border border-dark-border bg-surface-raised p-4">
      <p className="text-sm text-text-muted">Adjust evaluation criteria weights:</p>
      {WEIGHT_CONFIG.map((config) => (
        <div key={config.key}>
          <label className="block text-sm font-medium text-text-primary mb-1">
            {config.label}: {weights[config.key].toFixed(1)}
          </label>
          <input
            type="range"
            aria-label={config.label}
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

export default WeightEditor;
