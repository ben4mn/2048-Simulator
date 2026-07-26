/**
 * Weighted-scoring rule form: score every move immediately using the
 * shared evaluation weight sliders.
 */

import type { EvaluationWeights } from '../../engine/customRules';
import { WeightEditor } from './WeightEditor';

export interface WeightedRuleFormProps {
  weights: EvaluationWeights;
  onWeightsChange: (weights: EvaluationWeights) => void;
}

export function WeightedRuleForm({ weights, onWeightsChange }: WeightedRuleFormProps) {
  return (
    <div className="space-y-4">
      <WeightEditor weights={weights} onChange={onWeightsChange} />
    </div>
  );
}

export default WeightedRuleForm;
