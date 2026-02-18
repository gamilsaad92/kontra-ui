const { supabase } = require('../../db');

function applyListFilters(query, { status, q } = {}) {
  let scoped = query;
  if (status) scoped = scoped.eq('status', status);
  if (q) scoped = scoped.ilike('title', `%${q}%`);
  return scoped;
}

async function listEntity(table, orgId, options = {}) {
  const limit = Math.min(Number(options.limit) || 25, 100);
  const offset = Math.max(Number(options.offset) || 0, 0);

    const scopeColumn = table === 'organizations' ? 'id' : 'org_id';

  let query = supabase
    .from(table)
    .select('*', { count: 'exact' })
   .eq(scopeColumn, orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  query = applyListFilters(query, options);

  const { data, error, count } = await query;
  if (error) throw error;
  return { items: data || [], total: count || 0 };
}

async function createEntity(table, orgId, payload) {
  const insertPayload = {
    status: payload.status,
    title: payload.title ?? null,
    data: payload.data ?? {},
  };

    if (table !== 'organizations') {
    insertPayload.org_id = orgId;
  }

  const { data, error } = await supabase
    .from(table)
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function getEntity(table, orgId, id) {
    const scopeColumn = table === 'organizations' ? 'id' : 'org_id';

  const { data, error } = await supabase
    .from(table)
    .select('*')
  .eq(scopeColumn, orgId)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function updateEntity(table, orgId, id, patch) {
  const updatePayload = {
    ...patch,
    updated_at: new Date().toISOString(),
  };

    const scopeColumn = table === 'organizations' ? 'id' : 'org_id';

  const { data, error } = await supabase
    .from(table)
    .update(updatePayload)
      .eq(scopeColumn, orgId)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data;
}

module.exports = {
  listEntity,
  createEntity,
  getEntity,
  updateEntity,
};
