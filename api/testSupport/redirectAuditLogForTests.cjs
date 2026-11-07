const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

if (process.env.NODE_ENV === 'production' || process.env.KONTRA_TEST_ISOLATION !== 'true') {
  throw new Error('Audit-log test redirection is restricted to isolated test processes.');
}

const isolatedDirectory = path.join(os.tmpdir(), 'kontra-api-test-audit');

function redirectAuditPath(target) {
  if (typeof target !== 'string' && !Buffer.isBuffer(target)) return target;
  const candidate = Buffer.isBuffer(target) ? target.toString() : target;
  const absolute = path.resolve(candidate);
  if (path.basename(absolute) !== 'auditLogs.enc') return target;

  const suffix = crypto.createHash('sha256').update(absolute).digest('hex');
  return path.join(isolatedDirectory, `${suffix}.enc`);
}

fs.mkdirSync(isolatedDirectory, { recursive: true });

for (const method of ['appendFile', 'existsSync', 'readFileSync', 'unlinkSync']) {
  const original = fs[method].bind(fs);
  fs[method] = (target, ...args) => original(redirectAuditPath(target), ...args);
}
