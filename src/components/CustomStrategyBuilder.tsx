/** Strategy studio: usable offline, with optional AI and a cancellable worker benchmark. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AuthoredRule, CustomRule, EvaluationRule, PatternRule } from '../engine/customRules';
import { DEFAULT_WEIGHTS, migrateCustomRules, normalizeWeights, RuleValidator } from '../engine/customRules';
import { autoName, summarizeRules } from '../engine/strategySummary';
import { startStrategyPreview, type StrategyPreviewGame } from '../services/strategyPreview';
import { AIStrategyAssistant } from './AIStrategyAssistant';
import { EvaluationEditor } from './EvaluationEditor';
import { PatternEditor } from './PatternEditor';
import { GameReplay } from './GameReplay';

export interface CustomStrategyBuilderProps {
  onSave: (rules: CustomRule[], name: string) => void | Promise<void>;
  onCancel: () => void;
  initialRules?: CustomRule[];
  initialName?: string;
}

const defaultRule = (): EvaluationRule => ({ type: 'evaluation', weights: { ...DEFAULT_WEIGHTS }, depth: 1 });
const defaultPattern = (): PatternRule => ({ type: 'pattern', sequence: ['left', 'down', 'right', 'down', 'up'] });

const PRESETS: Array<{ name: string; description: string; symbol: string; rule: () => AuthoredRule }> = [
  { name: 'Balanced', description: 'Room to move. Orderly tiles.', symbol: '◈', rule: defaultRule },
  { name: 'Corner keeper', description: 'Protect the bottom-left corner.', symbol: '↙', rule: () => ({
    ...defaultRule(), weights: { ...DEFAULT_WEIGHTS, maxTileCorner: 8, monotonicity: 5 },
    overrides: [{ when: 'max_tile_in_corner', params: { corner: 'bottom-left' }, action: ['left', 'down'] }],
  }) },
  { name: 'Merge hunter', description: 'Make space by joining tiles.', symbol: '⊕', rule: () => ({
    ...defaultRule(), weights: { ...DEFAULT_WEIGHTS, mergeCount: 7, emptyTiles: 6, maxTileCorner: 1.5 },
  }) },
  { name: 'Move loop', description: 'A simple, editable rhythm.', symbol: '↺', rule: defaultPattern },
];

function toEditableRule(rules: CustomRule[]): AuthoredRule {
  const first = migrateCustomRules(rules).rules[0];
  if (first?.type === 'evaluation') return { ...first, weights: normalizeWeights(first.weights) };
  return first?.type === 'pattern' ? first : defaultRule();
}

function validateDraft(rule: AuthoredRule): string | null {
  if (rule.type === 'evaluation') {
    if (rule.overrides?.some((override) => override.action.length === 0)) return 'Every hard rule needs at least one direction.';
    if (Object.values(rule.weights).some((value) => !Number.isFinite(value) || value < 0)) return 'Weights must be finite, positive numbers or zero.';
  }
  return RuleValidator.validateRule(rule);
}

export function CustomStrategyBuilder({ onSave, onCancel, initialRules = [], initialName = '' }: CustomStrategyBuilderProps) {
  const [rule, setRule] = useState<AuthoredRule>(() => initialRules.length ? toEditableRule(initialRules) : defaultRule());
  const evaluationDraft = useRef(defaultRule());
  const patternDraft = useRef(defaultPattern());
  const [strategyName, setStrategyName] = useState(initialName);
  const [presetName, setPresetName] = useState(initialRules.length ? '' : 'Balanced');
  const [testGames, setTestGames] = useState<StrategyPreviewGame[] | null>(null);
  const [testProgress, setTestProgress] = useState<number | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [replay, setReplay] = useState<StrategyPreviewGame | null>(null);
  const testJob = useRef<ReturnType<typeof startStrategyPreview> | null>(null);
  const testVersion = useRef(0);

  useEffect(() => () => {
    testVersion.current++;
    testJob.current?.cancel();
  }, []);

  const rules = useMemo(() => [rule], [rule]);
  const summary = useMemo(() => summarizeRules(rules), [rules]);
  const average = (kind: 'strategy' | 'baseline') => testGames ? Math.round(testGames.reduce((sum, game) => sum + game[kind].score, 0) / testGames.length) : 0;
  const strategyAverage = average('strategy');
  const baselineAverage = average('baseline');
  const scoreDifference = strategyAverage - baselineAverage;

  const cancelTest = () => {
    testVersion.current++;
    testJob.current?.cancel();
    testJob.current = null;
    setTestProgress(null);
  };

  const handleRuleChange = (next: AuthoredRule) => {
    cancelTest();
    setRule(next);
    setPresetName('');
    setTestGames(null);
    setTestError(null);
    setSaveError(null);
    setReplay(null);
  };

  const switchMode = (type: AuthoredRule['type']) => {
    if (type === rule.type) return;
    if (rule.type === 'evaluation') evaluationDraft.current = rule;
    else patternDraft.current = rule;
    handleRuleChange(type === 'evaluation' ? evaluationDraft.current : patternDraft.current);
  };

  const handleTestDrive = async () => {
    const invalid = validateDraft(rule);
    if (invalid) { setTestError(invalid); return; }
    cancelTest();
    const version = testVersion.current;
    setTestProgress(0);
    setTestGames(null);
    setTestError(null);
    const job = startStrategyPreview(rules, (completed) => {
      if (version === testVersion.current) setTestProgress(completed);
    });
    testJob.current = job;
    try {
      const games = await job.promise;
      if (version === testVersion.current) setTestGames(games);
    } catch (error) {
      if (version === testVersion.current) setTestError(error instanceof Error ? error.message : 'Test drive failed. Please try again.');
    } finally {
      if (version === testVersion.current) {
        testJob.current = null;
        setTestProgress(null);
      }
    }
  };

  const handleSave = async () => {
    if (isSaving) return;
    const invalid = validateDraft(rule);
    if (invalid) { setSaveError(invalid); return; }
    try {
      cancelTest();
      setSaveError(null);
      setIsSaving(true);
      await onSave(rules, strategyName.trim() || autoName(rules));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save this strategy. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => { if (isSaving) return; cancelTest(); onCancel(); };

  return (
    <div className="h-full flex flex-col bg-surface text-text-primary">
      <div className="px-5 sm:px-7 py-5 border-b border-dark-border flex items-start justify-between gap-3 shrink-0 bg-surface-elevated">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent mb-1">Strategy studio</p>
          <h2 className="text-2xl font-bold text-text-primary">Build your own</h2>
          <p className="text-sm text-text-muted mt-1">Start with an idea. Tune it. Put it to the test.</p>
        </div>
        <button type="button" disabled={isSaving} onClick={handleClose} className="w-9 h-9 rounded-lg border border-dark-border text-text-muted hover:text-text-primary hover:bg-surface disabled:opacity-40" aria-label="Close">×</button>
      </div>

      <fieldset disabled={isSaving} className="flex-1 min-h-0 min-w-0 overflow-y-auto px-5 sm:px-7 py-6 space-y-6">
        <section aria-labelledby="starter-title">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
            <h3 id="starter-title" className="text-sm font-semibold">Choose a starting point</h3>
            <span className="text-[10px] uppercase tracking-wide text-text-muted">No account or API key needed</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRESETS.map((preset) => (
              <button type="button" key={preset.name} aria-pressed={presetName === preset.name}
                onClick={() => { handleRuleChange(preset.rule()); setPresetName(preset.name); }}
                className={`rounded-xl border p-3 text-left transition-colors ${presetName === preset.name ? 'border-accent bg-accent/10' : 'border-dark-border bg-surface-raised hover:border-accent/50'}`}>
                <span className="text-2xl text-accent block mb-2" aria-hidden="true">{preset.symbol}</span>
                <span className="text-sm font-semibold block">{preset.name}</span>
                <span className="text-xs text-text-muted block mt-1 leading-relaxed">{preset.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="controls-title" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 id="controls-title" className="text-sm font-semibold">Make it yours</h3>
            <div className="inline-flex rounded-lg border border-dark-border bg-surface-raised p-1" role="group" aria-label="Strategy type">
              {([{ type: 'evaluation', label: 'Weighted decisions' }, { type: 'pattern', label: 'Move sequence' }] as const).map(({ type, label }) => (
                <button type="button" key={type} aria-pressed={rule.type === type} onClick={() => switchMode(type)} className={`px-3 py-2 rounded-md text-xs font-medium ${rule.type === type ? 'bg-accent text-gray-950' : 'text-text-muted hover:text-text-primary'}`}>{label}</button>
              ))}
            </div>
          </div>
          {rule.type === 'evaluation' ? <EvaluationEditor rule={rule} onChange={handleRuleChange} /> : <PatternEditor rule={rule} onChange={handleRuleChange} />}
        </section>

        <div className="p-4 bg-accent/10 rounded-xl border border-accent/30">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-accent mb-2">What this strategy does</h3>
          <p className="text-sm text-text-primary leading-relaxed">{summary}</p>
        </div>

        <section aria-labelledby="test-drive-title" className="p-4 rounded-xl border border-dark-border bg-surface-raised space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="test-drive-title" className="font-semibold text-sm">Test drive</h3>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">3 fixed-seed games against Random, using your exact settings.</p>
            </div>
            {testProgress !== null ? (
              <button type="button" onClick={cancelTest} className="shrink-0 px-3 py-2 border border-dark-border rounded-lg text-xs text-text-primary hover:bg-surface">Cancel test</button>
            ) : (
              <button type="button" onClick={handleTestDrive} className="shrink-0 px-4 py-2 bg-accent text-gray-950 rounded-lg text-sm font-semibold hover:bg-accent-strong">Test drive</button>
            )}
          </div>
          {testProgress !== null && (
            <div role="status" className="space-y-2">
              <div className="flex justify-between gap-2 text-xs text-text-muted"><span>Playing in the background…</span><span>{testProgress} / 3 games</span></div>
              <progress value={testProgress} max={3} aria-label="Test drive progress" className="w-full h-2 accent-accent" />
              {rule.type === 'evaluation' && rule.depth >= 3 && <p className="text-xs text-text-muted">Depth {rule.depth} explores more possibilities. You can keep editing or cancel any time.</p>}
            </div>
          )}
          {testError && <p role="alert" className="text-sm text-danger">{testError}</p>}
          {testGames && (
            <div className="space-y-4" aria-live="polite">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-surface p-3"><div className="text-lg sm:text-xl font-bold text-accent">{strategyAverage.toLocaleString()}</div><div className="text-[10px] text-text-muted mt-1">your avg score</div></div>
                <div className="rounded-lg bg-surface p-3"><div className="text-lg sm:text-xl font-bold">{baselineAverage.toLocaleString()}</div><div className="text-[10px] text-text-muted mt-1">random avg</div></div>
                <div className="rounded-lg bg-surface p-3"><div className="text-lg sm:text-xl font-bold">{Math.max(...testGames.map((game) => game.strategy.maxTile))}</div><div className="text-[10px] text-text-muted mt-1">your best tile</div></div>
              </div>
              <p className={`text-xs ${scoreDifference >= 0 ? 'text-success' : 'text-text-muted'}`}>
                {scoreDifference === 0 ? 'Matched Random on these three seeds.' : `${Math.abs(scoreDifference).toLocaleString()} points ${scoreDifference > 0 ? 'ahead of' : 'behind'} Random on average.`} A quick sample; run a larger batch to compare reliably.
              </p>
              <div className="space-y-2">
                {testGames.map((game, index) => <button type="button" key={game.seed} onClick={() => setReplay(game)} className="w-full flex items-center justify-between gap-2 rounded-lg border border-dark-border px-3 py-2 text-xs hover:border-accent/50 hover:bg-surface-elevated" aria-label={`Replay test game ${index + 1}`}>
                  <span className="text-text-muted font-mono">{game.seed}</span><span>{game.strategy.score.toLocaleString()} pts · {game.strategy.moveCount} moves</span><span className="text-accent">Replay →</span>
                </button>)}
              </div>
            </div>
          )}
        </section>

        <details className="rounded-xl border border-dark-border bg-surface-raised">
          <summary className="cursor-pointer p-4 text-sm font-semibold text-text-primary">Describe your idea with AI <span className="text-xs font-normal text-text-muted ml-1">Optional</span></summary>
          <div className="px-4 pb-4"><AIStrategyAssistant onGenerate={(generated, name) => { handleRuleChange(toEditableRule(generated)); setStrategyName(name); }} /></div>
        </details>

        <div>
          <label htmlFor="strategy-name" className="block text-sm font-medium text-text-primary mb-2">Strategy name <span className="text-text-muted font-normal">(optional)</span></label>
          <input id="strategy-name" type="text" value={strategyName} maxLength={80} onChange={(event) => setStrategyName(event.target.value)} placeholder={autoName(rules)} className="w-full px-4 py-3 border border-dark-border bg-surface-raised text-text-primary rounded-lg focus:ring-2 focus:ring-accent focus:border-accent" />
          <p className="text-xs text-text-muted mt-2">Leave blank and we’ll name it from your settings.</p>
        </div>
      </fieldset>

      <div className="px-5 sm:px-7 py-4 border-t border-dark-border bg-surface-elevated shrink-0">
        {saveError && <p role="alert" className="text-sm text-danger mb-3">{saveError}</p>}
        <div className="flex gap-3">
          <button type="button" disabled={isSaving} onClick={handleSave} className="flex-1 px-5 py-3 bg-accent text-gray-950 font-semibold rounded-lg hover:bg-accent-strong transition-colors disabled:opacity-60">{isSaving ? 'Saving…' : 'Save Strategy'}</button>
          <button type="button" disabled={isSaving} onClick={handleClose} className="px-5 py-3 text-text-primary border border-dark-border font-medium rounded-lg hover:bg-surface transition-colors disabled:opacity-40">Cancel</button>
        </div>
      </div>
      {replay && <GameReplay seed={replay.seed} moves={replay.strategy.moves} onClose={() => setReplay(null)} />}
    </div>
  );
}
