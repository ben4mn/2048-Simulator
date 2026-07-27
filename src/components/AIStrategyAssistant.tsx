/**
 * AI Strategy Assistant - Natural language strategy generation
 *
 * Two modes:
 * - Server mode: signed-in users with a stored key for the selected provider
 *   (or the admin, whose site key covers Anthropic) call the backend proxy —
 *   no key ever touches this browser.
 * - Direct-browser mode (legacy, still supported for logged-out users):
 *   the existing sessionStorage-key flow, sent straight to the provider.
 */

import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { CustomRule } from '../engine/customRules';
import { AIStrategyGenerator, type AIProvider } from '../services/aiStrategyGenerator';
import { useAuthStore } from '../store/authStore';

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

  const { authStatus, user } = useAuthStore(
    useShallow((s) => ({ authStatus: s.status, user: s.user }))
  );

  const usesServerMode =
    authStatus === 'authed' && !!user && (user.isAdmin || user.keys[provider]);

  const loadApiKey = () => {
    const stored = sessionStorage.getItem(`ai_${provider}_key`);
    if (stored) {
      setApiKey(stored);
      return true;
    }
    return false;
  };

  const checkKeyPrefix = (key: string): string | null => {
    if (provider === 'openai' && !key.startsWith('sk-')) {
      return 'That does not look like an OpenAI API key — OpenAI keys start with "sk-".';
    }
    if (provider === 'anthropic' && !key.startsWith('sk-ant-')) {
      return 'That does not look like an Anthropic API key — Anthropic keys start with "sk-ant-".';
    }
    return null;
  };

  const saveApiKey = () => {
    const trimmed = apiKey.trim();
    if (trimmed) {
      const prefixError = checkKeyPrefix(trimmed);
      if (prefixError) {
        setError(prefixError);
        return;
      }
      sessionStorage.setItem(`ai_${provider}_key`, trimmed);
      setError(null);
      setShowApiKeyInput(false);
    }
  };

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError('Please enter a strategy description');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      if (usesServerMode) {
        const response = await AIStrategyGenerator.serverGenerate(description.trim(), provider);
        if (response.success && response.rules) {
          onGenerate(response.rules, response.strategyName || 'AI Generated Strategy');
          setDescription('');
          setError(null);
        } else {
          setError(response.error || 'Failed to generate strategy');
        }
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

      {usesServerMode ? (
        <div className="p-4 bg-emerald-500/10 border border-success/35 rounded-lg">
          <p className="text-sm text-emerald-200">
            Using your account{user?.isAdmin && provider === 'anthropic' ? ' (site key)' : ''} — no
            API key needed here. Requests go through the server for the {provider === 'openai' ? 'OpenAI' : 'Anthropic'}{' '}
            provider.
          </p>
        </div>
      ) : (
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
              <p className="text-xs text-amber-200 bg-amber-500/10 border border-accent/35 rounded-lg p-2">
                Warning: your API key is sent directly from this browser to the AI provider and kept
                in sessionStorage for this tab. Anyone with access to this browser session (including
                malicious browser extensions) could read it. Use a low-limit key you can revoke, and
                avoid entering keys on shared computers.
              </p>
            </div>
          )}

          {!showApiKeyInput && sessionStorage.getItem(`ai_${provider}_key`) && (
            <p className="text-sm text-success">✓ API key configured</p>
          )}

          <p className="text-xs text-text-muted mt-2">
            Prefer not to paste a key here? Sign in from the Account card in the simulation section
            and add your key there once — it stays on the server and this assistant will use it
            automatically.
          </p>
        </div>
      )}

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
          <strong className="text-text-primary">Note:</strong> The generated strategy appears below
          as a plain-English summary with tunable dials — test drive it before saving.
        </p>
      </div>
    </div>
  );
}
