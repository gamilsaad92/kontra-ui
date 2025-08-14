// api/auditLogger.js
const { supabase } = require('./db');

// fire-and-forget, never throws
function logAuditEntry(entry = {}) {
  // Detach so we don't block the response lifecycle
  void (async () => {
    try {
      // Ensure payload is JSON-serializable (avoid circular refs)
      const safePayload = JSON.parse(JSON.stringify(entry));

      const record = {
        trade_id: entry.trade_id ?? null,
        status: entry.status ?? entry.result ?? entry.method ?? 'info',
        event_payload: safePayload, // json/jsonb column
        created_at: new Date().toISOString(), // optional, if your table doesn't default this
      };

      const { error } = await supabase
        .from('exchange_trade_events')
        .insert([record]);

      if (error) {
        console.error('Audit log insert error:', error.message, { recordMeta: { trade_id: record.trade_id, status: record.status } });
      }
    } catch (err) {
      console.error('Audit log failed:', err && err.message ? err.message : err);
    }
  })();
}

module.exports = { logAuditEntry };
