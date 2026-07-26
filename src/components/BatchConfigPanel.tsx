/**
 * Batch Configuration Panel
 * UI for configuring and starting batch simulations
 */

import { useState, type FC } from 'react';
import { generateSeed } from '../engine/rng';
import { CustomStrategyBuilder } from './CustomStrategyBuilder';
import { StrategyPicker, type StrategyType } from './StrategyPicker';
import { SavedStrategiesList } from './SavedStrategiesList';
import { useGameStore } from '../store/gameStore';
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
  isRunning: boolean;
}

export const BatchConfigPanel: FC<BatchConfigPanelProps> = ({
  onStartBatch,
  isRunning,
}) => {
  const [strategyType, setStrategyType] = useState<StrategyType>('directional_priority');
  const [corner, setCorner] = useState('bottom-left');
  const [batchSize, setBatchSize] = useState(100);
  const [seedMode, setSeedMode] = useState<'random' | 'fixed' | 'shared'>('random');
  const [fixedSeed, setFixedSeed] = useState(generateSeed());
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [customRules, setCustomRules] = useState<CustomRule[]>([]);
  const [customStrategyName, setCustomStrategyName] = useState('');

  const savedStrategies = useGameStore((s) => s.savedStrategies);
  const saveCustomStrategy = useGameStore((s) => s.saveCustomStrategy);
  const deleteCustomStrategy = useGameStore((s) => s.deleteCustomStrategy);

  const handleCancelCustomBuilder = () => {
    setShowCustomBuilder(false);
  };

  const slideOverRef = useFocusTrap<HTMLDivElement>(showCustomBuilder, handleCancelCustomBuilder);

  const handleStart = () => {
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
      <h2 className="text-2xl font-bold text-text-primary">Batch Simulation</h2>

      <StrategyPicker
        strategyType={strategyType}
        onSelect={setStrategyType}
        isRunning={isRunning}
        customRuleCount={customRules.length}
      />

      {strategyType === 'custom' && !showCustomBuilder && (
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
                disabled={isRunning}
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

      {strategyType === 'custom' && (
        <SavedStrategiesList
          strategies={savedStrategies}
          onLoad={handleLoadSavedStrategy}
          onDelete={(id) => void deleteCustomStrategy(id)}
        />
      )}

      {strategyType === 'corner_anchor' && (
        <div>
          <label className="block text-sm font-medium text-text-muted mb-2">
            Corner Position
          </label>
          <select
            value={corner}
            onChange={(e) => setCorner(e.target.value)}
            disabled={isRunning}
            className="w-full px-3 py-2 border border-dark-border bg-surface-raised text-text-primary rounded-md focus:ring-2 focus:ring-accent"
          >
            <option value="bottom-left">Bottom Left</option>
            <option value="bottom-right">Bottom Right</option>
            <option value="top-left">Top Left</option>
            <option value="top-right">Top Right</option>
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-text-muted mb-2">
          Number of Games
        </label>
        <input
          type="number"
          value={batchSize}
          onChange={(e) => setBatchSize(Math.max(1, Math.min(10000, Number(e.target.value))))}
          disabled={isRunning}
          min={1}
          max={10000}
          className="w-full px-3 py-2 border border-dark-border bg-surface-raised text-text-primary rounded-md focus:ring-2 focus:ring-accent"
        />
        <p className="text-xs text-text-muted mt-1">Min: 1, Max: 10,000</p>
      </div>

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
              disabled={isRunning}
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
              disabled={isRunning}
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
              disabled={isRunning}
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

      {seedMode === 'fixed' && (
        <div>
          <label className="block text-sm font-medium text-text-muted mb-2">
            Seed
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={fixedSeed}
              onChange={(e) => setFixedSeed(e.target.value.toUpperCase())}
              disabled={isRunning}
              maxLength={8}
              className="flex-1 px-3 py-2 border border-dark-border bg-surface-raised text-text-primary rounded-md font-mono focus:ring-2 focus:ring-accent"
              placeholder="A7X9K2M1"
            />
            <button
              onClick={() => setFixedSeed(generateSeed())}
              disabled={isRunning}
              className="px-3 py-2 bg-surface-raised hover:bg-surface-elevated text-text-primary rounded-md text-sm disabled:opacity-50 border border-dark-border"
            >
              Random
            </button>
          </div>
        </div>
      )}

      <button
        onClick={handleStart}
        disabled={isRunning}
        className="w-full px-6 py-3 bg-accent hover:bg-accent-strong text-gray-950 font-bold rounded-lg shadow-lg shadow-amber-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isRunning ? 'Running...' : 'Start Batch Simulation'}
      </button>
    </div>
  );
};

export default BatchConfigPanel;
