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

  // Load API key from sessionStorage
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

    // Check for API key
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
      <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
        <h3 className="font-medium text-amber-900 mb-2">How to use AI Assistant</h3>
        <p className="text-sm text-amber-800">
          Describe your desired 2048 strategy in natural language. The AI will convert it into
          executable rules. Be specific about behaviors, priorities, and conditions.
        </p>
      </div>

      {/* Provider Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">AI Provider</label>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setProvider('openai');
              setApiKey('');
              loadApiKey();
            }}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              provider === 'openai'
                ? 'bg-amber-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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
                ? 'bg-amber-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Anthropic
          </button>
        </div>
      </div>

      {/* API Key Configuration */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">API Key</label>
          <button
            onClick={() => setShowApiKeyInput(!showApiKeyInput)}
            className="text-sm text-amber-600 hover:text-amber-800 font-medium"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
            <button
              onClick={saveApiKey}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Save API Key (session only)
            </button>
            <p className="text-xs text-gray-500">
              Your API key is stored in session storage and will be cleared when you close the browser.
            </p>
          </div>
        )}

        {!showApiKeyInput && sessionStorage.getItem(`ai_${provider}_key`) && (
          <p className="text-sm text-green-600">✓ API key configured</p>
        )}
      </div>

      {/* Strategy Description */}
      <div>
        <label htmlFor="ai-description" className="block text-sm font-medium text-gray-700 mb-2">
          Strategy Description
        </label>
        <textarea
          id="ai-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your strategy... e.g., 'I want the AI to prioritize keeping the highest tile in the bottom-left corner and only move up as a last resort'"
          rows={6}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Example Prompts */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Example Prompts</label>
        <div className="space-y-2">
          {examplePrompts.map((prompt, index) => (
            <button
              key={index}
              onClick={() => setDescription(prompt)}
              className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm text-gray-700 transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating || !description.trim()}
        className="w-full px-6 py-3 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {isGenerating ? (
          <>
            <svg
              className="animate-spin h-5 w-5 text-white"
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

      {/* Info Note */}
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-600">
          <strong>Note:</strong> The AI will analyze your description and create a combination of
          rules (pattern-based, conditional, look-ahead, or weighted). You can review and edit the
          generated rules in the Manual Builder tab before saving.
        </p>
      </div>
    </div>
  );
}
