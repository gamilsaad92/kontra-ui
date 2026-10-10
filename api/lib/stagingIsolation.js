'use strict';

const STAGING_PROJECT_REF = 'jpemuoapbgzwapydqiio';
const DATABASE_OVERRIDE_VARS = [
  'DATABASE_URL',
  'SUPABASE_REPLICA_URL',
  'SUPABASE_DB_URL',
  'APP_DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'DATABASE_URL_UNPOOLED',
  'DIRECT_URL',
  'DB_URL',
  'PGHOST',
  'PGHOSTADDR',
  'PGPORT',
  'PGDATABASE',
  'PGUSER',
  'PGPASSWORD',
  'PGSSLMODE',
  'PGSERVICE',
  'PGSERVICEFILE',
  'PGOPTIONS',
  'PGAPPNAME',
  'PGCONNECT_TIMEOUT',
  'PGTARGETSESSIONATTRS',
  'POSTGRES_HOST',
  'POSTGRES_PORT',
  'POSTGRES_DATABASE',
  'POSTGRES_DB',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'DATABASE_HOST',
  'DATABASE_NAME',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
];
const PRODUCTION_FRONTEND_HOSTS = [
  'kontra.vercel.app',
  'kontra-ui.vercel.app',
  'kontraui.com',
  'www.kontraui.com',
  'kontraplatform.com',
  'www.kontraplatform.com',
];

function isStagingIsolationEnabled(env = process.env) {
  return env.KONTRA_STAGING_ISOLATION === 'true';
}

function assertStagingDatabaseEnvironment(env = process.env) {
  if (!isStagingIsolationEnabled(env)) return;
  const overrides = DATABASE_OVERRIDE_VARS.filter(name => String(env[name] || '').trim());
  if (overrides.length) {
    throw new Error(`Staging isolation rejects database overrides: ${overrides.join(', ')}`);
  }
  let url;
  try {
    url = new URL(env.SUPABASE_URL || '');
  } catch (_) {
    throw new Error('Staging isolation requires the designated Supabase URL');
  }
  if (url.protocol !== 'https:'
      || url.hostname !== `${STAGING_PROJECT_REF}.supabase.co`
      || url.username
      || url.password
      || url.pathname !== '/'
      || url.search
      || url.hash) {
    throw new Error('Staging isolation requires Supabase project jpemuoapbgzwapydqiio');
  }
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!serviceRoleKey || /placeholder|sk-not-configured/i.test(serviceRoleKey)) {
    throw new Error('Staging isolation requires SUPABASE_SERVICE_ROLE_KEY');
  }
}

function assertStagingEnvironment(env = process.env) {
  if (!isStagingIsolationEnabled(env)) return;
  if (env.NODE_ENV !== 'production') {
    throw new Error('Staging isolation requires NODE_ENV=production');
  }
  assertStagingDatabaseEnvironment(env);
  if (String(env.OPENAI_API_KEY1 || '').trim()) {
    throw new Error('Staging isolation rejects OPENAI_API_KEY1; use the staging OPENAI_API_KEY');
  }
  if (!String(env.OPENAI_API_KEY || '').trim()
      || /placeholder|sk-not-configured/i.test(String(env.OPENAI_API_KEY))) {
    throw new Error('Staging isolation requires a staging-only OPENAI_API_KEY');
  }
  if (!String(env.FRONTEND_URL || '').trim() || !String(env.CORS_ORIGINS || '').trim()) {
    throw new Error('Staging isolation requires explicit staging FRONTEND_URL and CORS_ORIGINS');
  }
  const frontend = new URL(env.FRONTEND_URL);
  const origins = env.CORS_ORIGINS.split(',').map(value => value.trim().replace(/\/$/, '')).filter(Boolean);
  const allowed = origins.map(value => new URL(value));
  const isProductionHost = hostname => {
    const normalized = hostname.toLowerCase();
    return PRODUCTION_FRONTEND_HOSTS.some(host => normalized === host || normalized.endsWith(`.${host}`));
  };
  if (frontend.protocol !== 'https:'
      || frontend.username
      || frontend.password
      || frontend.pathname !== '/'
      || frontend.search
      || frontend.hash
      || isProductionHost(frontend.hostname)) {
    throw new Error('Staging FRONTEND_URL must be an HTTPS staging origin, not production');
  }
  if (!allowed.length || allowed.some((origin, index) => (
    origin.origin !== origins[index]
    || origin.protocol !== 'https:'
    || isProductionHost(origin.hostname)
  ))) {
    throw new Error('Staging CORS_ORIGINS must contain only explicit HTTPS staging origins');
  }
  if (!allowed.some(origin => origin.origin === frontend.origin)) {
    throw new Error('Staging CORS_ORIGINS must include the FRONTEND_URL origin');
  }
}

function isStagingStripeReady(env = process.env) {
  return isStagingIsolationEnabled(env)
    && env.STAGING_STRIPE_ENABLED === 'true'
    && /^sk_test_/.test(String(env.STRIPE_SECRET_KEY || ''))
    && Boolean(String(env.STRIPE_WEBHOOK_SECRET || '').trim());
}

module.exports = {
  STAGING_PROJECT_REF,
  DATABASE_OVERRIDE_VARS,
  isStagingIsolationEnabled,
  assertStagingDatabaseEnvironment,
  assertStagingEnvironment,
  isStagingStripeReady,
};
