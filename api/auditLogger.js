const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const AUDIT_PATH = path.join(__dirname, 'auditLogs.enc');
const secret = process.env.ENCRYPTION_KEY || 'default_audit_key';
const KEY = crypto.createHash('sha256').update(secret).digest();

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function logAuditEntry(entry) {
  const record = encrypt(JSON.stringify({ ...entry, timestamp: new Date().toISOString() }));
  fs.appendFileSync(AUDIT_PATH, record + '\n');
}

module.exports = { logAuditEntry };
