import { useState, type FC } from 'react';
import { generateSeed } from '../engine/rng';
import { CustomStrategyBuilder } from './CustomStrategyBuilder';
import { StrategyPicker } from './StrategyPicker';
import { useGameStore, type StrategySelection } from '../store/gameStore';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { RuleValidator, type CustomRule } from '../engine/customRules';
import type { Direction } from '../engine/types';
import ConfirmDialog from './ui/ConfirmDialog';

export interface BatchConfig extends StrategySelection {
  batchSize: number;
  seedMode: 'random' | 'fixed' | 'shared';
  fixedSeed?: string;
}
interface BatchConfigPanelProps {
  onStartBatch: (config: BatchConfig) => void;
  onStartComparison?: (
    configA: StrategySelection,
    configB: StrategySelection,
    batchSize: number,
  ) => void;
  isRunning: boolean;
  isRunningComparison?: boolean;
}
const CORNERS = ['bottom-left', 'bottom-right', 'top-left', 'top-right'];
const DIRECTIONS: Direction[] = ['left', 'down', 'right', 'up'];
const ARROWS: Record<Direction, string> = {
  left: '←',
  down: '↓',
  right: '→',
  up: '↑',
};
const DEFAULT_PATTERN: Direction[] = ['left', 'down', 'right', 'down'];

export const BatchConfigPanel: FC<BatchConfigPanelProps> = ({
  onStartBatch,
  onStartComparison,
  isRunning,
  isRunningComparison = false,
}) => {
  const [strategyType, setStrategyType] = useState('directional_priority');
  const [corner, setCorner] = useState('bottom-left');
  const [pattern, setPattern] = useState<Direction[]>(DEFAULT_PATTERN);
  const [strategyTypeB, setStrategyTypeB] = useState('random');
  const [cornerB, setCornerB] = useState('bottom-left');
  const [patternB, setPatternB] = useState<Direction[]>(DEFAULT_PATTERN);
  const [compareMode, setCompareMode] = useState(false);
  const [batchSize, setBatchSize] = useState('100');
  const [seedMode, setSeedMode] = useState<'random' | 'fixed'>('random');
  const [fixedSeed, setFixedSeed] = useState(generateSeed);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [editorRules, setEditorRules] = useState<CustomRule[]>([]);
  const [editorName, setEditorName] = useState('');
  const [builderSide, setBuilderSide] = useState<'A' | 'B'>('A');
  const [builderSaving, setBuilderSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const savedStrategies = useGameStore((s) => s.savedStrategies);
  const saveCustomStrategy = useGameStore((s) => s.saveCustomStrategy);
  const deleteCustomStrategy = useGameStore((s) => s.deleteCustomStrategy);
  const busy = isRunning || isRunningComparison;
  const closeBuilder = () => {
    if (!builderSaving) setShowBuilder(false);
  };
  const slideOverRef = useFocusTrap<HTMLDivElement>(showBuilder, closeBuilder);

  const openBuilder = (id?: string, side: 'A' | 'B' = 'A') => {
    setBuilderSide(side);
    const saved = savedStrategies.find((s) => s.id === id);
    setEditingId(saved?.id);
    setEditorRules(
      saved ? ((saved.params.customRules as CustomRule[]) ?? []) : [],
    );
    setEditorName(saved?.name ?? '');
    setShowBuilder(true);
  };
  const resolveSelection = (
    type: string,
    selectedCorner: string,
    sequence: Direction[],
  ): StrategySelection | null => {
    if (type.startsWith('saved:')) {
      const saved = savedStrategies.find((s) => s.id === type.slice(6));
      const rules = saved?.params.customRules as CustomRule[] | undefined;
      if (
        !saved ||
        !rules?.length ||
        rules.some((r) => RuleValidator.validateRule(r))
      )
        return null;
      return {
        strategyType: 'custom',
        customRules: rules,
        customStrategyName: saved.name,
      };
    }
    if (type === 'custom') return null;
    if (type === 'corner_anchor')
      return { strategyType: type, strategyParams: { corner: selectedCorner } };
    if (type === 'pattern')
      return sequence.length
        ? { strategyType: type, strategyParams: { pattern: sequence } }
        : null;
    return { strategyType: type };
  };
  const selectionA = resolveSelection(strategyType, corner, pattern);
  const selectionB = resolveSelection(strategyTypeB, cornerB, patternB);
  const gameCount = Number(batchSize);
  const validSize =
    Number.isInteger(gameCount) && gameCount >= 1 && gameCount <= 10000;
  const validSeed = seedMode !== 'fixed' || fixedSeed.trim().length > 0;
  const canStart =
    !busy &&
    validSize &&
    selectionA &&
    (compareMode ? selectionB && onStartComparison : validSeed);
  const handleStart = () => {
    if (!canStart || !selectionA) return;
    if (compareMode && selectionB && onStartComparison)
      onStartComparison(selectionA, selectionB, gameCount);
    else
      onStartBatch({
        ...selectionA,
        batchSize: gameCount,
        seedMode,
        fixedSeed: seedMode === 'fixed' ? fixedSeed.trim() : undefined,
      });
  };
  const handleSave = async (rules: CustomRule[], name: string) => {
    setBuilderSaving(true);
    try {
      const id = await saveCustomStrategy(name, rules, editingId);
      if (!id)
        throw new Error(
          useGameStore.getState().storageError ??
            'Could not save your strategy. Please try again.',
        );
      (builderSide === 'A' ? setStrategyType : setStrategyTypeB)(`saved:${id}`);
      setShowBuilder(false);
    } finally {
      setBuilderSaving(false);
    }
  };
  const handleDelete = async () => {
    if (!deleteId) return;
    const deleted = await deleteCustomStrategy(deleteId);
    if (!deleted) return;
    if (strategyType === `saved:${deleteId}`)
      setStrategyType('directional_priority');
    if (strategyTypeB === `saved:${deleteId}`) setStrategyTypeB('random');
    setDeleteId(null);
  };
  const extraControls = (
    type: string,
    selectedCorner: string,
    setSelectedCorner: (v: string) => void,
    sequence: Direction[],
    setSequence: (v: Direction[]) => void,
    side: string,
  ) => {
    if (type === 'corner_anchor')
      return (
        <div className="mt-4">
          <label
            htmlFor={`corner-${side}`}
            className="block text-xs text-text-muted mb-2"
          >
            Anchor corner
          </label>
          <select
            id={`corner-${side}`}
            value={selectedCorner}
            onChange={(e) => setSelectedCorner(e.target.value)}
            disabled={busy}
            className="w-full rounded-lg border border-dark-border bg-surface-raised px-3 py-2.5 text-sm capitalize"
          >
            {CORNERS.map((c) => (
              <option key={c} value={c}>
                {c.replace('-', ' ')}
              </option>
            ))}
          </select>
        </div>
      );
    if (type !== 'pattern') return null;
    return (
      <div className="mt-4 rounded-xl border border-dark-border bg-surface-raised/40 p-3 space-y-3">
        <p className="text-xs text-text-muted">
          Move sequence · {sequence.length}/8 steps
        </p>
        <div
          className="flex gap-1.5 flex-wrap min-h-8"
          aria-label={`Strategy ${side} move sequence`}
        >
          {sequence.map((d, i) => (
            <span
              key={i}
              title={d}
              className="grid place-items-center w-8 h-8 rounded-md bg-surface-elevated font-mono text-accent"
            >
              {ARROWS[d]}
            </span>
          ))}
          {!sequence.length && (
            <span className="text-xs text-danger self-center">
              Add at least one direction.
            </span>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {DIRECTIONS.map((d) => (
            <button
              key={d}
              disabled={busy || sequence.length >= 8}
              onClick={() => setSequence([...sequence, d])}
              aria-label={`Add ${d} to strategy ${side}`}
              className="w-9 h-8 rounded-md border border-dark-border bg-surface-raised hover:border-accent text-sm disabled:opacity-40"
            >
              {ARROWS[d]}
            </button>
          ))}
          <button
            disabled={busy || !sequence.length}
            onClick={() => setSequence(sequence.slice(0, -1))}
            className="px-2 text-xs text-text-muted hover:text-text-primary disabled:opacity-40"
          >
            Undo
          </button>
          <button
            disabled={busy || !sequence.length}
            onClick={() => setSequence([])}
            className="px-2 text-xs text-text-muted hover:text-danger disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-dark-border bg-surface overflow-hidden">
      <div className="px-5 sm:px-6 py-5 border-b border-dark-border">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-semibold text-lg">Configure a run</h2>
          <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
            Seeded · Reproducible
          </span>
        </div>
        <div
          className="grid grid-cols-2 gap-1 rounded-lg bg-app-bg p-1"
          aria-label="Simulation mode"
        >
          <button
            disabled={busy}
            onClick={() => setCompareMode(false)}
            aria-pressed={!compareMode}
            className={`rounded-md px-3 py-2 text-sm transition-colors ${!compareMode ? 'bg-surface-elevated text-text-primary shadow' : 'text-text-muted hover:text-text-primary'} disabled:opacity-50`}
          >
            Single strategy
          </button>
          <button
            disabled={busy || !onStartComparison}
            onClick={() => setCompareMode(true)}
            aria-pressed={compareMode}
            className={`rounded-md px-3 py-2 text-sm transition-colors ${compareMode ? 'bg-surface-elevated text-text-primary shadow' : 'text-text-muted hover:text-text-primary'} disabled:opacity-50`}
          >
            Head to head
          </button>
        </div>
        {compareMode && (
          <p className="text-xs leading-relaxed text-text-muted mt-3">
            Both strategies play identical seeds. Compare scores, win rates, and
            individual games.
          </p>
        )}
      </div>
      <div className="p-5 sm:p-6 space-y-6">
        <section>
          <Step
            number="01"
            title={compareMode ? 'Pick strategy A' : 'Choose your strategy'}
          />
          <StrategyPicker
            strategyType={strategyType}
            onSelect={setStrategyType}
            isRunning={busy}
            savedStrategies={savedStrategies}
            onDeleteSaved={setDeleteId}
            onEditSaved={openBuilder}
            onCreate={() => openBuilder()}
          />
          {extraControls(
            strategyType,
            corner,
            setCorner,
            pattern,
            setPattern,
            'A',
          )}
        </section>
        {compareMode && (
          <section className="pt-5 border-t border-dark-border">
            <Step number="02" title="Pick strategy B" />
            <StrategyPicker
              strategyType={strategyTypeB}
              onSelect={setStrategyTypeB}
              isRunning={busy}
              savedStrategies={savedStrategies}
              onEditSaved={(id) => openBuilder(id, 'B')}
              onCreate={() => openBuilder(undefined, 'B')}
            />
            {extraControls(
              strategyTypeB,
              cornerB,
              setCornerB,
              patternB,
              setPatternB,
              'B',
            )}
          </section>
        )}
        <section className="pt-5 border-t border-dark-border">
          <Step
            number={compareMode ? '03' : '02'}
            title="Set your sample size"
          />
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[10, 100, 1000, 10000].map((size) => (
              <button
                key={size}
                disabled={busy}
                onClick={() => setBatchSize(String(size))}
                aria-pressed={gameCount === size}
                className={`rounded-lg border py-2 text-sm font-mono ${gameCount === size ? 'border-accent/60 bg-accent/10 text-accent' : 'border-dark-border text-text-muted hover:text-text-primary'} disabled:opacity-50`}
              >
                {size.toLocaleString()}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <input
              id="batch-size"
              type="number"
              min="1"
              max="10000"
              step="1"
              value={batchSize}
              onChange={(e) => setBatchSize(e.target.value)}
              disabled={busy}
              aria-invalid={!validSize}
              aria-describedby="batch-size-help"
              className="w-32 rounded-lg border border-dark-border bg-surface-raised px-3 py-2 text-sm font-mono"
            />
            <label htmlFor="batch-size" className="text-sm text-text-muted">
              games {compareMode ? 'per strategy' : 'per run'}
            </label>
          </div>
          <p
            id="batch-size-help"
            className={`text-xs mt-2 ${validSize ? 'text-text-muted' : 'text-danger'}`}
          >
            {validSize
              ? '10 for a quick check · 1,000 for a stronger comparison.'
              : 'Enter a whole number between 1 and 10,000.'}
          </p>
        </section>
        <section className="pt-5 border-t border-dark-border">
          <Step number={compareMode ? '04' : '03'} title="Choose your seeds" />
          {compareMode ? (
            <div className="text-sm bg-success/5 border border-success/20 rounded-lg p-3">
              <span className="text-success font-medium">
                Shared seeds, fair comparison
              </span>
              <p className="text-xs text-text-muted mt-1">
                Each strategy sees the same starting boards and random stream.
              </p>
            </div>
          ) : (
            <>
              <div className="flex gap-4 text-sm">
                {(['random', 'fixed'] as const).map((mode) => (
                  <label
                    key={mode}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="seed-mode"
                      value={mode}
                      checked={seedMode === mode}
                      onChange={() => setSeedMode(mode)}
                      disabled={busy}
                      className="accent-accent"
                    />
                    {mode === 'random' ? 'Fresh seeds' : 'Fixed seed'}
                  </label>
                ))}
              </div>
              <p className="text-xs text-text-muted mt-2">
                {seedMode === 'random'
                  ? 'A different seed for every game. Best for measuring performance.'
                  : 'Repeat one identical game. Useful for debugging a strategy.'}
              </p>
              {seedMode === 'fixed' && (
                <div className="flex gap-2 mt-3">
                  <input
                    aria-label="Fixed seed"
                    value={fixedSeed}
                    onChange={(e) => setFixedSeed(e.target.value.toUpperCase())}
                    disabled={busy}
                    maxLength={8}
                    aria-invalid={!validSeed}
                    placeholder="A7X9K2M1"
                    className="min-w-0 flex-1 rounded-lg border border-dark-border bg-surface-raised px-3 py-2 font-mono text-sm"
                  />
                  <button
                    onClick={() => setFixedSeed(generateSeed())}
                    disabled={busy}
                    className="px-3 py-2 text-xs rounded-lg border border-dark-border text-text-muted hover:text-text-primary"
                  >
                    Shuffle
                  </button>
                </div>
              )}
              {!validSeed && (
                <p className="text-xs text-danger mt-2">
                  Enter a seed before starting.
                </p>
              )}
            </>
          )}
        </section>
        <button
          onClick={handleStart}
          disabled={!canStart}
          className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl bg-accent text-gray-950 font-semibold hover:bg-accent-strong transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span aria-hidden="true">▶</span>
          {busy
            ? 'Simulation in progress…'
            : compareMode
              ? 'Run head-to-head comparison'
              : 'Start simulation'}
          <span className="font-mono text-xs opacity-70">
            {validSize
              ? `${(gameCount * (compareMode ? 2 : 1)).toLocaleString()} games`
              : ''}
          </span>
        </button>
        <p className="text-[11px] text-center text-text-muted -mt-3">
          Runs locally in your browser · Full replay for every game
        </p>
      </div>
      {showBuilder && (
        <>
          <div
            className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm"
            onClick={closeBuilder}
          />
          <div
            ref={slideOverRef}
            role="dialog"
            aria-modal="true"
            aria-label="Custom Strategy Builder"
            tabIndex={-1}
            className="fixed right-0 top-0 bottom-0 w-full md:w-[760px] max-w-full bg-surface border-l border-dark-border shadow-2xl z-50 overflow-y-auto outline-none"
          >
            <CustomStrategyBuilder
              onSave={handleSave}
              onCancel={closeBuilder}
              initialRules={editorRules}
              initialName={editorName}
            />
          </div>
        </>
      )}
      <ConfirmDialog
        open={!!deleteId}
        title="Delete saved strategy?"
        message={`“${savedStrategies.find((s) => s.id === deleteId)?.name ?? 'This strategy'}” will be removed from this device. Previous simulation results are kept.`}
        confirmLabel="Delete strategy"
        danger
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
};
function Step({ number, title }: { number: string; title: string }) {
  return (
    <h3 className="flex items-center gap-2.5 mb-3 text-sm font-semibold">
      <span className="text-[10px] font-mono text-accent bg-accent/10 border border-accent/15 px-1.5 py-1 rounded">
        {number}
      </span>
      {title}
    </h3>
  );
}
export default BatchConfigPanel;
