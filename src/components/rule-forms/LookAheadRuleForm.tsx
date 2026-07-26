/**
 * Look-ahead rule form: evaluation depth plus shared weight sliders.
 */

import type { EvaluationWeights } from '../../engine/customRules';
import { WeightEditor } from './WeightEditor';

export interface LookAheadRuleFormProps {
  depth: number;
  onDepthChange: (depth: number) => void;
  weights: EvaluationWeights;
  onWeightsChange: (weights: EvaluationWeights) => void;
}

export function LookAheadRuleForm({
  depth,
  onDepthChange,
  weights,
  onWeightsChange,
}: LookAheadRuleFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-muted mb-2">
          Look-Ahead Depth: {depth}
        </label>
        <input
          type="range"
          aria-label="Look-ahead depth"
          value={depth}
          onChange={(e) => onDepthChange(parseInt(e.target.value))}
          min="1"
          max="3"
          className="w-full accent-accent"
        />
        <p className="text-xs text-text-muted mt-1">
          Higher depth = better moves but slower simulation
        </p>
      </div>

      <WeightEditor weights={weights} onChange={onWeightsChange} />
    </div>
  );
}

export default LookAheadRuleForm;
