/**
 * AI Strategy Assistant - Natural language strategy generation
 */

import { useState } from 'react';
import type { CustomRule } from '../engine/customRules';
import { AIStrategyGenerator, type AIProvider } from '../services/aiStrategyGenerator';

export interface AIStrategyAssistantProps {
  onGenerate: (rules: CustomRule[], strategyName: string) => void;
}

export function AIStrategyAssistant({ onGenerate }: AIStrategyAssistantProps) {
  const [description, setDescription] = useState('');
  const [provider, setProvider] = useState<AIProvider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  const loadApiKey = () => {
    const stored = sessionStorage.getItem(`ai_${provider}_key`);
    if (stored) {
      setApiKey(stored);
      return true;
    }
    return false;
  };

  const saveApiKey = () => {
    if (apiKey.trim()) {
      sessionStorage.setItem(`ai_${provider}_key`, apiKey.trim());
      setShowApiKeyInput(false);
    }
  };

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError('Please enter a strategy description');
      return;
    }

    let currentApiKey = apiKey;
    if (!currentApiKey) {
      const hasStoredKey = loadApiKey();
      if (!hasStoredKey) {
        setShowApiKeyInput(true);
        setError('Please enter your API key');
        return;
      }
      currentApiKey = sessionStorage.getItem(`ai_${provider}_key`) || '';
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await AIStrategyGenerator.generateStrategy({
        description: description.trim(),
        config: {
          provider,
          apiKey: currentApiKey,
        },
      });

      if (response.success && response.rules) {
        onGenerate(response.rules, response.strategyName || 'AI Generated Strategy');
        setDescription('');
        setError(null);
      } else {
        setError(response.error || 'Failed to generate strategy');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  const examplePrompts = [
    'Create a strategy that always moves left and down',
    'I want a strategy that keeps the highest tile in the bottom-left corner',
    'Make a strategy that prioritizes merging tiles and keeping empty spaces',
    'Create a strategy that looks 2 moves ahead and values corner positioning highly',
  ];

  return (
    <div className="space-y-6">
      <div className="p-4 bg-amber-500/10 rounded-lg border border-accent/35">
        <h3 className="font-medium text-accent mb-2">How to use AI Assistant</h3>
        <p className="text-sm text-amber-100">
          Describe your desired 2048 strategy in natural language. The AI will convert it into
          executable rules. Be specific about behaviors, priorities, and conditions.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-muted mb-2">AI Provider</label>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setProvider('openai');
              setApiKey('');
              loadApiKey();
            }}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              provider === 'openai'
                ? 'bg-accent text-gray-950'
                : 'bg-surface-raised text-text-primary border border-dark-border hover:bg-surface-elevated'
            }`}
          >
            OpenAI
          </button>
          <button
            onClick={() => {
              setProvider('anthropic');
              setApiKey('');
              loadApiKey();
            }}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              provider === 'anthropic'
                ? 'bg-accent text-gray-950'
                : 'bg-surface-raised text-text-primary border border-dark-border hover:bg-surface-elevated'
            }`}
          >
            Anthropic
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-text-muted">API Key</label>
          <button
            onClick={() => setShowApiKeyInput(!showApiKeyInput)}
            className="text-sm text-accent hover:text-amber-300 font-medium"
          >
            {showApiKeyInput ? 'Hide' : sessionStorage.getItem(`ai_${provider}_key`) ? 'Change' : 'Configure'}
          </button>
        </div>

        {showApiKeyInput && (
          <div className="space-y-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={`Enter your ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key`}
              className="w-full px-4 py-2 border border-dark-border bg-surface-raised text-text-primary rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
            />
            <button
              onClick={saveApiKey}
              className="w-full px-4 py-2 bg-surface-elevated text-text-primary rounded-lg border border-dark-border hover:bg-surface"
            >
              Save API Key (session only)
            </button>
            <p className="text-xs text-text-muted">
              Your API key is stored in session storage and will be cleared when you close the browser.
            </p>
          </div>
        )}

        {!showApiKeyInput && sessionStorage.getItem(`ai_${provider}_key`) && (
          <p className="text-sm text-success">✓ API key configured</p>
        )}
      </div>

      <div>
        <label htmlFor="ai-description" className="block text-sm font-medium text-text-muted mb-2">
          Strategy Description
        </label>
        <textarea
          id="ai-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your strategy... e.g., 'I want the AI to prioritize keeping the highest tile in the bottom-left corner and only move up as a last resort'"
          rows={6}
          className="w-full px-4 py-3 border border-dark-border bg-surface-raised text-text-primary rounded-lg focus:ring-2 focus:ring-accent focus:border-accent resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-muted mb-2">Example Prompts</label>
        <div className="space-y-2">
          {examplePrompts.map((prompt, index) => (
            <button
              key={index}
              onClick={() => setDescription(prompt)}
              className="w-full text-left px-4 py-2 bg-surface-raised hover:bg-surface-elevated rounded-lg text-sm text-text-primary border border-dark-border transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-danger/35 rounded-lg">
          <p className="text-sm text-red-100">{error}</p>
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={isGenerating || !description.trim()}
        className="w-full px-6 py-3 bg-accent text-gray-950 font-semibold rounded-lg hover:bg-accent-strong disabled:bg-surface disabled:text-text-muted disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {isGenerating ? (
          <>
            <svg
              className="animate-spin h-5 w-5 text-gray-900"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Generating Strategy...
          </>
        ) : (
          'Generate Strategy'
        )}
      </button>

      <div className="p-4 bg-surface-raised rounded-lg border border-dark-border">
        <p className="text-sm text-text-muted">
          <strong className="text-text-primary">Note:</strong> The AI will analyze your description and create a combination of
          rules (pattern-based, conditional, look-ahead, or weighted). You can review and edit the
          generated rules in the Manual Builder tab before saving.
        </p>
      </div>
    </div>
  );
}
