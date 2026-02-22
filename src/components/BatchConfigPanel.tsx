/**
 * Batch Configuration Panel
 * UI for configuring and starting batch simulations
 */

import React, { useState } from 'react';
import { generateSeed } from '../engine/rng';
import { CustomStrategyBuilder } from './CustomStrategyBuilder';
import { useGameStore } from '../store/gameStore';
import type { CustomRule } from '../engine/customRules';

export interface BatchConfig {
  strategyType: string;
  strategyParams?: any;
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

export const BatchConfigPanel: React.FC<BatchConfigPanelProps> = ({
  onStartBatch,
  isRunning,
}) => {
  const [strategyType, setStrategyType] = useState('directional_priority');
  const [corner, setCorner] = useState('bottom-left');
  const [batchSize, setBatchSize] = useState(100);
  const [seedMode, setSeedMode] = useState<'random' | 'fixed' | 'shared'>('random');
  const [fixedSeed, setFixedSeed] = useState(generateSeed());
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [customRules, setCustomRules] = useState<CustomRule[]>([]);
  const [customStrategyName, setCustomStrategyName] = useState('');

  const { savedStrategies, saveCustomStrategy, deleteCustomStrategy } = useGameStore();

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

  const handleLoadSavedStrategy = (strategy: { name: string; params: { customRules: CustomRule[] } }) => {
    setCustomRules(strategy.params.customRules);
    setCustomStrategyName(strategy.name);
    setStrategyType('custom');
  };

  const handleCancelCustomBuilder = () => {
    setShowCustomBuilder(false);
  };

  return (
    <div className="bg-surface rounded-xl shadow-lg p-6 space-y-6 border border-dark-border">
      <h2 className="text-2xl font-bold text-text-primary">Batch Simulation</h2>

      <div>
        <label className="block text-sm font-medium text-text-muted mb-3">
          Choose Strategy
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setStrategyType('directional_priority')}
            disabled={isRunning}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              strategyType === 'directional_priority'
                ? 'border-accent bg-amber-500/15'
                : 'border-dark-border bg-surface-raised hover:border-accent/60 hover:bg-surface-elevated'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="flex items-start">
              <div className="flex-1">
                <div className="font-semibold text-text-primary">Directional Priority</div>
                <div className="text-xs text-text-muted mt-1">L→D→R→U order</div>
              </div>
            </div>
          </button>

          <button
            onClick={() => setStrategyType('corner_anchor')}
            disabled={isRunning}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              strategyType === 'corner_anchor'
                ? 'border-accent bg-amber-500/15'
                : 'border-dark-border bg-surface-raised hover:border-accent/60 hover:bg-surface-elevated'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="flex items-start">
              <div className="flex-1">
                <div className="font-semibold text-text-primary">Corner Anchor</div>
                <div className="text-xs text-text-muted mt-1">Keep max in corner</div>
              </div>
            </div>
          </button>

          <button
            onClick={() => setStrategyType('merge_max')}
            disabled={isRunning}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              strategyType === 'merge_max'
                ? 'border-accent bg-amber-500/15'
                : 'border-dark-border bg-surface-raised hover:border-accent/60 hover:bg-surface-elevated'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="flex items-start">
              <div className="flex-1">
                <div className="font-semibold text-text-primary">Merge Maximization</div>
                <div className="text-xs text-text-muted mt-1">Prioritize merges</div>
              </div>
            </div>
          </button>

          <button
            onClick={() => setStrategyType('random')}
            disabled={isRunning}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              strategyType === 'random'
                ? 'border-accent bg-amber-500/15'
                : 'border-dark-border bg-surface-raised hover:border-accent/60 hover:bg-surface-elevated'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="flex items-start">
              <div className="flex-1">
                <div className="font-semibold text-text-primary">Random</div>
                <div className="text-xs text-text-muted mt-1">Baseline comparison</div>
              </div>
            </div>
          </button>

          <button
            onClick={() => setStrategyType('custom')}
            disabled={isRunning}
            className={`col-span-2 p-4 rounded-xl border-2 text-left transition-all ${
              strategyType === 'custom'
                ? 'border-accent bg-amber-500/15'
                : 'border-dark-border bg-surface-raised hover:border-accent/60 hover:bg-surface-elevated'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="flex items-start">
              <div className="flex-1">
                <div className="font-semibold text-text-primary">Custom Strategy</div>
                <div className="text-xs text-text-muted mt-1">Build your own with manual rules or AI assistance</div>
              </div>
              {customRules.length > 0 && (
                <div className="px-3 py-1 bg-accent text-gray-950 text-xs font-semibold rounded-full">
                  {customRules.length} rule{customRules.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </button>
        </div>
      </div>

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

          <div className="fixed right-0 top-0 bottom-0 w-full md:w-[640px] bg-surface-elevated border-l border-dark-border shadow-2xl z-50 overflow-y-auto transform transition-transform">
            <CustomStrategyBuilder
              onSave={handleSaveCustomStrategy}
              onCancel={handleCancelCustomBuilder}
              initialRules={customRules}
              initialName={customStrategyName}
            />
          </div>
        </>
      )}

      {strategyType === 'custom' && savedStrategies.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-text-muted">Saved Strategies</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {savedStrategies.map((strategy) => (
              <div
                key={strategy.id}
                className="flex items-center justify-between p-3 bg-surface-raised rounded-lg border border-dark-border"
              >
                <button
                  onClick={() => handleLoadSavedStrategy(strategy as any)}
                  className="flex-1 text-left"
                >
                  <div className="font-medium text-text-primary text-sm">{strategy.name}</div>
                  <div className="text-xs text-text-muted">
                    {(strategy.params.customRules as any[])?.length || 0} rule{(strategy.params.customRules as any[])?.length !== 1 ? 's' : ''}
                  </div>
                </button>
                <button
                  onClick={() => void deleteCustomStrategy(strategy.id)}
                  className="ml-2 p-1.5 text-danger hover:text-red-200 hover:bg-red-500/15 rounded transition-colors"
                  title="Delete strategy"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
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
