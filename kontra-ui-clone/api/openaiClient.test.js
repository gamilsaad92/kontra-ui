const mockCreate = jest.fn();

jest.mock('openai', () => jest.fn().mockImplementation((options) => ({
  options,
  chat: { completions: { create: mockCreate } },
})));

describe('OpenAI client hardening', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValue({ choices: [] });
    delete process.env.OPENAI_API_KEY1;
    process.env.OPENAI_API_KEY = 'wrapper-test-key';
  });

  test('forces store false on Chat Completions requests', async () => {
    const { createOpenAIClient } = require('./lib/openaiClient');
    const client = createOpenAIClient({ apiKey: 'test-key' });

    await client.chat.completions.create({ model: 'gpt-4o-mini', store: true });

    expect(mockCreate).toHaveBeenCalledWith(
      { model: 'gpt-4o-mini', store: false },
    );
  });

  test('institutional clients use the configured standard API key path', () => {
    const {
      createInstitutionalOpenAIClient,
      STANDARD_OPENAI_BASE_URL,
    } = require('./lib/openaiClient');
    const client = createInstitutionalOpenAIClient();

    expect(client.options).toEqual({
      apiKey: 'wrapper-test-key',
      baseURL: STANDARD_OPENAI_BASE_URL,
    });
  });

  test('provider errors expose only safe metadata', () => {
    const {
      safeAIErrorMetadata,
      safeAIErrorMessage,
    } = require('./lib/openaiClient');
    const error = Object.assign(new Error('provider response contains customer prompt text'), {
      code: 'rate_limit_exceeded',
      status: 429,
    });

    expect(safeAIErrorMetadata(error)).toEqual({
      name: 'Error',
      code: 'rate_limit_exceeded',
      status: 429,
    });
    expect(safeAIErrorMessage(error)).toBe('AI service unavailable. Please try again.');
    expect(JSON.stringify(safeAIErrorMetadata(error))).not.toContain('customer prompt');
  });
});