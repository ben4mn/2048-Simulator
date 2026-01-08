/**
 * Batch Configuration Panel
 * UI for configuring and starting batch simulations
 */

import React, { useState } from 'react';
import { generateSeed } from '../engine/rng';
import { CustomStrategyBuilder } from './CustomStrategyBuilder';
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
  };

  const handleCancelCustomBuilder = () => {
    setShowCustomBuilder(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
      <h2 className="text-2xl font-bold text-amber-900">Batch Simulation</h2>

      {/* Strategy Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Choose Strategy
        </label>
        <div className="grid grid-cols-2 gap-3">
          {/* Directional Priority Card */}
          <button
            onClick={() => setStrategyType('directional_priority')}
            disabled={isRunning}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              strategyType === 'directional_priority'
                ? 'border-amber-500 bg-amber-50'
                : 'border-gray-200 bg-white hover:border-amber-300'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="flex items-start gap-3">
              <div className="text-2xl">↗️</div>
              <div className="flex-1">
                <div className="font-semibold text-gray-900">Directional Priority</div>
                <div className="text-xs text-gray-600 mt-1">L→D→R→U order</div>
              </div>
            </div>
          </button>

          {/* Corner Anchor Card */}
          <button
            onClick={() => setStrategyType('corner_anchor')}
            disabled={isRunning}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              strategyType === 'corner_anchor'
                ? 'border-amber-500 bg-amber-50'
                : 'border-gray-200 bg-white hover:border-amber-300'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="flex items-start gap-3">
              <div className="text-2xl">📍</div>
              <div className="flex-1">
                <div className="font-semibold text-gray-900">Corner Anchor</div>
                <div className="text-xs text-gray-600 mt-1">Keep max in corner</div>
              </div>
            </div>
          </button>

          {/* Merge Maximization Card */}
          <button
            onClick={() => setStrategyType('merge_max')}
            disabled={isRunning}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              strategyType === 'merge_max'
                ? 'border-amber-500 bg-amber-50'
                : 'border-gray-200 bg-white hover:border-amber-300'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="flex items-start gap-3">
              <div className="text-2xl">🔗</div>
              <div className="flex-1">
                <div className="font-semibold text-gray-900">Merge Maximization</div>
                <div className="text-xs text-gray-600 mt-1">Prioritize merges</div>
              </div>
            </div>
          </button>

          {/* Random Card */}
          <button
            onClick={() => setStrategyType('random')}
            disabled={isRunning}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              strategyType === 'random'
                ? 'border-amber-500 bg-amber-50'
                : 'border-gray-200 bg-white hover:border-amber-300'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="flex items-start gap-3">
              <div className="text-2xl">🎲</div>
              <div className="flex-1">
                <div className="font-semibold text-gray-900">Random</div>
                <div className="text-xs text-gray-600 mt-1">Baseline comparison</div>
              </div>
            </div>
          </button>

          {/* Custom Card - Full Width */}
          <button
            onClick={() => setStrategyType('custom')}
            disabled={isRunning}
            className={`col-span-2 p-4 rounded-lg border-2 text-left transition-all ${
              strategyType === 'custom'
                ? 'border-amber-500 bg-amber-50'
                : 'border-gray-200 bg-white hover:border-amber-300'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="flex items-start gap-3">
              <div className="text-2xl">🔧</div>
              <div className="flex-1">
                <div className="font-semibold text-gray-900">Custom Strategy</div>
                <div className="text-xs text-gray-600 mt-1">Build your own with manual rules or AI assistance</div>
              </div>
              {customRules.length > 0 && (
                <div className="px-3 py-1 bg-amber-600 text-white text-xs font-medium rounded-full">
                  {customRules.length} rule{customRules.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Custom Strategy Builder Action */}
      {strategyType === 'custom' && !showCustomBuilder && (
        <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
          {customRules.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-amber-900">{customStrategyName}</h3>
                <button
                  onClick={() => setShowCustomBuilder(true)}
                  className="text-sm text-amber-600 hover:text-amber-800 font-medium"
                >
                  Edit Rules
                </button>
              </div>
              <p className="text-sm text-amber-800">
                {customRules.length} rule{customRules.length !== 1 ? 's' : ''} configured
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-amber-800 mb-3">
                Create your own custom strategy using manual rules or AI assistance
              </p>
              <button
                onClick={() => setShowCustomBuilder(true)}
                disabled={isRunning}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 font-medium"
              >
                Build Custom Strategy
              </button>
            </div>
          )}
        </div>
      )}

      {/* Side Panel for Custom Strategy Builder */}
      {showCustomBuilder && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-30 z-40 transition-opacity"
            onClick={handleCancelCustomBuilder}
          />

          {/* Side Panel */}
          <div className="fixed right-0 top-0 bottom-0 w-full md:w-[600px] bg-white shadow-2xl z-50 overflow-y-auto transform transition-transform">
            <CustomStrategyBuilder
              onSave={handleSaveCustomStrategy}
              onCancel={handleCancelCustomBuilder}
              initialRules={customRules}
              initialName={customStrategyName}
            />
          </div>
        </>
      )}

      {/* Corner selection for Corner Anchor strategy */}
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
        disabled={isRunning}
        className="w-full px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isRunning ? 'Running...' : 'Start Batch Simulation'}
      </button>
    </div>
  );
};

export default BatchConfigPanel;
