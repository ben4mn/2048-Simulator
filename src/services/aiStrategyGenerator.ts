/**
 * AI Strategy Generator Service
 * Converts natural language descriptions into 2048 strategy rules
 */

import { SYSTEM_PROMPT } from '../../shared/aiPrompt';
import type {
  ConditionParams,
  ConditionType,
  CustomRule,
  EvaluationOverride,
  EvaluationWeights,
} from '../engine/customRules';
import { MAX_OVERRIDES, migrateCustomRules, normalizeWeights } from '../engine/customRules';
import type { Direction } from '../engine/types';

export type AIProvider = 'openai' | 'anthropic';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model?: string;
}

export interface GenerateStrategyRequest {
  description: string;
  config: AIConfig;
}

export interface GenerateStrategyResponse {
  success: boolean;
  rules?: CustomRule[];
  strategyName?: string;
  error?: string;
}

/** Default model IDs (current as of 2026). */
export const DEFAULT_OPENAI_MODEL = 'gpt-5-mini';
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5';

/** Mirrors the ConditionType union in src/engine/customRules.ts. */
export const CONDITION_TYPES = [
  'max_tile_in_corner',
  'max_tile_on_edge',
  'empty_cells_count',
  'merge_available',
  'monotonic_rows',
  'monotonic_cols',
] as const satisfies readonly ConditionType[];

const VALID_CORNERS = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
] as const;

const DIRECTIONS = ['up', 'down', 'left', 'right'] as const;


export class AIStrategyGenerator {
  /**
   * Generate strategy rules from natural language description
   */
  static async generateStrategy(
    request: GenerateStrategyRequest
  ): Promise<GenerateStrategyResponse> {
    try {
      const { provider, apiKey, model } = request.config;

      if (!apiKey) {
        return {
          success: false,
          error: 'API key is required',
        };
      }

      const keyError = this.checkApiKeyPrefix(provider, apiKey);
      if (keyError) {
        return { success: false, error: keyError };
      }

      let response: string;

      if (provider === 'openai') {
        response = await this.callOpenAI(request.description, apiKey, model);
      } else if (provider === 'anthropic') {
        response = await this.callAnthropic(request.description, apiKey, model);
      } else {
        return {
          success: false,
          error: `Unsupported provider: ${String(provider)}`,
        };
      }

      // Parse the response
      const parsed = this.parseAIResponse(response);

      if (!parsed.success) {
        return parsed;
      }

      return {
        success: true,
        rules: parsed.rules,
        strategyName: parsed.strategyName,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Sanity-check the API key prefix against the selected provider.
   * Only rejects keys that clearly belong to the OTHER provider so that
   * non-standard keys (proxies, test keys) still work.
   */
  private static checkApiKeyPrefix(provider: AIProvider, apiKey: string): string | null {
    if (provider === 'openai' && apiKey.startsWith('sk-ant-')) {
      return 'This looks like an Anthropic API key (starts with "sk-ant-"). OpenAI keys start with "sk-". Please check the selected provider or the key.';
    }
    if (
      provider === 'anthropic' &&
      apiKey.startsWith('sk-') &&
      !apiKey.startsWith('sk-ant-')
    ) {
      return 'This looks like an OpenAI API key. Anthropic keys start with "sk-ant-". Please check the selected provider or the key.';
    }
    return null;
  }

  /**
   * Server mode: POST the description to the backend, which builds the
   * request itself (system prompt, key resolution for the signed-in user or
   * the admin's site key) and returns { content: string } — the raw model
   * text. Runs the SAME extraction/validation pipeline as the direct-browser
   * mode on that content, so downstream rule handling is identical either way.
   */
  static async serverGenerate(
    description: string,
    provider?: AIProvider,
    model?: string
  ): Promise<GenerateStrategyResponse> {
    try {
      const response = await this.safeFetch('AI strategy', '/api/ai/generate-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ description, provider, model }),
      });

      if (!response.ok) {
        throw new Error(await this.extractServerErrorMessage(response));
      }

      const data = (await response.json()) as { content?: string };
      if (typeof data.content !== 'string') {
        throw new Error('AI strategy server returned an unexpected response shape');
      }

      return this.parseAIResponse(data.content);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Readable error extraction for the server-proxied AI endpoint, including
   * a dedicated message for 429 (per-user rate limiting).
   */
  private static async extractServerErrorMessage(response: Response): Promise<string> {
    if (response.status === 429) {
      return 'Rate limit reached for AI strategy generation (10/hour). Please wait before trying again.';
    }

    try {
      const body: unknown = await response.json();
      if (body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string') {
        return (body as { error: string }).error;
      }
    } catch {
      // Body wasn't JSON — fall through to the generic message below.
    }

    return `AI strategy request failed (${response.status}${response.statusText ? ` ${response.statusText}` : ''})`;
  }

  /**
   * Wrap fetch so network/CORS-level failures (TypeError) produce a readable message.
   */
  private static async safeFetch(
    providerName: string,
    url: string,
    init: RequestInit
  ): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(
          `Could not reach the ${providerName} API (network or CORS error). Check your internet connection; some networks and browser extensions block direct API access.`
        );
      }
      throw error;
    }
  }

  /**
   * Build a readable error from a non-OK response without assuming the body is JSON.
   */
  private static async extractApiError(
    providerName: string,
    response: Response,
    fallbackModel: string
  ): Promise<string> {
    let message: string | undefined;
    try {
      const body: unknown = await response.json();
      if (body && typeof body === 'object') {
        const err = (body as { error?: { message?: unknown } }).error;
        if (err && typeof err.message === 'string') {
          message = err.message;
        }
      }
    } catch {
      // Body was not JSON (e.g. an HTML error page from a WAF/proxy).
    }

    if (response.status === 404) {
      return `${providerName} API returned 404 (model not found). The model "${fallbackModel}" may have been retired — please choose another model.${message ? ` Details: ${message}` : ''}`;
    }

    return (
      message ||
      `${providerName} API request failed (${response.status}${response.statusText ? ` ${response.statusText}` : ''})`
    );
  }

  /**
   * Call OpenAI API
   */
  private static async callOpenAI(
    description: string,
    apiKey: string,
    model?: string
  ): Promise<string> {
    const usedModel = model || DEFAULT_OPENAI_MODEL;
    const response = await this.safeFetch('OpenAI', 'https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: usedModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: description },
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(await this.extractApiError('OpenAI', response, usedModel));
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('OpenAI API returned an unexpected response shape');
    }
    return content;
  }

  /**
   * Call Anthropic API
   */
  private static async callAnthropic(
    description: string,
    apiKey: string,
    model?: string
  ): Promise<string> {
    const usedModel = model || DEFAULT_ANTHROPIC_MODEL;
    const response = await this.safeFetch('Anthropic', 'https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: usedModel,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: description }],
      }),
    });

    if (!response.ok) {
      throw new Error(await this.extractApiError('Anthropic', response, usedModel));
    }

    const data = (await response.json()) as {
      content?: { text?: string }[];
    };
    const text = data.content?.[0]?.text;
    if (typeof text !== 'string') {
      throw new Error('Anthropic API returned an unexpected response shape');
    }
    return text;
  }

  /**
   * Extract the JSON payload from an AI response that may contain prose
   * and/or markdown code fences anywhere in the text.
   */
  private static extractJson(responseText: string): string {
    const text = responseText.trim();

    // Prefer a fenced code block, wherever it appears.
    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (fenceMatch && fenceMatch[1]?.trim()) {
      return fenceMatch[1].trim();
    }

    // Otherwise take the first balanced {...} block, tracking strings/escapes.
    const start = text.indexOf('{');
    if (start !== -1) {
      let depth = 0;
      let inString = false;
      let escaped = false;
      for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (escaped) {
          escaped = false;
        } else if (inString) {
          if (ch === '\\') escaped = true;
          else if (ch === '"') inString = false;
        } else if (ch === '"') {
          inString = true;
        } else if (ch === '{') {
          depth++;
        } else if (ch === '}') {
          depth--;
          if (depth === 0) {
            return text.slice(start, i + 1);
          }
        }
      }
    }

    return text;
  }

  /**
   * Parse AI response and validate rules
   */
  private static parseAIResponse(responseText: string): GenerateStrategyResponse {
    try {
      const jsonText = this.extractJson(responseText);
      const parsed: unknown = JSON.parse(jsonText);

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {
          success: false,
          error: 'Response must be a JSON object with a rules array',
        };
      }

      const { rules, strategyName } = parsed as {
        rules?: unknown;
        strategyName?: unknown;
      };

      if (!Array.isArray(rules)) {
        return {
          success: false,
          error: 'Response must contain a rules array',
        };
      }

      // Validate and normalize rules (weight-key defaulting means a missing
      // weight no longer rejects the whole response), then migrate any
      // legacy rule shapes to the consolidated evaluation model.
      const validatedRules: CustomRule[] = [];
      for (const rule of rules) {
        const coerced = this.coerceRule(rule);
        if (!coerced) {
          return {
            success: false,
            error: `Invalid rule structure: ${JSON.stringify(rule)}`,
          };
        }
        validatedRules.push(coerced);
      }

      if (validatedRules.length === 0) {
        return { success: false, error: 'Response contained no rules' };
      }

      return {
        success: true,
        rules: migrateCustomRules(validatedRules).rules,
        strategyName:
          typeof strategyName === 'string' && strategyName.trim()
            ? strategyName
            : 'AI Generated Strategy',
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to parse AI response: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private static isDirection(value: unknown): value is Direction {
    return typeof value === 'string' && (DIRECTIONS as readonly string[]).includes(value);
  }

  private static isDirectionArray(value: unknown): value is Direction[] {
    return Array.isArray(value) && value.length > 0 && value.every((d) => this.isDirection(d));
  }

  private static isConditionType(value: unknown): value is ConditionType {
    return (
      typeof value === 'string' && (CONDITION_TYPES as readonly string[]).includes(value)
    );
  }

  private static isValidConditionParams(value: unknown): value is ConditionParams {
    if (value === undefined) return true;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const params = value as Record<string, unknown>;
    if (
      params.corner !== undefined &&
      !(VALID_CORNERS as readonly string[]).includes(params.corner as string)
    ) {
      return false;
    }
    if (params.threshold !== undefined && !Number.isFinite(params.threshold)) {
      return false;
    }
    return true;
  }

  /** Weights are usable if they're an object; missing keys default via normalizeWeights. */
  private static isWeightsObject(value: unknown): value is Partial<EvaluationWeights> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  private static coerceOverrides(value: unknown): EvaluationOverride[] | null {
    if (value === undefined) return [];
    if (!Array.isArray(value)) return null;

    const overrides: EvaluationOverride[] = [];
    for (const entry of value.slice(0, MAX_OVERRIDES)) {
      if (!entry || typeof entry !== 'object') return null;
      const candidate = entry as Record<string, unknown>;
      if (!this.isConditionType(candidate.when)) return null;
      if (!this.isValidConditionParams(candidate.params)) return null;
      if (!this.isDirectionArray(candidate.action)) return null;
      overrides.push({
        when: candidate.when,
        ...(candidate.params !== undefined ? { params: candidate.params as ConditionParams } : {}),
        action: candidate.action,
      });
    }
    return overrides;
  }

  /**
   * Validate a rule from the AI and normalize it (clamped depth, defaulted
   * weight keys, capped overrides). Returns null when the rule is unusable.
   * Legacy rule shapes are still accepted; the caller migrates them.
   */
  private static coerceRule(rule: unknown): CustomRule | null {
    if (!rule || typeof rule !== 'object') return null;
    const candidate = rule as Record<string, unknown>;

    switch (candidate.type) {
      case 'evaluation': {
        if (!this.isWeightsObject(candidate.weights)) return null;
        const overrides = this.coerceOverrides(candidate.overrides);
        if (overrides === null) return null;
        const rawDepth = typeof candidate.depth === 'number' ? Math.floor(candidate.depth) : 1;
        const depth = Math.max(1, Math.min(rawDepth || 1, 5));
        return {
          type: 'evaluation',
          weights: normalizeWeights(candidate.weights),
          depth,
          ...(overrides.length > 0 ? { overrides } : {}),
        };
      }

      case 'pattern':
        return this.isDirectionArray(candidate.sequence)
          ? { type: 'pattern', sequence: candidate.sequence }
          : null;

      case 'conditional':
        return this.isConditionType(candidate.condition) &&
          this.isValidConditionParams(candidate.conditionParams) &&
          this.isDirectionArray(candidate.action) &&
          typeof candidate.priority === 'number' &&
          Number.isFinite(candidate.priority)
          ? (candidate as unknown as CustomRule)
          : null;

      case 'lookahead':
        return typeof candidate.depth === 'number' &&
          candidate.depth >= 1 &&
          candidate.depth <= 5 &&
          this.isWeightsObject(candidate.evaluationWeights)
          ? {
              type: 'lookahead',
              depth: candidate.depth,
              evaluationWeights: normalizeWeights(candidate.evaluationWeights),
            }
          : null;

      case 'weighted':
        return this.isWeightsObject(candidate.weights)
          ? { type: 'weighted', weights: normalizeWeights(candidate.weights) }
          : null;

      default:
        return null;
    }
  }
}
