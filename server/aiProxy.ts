/**
 * Server-side AI provider calls for /api/ai/generate-strategy.
 *
 * The system prompt is fixed server-side (shared/aiPrompt.ts) — clients can
 * only supply the strategy description and optionally a provider/model.
 * max_tokens is capped server-side. Provider failures surface as readable
 * messages that the route turns into 502s; a 404 gets a model-retired hint.
 */
import { SYSTEM_PROMPT } from '../shared/aiPrompt.js';

export type Provider = 'anthropic' | 'openai';

export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5';
export const DEFAULT_OPENAI_MODEL = 'gpt-5-mini';
export const MAX_TOKENS = 2000;

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly status: number = 502
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

async function readErrorMessage(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object') {
      const err = (body as { error?: { message?: unknown } }).error;
      if (err && typeof err === 'object' && typeof err.message === 'string') {
        return err.message;
      }
    }
  } catch {
    // Body was not JSON (e.g. an HTML error page).
  }
  return undefined;
}

async function throwProviderError(
  providerName: string,
  response: Response,
  model: string
): Promise<never> {
  const detail = await readErrorMessage(response);
  if (response.status === 404) {
    throw new ProviderError(
      `${providerName} API returned 404 (model not found). The model "${model}" may have ` +
        `been retired — try a newer model.${detail ? ` Details: ${detail}` : ''}`
    );
  }
  throw new ProviderError(
    detail ||
      `${providerName} API request failed (${response.status}${
        response.statusText ? ` ${response.statusText}` : ''
      })`
  );
}

async function safeFetch(
  providerName: string,
  url: string,
  init: RequestInit
): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new ProviderError(
      `Could not reach the ${providerName} API from the server (network error). ` +
        `Please try again.`
    );
  }
}

export async function callAnthropic(
  apiKey: string,
  description: string,
  model = DEFAULT_ANTHROPIC_MODEL
): Promise<string> {
  const response = await safeFetch('Anthropic', 'https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: description }],
    }),
  });
  if (!response.ok) {
    await throwProviderError('Anthropic', response, model);
  }
  const data = (await response.json()) as { content?: { text?: string }[] };
  const text = data.content?.[0]?.text;
  if (typeof text !== 'string') {
    throw new ProviderError('Anthropic API returned an unexpected response shape');
  }
  return text;
}

export async function callOpenAI(
  apiKey: string,
  description: string,
  model = DEFAULT_OPENAI_MODEL
): Promise<string> {
  const response = await safeFetch(
    'OpenAI',
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: description },
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: MAX_TOKENS,
      }),
    }
  );
  if (!response.ok) {
    await throwProviderError('OpenAI', response, model);
  }
  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new ProviderError('OpenAI API returned an unexpected response shape');
  }
  return content;
}

export function callProvider(
  provider: Provider,
  apiKey: string,
  description: string,
  model?: string
): Promise<string> {
  return provider === 'openai'
    ? callOpenAI(apiKey, description, model)
    : callAnthropic(apiKey, description, model);
}
