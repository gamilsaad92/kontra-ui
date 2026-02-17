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

  let query = supabase
    .from(table)
    .select('*', { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  query = applyListFilters(query, options);

  const { data, error, count } = await query;
  if (error) throw error;
  return { items: data || [], total: count || 0 };
}

async function createEntity(table, orgId, payload) {
  const insertPayload = {
    org_id: orgId,
    status: payload.status,
    title: payload.title ?? null,
    data: payload.data ?? {},
  };

  const { data, error } = await supabase
    .from(table)
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function getEntity(table, orgId, id) {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('org_id', orgId)
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

  const { data, error } = await supabase
    .from(table)
    .update(updatePayload)
    .eq('org_id', orgId)
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
