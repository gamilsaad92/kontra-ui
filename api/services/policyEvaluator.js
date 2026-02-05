function getField(ctx, path) {
  const parts = String(path || '').split('.');
  let cur = ctx;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function evalLeaf(ctx, leaf) {
  const fieldVal = getField(ctx, leaf.field);
  const op = leaf.op;
  const v = leaf.value;

  switch (op) {
    case 'exists':
      return fieldVal !== undefined && fieldVal !== null;
    case '=':
      return fieldVal === v;
    case '!=':
      return fieldVal !== v;
    case '>':
      return Number(fieldVal) > Number(v);
    case '>=':
      return Number(fieldVal) >= Number(v);
    case '<':
      return Number(fieldVal) < Number(v);
    case '<=':
      return Number(fieldVal) <= Number(v);
    case 'in':
      return Array.isArray(v) ? v.includes(fieldVal) : false;
    case 'contains':
      if (typeof fieldVal === 'string') return String(fieldVal).includes(String(v));
      if (Array.isArray(fieldVal)) return fieldVal.includes(v);
      return false;
    default:
      return false;
  }
}

function evaluateConditions(ctx, cond) {
  if (!cond || typeof cond !== 'object') return false;
  if (Array.isArray(cond.all)) return cond.all.every((c) => evaluateConditions(ctx, c));
  if (Array.isArray(cond.any)) return cond.any.some((c) => evaluateConditions(ctx, c));
  return evalLeaf(ctx, cond);
}

function computeDueDate(action) {
  if (!action || action.type !== 'set_due_date') return null;
  if (action.mode === 'fixed') return action.value;
  if (action.mode === 'days_from_now') {
    const d = new Date();
    d.setDate(d.getDate() + Number(action.value || 0));
    return d.toISOString().slice(0, 10);
  }
  return null;
}

module.exports = {
  evaluateConditions,
  computeDueDate,
};
