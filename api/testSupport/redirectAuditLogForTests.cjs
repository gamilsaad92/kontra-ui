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

fs.mkdirSync(isolatedDirectory, { recursive: true, mode: 0o700 });
fs.chmodSync(isolatedDirectory, 0o700);

for (const method of ['appendFile', 'existsSync', 'readFileSync', 'writeFileSync', 'unlinkSync']) {
  const original = fs[method].bind(fs);
  fs[method] = (target, ...args) => {
    const redirected = redirectAuditPath(target);
    if (redirected === target) return original(target, ...args);

    if (method === 'appendFile') {
      let options = args[1];
      let callback = args[2];
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }
      if (typeof options === 'string') options = { encoding: options };
      options = { ...(options || {}), mode: 0o600 };
      if (fs.existsSync(redirected)) fs.chmodSync(redirected, 0o600);
      const ensurePrivateMode = error => {
        if (!error) fs.chmodSync(redirected, 0o600);
        if (typeof callback === 'function') callback(error);
      };
      return original(redirected, args[0], options, ensurePrivateMode);
    }

    if (method === 'writeFileSync') {
      let options = args[1];
      if (typeof options === 'string') options = { encoding: options };
      const result = original(redirected, args[0], { ...(options || {}), mode: 0o600 });
      fs.chmodSync(redirected, 0o600);
      return result;
    }

    return original(redirected, ...args);
  };
}
