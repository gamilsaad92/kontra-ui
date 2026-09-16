const OpenAI = require('openai');

const DEV_PLACEHOLDER_KEY = 'sk-not-configured';
const STANDARD_OPENAI_BASE_URL = 'https://api.openai.com/v1';

function resolveOpenAIKey() {
  return process.env.OPENAI_API_KEY1 || process.env.OPENAI_API_KEY || DEV_PLACEHOLDER_KEY;
}

/**
 * Create an OpenAI-compatible client whose Chat Completions requests do not
 * opt into provider-side application state. Custom base URLs remain available
 * to legacy/demo callers through this general factory.
 */
function createOpenAIClient(options = {}) {
  const client = new OpenAI(options);
  const createCompletion = client.chat.completions.create.bind(client.chat.completions);
  client.chat.completions.create = (params = {}, ...requestOptions) => (
    createCompletion({ ...params, store: false }, ...requestOptions)
  );
  return client;
}

/**
 * Institutional Deal Room/document/grounding flows must always use the
 * approved OpenAI API project path. This intentionally does not accept a
 * caller-provided base URL or provider fallback.
 */
function createInstitutionalOpenAIClient() {
  return createOpenAIClient({
    apiKey: resolveOpenAIKey(),
    baseURL: STANDARD_OPENAI_BASE_URL,
  });
}

function safeAIErrorMetadata(error) {
  return {
    name: error?.name || 'Error',
    code: error?.code || undefined,
    status: Number.isFinite(error?.status) ? error.status : undefined,
  };
}

function safeAIErrorMessage(_error, fallback = 'AI service unavailable. Please try again.') {
  return fallback;
}

module.exports = {
  createOpenAIClient,
  createInstitutionalOpenAIClient,
  resolveOpenAIKey,
  STANDARD_OPENAI_BASE_URL,
  safeAIErrorMetadata,
  safeAIErrorMessage,
};