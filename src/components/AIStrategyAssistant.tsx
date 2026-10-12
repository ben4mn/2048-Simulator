/** Optional natural-language authoring, using account keys or a per-provider session key. */
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { CustomRule } from '../engine/customRules';
import { AIStrategyGenerator, type AIProvider } from '../services/aiStrategyGenerator';
import { useAuthStore } from '../store/authStore';

export interface AIStrategyAssistantProps {
  onGenerate: (rules: CustomRule[], strategyName: string) => void;
}

function readSessionKey(provider: AIProvider): string {
  try { return sessionStorage.getItem(`ai_${provider}_key`) || ''; }
  catch { return ''; }
}

export function AIStrategyAssistant({ onGenerate }: AIStrategyAssistantProps) {
  const [description, setDescription] = useState('');
  const [provider, setProvider] = useState<AIProvider>('openai');
  const [apiKey, setApiKey] = useState(() => readSessionKey('openai'));
  const [hasStoredKey, setHasStoredKey] = useState(() => !!readSessionKey('openai'));
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const requestVersion = useRef(0);

  const { authStatus, user } = useAuthStore(useShallow((state) => ({ authStatus: state.status, user: state.user })));
  const usesServerMode = authStatus === 'authed' && !!user && (user.keys[provider] || (user.isAdmin && provider === 'anthropic'));

  useEffect(() => () => {
    requestVersion.current++;
    controller.current?.abort();
  }, []);

  const chooseProvider = (next: AIProvider) => {
    if (next === provider) return;
    const key = readSessionKey(next);
    setProvider(next);
    setApiKey(key);
    setHasStoredKey(!!key);
    setShowApiKeyInput(false);
    setError(null);
  };

  const checkKey = (key: string): string | null => {
    if (!key) return 'Please enter your API key';
    if (provider === 'openai' && key.startsWith('sk-ant-')) return 'This is an Anthropic key. Choose Anthropic or enter your OpenAI key.';
    if (provider === 'anthropic' && key.startsWith('sk-') && !key.startsWith('sk-ant-')) return 'This is an OpenAI key. Choose OpenAI or enter your Anthropic key.';
    return null;
  };

  const saveApiKey = () => {
    const key = apiKey.trim();
    const invalid = checkKey(key);
    if (invalid) { setError(invalid); return; }
    try {
      sessionStorage.setItem(`ai_${provider}_key`, key);
      setApiKey(key);
      setHasStoredKey(true);
      setShowApiKeyInput(false);
      setError(null);
    } catch {
      setError('This browser could not save your session key. You can still generate using the key entered here.');
    }
  };

  const forgetKey = () => {
    try { sessionStorage.removeItem(`ai_${provider}_key`); }
    catch { setError('This browser could not clear the saved session key. Close this tab to end the session.'); return; }
    setApiKey('');
    setHasStoredKey(false);
    setError(null);
  };

  const cancelGeneration = () => {
    requestVersion.current++;
    controller.current?.abort();
    controller.current = null;
    setIsGenerating(false);
  };

  const handleGenerate = async () => {
    const trimmedDescription = description.trim();
    if (!trimmedDescription) { setError('Please enter a strategy description'); return; }
    const key = apiKey.trim() || readSessionKey(provider);
    if (!usesServerMode) {
      const invalid = checkKey(key);
      if (invalid) { setShowApiKeyInput(true); setError(invalid); return; }
    }

    const version = ++requestVersion.current;
    const activeController = new AbortController();
    controller.current = activeController;
    setIsGenerating(true);
    setError(null);
    const timeout = setTimeout(() => {
      if (version !== requestVersion.current) return;
      cancelGeneration();
      setError('Generation took longer than 60 seconds. Please try again. Your description is still here.');
    }, 60_000);

    try {
      const response = usesServerMode
        ? await AIStrategyGenerator.serverGenerate(trimmedDescription, provider, undefined, activeController.signal)
        : await AIStrategyGenerator.generateStrategy({ description: trimmedDescription, config: { provider, apiKey: key }, signal: activeController.signal });
      if (version !== requestVersion.current) return;
      if (response.success && response.rules?.length) {
        onGenerate(response.rules, response.strategyName || 'AI Generated Strategy');
        setError(null);
      } else {
        setError(response.error || 'No usable strategy was returned. Try a more specific description.');
      }
    } catch (err) {
      if (version === requestVersion.current) setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      clearTimeout(timeout);
      if (version === requestVersion.current) {
        controller.current = null;
        setIsGenerating(false);
      }
    }
  };

  const examplePrompts = [
    'Keep the biggest tile in the bottom-left corner and favor empty cells',
    'Prioritize merges and orderly rows, looking 2 moves ahead',
    'Repeat left, down, right, down, up; skip blocked directions',
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-muted leading-relaxed">Describe a goal and AI will fill in the controls above. Review the generated settings and test drive them before saving.</p>
      <fieldset disabled={isGenerating} className="space-y-4">
        <div>
          <p className="text-xs font-medium text-text-muted mb-2">AI Provider</p>
          <div className="flex gap-2" role="group" aria-label="AI Provider">
            {(['openai', 'anthropic'] as const).map((choice) => <button type="button" key={choice} aria-pressed={provider === choice} onClick={() => chooseProvider(choice)} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${provider === choice ? 'bg-accent text-gray-950' : 'bg-surface-elevated text-text-primary border border-dark-border hover:bg-surface'}`}>
              {choice === 'openai' ? 'OpenAI' : 'Anthropic'}
            </button>)}
          </div>
        </div>

        {usesServerMode ? (
          <p className="text-xs text-success rounded-lg bg-success/10 border border-success/20 p-3">Using your account{user?.isAdmin && provider === 'anthropic' ? ' (site key)' : ''} — requests go through the server. No API key needed here.</p>
        ) : (
          <div className="rounded-lg border border-dark-border bg-surface p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-text-muted">API Key</span>
              <button type="button" onClick={() => setShowApiKeyInput(!showApiKeyInput)} className="text-xs text-accent">{showApiKeyInput ? 'Hide' : hasStoredKey ? 'Change' : 'Configure'}</button>
            </div>
            {showApiKeyInput && <div className="space-y-2">
              <input type="password" aria-label={`${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key`} autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={`Enter your ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key`} className="w-full px-3 py-2 border border-dark-border bg-surface-raised text-text-primary rounded-lg focus:ring-2 focus:ring-accent text-sm" />
              <button type="button" onClick={saveApiKey} className="w-full px-3 py-2 bg-surface-elevated text-text-primary rounded-lg border border-dark-border text-xs hover:bg-surface">Save API Key (session only)</button>
              <p className="text-[11px] text-text-muted leading-relaxed">This key is sent directly to the provider and saved in this tab’s session storage. It is cleared when the tab closes. Use your account to store a key on the server instead.</p>
            </div>}
            {hasStoredKey && <div className="flex justify-between items-center"><span className="text-xs text-success">✓ API key configured</span><button type="button" onClick={forgetKey} className="text-xs text-text-muted hover:text-danger">Forget key</button></div>}
            <p className="text-[11px] text-text-muted leading-relaxed">Prefer not to paste a key here? Sign in from the Account card in the simulation section and add your key there once.</p>
          </div>
        )}

        <div>
          <label htmlFor="ai-description" className="block text-xs font-medium text-text-muted mb-2">Strategy Description</label>
          <textarea id="ai-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} placeholder="Keep the largest tile in a corner, prioritize merges, and look two moves ahead…" rows={3} className="w-full px-3 py-3 border border-dark-border bg-surface text-text-primary rounded-lg focus:ring-2 focus:ring-accent text-sm resize-y" />
        </div>
        <div className="flex flex-wrap gap-2">
          {examplePrompts.map((prompt) => <button type="button" key={prompt} onClick={() => setDescription(prompt)} className="text-left px-3 py-2 bg-surface border border-dark-border hover:border-accent/50 rounded-lg text-[11px] text-text-muted">{prompt}</button>)}
        </div>
      </fieldset>

      {error && <p role="alert" className="p-3 bg-danger/10 border border-danger/25 rounded-lg text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={handleGenerate} disabled={isGenerating || !description.trim()} className="flex-1 px-4 py-3 bg-accent text-gray-950 rounded-lg text-sm font-semibold hover:bg-accent-strong disabled:bg-surface disabled:text-text-muted disabled:cursor-not-allowed">{isGenerating ? 'Generating Strategy…' : 'Generate Strategy'}</button>
        {isGenerating && <button type="button" onClick={cancelGeneration} className="px-4 py-3 rounded-lg border border-dark-border text-sm text-text-primary hover:bg-surface">Cancel generation</button>}
      </div>
    </div>
  );
}
