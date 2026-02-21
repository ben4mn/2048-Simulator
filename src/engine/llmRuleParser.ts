/**
 * LLM Rule Parser
 * Converts natural language strategy descriptions into structured RuleSets
 */

import type { RuleSet, Rule, Direction } from './types';

const SYSTEM_PROMPT = `You are a 2048 game strategy designer. Convert the user's natural language strategy description into a structured RuleSet JSON.

The RuleSet defines an ordered list of rules. Each rule specifies a direction to move and a condition for when that rule should fire. Rules are evaluated top-to-bottom; the first rule whose condition is met AND whose direction is a valid move gets executed.

Available directions: "up", "down", "left", "right"

Available condition types:
1. { "type": "always" } - Always try this direction (no condition)
2. { "type": "fallback", "whenUnavailable": ["left", "down"] } - Only when ALL listed directions are invalid moves
3. { "type": "board", "check": { "type": "highest_tile_in", "positions": [[3,0]] } } - When highest tile is at position [row,col]. Common corners: [0,0]=top-left, [0,3]=top-right, [3,0]=bottom-left, [3,3]=bottom-right
4. { "type": "board", "check": { "type": "merge_available", "direction": "left" } } - When a merge is possible in that direction
5. { "type": "board", "check": { "type": "empty_cells_above", "threshold": 6 } } - When board is open (more than N empty cells)
6. { "type": "board", "check": { "type": "empty_cells_below", "threshold": 4 } } - When board is crowded (fewer than N empty cells)

Return ONLY valid JSON (no markdown, no explanation) matching this schema:
{
  "name": "Strategy Name",
  "description": "Brief description",
  "rules": [
    { "id": "r1", "direction": "left", "condition": { "type": "always" }, "priority": 0 },
    { "id": "r2", "direction": "right", "condition": { "type": "fallback", "whenUnavailable": ["left"] }, "priority": 1 }
  ],
  "fallbackDirection": "down"
}

Rules should have sequential ids (r1, r2, r3...) and priorities (0, 1, 2...).
The fallbackDirection is used as a last resort if no rules fire.`;

export interface LLMConfig {
  provider: 'openai' | 'anthropic';
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export interface LLMParseResult {
  success: boolean;
  ruleSet?: RuleSet;
  error?: string;
  rawResponse?: string;
}

/**
 * Call the LLM API and parse the response into a RuleSet
 */
export async function generateRuleSet(
  description: string,
  config: LLMConfig
): Promise<LLMParseResult> {
  try {
    const rawResponse = await callLLM(description, config);
    const parsed = parseResponse(rawResponse);
    return parsed;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

async function callLLM(description: string, config: LLMConfig): Promise<string> {
  if (config.provider === 'anthropic') {
    return callAnthropic(description, config);
  }
  return callOpenAI(description, config);
}

async function callOpenAI(description: string, config: LLMConfig): Promise<string> {
  const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  const model = config.model || 'gpt-4o-mini';

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: description },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

async function callAnthropic(description: string, config: LLMConfig): Promise<string> {
  const baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
  const model = config.model || 'claude-sonnet-4-5-20250929';

  const response = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: description },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  const block = data.content?.find((b: any) => b.type === 'text');
  return block?.text || '';
}

function parseResponse(raw: string): LLMParseResult {
  // Try to extract JSON from the response
  let jsonStr = raw.trim();

  // Strip markdown code fences if present
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return { success: false, error: 'Failed to parse LLM response as JSON', rawResponse: raw };
  }

  // Validate and build the RuleSet
  if (!parsed.rules || !Array.isArray(parsed.rules)) {
    return { success: false, error: 'Response missing "rules" array', rawResponse: raw };
  }

  const validDirections: Direction[] = ['up', 'down', 'left', 'right'];

  const rules: Rule[] = [];
  for (let i = 0; i < parsed.rules.length; i++) {
    const r = parsed.rules[i];
    if (!r.direction || !validDirections.includes(r.direction)) {
      continue; // Skip invalid rules
    }

    const rule: Rule = {
      id: r.id || `r${i + 1}`,
      direction: r.direction,
      condition: validateCondition(r.condition) || { type: 'always' },
      priority: typeof r.priority === 'number' ? r.priority : i,
    };
    rules.push(rule);
  }

  if (rules.length === 0) {
    return { success: false, error: 'No valid rules found in response', rawResponse: raw };
  }

  const ruleSet: RuleSet = {
    id: `llm_${Date.now()}`,
    name: parsed.name || 'LLM Generated Strategy',
    description: parsed.description,
    rules,
    fallbackDirection: validDirections.includes(parsed.fallbackDirection) ? parsed.fallbackDirection : undefined,
    source: 'llm',
  };

  return { success: true, ruleSet, rawResponse: raw };
}

function validateCondition(cond: any): Rule['condition'] | null {
  if (!cond || typeof cond !== 'object') return null;

  switch (cond.type) {
    case 'always':
      return { type: 'always' };

    case 'fallback':
      if (Array.isArray(cond.whenUnavailable) && cond.whenUnavailable.length > 0) {
        const valid = cond.whenUnavailable.filter((d: string) =>
          ['up', 'down', 'left', 'right'].includes(d)
        );
        if (valid.length > 0) {
          return { type: 'fallback', whenUnavailable: valid };
        }
      }
      return null;

    case 'board':
      if (cond.check && typeof cond.check === 'object') {
        return { type: 'board', check: cond.check };
      }
      return null;

    default:
      return null;
  }
}

/**
 * Get stored LLM config from localStorage
 */
export function getLLMConfig(): LLMConfig | null {
  try {
    const stored = localStorage.getItem('2048_llm_config');
    if (!stored) return null;
    const config = JSON.parse(stored);
    if (!config.apiKey) return null;
    return config;
  } catch {
    return null;
  }
}

/**
 * Save LLM config to localStorage
 */
export function saveLLMConfig(config: LLMConfig): void {
  localStorage.setItem('2048_llm_config', JSON.stringify(config));
}
