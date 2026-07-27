/**
 * Batch Configuration Panel
 * Tier-1 flow: pick a tile (built-in preset, saved strategy, or create your
 * own), set batch size, start. Compare mode accepts any two tiles —
 * including saved custom strategies — on shared seeds.
 */

import { useState, type FC } from 'react';
import { generateSeed } from '../engine/rng';
import { CustomStrategyBuilder } from './CustomStrategyBuilder';
import { StrategyPicker, type StrategyType } from './StrategyPicker';
import { useGameStore } from '../store/gameStore';
import type { StrategySelection } from '../store/gameStore';
import { useFocusTrap } from '../hooks/useFocusTrap';
import type { CustomRule } from '../engine/customRules';
import type { Direction } from '../engine/types';

export interface BatchConfig {
  strategyType: string;
  strategyParams?: Record<string, unknown>;
  batchSize: number;
  seedMode: 'random' | 'fixed' | 'shared';
  fixedSeed?: string;
  customRules?: CustomRule[];
  customStrategyName?: string;
}

interface BatchConfigPanelProps {
  onStartBatch: (config: BatchConfig) => void;
  onStartComparison?: (configA: StrategySelection, configB: StrategySelection, batchSize: number) => void;
  isRunning: boolean;
  isRunningComparison?: boolean;
}

const CORNER_OPTIONS = [
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-right', label: 'Top Right' },
];

const PATTERN_DIRECTIONS: Direction[] = ['left', 'down', 'right', 'up'];
const DEFAULT_PATTERN: Direction[] = ['left', 'down', 'right', 'down'];

export const BatchConfigPanel: FC<BatchConfigPanelProps> = ({
  onStartBatch,
  onStartComparison,
  isRunning,
  isRunningComparison = false,
}) => {
  const [strategyType, setStrategyType] = useState<string>('directional_priority');
  const [corner, setCorner] = useState('bottom-left');
  const [pattern, setPattern] = useState<Direction[]>(DEFAULT_PATTERN);
  const [batchSize, setBatchSize] = useState(100);
  const [seedMode, setSeedMode] = useState<'random' | 'fixed'>('random');
  const [fixedSeed, setFixedSeed] = useState(generateSeed());
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [customRules, setCustomRules] = useState<CustomRule[]>([]);
  const [customStrategyName, setCustomStrategyName] = useState('');

  // Compare mode: strategy A reuses the fields above; strategy B has its own
  // tile selection. Any tile works on either side, including saved customs.
  const [compareMode, setCompareMode] = useState(false);
  const [strategyTypeB, setStrategyTypeB] = useState<string>('random');
  const [cornerB, setCornerB] = useState('bottom-left');
  const [patternB, setPatternB] = useState<Direction[]>(DEFAULT_PATTERN);

  const savedStrategies = useGameStore((s) => s.savedStrategies);
  const saveCustomStrategy = useGameStore((s) => s.saveCustomStrategy);
  const deleteCustomStrategy = useGameStore((s) => s.deleteCustomStrategy);

  const busy = isRunning || isRunningComparison;

  const handleCancelCustomBuilder = () => {
    setShowCustomBuilder(false);
  };

  const slideOverRef = useFocusTrap<HTMLDivElement>(showCustomBuilder, handleCancelCustomBuilder);

  /**
   * Resolve a tile selection into the StrategySelection sent to the store.
   * 'saved:<id>' tiles carry the saved strategy's rules; 'custom' carries the
   * transient rules from the builder session.
   */
  const resolveSelection = (
    type: string,
    cornerValue: string,
    patternValue: Direction[]
  ): StrategySelection | null => {
    if (type.startsWith('saved:')) {
      const id = type.slice('saved:'.length);
      const saved = savedStrategies.find((s) => s.id === id);
      if (!saved) return null;
      return {
        strategyType: 'custom',
        customRules: (saved.params.customRules as CustomRule[] | undefined) ?? [],
        customStrategyName: saved.name,
      };
    }
    if (type === 'custom') {
      if (customRules.length === 0) return null;
      return {
        strategyType: 'custom',
        customRules,
        customStrategyName: customStrategyName || 'Custom Strategy',
      };
    }
    if (type === 'corner_anchor') {
      return { strategyType: type, strategyParams: { corner: cornerValue } };
    }
    if (type === 'pattern') {
      return { strategyType: type, strategyParams: { pattern: patternValue } };
    }
    return { strategyType: type };
  };

  const selectionA = resolveSelection(strategyType, corner, pattern);
  const selectionB = resolveSelection(strategyTypeB, cornerB, patternB);
  const startDisabled = busy || !selectionA || (compareMode && !selectionB);

  const handleStart = () => {
    if (!selectionA) return;

    if (compareMode && onStartComparison) {
      if (!selectionB) return;
      onStartComparison(selectionA, selectionB, batchSize);
      return;
    }

    onStartBatch({
      ...selectionA,
      batchSize,
      seedMode,
      fixedSeed: seedMode === 'fixed' ? fixedSeed : undefined,
    });
  };

  const handleSaveCustomStrategy = (rules: CustomRule[], name: string) => {
    setCustomRules(rules);
    setCustomStrategyName(name);
    setShowCustomBuilder(false);
    setStrategyType('custom');
    void saveCustomStrategy(name, rules);
  };

  const handleDeleteSaved = (id: string) => {
    if (strategyType === `saved:${id}`) setStrategyType('directional_priority');
    if (strategyTypeB === `saved:${id}`) setStrategyTypeB('random');
    void deleteCustomStrategy(id);
  };

  const patternEditor = (
    value: Direction[],
    onChange: (next: Direction[]) => void,
    label: string
  ) => (
    <div>
      <label className="block text-sm font-medium text-text-muted mb-2">{label}</label>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-mono text-text-primary bg-surface-raised border border-dark-border rounded-md px-3 py-2 min-w-28">
          {value.map((d) => d[0].toUpperCase()).join(' ') || '—'}
        </span>
        {PATTERN_DIRECTIONS.map((direction) => (
          <button
            key={direction}
            onClick={() => onChange([...value, direction])}
            disabled={busy || value.length >= 8}
            className="px-2.5 py-1.5 text-xs rounded-md border capitalize bg-surface-raised text-text-primary border-dark-border hover:bg-surface-elevated disabled:opacity-50"
          >
            + {direction}
          </button>
        ))}
        <button
          onClick={() => onChange([])}
          disabled={busy}
          className="px-2.5 py-1.5 text-xs rounded-md border bg-surface-raised text-text-muted border-dark-border hover:text-danger disabled:opacity-50"
        >
          Clear
        </button>
      </div>
      {value.length === 0 && (
        <p className="text-xs text-danger mt-1">Add at least one move to the sequence.</p>
      )}
    </div>
  );

  return (
    <div className="bg-surface rounded-xl shadow-lg p-6 space-y-6 border border-dark-border">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-2xl font-bold text-text-primary">Batch Simulation</h2>
        <label className="flex items-center gap-2 shrink-0 cursor-pointer select-none">
          <span className="text-xs font-medium text-text-muted">Compare mode</span>
          <input
            type="checkbox"
            role="switch"
            aria-checked={compareMode}
            checked={compareMode}
            onChange={() => setCompareMode(!compareMode)}
            disabled={busy}
            className="h-4 w-8 accent-accent"
          />
        </label>
      </div>

      {compareMode && (
        <p className="text-xs text-amber-200 bg-amber-500/10 border border-accent/35 rounded-lg p-3">
          Compare mode runs Strategy A then Strategy B on the exact same seeds, so results are
          directly comparable — saved custom strategies included.
        </p>
      )}

      <div>
        {compareMode && (
          <label className="block text-sm font-medium text-text-muted mb-3">Strategy A</label>
        )}
        <StrategyPicker
          strategyType={strategyType}
          onSelect={(type) => setStrategyType(type)}
          isRunning={busy}
          savedStrategies={savedStrategies}
          onDeleteSaved={handleDeleteSaved}
          excludeCreate={compareMode}
          onCreate={() => setShowCustomBuilder(true)}
          customStrategyName={customRules.length > 0 ? customStrategyName : undefined}
        />
        {!compareMode && strategyType === 'custom' && customRules.length > 0 && (
          <button
            onClick={() => setShowCustomBuilder(true)}
            disabled={busy}
            className="mt-2 text-sm text-accent hover:text-amber-300 font-medium"
          >
            Edit “{customStrategyName}”
          </button>
        )}
      </div>

      {strategyType === 'corner_anchor' && (
        <div>
          <label className="block text-sm font-medium text-text-muted mb-2">
            {compareMode ? 'Strategy A Corner Position' : 'Corner Position'}
          </label>
          <select
            value={corner}
            onChange={(e) => setCorner(e.target.value)}
            disabled={busy}
            className="w-full px-3 py-2 border border-dark-border bg-surface-raised text-text-primary rounded-md focus:ring-2 focus:ring-accent"
          >
            {CORNER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {strategyType === 'pattern' &&
        patternEditor(pattern, setPattern, compareMode ? 'Strategy A Sequence' : 'Move Sequence')}

      {showCustomBuilder && (
        <>
          <div
            className="fixed inset-0 bg-black/70 z-40 transition-opacity"
            onClick={handleCancelCustomBuilder}
          />

          <div
            ref={slideOverRef}
            role="dialog"
            aria-modal="true"
            aria-label="Custom Strategy Builder"
            tabIndex={-1}
            className="fixed right-0 top-0 bottom-0 w-full md:w-[640px] bg-surface-elevated border-l border-dark-border shadow-2xl z-50 overflow-y-auto transform transition-transform outline-none"
          >
            <CustomStrategyBuilder
              onSave={handleSaveCustomStrategy}
              onCancel={handleCancelCustomBuilder}
              initialRules={customRules}
              initialName={customStrategyName}
            />
          </div>
        </>
      )}

      {compareMode && (
        <div className="pt-2 border-t border-dark-border space-y-4">
          <label className="block text-sm font-medium text-text-muted">Strategy B</label>
          <StrategyPicker
            strategyType={strategyTypeB}
            onSelect={(type: StrategyType) => setStrategyTypeB(type)}
            isRunning={busy}
            savedStrategies={savedStrategies}
            excludeCreate
          />

          {strategyTypeB === 'corner_anchor' && (
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">
                Strategy B Corner Position
              </label>
              <select
                value={cornerB}
                onChange={(e) => setCornerB(e.target.value)}
                disabled={busy}
                className="w-full px-3 py-2 border border-dark-border bg-surface-raised text-text-primary rounded-md focus:ring-2 focus:ring-accent"
              >
                {CORNER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {strategyTypeB === 'pattern' &&
            patternEditor(patternB, setPatternB, 'Strategy B Sequence')}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-text-muted mb-2">
          Number of Games{compareMode ? ' (per strategy)' : ''}
        </label>
        <input
          type="number"
          value={batchSize}
          onChange={(e) => setBatchSize(Math.max(1, Math.min(10000, Number(e.target.value))))}
          disabled={busy}
          min={1}
          max={10000}
          className="w-full px-3 py-2 border border-dark-border bg-surface-raised text-text-primary rounded-md focus:ring-2 focus:ring-accent"
        />
        <p className="text-xs text-text-muted mt-1">Min: 1, Max: 10,000</p>
      </div>

      {compareMode ? (
        <div className="rounded-lg border border-dark-border bg-surface-raised px-3 py-2">
          <div className="font-medium text-text-primary text-sm">Seeds: Shared</div>
          <div className="text-xs text-text-muted">
            Both strategies play the exact same seeds — applied automatically.
          </div>
        </div>
      ) : (
        <div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={seedMode === 'fixed'}
              onChange={() => setSeedMode(seedMode === 'fixed' ? 'random' : 'fixed')}
              disabled={busy}
              className="accent-accent"
            />
            <span className="text-sm font-medium text-text-muted">
              Use a fixed seed (every game identical — for debugging)
            </span>
          </label>
          {seedMode === 'fixed' && (
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={fixedSeed}
                onChange={(e) => setFixedSeed(e.target.value.toUpperCase())}
                disabled={busy}
                maxLength={8}
                className="flex-1 px-3 py-2 border border-dark-border bg-surface-raised text-text-primary rounded-md font-mono focus:ring-2 focus:ring-accent"
                placeholder="A7X9K2M1"
              />
              <button
                onClick={() => setFixedSeed(generateSeed())}
                disabled={busy}
                className="px-3 py-2 bg-surface-raised hover:bg-surface-elevated text-text-primary rounded-md text-sm disabled:opacity-50 border border-dark-border"
              >
                Random
              </button>
            </div>
          )}
        </div>
      )}

      <button
        onClick={handleStart}
        disabled={startDisabled}
        className="w-full px-6 py-3 bg-accent hover:bg-accent-strong text-gray-950 font-bold rounded-lg shadow-lg shadow-amber-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy
          ? 'Running...'
          : compareMode
            ? 'Run Comparison'
            : 'Start Batch Simulation'}
      </button>
    </div>
  );
};

export default BatchConfigPanel;
