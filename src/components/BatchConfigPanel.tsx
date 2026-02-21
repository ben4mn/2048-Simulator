/**
 * Batch Configuration Panel
 * UI for configuring and starting batch simulations
 */

import React, { useState } from 'react';
import { generateSeed } from '../engine/rng';
import type { RuleSet } from '../engine/types';
import RuleSetPreview from './RuleSetPreview';

export interface BatchConfig {
  strategyType: string;
  strategyParams?: any;
  batchSize: number;
  seedMode: 'random' | 'fixed' | 'shared';
  fixedSeed?: string;
}

interface BatchConfigPanelProps {
  onStartBatch: (config: BatchConfig) => void;
  isRunning: boolean;
  currentRuleSet: RuleSet | null;
  onGoToBuild: () => void;
}

export const BatchConfigPanel: React.FC<BatchConfigPanelProps> = ({
  onStartBatch,
  isRunning,
  currentRuleSet,
  onGoToBuild,
}) => {
  const hasCustomRuleSet = currentRuleSet && currentRuleSet.rules.length > 0;
  const [strategySource, setStrategySource] = useState<'preset' | 'custom'>(
    hasCustomRuleSet ? 'custom' : 'preset'
  );
  const [strategyType, setStrategyType] = useState('directional_priority');
  const [corner, setCorner] = useState('bottom-left');
  const [batchSize, setBatchSize] = useState(100);
  const [seedMode, setSeedMode] = useState<'random' | 'fixed' | 'shared'>('random');
  const [fixedSeed, setFixedSeed] = useState(generateSeed());

  const handleStart = () => {
    let config: BatchConfig;

    if (strategySource === 'custom' && hasCustomRuleSet) {
      config = {
        strategyType: 'custom_rule',
        strategyParams: { ruleSet: currentRuleSet },
        batchSize,
        seedMode,
        fixedSeed: seedMode === 'fixed' ? fixedSeed : undefined,
      };
    } else {
      config = {
        strategyType,
        strategyParams:
          strategyType === 'corner_anchor' ? { corner } : undefined,
        batchSize,
        seedMode,
        fixedSeed: seedMode === 'fixed' ? fixedSeed : undefined,
      };
    }
    onStartBatch(config);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
      <h2 className="text-2xl font-bold text-amber-900">Batch Simulation</h2>

      {/* Strategy Source Toggle */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Strategy Source
        </label>
        <div className="flex rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setStrategySource('preset')}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all ${
              strategySource === 'preset'
                ? 'bg-white text-amber-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
            disabled={isRunning}
          >
            Preset Strategy
          </button>
          <button
            onClick={() => setStrategySource('custom')}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all ${
              strategySource === 'custom'
                ? 'bg-white text-amber-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
            disabled={isRunning}
          >
            Custom Rule Set
          </button>
        </div>
      </div>

      {/* Preset Strategy Selection */}
      {strategySource === 'preset' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Strategy
            </label>
            <select
              value={strategyType}
              onChange={(e) => setStrategyType(e.target.value)}
              disabled={isRunning}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500"
            >
              <option value="directional_priority">Directional Priority (L-D-R-U)</option>
              <option value="corner_anchor">Corner Anchor</option>
              <option value="merge_max">Merge Maximization</option>
              <option value="random">Random (Baseline)</option>
            </select>
          </div>

          {strategyType === 'corner_anchor' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Corner Position
              </label>
              <select
                value={corner}
                onChange={(e) => setCorner(e.target.value)}
                disabled={isRunning}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500"
              >
                <option value="bottom-left">Bottom Left</option>
                <option value="bottom-right">Bottom Right</option>
                <option value="top-left">Top Left</option>
                <option value="top-right">Top Right</option>
              </select>
            </div>
          )}
        </>
      )}

      {/* Custom Rule Set Display */}
      {strategySource === 'custom' && (
        <div>
          {hasCustomRuleSet ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm text-gray-800">{currentRuleSet!.name}</div>
                  <div className="text-xs text-gray-500">
                    {currentRuleSet!.rules.length} rules | Source: {currentRuleSet!.source}
                  </div>
                </div>
                <button
                  onClick={onGoToBuild}
                  className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                  disabled={isRunning}
                >
                  Edit
                </button>
              </div>
              <RuleSetPreview ruleSet={currentRuleSet!} />
            </div>
          ) : (
            <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg">
              <p className="text-gray-500 text-sm mb-3">No custom rule set built yet</p>
              <button
                onClick={onGoToBuild}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg"
                disabled={isRunning}
              >
                Go to Rule Builder
              </button>
            </div>
          )}
        </div>
      )}

      {/* Batch Size */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Number of Games
        </label>
        <input
          type="number"
          value={batchSize}
          onChange={(e) => setBatchSize(Math.max(1, Math.min(10000, Number(e.target.value))))}
          disabled={isRunning}
          min={1}
          max={10000}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500"
        />
        <p className="text-xs text-gray-500 mt-1">Min: 1, Max: 10,000</p>
      </div>

      {/* Seed Mode */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
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
              className="mt-1 mr-2"
            />
            <div>
              <div className="font-medium">Random</div>
              <div className="text-xs text-gray-600">
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
              className="mt-1 mr-2"
            />
            <div>
              <div className="font-medium">Fixed</div>
              <div className="text-xs text-gray-600">
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
              className="mt-1 mr-2"
            />
            <div>
              <div className="font-medium">Shared</div>
              <div className="text-xs text-gray-600">
                Generate seeds for head-to-head comparison
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Fixed Seed Input */}
      {seedMode === 'fixed' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Seed
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={fixedSeed}
              onChange={(e) => setFixedSeed(e.target.value.toUpperCase())}
              disabled={isRunning}
              maxLength={8}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md font-mono focus:ring-2 focus:ring-amber-500"
              placeholder="A7X9K2M1"
            />
            <button
              onClick={() => setFixedSeed(generateSeed())}
              disabled={isRunning}
              className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-md text-sm disabled:opacity-50"
            >
              Random
            </button>
          </div>
        </div>
      )}

      {/* Start Button */}
      <button
        onClick={handleStart}
        disabled={isRunning || (strategySource === 'custom' && !hasCustomRuleSet)}
        className="w-full px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isRunning ? 'Running...' : 'Start Batch Simulation'}
      </button>
    </div>
  );
};

export default BatchConfigPanel;
