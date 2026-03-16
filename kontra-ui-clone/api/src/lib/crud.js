const { supabase } = require('../../db');
const { selectFor } = require('./selectColumns');
const { asApiError } = require('./dbErrors');

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

  let query = supabase
    .from(table)
     .select(selectFor(table), { count: 'exact' })
    .eq(scopeColumn, orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  query = applyListFilters(query, options, table);

  const { data, error, count } = await query;
  if (error) throw asApiError(error, 'Failed to list records');
  return { items: data || [], total: count || 0 };
}

async function createEntity(table, orgId, payload) {
  const insertPayload = {
    status: payload.status,
    data: payload.data ?? {},
  };

  if (table === 'organizations') {
    insertPayload.name = payload.name ?? payload.title ?? null;
  } else {
    insertPayload.title = payload.title ?? null;
    insertPayload.org_id = orgId;
  }

   if (table === 'payments') {
    insertPayload.currency = payload.currency || 'USD';
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

  const { data, error } = await supabase
    .from(table)
    .select(selectFor(table))
    .eq(scopeColumn, orgId)
    .eq('id', id)
    .maybeSingle();

 if (error) throw asApiError(error, 'Failed to fetch record');
  return data;
}

async function updateEntity(table, orgId, id, patch) {
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
      .eq(scopeColumn, orgId)
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
};
