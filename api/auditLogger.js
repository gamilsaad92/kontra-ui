const { supabase } = require('./db');

function logAuditEntry(entry) {
  supabase
    .from('exchange_trade_events')
    .insert([
      {
        trade_id: entry.trade_id || null,
        status: entry.status || entry.result || entry.method || 'info',
        event_payload: entry
      }
    ])
    .catch(err => {
      console.error('Audit log failed:', err.message);
    });
}

module.exports = { logAuditEntry };
