// TEMP release diagnostic. Remove this file and its db.js call after verification.
function getProjectRef(urlValue, allowPooler = false) {
  if (typeof urlValue !== 'string' || !urlValue.trim()) return null;
  try {
    const parsed = new URL(urlValue);
    const hostMatch = parsed.hostname.match(/^(?:db\.)?([a-z0-9]{20})\.supabase\.co$/i);
    if (hostMatch) return hostMatch[1].toLowerCase();
    if (allowPooler && parsed.hostname.toLowerCase().endsWith('.pooler.supabase.com')) {
      const userMatch = decodeURIComponent(parsed.username).match(/^postgres\.([a-z0-9]{20})$/i);
      if (userMatch) return userMatch[1].toLowerCase();
    }
  } catch (_) {}
  return null;
}

function getReleaseDbIdentity(env = process.env) {
  const databaseUrlSet = Boolean(env.DATABASE_URL);
  const supabaseUrl = env.SUPABASE_URL;
  let realSupabaseUrl = false;
  if (typeof supabaseUrl === 'string' && !supabaseUrl.includes('placeholder')) {
    try {
      realSupabaseUrl = new URL(supabaseUrl).protocol === 'https:';
    } catch (_) {}
  }
  const effectiveDatabaseSource = databaseUrlSet
    ? 'DATABASE_URL'
    : realSupabaseUrl
      ? 'SUPABASE_URL'
      : 'none';
  const effectiveUrl = databaseUrlSet
    ? env.DATABASE_URL
    : realSupabaseUrl
      ? supabaseUrl
      : null;

  return {
    databaseUrlSet,
    effectiveDatabaseSource,
    databaseUrlOverridesSupabaseUrl: Boolean(databaseUrlSet && realSupabaseUrl),
    effectiveSupabaseProjectRef: getProjectRef(effectiveUrl, databaseUrlSet),
  };
}

function logReleaseDbIdentity(env = process.env, logger = line => console.info(line)) {
  logger(`[release-5524-db-identity] ${JSON.stringify(getReleaseDbIdentity(env))}`);
}

module.exports = { getReleaseDbIdentity, logReleaseDbIdentity };
