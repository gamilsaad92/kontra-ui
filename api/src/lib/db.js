const { execFile } = require('node:child_process');

function runPsqlQuery(sql, variables = {}) {
  return new Promise((resolve, reject) => {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      reject(new Error('Missing DATABASE_URL environment variable'));
      return;
    }

    const wrappedSql = `SELECT COALESCE(json_agg(t), '[]'::json) FROM (${sql}) AS t;`;
    const args = [databaseUrl, '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-c', wrappedSql];

    for (const [key, value] of Object.entries(variables)) {
      args.push('-v', `${key}=${value ?? ''}`);
    }

    execFile('psql', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }

      const output = stdout.trim();
      if (!output) {
        resolve([]);
        return;
      }

      try {
        resolve(JSON.parse(output));
      } catch (parseError) {
        reject(new Error(`Failed to parse SQL response: ${parseError.message}`));
      }
    });
  });
}

module.exports = { runPsqlQuery };
