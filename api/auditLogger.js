const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const AUDIT_PATH = path.join(__dirname, 'auditLogs.enc');
const DEFAULT_TTL_MS = 1000 * 60 * 15; // 15 minutes for OTP reuse and audit correlation
const PII_FIELDS = ['ssn', 'tax_id', 'taxId', 'account_number', 'accountNumber', 'routing_number', 'routingNumber'];

function resolveKey(secret, fallbackLabel) {
  const value = secret && secret.trim().length ? secret : `${fallbackLabel}-fallback-secret`;
  return crypto.createHash('sha256').update(value).digest();
}

const envelopeKey = resolveKey(process.env.ENCRYPTION_KEY, 'audit');
const piiKey = resolveKey(process.env.PII_ENCRYPTION_KEY, 'pii');

function redactValue(value) {
  const payload = typeof value === 'string' ? value : JSON.stringify(value);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', piiKey, iv);
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `pii:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function sanitizePayload(input) {
  if (!input || typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.map((item) => sanitizePayload(item));

  return Object.entries(input).reduce((acc, [key, value]) => {
    if (value && typeof value === 'object') {
      acc[key] = sanitizePayload(value);
    } else if (typeof value === 'string' && value.length > 2048) {
      acc[key] = `${value.slice(0, 2048)}…`;
    } else if (typeof value === 'string' && /password|token|secret/i.test(key)) {
      acc[key] = '***redacted***';
    } else if (PII_FIELDS.includes(key)) {
      acc[key] = redactValue(value);
    } else {
      acc[key] = value;
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
    if (err) console.error('Audit log write error:', err.message);
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
      console.error('Audit log failed:', err && err.message ? err.message : err);
    }
  });
}

module.exports = {
  logAuditEntry,
  AUDIT_PATH,
  DEFAULT_TTL_MS,
};
