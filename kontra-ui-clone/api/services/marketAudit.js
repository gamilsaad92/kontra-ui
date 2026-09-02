const { supabase } = require('../db');

async function recordMarketAuditEvent({
  tenantId,
  actorId,
  action,
  objectType,
  objectId,
  beforeStatus,
  afterStatus,
  metadata,
}) {
  if (!tenantId || !action || !objectType) {
    return;
  }

  const payload = {
    tenant_id: tenantId,
    actor_id: actorId || null,
    action,
    object_type: objectType,
    object_id: objectId || null,
    before_status: beforeStatus || null,
    after_status: afterStatus || null,
    metadata: metadata || {},
  };

  try {
    await supabase.from('audit_events').insert(payload);
  } catch (err) {
    console.error('Audit event insert failed:', err.message || err);
  }
}

module.exports = {
  recordMarketAuditEvent,
};
