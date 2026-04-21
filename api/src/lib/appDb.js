const { execFile } = require('node:child_process');

const DEFAULT_TIMEOUT_MS = Number(process.env.APP_DB_TIMEOUT_MS || 10000);

// psql stderr fragments that indicate the URL is misconfigured / unreachable.
// Treat these the same as APP_DB_URL_MISSING so callers fall back silently.
const SILENT_PSQL_ERRORS = [
  'Wrong password',
  'SCRAM exchange',
  'authentication failed',
  'password authentication failed',
  'Connection refused',
  'could not connect',
  'connection to server',
];

function isSilentPsqlError(message) {
  if (!message) return false;
  return SILENT_PSQL_ERRORS.some((fragment) => message.includes(fragment));
}

function runSql(sql, params = [], timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const databaseUrl = process.env.APP_DATABASE_URL || process.env.DATABASE_URL;
    if (!databaseUrl) {
      const error = new Error('Missing APP_DATABASE_URL or DATABASE_URL environment variable');
      error.code = 'APP_DB_URL_MISSING';
      reject(error);
      return;
    }

    // Build -v key=value args so psql exposes them as :varname / :'varname'
    // (Setting as env vars is NOT sufficient — psql only reads psql vars via -v)
    const varArgs = [];
    params.forEach((value, index) => {
      varArgs.push('-v', `APP_DB_PARAM_${index + 1}=${value == null ? '' : String(value)}`);
    });

    const args = [
      databaseUrl,
      '-X',
      '-v', 'ON_ERROR_STOP=1',
      '-At',
      ...varArgs,
      '-c', sql,
    ];

    execFile('psql', args, { encoding: 'utf8', timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const message = stderr || error.message || '';
        // Bad credentials / unreachable host → treat same as URL missing so
        // callers fall back silently to Supabase instead of logging noise.
        if (isSilentPsqlError(message)) {
          const silentErr = new Error('Local DB unavailable (credentials/host): ' + message.split('\n')[0]);
          silentErr.code = 'APP_DB_URL_MISSING';
          reject(silentErr);
          return;
        }
        reject(new Error(message));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

async function queryRows(sql, params = []) {
  const wrapped = `WITH q AS (${sql}) SELECT COALESCE(json_agg(q), '[]'::json) FROM q;`;
  const preparedSql = wrapped.replace(/\$(\d+)/g, (_, idx) => `:'APP_DB_PARAM_${idx}'`);
  const output = await runSql(preparedSql, params);
  if (!output) return [];
  return JSON.parse(output);
}

async function queryOne(sql, params = []) {
  const rows = await queryRows(`${sql} LIMIT 1`, params);
  return rows[0] || null;
}

module.exports = {
  queryRows,
  queryOne,
};
