const { execFile } = require('node:child_process');

const DEFAULT_TIMEOUT_MS = Number(process.env.APP_DB_TIMEOUT_MS || 10000);

function runSql(sql, params = [], timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const databaseUrl = process.env.APP_DATABASE_URL || process.env.DATABASE_URL;
    if (!databaseUrl) {
      reject(new Error('Missing APP_DATABASE_URL or DATABASE_URL environment variable'));
      return;
    }

    const args = [databaseUrl, '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql];
    const env = { ...process.env };
    params.forEach((value, index) => {
      env[`APP_DB_PARAM_${index + 1}`] = value == null ? '' : String(value);
    });

    execFile('psql', args, { encoding: 'utf8', timeout: timeoutMs, env, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
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
