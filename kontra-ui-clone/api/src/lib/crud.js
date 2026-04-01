const { supabase } = require('../../db');
const { selectFor } = require('./selectColumns');
const { asApiError } = require('./dbErrors');

/**
 * Convert an integer org ID (e.g. "11", "20") to the UUID format
 * that Supabase tables with `org_id uuid` expect.
 * Pattern: 00000000-0000-0000-0000-{12-digit-padded-integer}
 * e.g. 11 → "00000000-0000-0000-0000-000000000011"
 *
 * If the value is already a UUID or the table is 'organizations' (which
 * uses integer PKs directly), return as-is.
 */
const UUID_TABLES = new Set([
  'pools', 'tokens', 'trades', 'exchange_listings', 'pool_loans',
  'pool_allocations', 'pool_whitelist', 'loans', 'assets', 'inspections',
  'payments', 'escrows', 'draws', 'borrower_financials', 'management_items',
  'compliance_items', 'legal_items', 'regulatory_scans', 'risk_items',
  'document_reviews', 'reports', 'org_memberships', 'ai_reviews', 'ai_review_actions',
]);

function toOrgUuid(table, orgId) {
  if (!orgId) return orgId;
  if (table === 'organizations') return orgId; // integer PK, no conversion
  if (!UUID_TABLES.has(table)) return orgId;   // unknown table, pass through
  const id = String(orgId);
  // Already a UUID (contains hyphens)
  if (/[0-9a-f]{8}-/i.test(id)) return id;
  // Pure integer → pad to UUID format
  if (/^\d+$/.test(id)) {
    return `00000000-0000-0000-0000-${id.padStart(12, '0')}`;
  }
  return orgId;
}

function applyListFilters(query, { status, q } = {}, table) {
  let scoped = query;
  if (status) scoped = scoped.eq('status', status);
  if (q) {
    const searchColumn = table === 'organizations' ? 'name' : 'title';
    scoped = scoped.ilike(searchColumn, `%${q}%`);
  }
  return scoped;
}

async function listEntity(table, orgId, options = {}) {
  const limit = Math.min(Number(options.limit) || 25, 100);
  const offset = Math.max(Number(options.offset) || 0, 0);
  const scopeColumn = table === 'organizations' ? 'id' : 'org_id';
  const resolvedOrgId = toOrgUuid(table, orgId);

  let query = supabase
    .from(table)
    .select(selectFor(table), { count: 'exact' })
    .eq(scopeColumn, resolvedOrgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  query = applyListFilters(query, options, table);

  const { data, error, count } = await query;
  if (error) throw asApiError(error, 'Failed to list records');
  return { items: data || [], total: count || 0 };
}

// Table-specific defaults for columns that are NOT NULL and have no DB default.
// These ensure a "quick create" from the UI never fails a constraint violation.
const TODAY = () => new Date().toISOString().split('T')[0]; // YYYY-MM-DD

const TABLE_DEFAULTS = {
  loans: () => ({
    borrower_name: 'New Borrower',
    amount: 0,
    interest_rate: 0,
    term_months: 0,
    start_date: TODAY(),
    updated_at: new Date().toISOString(),
  }),
  payments: () => ({
    payment_date: TODAY(),
    amount: 0,
    applied_principal: 0,
    applied_interest: 0,
    remaining_balance: 0,
    currency: 'USD',
    updated_at: new Date().toISOString(),
  }),
  inspections: () => ({
    inspector: 'TBD',
    updated_at: new Date().toISOString(),
  }),
  // exchange_listings uses PostgreSQL enums: exchange_status, exchange_asset_type, exchange_visibility
  // Valid exchange_asset_type values: term_loan, revolver, mortgage, sba, consumer, lease,
  //   portfolio, securitization_note, repo, other
  // Valid exchange_status values: draft, listed, closed, ... (use 'draft' for new records)
  // Valid visibility values: private, public, restricted, invite_only, semi_public
  exchange_listings: (resolvedOrgId) => ({
    organization_id: resolvedOrgId,
    created_by: resolvedOrgId,
    asset_type: 'mortgage',
    currency: 'USD',
    par_amount: 0,
    visibility: 'private',
    marketplace_metrics: {},
    status: 'draft',
  }),
};

async function createEntity(table, orgId, payload) {
  const resolvedOrgId = toOrgUuid(table, orgId);
  const insertPayload = {
    status: payload.status ?? 'active',
    data: payload.data ?? {},
  };

  if (table === 'organizations') {
    insertPayload.name = payload.name ?? payload.title ?? null;
  } else {
    insertPayload.title = payload.title ?? null;
    insertPayload.org_id = resolvedOrgId;
  }

  // Apply table-specific required-field defaults (can be overridden by payload)
  if (TABLE_DEFAULTS[table]) {
    const defaults = TABLE_DEFAULTS[table](resolvedOrgId);
    Object.assign(insertPayload, defaults);
    // Let explicit payload values override defaults where provided
    for (const key of Object.keys(defaults)) {
      if (payload[key] !== undefined) insertPayload[key] = payload[key];
    }
    // exchange_listings uses enum status, override the generic 'active' default
    if (table === 'exchange_listings') {
      insertPayload.status = payload.status === 'active' ? 'draft' : (payload.status ?? 'draft');
    }
  }

  const { data, error } = await supabase
    .from(table)
    .insert(insertPayload)
    .select(selectFor(table))
    .single();

  if (error) throw asApiError(error, 'Failed to create record');
  return data;
}

async function getEntity(table, orgId, id) {
  const scopeColumn = table === 'organizations' ? 'id' : 'org_id';
  const resolvedOrgId = toOrgUuid(table, orgId);

  const { data, error } = await supabase
    .from(table)
    .select(selectFor(table))
    .eq(scopeColumn, resolvedOrgId)
    .eq('id', id)
    .maybeSingle();

 if (error) throw asApiError(error, 'Failed to fetch record');
  return data;
}

async function updateEntity(table, orgId, id, patch) {
  const resolvedOrgId = toOrgUuid(table, orgId);
  const updatePayload = {
    ...patch,
    updated_at: new Date().toISOString(),
  };

  if (table === 'payments' && !updatePayload.currency) {
    updatePayload.currency = 'USD';
  }

  const scopeColumn = table === 'organizations' ? 'id' : 'org_id';

  const { data, error } = await supabase
    .from(table)
    .update(updatePayload)
    .eq(scopeColumn, resolvedOrgId)
    .eq('id', id)
    .select(selectFor(table))
    .maybeSingle();

  if (error) throw asApiError(error, 'Failed to update record');
  return data;
}

module.exports = {
  listEntity,
  createEntity,
  getEntity,
  updateEntity,
  toOrgUuid,
};
