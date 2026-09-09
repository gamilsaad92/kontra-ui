process.env.ENCRYPTION_KEY = 'test-encryption-key';
process.env.PII_ENCRYPTION_KEY = 'test-pii-key';

const fs = require('fs');
const crypto = require('crypto');
const { logAuditEntry, AUDIT_PATH } = require('./auditLogger');

function decrypt(line) {
  const [ivHex, tagHex, cipherHex] = line.split(':');
  const key = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherHex, 'hex')),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8'));
}

describe('audit logger', () => {
  afterEach(() => {
    if (fs.existsSync(AUDIT_PATH)) fs.unlinkSync(AUDIT_PATH);
  });

  it('writes encrypted operational metadata without customer payloads', async () => {
     logAuditEntry({
       method: 'POST',
       url: '/test',
       result: 'accepted',
       body: { a: 1, prompt: 'customer document text', ssn: '123-45-6789' },
       query: { text: 'sensitive query' },
     });
    await new Promise((resolve) => setTimeout(resolve, 10));
     const content = fs.readFileSync(AUDIT_PATH, 'utf8').trim();
     const lines = content.split('\n');
     const line = lines.find(candidate => {
       try {
         return decrypt(candidate).result === 'accepted';
       } catch {
         return false;
       }
     });
    expect(line).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
    const decoded = decrypt(line);
    expect(decoded.method).toBe('POST');
    expect(decoded.url).toBe('/test');
    expect(decoded.result).toBe('accepted');
    expect(decoded.body).toBeUndefined();
    expect(decoded.query).toBeUndefined();
    expect(decoded.timestamp).toBeDefined();
  });
});
