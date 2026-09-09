const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const AUDIT_PATH = path.join(__dirname, 'auditLogs.enc');
const DEFAULT_TTL_MS = 1000 * 60 * 15; // 15 minutes for OTP reuse and audit correlation
const SAFE_FIELDS = new Set([
  'type', 'event', 'method', 'url', 'status', 'durationMs',
  'requestId', 'userId', 'organizationId', 'propertyId', 'roomId',
  'actorId', 'actorRole', 'model', 'provider', 'task', 'success',
  'inputBytes', 'outputBytes', 'contentType', 'fileCount',
  'bodyKeyCount', 'queryKeyCount',
  'result', 'timestamp',
]);

function resolveKey(secret, label) {
  if (secret && secret.trim().length) {
    return crypto.createHash('sha256').update(secret).digest();
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${label} is required for encrypted audit logging in production`);
  }
  // Development/test logs must still use a non-predictable key.
  return crypto.randomBytes(32);
}

const envelopeKey = resolveKey(process.env.ENCRYPTION_KEY, 'ENCRYPTION_KEY');
// Keep this key validation for other sensitive-storage callers that load this
// module, even though audit entries now omit sensitive payloads entirely.
resolveKey(process.env.PII_ENCRYPTION_KEY, 'PII_ENCRYPTION_KEY');

function sanitizePayload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return Object.entries(input).reduce((acc, [key, value]) => {
    if (!SAFE_FIELDS.has(key)) return acc;
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      acc[key] = typeof value === 'string' ? value.slice(0, 200) : value;
    }
    return acc;
  }, {});
}

function encryptEnvelope(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', envelopeKey, iv);
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function persistAuditLine(line) {
  fs.mkdirSync(path.dirname(AUDIT_PATH), { recursive: true });
  fs.appendFile(AUDIT_PATH, `${line}\n`, (err) => {
    if (err) console.error('Audit log write error');
  });
}

function logAuditEntry(entry = {}) {
  const timestamp = new Date().toISOString();
  const base = {
    ...sanitizePayload(entry),
    timestamp,
  };

  setImmediate(() => {
    try {
      const serialized = JSON.stringify(base);
      const envelope = encryptEnvelope(serialized);
      persistAuditLine(envelope);   
    } catch (err) {
      console.error('Audit log failed');
    }
  });
}

module.exports = {
  logAuditEntry,
  AUDIT_PATH,
  DEFAULT_TTL_MS,
};
