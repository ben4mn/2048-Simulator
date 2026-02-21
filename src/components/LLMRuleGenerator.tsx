/**
 * LLMRuleGenerator Component
 * Natural language input that generates rule sets via LLM
 */

import React, { useState } from 'react';
import type { RuleSet } from '../engine/types';
import {
  generateRuleSet,
  getLLMConfig,
  saveLLMConfig,
  type LLMConfig,
} from '../engine/llmRuleParser';

interface LLMRuleGeneratorProps {
  onRuleSetGenerated: (ruleSet: RuleSet) => void;
}

const EXAMPLE_PROMPTS = [
  'Prioritize left and down. Only go right when left is unavailable. Avoid going up unless there are no other options.',
  'Keep the highest tile in the bottom-left corner. When the board gets crowded, prioritize merges.',
  'Alternate between left and down as primary moves. Use right only as a fallback. Never go up unless forced.',
  'Aggressive merge strategy: always move in the direction with the most merges available. Prefer left over right.',
];

export const LLMRuleGenerator: React.FC<LLMRuleGeneratorProps> = ({ onRuleSetGenerated }) => {
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<LLMConfig>(() => {
    return getLLMConfig() || { provider: 'anthropic', apiKey: '', model: '' };
  });

  const hasApiKey = config.apiKey.length > 0;

  const handleGenerate = async () => {
    if (!description.trim()) return;
    if (!hasApiKey) {
      setShowSettings(true);
      setError('Please configure your API key first');
      return;
    }

    setIsGenerating(true);
    setError(null);

    const result = await generateRuleSet(description, config);

    setIsGenerating(false);

    if (result.success && result.ruleSet) {
      onRuleSetGenerated(result.ruleSet);
    } else {
      setError(result.error || 'Failed to generate rule set');
    }
  };

  const handleSaveConfig = () => {
    saveLLMConfig(config);
    setShowSettings(false);
    setError(null);
  };

  const handleExampleClick = (example: string) => {
    setDescription(example);
  };

  return (
    <div className="space-y-4">
      {/* Settings toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasApiKey ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              {config.provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} configured
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
              API key required
            </span>
          )}
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="text-xs text-gray-500 hover:text-gray-700 font-medium"
        >
          {showSettings ? 'Hide settings' : 'API Settings'}
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Provider</label>
            <select
              value={config.provider}
              onChange={(e) => setConfig({ ...config, provider: e.target.value as 'openai' | 'anthropic' })}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">API Key</label>
            <input
              type="password"
              value={config.apiKey}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              placeholder={config.provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm font-mono"
            />
            <p className="text-xs text-gray-400 mt-1">Stored locally in your browser only</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Model (optional)</label>
            <input
              type="text"
              value={config.model || ''}
              onChange={(e) => setConfig({ ...config, model: e.target.value || undefined })}
              placeholder={config.provider === 'anthropic' ? 'claude-sonnet-4-5-20250929' : 'gpt-4o-mini'}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Base URL (optional)</label>
            <input
              type="text"
              value={config.baseUrl || ''}
              onChange={(e) => setConfig({ ...config, baseUrl: e.target.value || undefined })}
              placeholder={config.provider === 'anthropic' ? 'https://api.anthropic.com/v1' : 'https://api.openai.com/v1'}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm font-mono"
            />
          </div>
          <button
            onClick={handleSaveConfig}
            className="w-full px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded"
          >
            Save Settings
          </button>
        </div>
      )}

      {/* Text area */}
      <div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your strategy in plain English... e.g. 'Prioritize left and down. Only go right when left isn't available. Keep the highest tile in the bottom-left corner.'"
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          disabled={isGenerating}
        />
      </div>

      {/* Example prompts */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">Try an example:</label>
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLE_PROMPTS.map((example, i) => (
            <button
              key={i}
              onClick={() => handleExampleClick(example)}
              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded transition-colors truncate max-w-[200px]"
              title={example}
            >
              {example.slice(0, 40)}...
            </button>
          ))}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating || !description.trim()}
        className="w-full px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isGenerating ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating...
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 1v6M8 1L5 4M8 1l3 3M1 8h6M1 8l3-3M1 8l3 3M15 8H9M15 8l-3-3M15 8l-3 3M8 15V9M8 15l-3-3M8 15l3-3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Generate Rule Set with AI
          </>
        )}
      </button>
    </div>
  );
};

export default LLMRuleGenerator;
