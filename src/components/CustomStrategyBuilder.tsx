/**
 * Custom Strategy Builder - Main container component
 * Provides tabbed interface for manual and AI-assisted rule creation
 */

import { useState } from 'react';
import type { CustomRule } from '../engine/customRules';
import { ManualRuleBuilder } from './ManualRuleBuilder';
import { AIStrategyAssistant } from './AIStrategyAssistant';

export interface CustomStrategyBuilderProps {
  onSave: (rules: CustomRule[], name: string) => void;
  onCancel: () => void;
  initialRules?: CustomRule[];
  initialName?: string;
}

type TabMode = 'manual' | 'ai';

export function CustomStrategyBuilder({
  onSave,
  onCancel,
  initialRules = [],
  initialName = '',
}: CustomStrategyBuilderProps) {
  const [mode, setMode] = useState<TabMode>('manual');
  const [rules, setRules] = useState<CustomRule[]>(initialRules);
  const [strategyName, setStrategyName] = useState(initialName);

  const handleSave = () => {
    if (rules.length === 0) {
      alert('Please add at least one rule before saving');
      return;
    }

    if (!strategyName.trim()) {
      alert('Please enter a strategy name');
      return;
    }

    onSave(rules, strategyName);
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all rules?')) {
      setRules([]);
      setStrategyName('');
    }
  };

  const handleRulesUpdate = (newRules: CustomRule[]) => {
    setRules(newRules);
  };

  const handleAIGenerate = (generatedRules: CustomRule[], name: string) => {
    setRules(generatedRules);
    setStrategyName(name);
    setMode('manual'); // Switch to manual mode to review/edit
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-amber-900">Custom Strategy Builder</h2>
          <p className="text-sm text-gray-600 mt-1">
            Create your own 2048 strategy using rules or natural language
          </p>
        </div>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
      {/* Strategy Name Input */}
      <div className="mb-6">
        <label htmlFor="strategy-name" className="block text-sm font-medium text-gray-700 mb-2">
          Strategy Name
        </label>
        <input
          id="strategy-name"
          type="text"
          value={strategyName}
          onChange={(e) => setStrategyName(e.target.value)}
          placeholder="e.g., Aggressive Corner Strategy"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        />
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setMode('manual')}
          className={`px-6 py-3 font-medium transition-colors ${
            mode === 'manual'
              ? 'text-amber-600 border-b-2 border-amber-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Manual Builder
        </button>
        <button
          onClick={() => setMode('ai')}
          className={`px-6 py-3 font-medium transition-colors ${
            mode === 'ai'
              ? 'text-amber-600 border-b-2 border-amber-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          AI Assistant
        </button>
      </div>

      {/* Tab Content */}
      <div className="min-h-96">
        {mode === 'manual' ? (
          <ManualRuleBuilder rules={rules} onRulesChange={handleRulesUpdate} />
        ) : (
          <AIStrategyAssistant onGenerate={handleAIGenerate} />
        )}
      </div>

      {/* Rule Summary */}
      {rules.length > 0 && (
        <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
          <h3 className="font-medium text-amber-900 mb-2">Current Strategy</h3>
          <p className="text-sm text-amber-800">
            {rules.length} rule{rules.length !== 1 ? 's' : ''} configured
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {rules.map((rule, index) => (
              <span
                key={index}
                className="inline-block px-3 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full capitalize"
              >
                {rule.type}
              </span>
            ))}
          </div>
        </div>
      )}
      </div>

      {/* Footer Actions */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={rules.length === 0 || !strategyName.trim()}
            className="flex-1 px-6 py-3 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Save Strategy
          </button>
          <button
            onClick={handleReset}
            className="px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
