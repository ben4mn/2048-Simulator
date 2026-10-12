import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AIStrategyGenerator } from '../aiStrategyGenerator';

function mockFetchOnce(options: {
  ok: boolean;
  jsonBody?: any;
  jsonThrows?: boolean;
  status?: number;
}) {
  const { ok, jsonBody, jsonThrows, status = ok ? 200 : 400 } = options;
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: jsonThrows
      ? vi.fn().mockRejectedValue(new SyntaxError('Unexpected token < in JSON'))
      : vi.fn().mockResolvedValue(jsonBody),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function anthropicTextResponse(text: string) {
  return { content: [{ text }] };
}

function validRulesPayload() {
  return {
    strategyName: 'Corner Stacker',
    rules: [
      {
        type: 'pattern',
        sequence: ['left', 'down'],
      },
      {
        type: 'conditional',
        condition: 'max_tile_in_corner',
        conditionParams: { corner: 'bottom-left' },
        action: ['left', 'down'],
        priority: 10,
      },
    ],
  };
}

describe('AIStrategyGenerator', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses a well-formed JSON response into CustomRule[]', async () => {
    mockFetchOnce({
      ok: true,
      jsonBody: anthropicTextResponse(JSON.stringify(validRulesPayload())),
    });

    const result = await AIStrategyGenerator.generateStrategy({
      description: 'Stack tiles in the bottom-left corner',
      config: { provider: 'anthropic', apiKey: 'test-key' },
    });

    expect(result.success).toBe(true);
    // Legacy pattern+conditional payloads are migrated to ONE evaluation rule
    // with the conditional folded in as an override.
    expect(result.rules).toHaveLength(1);
    expect(result.strategyName).toBe('Corner Stacker');
    expect(result.rules?.[0]).toMatchObject({
      type: 'evaluation',
      overrides: [{ when: 'max_tile_in_corner', action: ['left', 'down'] }],
    });
  });

  // KNOWN BUG (aiStrategyGenerator.ts:212-220): the code-fence stripper only
  // matches when the response STARTS with ``` (jsonText.startsWith('```')).
  // A response with preamble text before the fence falls through to
  // JSON.parse on the raw text (including the prose and fences) and fails.
  it('parses a response that has preamble text before the code fence', async () => {
    const withPreamble =
      'Here is your strategy:\n```json\n' +
      JSON.stringify(validRulesPayload()) +
      '\n```';

    mockFetchOnce({
      ok: true,
      jsonBody: anthropicTextResponse(withPreamble),
    });

    const result = await AIStrategyGenerator.generateStrategy({
      description: 'Stack tiles in the bottom-left corner',
      config: { provider: 'anthropic', apiKey: 'test-key' },
    });

    expect(result.success).toBe(true);
    expect(result.rules).toHaveLength(1);
  });

  // KNOWN BUG (aiStrategyGenerator.ts:270-276): isValidRule only checks that
  // `condition` is typeof 'string' for conditional rules -- it never checks
  // that the value is one of the actual ConditionType values from
  // customRules.ts (max_tile_in_corner, max_tile_on_edge, empty_cells_count,
  // merge_available, monotonic_rows, monotonic_cols). A hallucinated
  // condition like "tile_near_edge" is accepted instead of rejected.
  it('rejects a conditional rule with a hallucinated condition type', async () => {
    const payload = {
      strategyName: 'Bad Condition Strategy',
      rules: [
        {
          type: 'conditional',
          condition: 'tile_near_edge', // not a valid ConditionType
          action: ['left'],
          priority: 5,
        },
      ],
    };

    mockFetchOnce({
      ok: true,
      jsonBody: anthropicTextResponse(JSON.stringify(payload)),
    });

    const result = await AIStrategyGenerator.generateStrategy({
      description: 'Keep tiles near the edge',
      config: { provider: 'anthropic', apiKey: 'test-key' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  // Weight-key defaulting: partial or non-numeric weights are normalized
  // (missing/invalid keys -> 0) instead of rejecting the whole response.
  it('accepts a weighted rule with missing weight keys (defaulted to 0) and migrates it', async () => {
    const payload = {
      strategyName: 'Bad Weights Strategy',
      rules: [
        {
          type: 'weighted',
          weights: {
            emptyTiles: 'high', // string instead of number
            maxTileValue: 1.0,
            // missing maxTileCorner, mergeCount, monotonicity, smoothness
          },
        },
      ],
    };

    mockFetchOnce({
      ok: true,
      jsonBody: anthropicTextResponse(JSON.stringify(payload)),
    });

    const result = await AIStrategyGenerator.generateStrategy({
      description: 'Weight the board by empty tiles',
      config: { provider: 'anthropic', apiKey: 'test-key' },
    });

    expect(result.success).toBe(true);
    const rule = result.rules?.[0] as unknown as { type: string; weights: Record<string, number>; depth: number };
    expect(rule).toMatchObject({ type: 'evaluation', depth: 1 });
    // Non-numeric and missing keys default to 0 instead of rejecting.
    expect(rule.weights.emptyTiles).toBe(0);
    expect(rule.weights.maxTileValue).toBe(1.0);
    expect(rule.weights.smoothness).toBe(0);
  });

  // KNOWN BUG: isValidRule never validates conditionParams.corner against the
  // allowed ConditionParams['corner'] values (top-left, top-right,
  // bottom-left, bottom-right), so an invalid corner like "middle" is
  // accepted.
  it('rejects a conditional rule with an invalid conditionParams.corner value', async () => {
    const payload = {
      strategyName: 'Bad Corner Strategy',
      rules: [
        {
          type: 'conditional',
          condition: 'max_tile_in_corner',
          conditionParams: { corner: 'middle' }, // not a valid corner
          action: ['left'],
          priority: 5,
        },
      ],
    };

    mockFetchOnce({
      ok: true,
      jsonBody: anthropicTextResponse(JSON.stringify(payload)),
    });

    const result = await AIStrategyGenerator.generateStrategy({
      description: 'Keep the max tile in the middle',
      config: { provider: 'anthropic', apiKey: 'test-key' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  // KNOWN BUG (aiStrategyGenerator.ts:182-195): the Anthropic request is
  // missing the 'anthropic-dangerous-direct-browser-access' header that is
  // required for calling the Anthropic API directly from a browser context.
  it('includes the anthropic-dangerous-direct-browser-access header on Anthropic requests', async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      jsonBody: anthropicTextResponse(JSON.stringify(validRulesPayload())),
    });

    await AIStrategyGenerator.generateStrategy({
      description: 'Stack tiles in the bottom-left corner',
      config: { provider: 'anthropic', apiKey: 'test-key' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchMock.mock.calls[0];
    const headers = requestInit.headers as Record<string, string>;
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
  });

  // KNOWN BUG: default model IDs are hardcoded to retired 2024 snapshots
  // ('gpt-4o-mini', 'claude-3-5-sonnet-20241022'). These should not be used
  // as the default model going forward.
  it('does not default to the retired claude-3-5-sonnet-20241022 model for Anthropic requests', async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      jsonBody: anthropicTextResponse(JSON.stringify(validRulesPayload())),
    });

    await AIStrategyGenerator.generateStrategy({
      description: 'Stack tiles in the bottom-left corner',
      config: { provider: 'anthropic', apiKey: 'test-key' },
    });

    const [, requestInit] = fetchMock.mock.calls[0];
    const body = JSON.parse(requestInit.body as string);
    expect(body.model).not.toBe('claude-3-5-sonnet-20241022');
  });

  it('does not default to the retired gpt-4o-mini model for OpenAI requests', async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      jsonBody: {
        choices: [{ message: { content: JSON.stringify(validRulesPayload()) } }],
      },
    });

    await AIStrategyGenerator.generateStrategy({
      description: 'Stack tiles in the bottom-left corner',
      config: { provider: 'openai', apiKey: 'test-key' },
    });

    const [, requestInit] = fetchMock.mock.calls[0];
    const body = JSON.parse(requestInit.body as string);
    expect(body.model).not.toBe('gpt-4o-mini');
  });

  // KNOWN BUG (aiStrategyGenerator.ts:167,:199): on a non-ok response the
  // code calls response.json() unconditionally. A WAF or proxy error page
  // returning HTML causes response.json() to throw a raw SyntaxError instead
  // of a readable, user-facing error message.
  it('produces a readable error when the error response body is not JSON (e.g. HTML from a WAF)', async () => {
    mockFetchOnce({
      ok: false,
      status: 503,
      jsonThrows: true,
    });

    const result = await AIStrategyGenerator.generateStrategy({
      description: 'Stack tiles in the bottom-left corner',
      config: { provider: 'anthropic', apiKey: 'test-key' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    // Should not be a raw, low-level JSON parsing error message.
    expect(result.error?.toLowerCase()).not.toContain('unexpected token');
  });
});

describe('AIStrategyGenerator.serverGenerate', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs to /api/ai/generate-strategy with credentials included and parses response.content', async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      jsonBody: { content: JSON.stringify(validRulesPayload()) },
    });

    const result = await AIStrategyGenerator.serverGenerate('Stack tiles in the corner', 'anthropic');

    expect(result.success).toBe(true);
    expect(result.rules).toHaveLength(1);
    expect(result.rules?.[0]).toMatchObject({ type: 'evaluation' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ai/generate-strategy',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ description: 'Stack tiles in the corner', provider: 'anthropic', model: undefined }),
      })
    );
  });

  it('surfaces a readable message on 429 rate limiting', async () => {
    mockFetchOnce({ ok: false, status: 429, jsonThrows: true });

    const result = await AIStrategyGenerator.serverGenerate('desc', 'anthropic');

    expect(result.success).toBe(false);
    expect(result.error?.toLowerCase()).toContain('rate limit');
  });

  it('surfaces the server error message for a 400 (e.g. no API key configured)', async () => {
    mockFetchOnce({ ok: false, status: 400, jsonBody: { error: 'No API key configured for this provider.' } });

    const result = await AIStrategyGenerator.serverGenerate('desc', 'openai');

    expect(result.success).toBe(false);
    expect(result.error).toBe('No API key configured for this provider.');
  });

  it('surfaces a readable message on a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const result = await AIStrategyGenerator.serverGenerate('desc', 'anthropic');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/could not reach/i);
  });

  it('fails gracefully when response.content is missing', async () => {
    mockFetchOnce({ ok: true, jsonBody: {} });

    const result = await AIStrategyGenerator.serverGenerate('desc', 'anthropic');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unexpected response shape/i);
  });

  it('forwards cancellation to both server and direct-provider fetches', async () => {
    const controller = new AbortController();
    const fetchMock = mockFetchOnce({ ok: true, jsonBody: { content: JSON.stringify(validRulesPayload()) } });
    await AIStrategyGenerator.serverGenerate('desc', 'anthropic', undefined, controller.signal);
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);

    const directFetch = mockFetchOnce({ ok: true, jsonBody: anthropicTextResponse(JSON.stringify(validRulesPayload())) });
    await AIStrategyGenerator.generateStrategy({ description: 'desc', config: { provider: 'anthropic', apiKey: 'sk-ant-test' }, signal: controller.signal });
    expect(directFetch.mock.calls[0][1].signal).toBe(controller.signal);
  });
});
