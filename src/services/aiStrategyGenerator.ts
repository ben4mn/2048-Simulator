/**
 * AI Strategy Generator Service
 * Converts natural language descriptions into 2048 strategy rules
 */

import type { CustomRule } from '../engine/customRules';

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

const SYSTEM_PROMPT = `You are a 2048 game strategy designer. Convert user descriptions into JSON rule configurations.

Available rule types:

1. PATTERN - Repeats a fixed sequence of moves
   Example: { "type": "pattern", "sequence": ["left", "down", "right", "down"] }

2. CONDITIONAL - If-then rules based on board state
   Example: {
     "type": "conditional",
     "condition": "max_tile_in_corner",
     "conditionParams": { "corner": "bottom-left" },
     "action": ["left", "down"],
     "priority": 10
   }

   Available conditions:
   - "max_tile_in_corner" (params: corner)
   - "max_tile_on_edge"
   - "empty_cells_count" (params: threshold)
   - "merge_available"
   - "monotonic_rows" (params: threshold)
   - "monotonic_cols" (params: threshold)

3. LOOKAHEAD - Evaluates moves N steps ahead
   Example: {
     "type": "lookahead",
     "depth": 2,
     "evaluationWeights": {
       "emptyTiles": 2.7,
       "maxTileValue": 1.0,
       "maxTileCorner": 4.0,
       "mergeCount": 1.5,
       "monotonicity": 3.0,
       "smoothness": 0.5
     }
   }

4. WEIGHTED - Scores moves by weighted criteria
   Example: {
     "type": "weighted",
     "weights": {
       "emptyTiles": 3.0,
       "maxTileValue": 1.0,
       "maxTileCorner": 5.0,
       "mergeCount": 2.0,
       "monotonicity": 2.5,
       "smoothness": 0.5
     }
   }

Directions: "up", "down", "left", "right"
Corners: "top-left", "top-right", "bottom-left", "bottom-right"

Respond with JSON in this format:
{
  "strategyName": "Descriptive strategy name",
  "rules": [rule1, rule2, ...]
}

Create strategies that match the user's description. Combine multiple rule types if needed.`;

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

      let response: any;

      if (provider === 'openai') {
        response = await this.callOpenAI(request.description, apiKey, model);
      } else if (provider === 'anthropic') {
        response = await this.callAnthropic(request.description, apiKey, model);
      } else {
        return {
          success: false,
          error: `Unsupported provider: ${provider}`,
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
   * Call OpenAI API
   */
  private static async callOpenAI(
    description: string,
    apiKey: string,
    model?: string
  ): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: description },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenAI API request failed');
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  /**
   * Call Anthropic API
   */
  private static async callAnthropic(
    description: string,
    apiKey: string,
    model?: string
  ): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: description }],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Anthropic API request failed');
    }

    const data = await response.json();
    return data.content[0].text;
  }

  /**
   * Parse AI response and validate rules
   */
  private static parseAIResponse(responseText: string): GenerateStrategyResponse {
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonText = responseText.trim();

      // Remove markdown code blocks if present
      if (jsonText.startsWith('```')) {
        const matches = jsonText.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
        if (matches && matches[1]) {
          jsonText = matches[1];
        }
      }

      const parsed = JSON.parse(jsonText);

      if (!parsed.rules || !Array.isArray(parsed.rules)) {
        return {
          success: false,
          error: 'Response must contain a rules array',
        };
      }

      // Validate rules
      const validatedRules: CustomRule[] = [];
      for (const rule of parsed.rules) {
        if (!this.isValidRule(rule)) {
          return {
            success: false,
            error: `Invalid rule structure: ${JSON.stringify(rule)}`,
          };
        }
        validatedRules.push(rule);
      }

      return {
        success: true,
        rules: validatedRules,
        strategyName: parsed.strategyName || 'AI Generated Strategy',
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to parse AI response: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Validate rule structure
   */
  private static isValidRule(rule: any): rule is CustomRule {
    if (!rule || typeof rule !== 'object') return false;

    switch (rule.type) {
      case 'pattern':
        return (
          Array.isArray(rule.sequence) &&
          rule.sequence.length > 0 &&
          rule.sequence.every((d: any) => ['up', 'down', 'left', 'right'].includes(d))
        );

      case 'conditional':
        return (
          typeof rule.condition === 'string' &&
          Array.isArray(rule.action) &&
          rule.action.every((d: any) => ['up', 'down', 'left', 'right'].includes(d)) &&
          typeof rule.priority === 'number'
        );

      case 'lookahead':
        return (
          typeof rule.depth === 'number' &&
          rule.depth >= 1 &&
          rule.depth <= 5 &&
          rule.evaluationWeights &&
          typeof rule.evaluationWeights === 'object'
        );

      case 'weighted':
        return rule.weights && typeof rule.weights === 'object';

      default:
        return false;
    }
  }
}
