const fs = require('fs');
const path = require('path');
const { logAuditEntry } = require('./auditLogger');

const AUDIT_PATH = path.join(__dirname, 'auditLogs.enc');

describe('audit logger', () => {
  afterEach(() => {
    if (fs.existsSync(AUDIT_PATH)) fs.unlinkSync(AUDIT_PATH);
  });

  it('writes encrypted log lines', () => {
    logAuditEntry({ method: 'POST', url: '/test', data: { a: 1 } });
    const content = fs.readFileSync(AUDIT_PATH, 'utf8').trim();
    expect(content).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
  });
});
