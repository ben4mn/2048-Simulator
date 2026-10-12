// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AIStrategyAssistant } from '../AIStrategyAssistant';
import { useAuthStore } from '../../store/authStore';
import { AIStrategyGenerator, type GenerateStrategyResponse } from '../../services/aiStrategyGenerator';
import type { CustomRule } from '../../engine/customRules';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

beforeEach(() => {
  useAuthStore.setState({ user: null, status: 'anon', error: null });
});

function validRulesPayload(): { strategyName: string; rules: CustomRule[] } {
  return {
    strategyName: 'Corner Stacker',
    rules: [{ type: 'pattern', sequence: ['left', 'down'] }],
  };
}

describe('AIStrategyAssistant', () => {
  it('logged out: shows the API key flow and a hint to sign in', () => {
    render(<AIStrategyAssistant onGenerate={vi.fn()} />);
    expect(screen.getByText('API Key')).toBeInTheDocument();
    expect(screen.getByText(/sign in from the account card/i)).toBeInTheDocument();
  });

  it('logged out: the generate button is disabled until a description is entered', () => {
    render(<AIStrategyAssistant onGenerate={vi.fn()} />);
    expect(screen.getByRole('button', { name: /generate strategy/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Strategy Description'), { target: { value: 'desc' } });
    expect(screen.getByRole('button', { name: /generate strategy/i })).not.toBeDisabled();
  });

  it('authed with a stored key for the selected provider: hides key input and shows "Using your account"', () => {
    useAuthStore.setState({
      status: 'authed',
      user: { id: 'u1', username: 'ben', isAdmin: false, keys: { anthropic: true, openai: false } },
    });
    render(<AIStrategyAssistant onGenerate={vi.fn()} />);

    // Default provider selection is 'openai', which this user has NOT configured.
    expect(screen.getByText('API Key')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Anthropic' }));
    expect(screen.getByText(/using your account/i)).toBeInTheDocument();
    expect(screen.queryByText('API Key')).not.toBeInTheDocument();
  });

  it('admin user always uses server mode for anthropic (site key)', () => {
    useAuthStore.setState({
      status: 'authed',
      user: { id: 'u1', username: 'ben', isAdmin: true, keys: { anthropic: false, openai: false } },
    });
    render(<AIStrategyAssistant onGenerate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Anthropic' }));
    expect(screen.getByText(/using your account \(site key\)/i)).toBeInTheDocument();
  });

  it('admin without an OpenAI key uses the direct-key flow for OpenAI', () => {
    useAuthStore.setState({ status: 'authed', user: { id: 'u1', username: 'ben', isAdmin: true, keys: { anthropic: false, openai: false } } });
    render(<AIStrategyAssistant onGenerate={vi.fn()} />);
    expect(screen.getByText('API Key')).toBeInTheDocument();
    expect(screen.queryByText(/using your account/i)).not.toBeInTheDocument();
  });

  it('switches session keys with the provider instead of sending the previous provider’s key', async () => {
    sessionStorage.setItem('ai_openai_key', 'sk-openai-session');
    sessionStorage.setItem('ai_anthropic_key', 'sk-ant-anthropic-session');
    const generate = vi.spyOn(AIStrategyGenerator, 'generateStrategy').mockResolvedValue({ success: true, ...validRulesPayload() });
    render(<AIStrategyAssistant onGenerate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Anthropic' }));
    fireEvent.change(screen.getByLabelText('Strategy Description'), { target: { value: 'A corner strategy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate Strategy' }));
    await waitFor(() => expect(generate).toHaveBeenCalledWith(expect.objectContaining({ config: { provider: 'anthropic', apiKey: 'sk-ant-anthropic-session' } })));
  });

  it('cancels the network request and ignores a late response', async () => {
    sessionStorage.setItem('ai_openai_key', 'sk-session');
    let complete!: (result: GenerateStrategyResponse) => void;
    const generate = vi.spyOn(AIStrategyGenerator, 'generateStrategy').mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    const onGenerate = vi.fn();
    render(<AIStrategyAssistant onGenerate={onGenerate} />);
    fireEvent.change(screen.getByLabelText('Strategy Description'), { target: { value: 'Keep this description' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate Strategy' }));
    const signal = generate.mock.calls[0][0].signal!;
    expect(signal.aborted).toBe(false);
    expect(screen.getByRole('button', { name: 'Anthropic' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel generation' }));
    expect(signal.aborted).toBe(true);
    await act(async () => { complete({ success: true, ...validRulesPayload() }); });
    expect(onGenerate).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Strategy Description')).toHaveValue('Keep this description');
    expect(screen.getByRole('button', { name: 'Generate Strategy' })).toBeEnabled();
  });

  it('server mode: calls the backend and forwards parsed rules to onGenerate', async () => {
    useAuthStore.setState({
      status: 'authed',
      user: { id: 'u1', username: 'ben', isAdmin: false, keys: { anthropic: true, openai: false } },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ content: JSON.stringify(validRulesPayload()) }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const onGenerate = vi.fn();
    render(<AIStrategyAssistant onGenerate={onGenerate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Anthropic' }));

    fireEvent.change(screen.getByLabelText('Strategy Description'), {
      target: { value: 'Stack tiles in the corner' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generate strategy/i }));

    await waitFor(() => {
      expect(onGenerate).toHaveBeenCalledWith(
        [{ type: 'pattern', sequence: ['left', 'down'] }],
        'Corner Stacker'
      );
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ai/generate-strategy',
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
  });

  it('server mode: surfaces a readable 429 rate-limit message', async () => {
    useAuthStore.setState({
      status: 'authed',
      user: { id: 'u1', username: 'ben', isAdmin: false, keys: { anthropic: true, openai: false } },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: vi.fn().mockRejectedValue(new SyntaxError('no body')),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AIStrategyAssistant onGenerate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Anthropic' }));
    fireEvent.change(screen.getByLabelText('Strategy Description'), { target: { value: 'desc' } });
    fireEvent.click(screen.getByRole('button', { name: /generate strategy/i }));

    await waitFor(() => {
      expect(screen.getByText(/rate limit/i)).toBeInTheDocument();
    });
  });
});
