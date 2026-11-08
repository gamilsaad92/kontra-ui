'use strict';

const STAGING_PROJECT_REF = 'jpemuoapbgzwapydqiio';
const STAGING_SUPABASE_URL = `https://${STAGING_PROJECT_REF}.supabase.co`;
const STAGING_FRONTEND_ORIGIN = 'https://staging.kontraplatform.com';
const PLACEHOLDERS = new Set(['placeholder', 'placeholder-key', 'sk-not-configured']);

function isConfiguredSecret(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return Boolean(normalized)
    && !PLACEHOLDERS.has(normalized)
    && !normalized.includes('placeholder');
}

function assertStagingEnvironment(env = process.env) {
  if (env.KONTRA_STAGING_ISOLATION !== 'true') return { enabled: false };
  const errors = [];
  if (env.NODE_ENV !== 'production') errors.push('NODE_ENV must be production');
  if (env.DATABASE_URL || env.SUPABASE_DB_URL) {
    errors.push('DATABASE_URL and SUPABASE_DB_URL are forbidden in staging');
  }
  if (env.SUPABASE_URL && env.SUPABASE_URL.replace(/\/+$/, '') !== STAGING_SUPABASE_URL) {
    errors.push(`SUPABASE_URL must identify the approved staging project ${STAGING_PROJECT_REF}`);
  }
  if (env.SUPABASE_REPLICA_URL
    && env.SUPABASE_REPLICA_URL.replace(/\/+$/, '') !== STAGING_SUPABASE_URL) {
    errors.push(`SUPABASE_REPLICA_URL must identify the approved staging project ${STAGING_PROJECT_REF}`);
  }
  if (!isConfiguredSecret(env.STAGING_SUPABASE_SERVICE_ROLE_KEY)) {
    errors.push('STAGING_SUPABASE_SERVICE_ROLE_KEY is required');
  }
  if (!isConfiguredSecret(env.STAGING_OPENAI_API_KEY)) {
    errors.push('STAGING_OPENAI_API_KEY is required');
  }
  if (errors.length) {
    const error = new Error(`Staging environment validation failed: ${errors.join('; ')}`);
    error.code = 'STAGING_ENVIRONMENT_INVALID';
    throw error;
  }

  env.SUPABASE_URL = STAGING_SUPABASE_URL;
  env.SUPABASE_SERVICE_ROLE_KEY = env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
  env.OPENAI_API_KEY = env.STAGING_OPENAI_API_KEY;
  env.SUPABASE_REPLICA_URL = STAGING_SUPABASE_URL;
  delete env.DATABASE_URL;
  delete env.SUPABASE_DB_URL;
  delete env.OPENAI_API_KEY1;
  delete env.AI_INTEGRATIONS_OPENAI_API_KEY;
  delete env.CORS_ORIGINS;
  env.FRONTEND_URL = STAGING_FRONTEND_ORIGIN;
  return {
    enabled: true,
    projectRef: STAGING_PROJECT_REF,
    frontendOrigin: STAGING_FRONTEND_ORIGIN,
  };
}

module.exports = {
  STAGING_PROJECT_REF,
  STAGING_SUPABASE_URL,
  STAGING_FRONTEND_ORIGIN,
  assertStagingEnvironment,
};
