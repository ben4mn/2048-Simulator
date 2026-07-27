/**
 * Custom Strategy Builder — single-page, AI-first.
 * Describe the strategy in natural language (AI generates an Evaluation
 * config), or tune the one Evaluation form directly. A deterministic
 * plain-English summary card reflects exactly what will run, and Test Drive
 * plays 3 fixed-seed games against a Random baseline before saving.
 */

import { useMemo, useState } from 'react';
import type { CustomRule, EvaluationRule } from '../engine/customRules';
import { DEFAULT_WEIGHTS, migrateCustomRules } from '../engine/customRules';
import { autoName, summarizeRules } from '../engine/strategySummary';
import { CustomStrategyFactory } from '../engine/customStrategyFactory';
import { RandomStrategy, playGameWithStrategy } from '../engine/strategy';
import { AIStrategyAssistant } from './AIStrategyAssistant';
import { EvaluationEditor } from './EvaluationEditor';

export interface CustomStrategyBuilderProps {
  onSave: (rules: CustomRule[], name: string) => void;
  onCancel: () => void;
  initialRules?: CustomRule[];
  initialName?: string;
}

const TEST_SEEDS = ['TESTDRV1', 'TESTDRV2', 'TESTDRV3'];

interface TestDriveResult {
  strategyAvg: number;
  randomAvg: number;
  strategyBest: number;
}

const defaultRule = (): EvaluationRule => ({
  type: 'evaluation',
  weights: { ...DEFAULT_WEIGHTS },
  depth: 1,
});

/** Pull the editable evaluation rule out of stored rules (migrating legacy shapes). */
function toEditableRule(rules: CustomRule[]): EvaluationRule {
  const { rules: migrated } = migrateCustomRules(rules);
  const first = migrated[0];
  return first && first.type === 'evaluation' ? first : defaultRule();
}

export function CustomStrategyBuilder({
  onSave,
  onCancel,
  initialRules = [],
  initialName = '',
}: CustomStrategyBuilderProps) {
  const [rule, setRule] = useState<EvaluationRule>(() =>
    initialRules.length > 0 ? toEditableRule(initialRules) : defaultRule()
  );
  const [strategyName, setStrategyName] = useState(initialName);
  const [showEditor, setShowEditor] = useState(initialRules.length > 0);
  const [testResult, setTestResult] = useState<TestDriveResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const rules = useMemo(() => [rule], [rule]);
  const summary = useMemo(() => summarizeRules(rules), [rules]);

  const handleAIGenerate = (generatedRules: CustomRule[], name: string) => {
    setRule(toEditableRule(generatedRules));
    setStrategyName(name);
    setShowEditor(true);
    setTestResult(null);
  };

  const handleRuleChange = (next: EvaluationRule) => {
    setRule(next);
    setTestResult(null);
  };

  const handleTestDrive = () => {
    setIsTesting(true);
    setSaveError(null);
    // Let the button render its busy state before the synchronous games run.
    setTimeout(() => {
      try {
        // Cap depth for the preview so it stays instant.
        const previewRule: EvaluationRule = { ...rule, depth: Math.min(rule.depth, 3) };
        let strategyTotal = 0;
        let randomTotal = 0;
        let strategyBest = 0;
        for (const seed of TEST_SEEDS) {
          const own = playGameWithStrategy(
            seed,
            CustomStrategyFactory.createFromRules([previewRule])
          );
          const baseline = playGameWithStrategy(seed, new RandomStrategy());
          strategyTotal += own.score;
          randomTotal += baseline.score;
          strategyBest = Math.max(strategyBest, own.maxTile);
        }
        setTestResult({
          strategyAvg: Math.round(strategyTotal / TEST_SEEDS.length),
          randomAvg: Math.round(randomTotal / TEST_SEEDS.length),
          strategyBest,
        });
      } finally {
        setIsTesting(false);
      }
    }, 30);
  };

  const handleSave = () => {
    const invalid = rule.overrides?.some((o) => o.action.length === 0);
    if (invalid) {
      setSaveError('Every hard rule needs at least one direction.');
      return;
    }
    setSaveError(null);
    onSave(rules, strategyName.trim() || autoName(rules));
  };

  return (
    <div className="h-full flex flex-col bg-surface-elevated text-text-primary">
      <div className="px-6 py-4 border-b border-dark-border flex items-center justify-between sticky top-0 bg-surface-elevated z-10">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Create a Strategy</h2>
          <p className="text-sm text-text-muted mt-1">
            Describe it and let AI build it, or tune the dials yourself.
          </p>
        </div>
        <button
          onClick={onCancel}
          className="text-text-muted hover:text-text-primary text-2xl leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        <AIStrategyAssistant onGenerate={handleAIGenerate} />

        <div className="border-t border-dark-border pt-4">
          <button
            onClick={() => setShowEditor(!showEditor)}
            className="text-sm font-medium text-accent hover:text-amber-300"
          >
            {showEditor ? 'Hide manual controls' : 'Skip AI — start from defaults and tweak'}
          </button>
        </div>

        {showEditor && <EvaluationEditor rule={rule} onChange={handleRuleChange} />}

        <div className="p-4 bg-amber-500/10 rounded-lg border border-accent/40">
          <h3 className="font-medium text-accent mb-1">What this strategy does</h3>
          <p className="text-sm text-amber-100">{summary}</p>
        </div>

        <div className="p-4 rounded-lg border border-dark-border bg-surface-raised space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-text-primary text-sm">Test drive</h3>
              <p className="text-xs text-text-muted">
                3 fixed-seed games vs a Random baseline, before you commit.
              </p>
            </div>
            <button
              onClick={handleTestDrive}
              disabled={isTesting}
              className="px-4 py-2 bg-surface-elevated border border-dark-border rounded-lg text-sm font-medium text-text-primary hover:bg-surface disabled:opacity-50"
            >
              {isTesting ? 'Playing…' : 'Test drive'}
            </button>
          </div>
          {testResult && (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-lg font-bold text-accent">
                  {testResult.strategyAvg.toLocaleString()}
                </div>
                <div className="text-xs text-text-muted">your avg score</div>
              </div>
              <div>
                <div className="text-lg font-bold text-text-primary">
                  {testResult.randomAvg.toLocaleString()}
                </div>
                <div className="text-xs text-text-muted">random avg</div>
              </div>
              <div>
                <div className="text-lg font-bold text-text-primary">{testResult.strategyBest}</div>
                <div className="text-xs text-text-muted">your best tile</div>
              </div>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="strategy-name" className="block text-sm font-medium text-text-muted mb-2">
            Name (optional — we’ll pick one if you leave it blank)
          </label>
          <input
            id="strategy-name"
            type="text"
            value={strategyName}
            onChange={(e) => setStrategyName(e.target.value)}
            placeholder={autoName(rules)}
            className="w-full px-4 py-2 border border-dark-border bg-surface-raised text-text-primary rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
          />
        </div>
      </div>

      <div className="px-6 py-4 border-t border-dark-border bg-surface-raised">
        {saveError && (
          <p role="alert" className="text-sm text-danger mb-3">
            {saveError}
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="flex-1 px-6 py-3 bg-accent text-gray-950 font-semibold rounded-lg hover:bg-accent-strong transition-colors"
          >
            Save Strategy
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-surface-elevated text-text-primary border border-dark-border font-medium rounded-lg hover:bg-surface transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
