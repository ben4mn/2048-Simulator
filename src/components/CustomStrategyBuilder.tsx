/**
 * Custom Strategy Builder - Main container component
 * Provides tabbed interface for manual and AI-assisted rule creation
 */

import { useState } from 'react';
import type { CustomRule } from '../engine/customRules';
import { ManualRuleBuilder } from './ManualRuleBuilder';
import { AIStrategyAssistant } from './AIStrategyAssistant';
import { ConfirmDialog } from './ui/ConfirmDialog';

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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleSave = () => {
    if (rules.length === 0) {
      setSaveError('Please add at least one rule before saving');
      return;
    }

    if (!strategyName.trim()) {
      setSaveError('Please enter a strategy name');
      return;
    }

    setSaveError(null);
    onSave(rules, strategyName);
  };

  const handleReset = () => {
    setShowResetConfirm(true);
  };

  const confirmReset = () => {
    setRules([]);
    setStrategyName('');
    setSaveError(null);
    setShowResetConfirm(false);
  };

  const handleRulesUpdate = (newRules: CustomRule[]) => {
    setRules(newRules);
  };

  const handleAIGenerate = (generatedRules: CustomRule[], name: string) => {
    setRules(generatedRules);
    setStrategyName(name);
    setMode('manual');
  };

  return (
    <div className="h-full flex flex-col bg-surface-elevated text-text-primary">
      <div className="px-6 py-4 border-b border-dark-border flex items-center justify-between sticky top-0 bg-surface-elevated z-10">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Custom Strategy Builder</h2>
          <p className="text-sm text-text-muted mt-1">
            Build rule-driven strategies manually or with AI guidance.
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

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mb-6">
          <label htmlFor="strategy-name" className="block text-sm font-medium text-text-muted mb-2">
            Strategy Name
          </label>
          <input
            id="strategy-name"
            type="text"
            value={strategyName}
            onChange={(e) => setStrategyName(e.target.value)}
            placeholder="e.g., Aggressive Corner Strategy"
            className="w-full px-4 py-2 border border-dark-border bg-surface-raised text-text-primary rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
          />
        </div>

        <div className="flex gap-2 mb-6 border-b border-dark-border">
          <button
            onClick={() => setMode('manual')}
            className={`px-6 py-3 font-medium transition-colors ${
              mode === 'manual'
                ? 'text-accent border-b-2 border-accent'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Manual Builder
          </button>
          <button
            onClick={() => setMode('ai')}
            className={`px-6 py-3 font-medium transition-colors ${
              mode === 'ai'
                ? 'text-accent border-b-2 border-accent'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            AI Assistant
          </button>
        </div>

        <div className="min-h-96">
          {mode === 'manual' ? (
            <ManualRuleBuilder rules={rules} onRulesChange={handleRulesUpdate} />
          ) : (
            <AIStrategyAssistant onGenerate={handleAIGenerate} />
          )}
        </div>

        {rules.length > 0 && (
          <div className="mt-6 p-4 bg-amber-500/10 rounded-lg border border-accent/40">
            <h3 className="font-medium text-accent mb-2">Current Strategy</h3>
            <p className="text-sm text-amber-200">
              {rules.length} rule{rules.length !== 1 ? 's' : ''} configured
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {rules.map((rule, index) => (
                <span
                  key={index}
                  className="inline-block px-3 py-1 bg-amber-500/20 text-amber-100 text-xs font-medium rounded-full capitalize"
                >
                  {rule.type}
                </span>
              ))}
            </div>
          </div>
        )}
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
            disabled={rules.length === 0 || !strategyName.trim()}
            className="flex-1 px-6 py-3 bg-accent text-gray-950 font-semibold rounded-lg hover:bg-accent-strong disabled:bg-surface disabled:text-text-muted disabled:cursor-not-allowed transition-colors"
          >
            Save Strategy
          </button>
          <button
            onClick={handleReset}
            className="px-6 py-3 bg-surface-elevated text-text-primary border border-dark-border font-medium rounded-lg hover:bg-surface transition-colors"
          >
            Reset
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-surface-elevated text-text-primary border border-dark-border font-medium rounded-lg hover:bg-surface transition-colors"
          >
            Cancel
          </button>
        </div>

        <ConfirmDialog
          open={showResetConfirm}
          title="Reset strategy?"
          message="This clears all configured rules and the strategy name. This cannot be undone."
          confirmLabel="Reset"
          danger
          onConfirm={confirmReset}
          onCancel={() => setShowResetConfirm(false)}
        />
      </div>
    </div>
  );
}
