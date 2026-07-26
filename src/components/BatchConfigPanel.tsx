/**
 * Batch Configuration Panel
 * UI for configuring and starting batch simulations, including Compare mode
 * (strategy A vs strategy B head-to-head on identical seeds).
 */

import { useState, type FC } from 'react';
import { generateSeed } from '../engine/rng';
import { CustomStrategyBuilder } from './CustomStrategyBuilder';
import { StrategyPicker, type StrategyType } from './StrategyPicker';
import { SavedStrategiesList } from './SavedStrategiesList';
import { useGameStore } from '../store/gameStore';
import type { StrategySelection } from '../store/gameStore';
import { useFocusTrap } from '../hooks/useFocusTrap';
import type { CustomRule } from '../engine/customRules';

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

export const BatchConfigPanel: FC<BatchConfigPanelProps> = ({
  onStartBatch,
  onStartComparison,
  isRunning,
  isRunningComparison = false,
}) => {
  const [strategyType, setStrategyType] = useState<StrategyType>('directional_priority');
  const [corner, setCorner] = useState('bottom-left');
  const [batchSize, setBatchSize] = useState(100);
  const [seedMode, setSeedMode] = useState<'random' | 'fixed' | 'shared'>('random');
  const [fixedSeed, setFixedSeed] = useState(generateSeed());
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [customRules, setCustomRules] = useState<CustomRule[]>([]);
  const [customStrategyName, setCustomStrategyName] = useState('');

  // Compare mode: strategy A reuses the fields above; strategy B is a
  // second, simpler slot (built-in strategies only — no custom builder).
  const [compareMode, setCompareMode] = useState(false);
  const [strategyTypeB, setStrategyTypeB] = useState<StrategyType>('random');
  const [cornerB, setCornerB] = useState('bottom-left');

  const savedStrategies = useGameStore((s) => s.savedStrategies);
  const saveCustomStrategy = useGameStore((s) => s.saveCustomStrategy);
  const deleteCustomStrategy = useGameStore((s) => s.deleteCustomStrategy);

  const busy = isRunning || isRunningComparison;

  const handleCancelCustomBuilder = () => {
    setShowCustomBuilder(false);
  };

  const slideOverRef = useFocusTrap<HTMLDivElement>(showCustomBuilder, handleCancelCustomBuilder);

  const toggleCompareMode = () => {
    const next = !compareMode;
    setCompareMode(next);
    if (next && strategyType === 'custom') {
      // Custom strategies aren't supported as either side of a comparison.
      setStrategyType('directional_priority');
    }
  };

  const handleStart = () => {
    if (compareMode && onStartComparison) {
      const configA: StrategySelection = {
        strategyType,
        strategyParams: strategyType === 'corner_anchor' ? { corner } : undefined,
      };
      const configB: StrategySelection = {
        strategyType: strategyTypeB,
        strategyParams: strategyTypeB === 'corner_anchor' ? { corner: cornerB } : undefined,
      };
      onStartComparison(configA, configB, batchSize);
      return;
    }

    const config: BatchConfig = {
      strategyType,
      strategyParams:
        strategyType === 'corner_anchor' ? { corner } : undefined,
      batchSize,
      seedMode,
      fixedSeed: seedMode === 'fixed' ? fixedSeed : undefined,
      customRules: strategyType === 'custom' ? customRules : undefined,
      customStrategyName: strategyType === 'custom' ? customStrategyName : undefined,
    };
    onStartBatch(config);
  };

  const handleSaveCustomStrategy = (rules: CustomRule[], name: string) => {
    setCustomRules(rules);
    setCustomStrategyName(name);
    setShowCustomBuilder(false);
    void saveCustomStrategy(name, rules);
  };

  const handleLoadSavedStrategy = (strategy: { name: string; customRules: CustomRule[] }) => {
    setCustomRules(strategy.customRules);
    setCustomStrategyName(strategy.name);
    setStrategyType('custom');
  };

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
            onChange={toggleCompareMode}
            disabled={busy}
            className="h-4 w-8 accent-accent"
          />
        </label>
      </div>

      {compareMode && (
        <p className="text-xs text-amber-200 bg-amber-500/10 border border-accent/35 rounded-lg p-3">
          Compare mode runs Strategy A then Strategy B on the same set of seeds, so results are
          directly comparable. Seed mode is forced to Shared and the custom strategy builder is
          unavailable for either side.
        </p>
      )}

      <div>
        <label className="block text-sm font-medium text-text-muted mb-3">
          {compareMode ? 'Strategy A' : undefined}
        </label>
        <StrategyPicker
          strategyType={strategyType}
          onSelect={setStrategyType}
          isRunning={busy}
          customRuleCount={customRules.length}
          excludeCustom={compareMode}
        />
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

      {!compareMode && strategyType === 'custom' && !showCustomBuilder && (
        <div className="p-4 bg-amber-500/10 rounded-xl border border-accent/35">
          {customRules.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-accent">{customStrategyName}</h3>
                <button
                  onClick={() => setShowCustomBuilder(true)}
                  className="text-sm text-accent hover:text-amber-300 font-medium"
                >
                  Edit Rules
                </button>
              </div>
              <p className="text-sm text-amber-200/80">
                {customRules.length} rule{customRules.length !== 1 ? 's' : ''} configured
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-amber-200/80 mb-3">
                Create your own custom strategy using manual rules or AI assistance
              </p>
              <button
                onClick={() => setShowCustomBuilder(true)}
                disabled={busy}
                className="px-4 py-2 bg-accent text-gray-950 rounded-lg hover:bg-accent-strong disabled:opacity-50 font-semibold transition-colors"
              >
                Build Custom Strategy
              </button>
            </div>
          )}
        </div>
      )}

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

      {!compareMode && strategyType === 'custom' && (
        <SavedStrategiesList
          strategies={savedStrategies}
          onLoad={handleLoadSavedStrategy}
          onDelete={(id) => void deleteCustomStrategy(id)}
        />
      )}

      {compareMode && (
        <div className="pt-2 border-t border-dark-border space-y-4">
          <label className="block text-sm font-medium text-text-muted">Strategy B</label>
          <StrategyPicker
            strategyType={strategyTypeB}
            onSelect={setStrategyTypeB}
            isRunning={busy}
            customRuleCount={0}
            excludeCustom
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
          <div className="font-medium text-text-primary text-sm">Seed Mode: Shared</div>
          <div className="text-xs text-text-muted">
            Required for head-to-head comparison — both strategies play the exact same seeds.
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-text-muted mb-2">
            Seed Mode
          </label>
          <div className="space-y-2">
            <label className="flex items-start">
              <input
                type="radio"
                name="seedMode"
                value="random"
                checked={seedMode === 'random'}
                onChange={() => setSeedMode('random')}
                disabled={busy}
                className="mt-1 mr-2 accent-accent"
              />
              <div>
                <div className="font-medium text-text-primary">Random</div>
                <div className="text-xs text-text-muted">
                  Each game gets a unique random seed
                </div>
              </div>
            </label>
            <label className="flex items-start">
              <input
                type="radio"
                name="seedMode"
                value="fixed"
                checked={seedMode === 'fixed'}
                onChange={() => setSeedMode('fixed')}
                disabled={busy}
                className="mt-1 mr-2 accent-accent"
              />
              <div>
                <div className="font-medium text-text-primary">Fixed</div>
                <div className="text-xs text-text-muted">
                  All games use the same seed (test consistency)
                </div>
              </div>
            </label>
            <label className="flex items-start">
              <input
                type="radio"
                name="seedMode"
                value="shared"
                checked={seedMode === 'shared'}
                onChange={() => setSeedMode('shared')}
                disabled={busy}
                className="mt-1 mr-2 accent-accent"
              />
              <div>
                <div className="font-medium text-text-primary">Shared</div>
                <div className="text-xs text-text-muted">
                  Generate seeds for head-to-head comparison
                </div>
              </div>
            </label>
          </div>
        </div>
      )}

      {!compareMode && seedMode === 'fixed' && (
        <div>
          <label className="block text-sm font-medium text-text-muted mb-2">
            Seed
          </label>
          <div className="flex gap-2">
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
        </div>
      )}

      <button
        onClick={handleStart}
        disabled={busy}
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
