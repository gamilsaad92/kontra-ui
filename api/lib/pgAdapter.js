/**
 * pgAdapter.js — Lightweight PostgreSQL adapter that mirrors the Supabase JS
 * client query-builder API used throughout the Kontra API.
 *
 * Supports:
 *   .from(table).select(cols).eq(col, val).neq(col, val).in(col, vals)
 *   .gte(col, val).lte(col, val).or(expr).limit(n).order(col, {asc})
 *   .insert(rows).update(data).delete().upsert(rows, {onConflict})
 *   .single()  → returns { data: obj, error }
 *   (default)  → returns { data: [], error }
 *
 * Only the subset actually used by this codebase is implemented.
 * RLS / realtime / auth are not supported — this is a pure query layer.
 */

const { Pool } = require('pg');

let _pool = null;

function getPool() {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode') ? undefined : { rejectUnauthorized: false },
    });
    _pool.on('error', (err) => {
      console.error('[pgAdapter] Pool error:', err.message);
    });
  }
  return _pool;
}

class QueryBuilder {
  constructor(table) {
    this._table = table;
    this._type = 'select';
    this._selectCols = '*';
    this._conditions = [];
    this._conditionValues = [];
    this._limitN = null;
    this._orderCol = null;
    this._orderAsc = true;
    this._insertData = null;
    this._updateData = null;
    this._upsertData = null;
    this._onConflict = null;
    this._single = false;
    this._returning = 'id';
  }

  select(cols) {
    this._type = 'select';
    this._selectCols = cols || '*';
    return this;
  }

  insert(rows) {
    this._type = 'insert';
    this._insertData = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  update(data) {
    this._type = 'update';
    this._updateData = data;
    return this;
  }

  upsert(rows, opts) {
    this._type = 'upsert';
    this._upsertData = Array.isArray(rows) ? rows : [rows];
    this._onConflict = opts?.onConflict || null;
    return this;
  }

  delete() {
    this._type = 'delete';
    return this;
  }

  eq(col, val) {
    this._conditions.push(`"${col}" = $${this._conditions.length + 1}`);
    this._conditionValues.push(val);
    return this;
  }

  neq(col, val) {
    this._conditions.push(`"${col}" != $${this._conditions.length + 1}`);
    this._conditionValues.push(val);
    return this;
  }

  in(col, vals) {
    if (!vals || vals.length === 0) return this;
    const placeholders = vals.map((_, i) => `$${this._conditions.length + i + 1}`).join(', ');
    this._conditions.push(`"${col}" IN (${placeholders})`);
    this._conditionValues.push(...vals);
    return this;
  }

  gte(col, val) {
    this._conditions.push(`"${col}" >= $${this._conditions.length + 1}`);
    this._conditionValues.push(val);
    return this;
  }

  lte(col, val) {
    this._conditions.push(`"${col}" <= $${this._conditions.length + 1}`);
    this._conditionValues.push(val);
    return this;
  }

  gt(col, val) {
    this._conditions.push(`"${col}" > $${this._conditions.length + 1}`);
    this._conditionValues.push(val);
    return this;
  }

  lt(col, val) {
    this._conditions.push(`"${col}" < $${this._conditions.length + 1}`);
    this._conditionValues.push(val);
    return this;
  }

  like(col, val) {
    this._conditions.push(`"${col}" ILIKE $${this._conditions.length + 1}`);
    this._conditionValues.push(val);
    return this;
  }

  is(col, val) {
    if (val === null) {
      this._conditions.push(`"${col}" IS NULL`);
    } else {
      this._conditions.push(`"${col}" = $${this._conditions.length + 1}`);
      this._conditionValues.push(val);
    }
    return this;
  }

  // Supabase .or('col1.eq.val1,col2.eq.val2') — best-effort parse
  or(expr) {
    try {
      const parts = expr.split(',').map(p => p.trim());
      const clauses = parts.map(p => {
        const m = p.match(/^(\w+)\.(eq|is|gt|gte|lt|lte|neq)\.(.+)$/);
        if (!m) return `TRUE`;
        const [, col, op, rawVal] = m;
        const val = rawVal === 'null' ? null : rawVal;
        const idx = this._conditionValues.length + 1;
        if (val === null) return `"${col}" IS NULL`;
        const opMap = { eq: '=', neq: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=' };
        this._conditionValues.push(val);
        return `"${col}" ${opMap[op] || '='} $${idx}`;
      });
      this._conditions.push(`(${clauses.join(' OR ')})`);
    } catch { /* ignore parse errors */ }
    return this;
  }

  limit(n) {
    this._limitN = n;
    return this;
  }

  order(col, opts) {
    this._orderCol = col;
    this._orderAsc = opts?.ascending ?? opts?.asc ?? true;
    return this;
  }

  single() {
    this._single = true;
    return this;
  }

  select_returning(cols) {
    this._returning = cols;
    return this;
  }

  // ── Execute ────────────────────────────────────────────────────────────────
  async _run() {
    const pool = getPool();
    const table = `"${this._table}"`;
    const where = this._conditions.length
      ? `WHERE ${this._conditions.join(' AND ')}`
      : '';
    const vals = this._conditionValues;

    try {
      if (this._type === 'select') {
        const cols = this._selectCols === '*' ? '*'
          : this._selectCols.split(',').map(c => `"${c.trim()}"`).join(', ');
        const order = this._orderCol ? `ORDER BY "${this._orderCol}" ${this._orderAsc ? 'ASC' : 'DESC'}` : '';
        const limit = this._limitN != null ? `LIMIT ${Number(this._limitN)}` : '';
        const sql = `SELECT ${cols} FROM ${table} ${where} ${order} ${limit}`.trim();
        const { rows } = await pool.query(sql, vals);
        if (this._single) {
          return { data: rows[0] ?? null, error: null };
        }
        return { data: rows, error: null };
      }

      if (this._type === 'insert') {
        const rows = this._insertData;
        const allCols = [...new Set(rows.flatMap(r => Object.keys(r)))];
        const colsSql = allCols.map(c => `"${c}"`).join(', ');
        const insertedRows = [];
        for (const row of rows) {
          const rowVals = allCols.map(c => row[c] !== undefined ? row[c] : null);
          const placeholders = rowVals.map((_, i) => `$${i + 1}`).join(', ');
          const sql = `INSERT INTO ${table} (${colsSql}) VALUES (${placeholders}) RETURNING *`;
          const { rows: r } = await pool.query(sql, rowVals);
          insertedRows.push(...r);
        }
        if (this._single) return { data: insertedRows[0] ?? null, error: null };
        return { data: insertedRows, error: null };
      }

      if (this._type === 'update') {
        const data = this._updateData;
        const keys = Object.keys(data);
        const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
        const paramVals = keys.map(k => data[k]);
        const whereVals = vals.map((v, i) => v);
        const whereClause = this._conditions.length
          ? `WHERE ${this._conditions.map((c, i) => c.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + keys.length}`)).join(' AND ')}`
          : '';
        const sql = `UPDATE ${table} SET ${setClause} ${whereClause} RETURNING *`;
        const { rows } = await pool.query(sql, [...paramVals, ...whereVals]);
        if (this._single) return { data: rows[0] ?? null, error: null };
        return { data: rows, error: null };
      }

      if (this._type === 'upsert') {
        const rows = this._upsertData;
        const allCols = [...new Set(rows.flatMap(r => Object.keys(r)))];
        const colsSql = allCols.map(c => `"${c}"`).join(', ');
        const conflict = this._onConflict ? `("${this._onConflict}")` : '(id)';
        const updateSet = allCols.filter(c => c !== 'id').map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');
        const insertedRows = [];
        for (const row of rows) {
          const rowVals = allCols.map(c => row[c] !== undefined ? row[c] : null);
          const placeholders = rowVals.map((_, i) => `$${i + 1}`).join(', ');
          const sql = `INSERT INTO ${table} (${colsSql}) VALUES (${placeholders}) ON CONFLICT ${conflict} DO UPDATE SET ${updateSet} RETURNING *`;
          const { rows: r } = await pool.query(sql, rowVals);
          insertedRows.push(...r);
        }
        if (this._single) return { data: insertedRows[0] ?? null, error: null };
        return { data: insertedRows, error: null };
      }

      if (this._type === 'delete') {
        const sql = `DELETE FROM ${table} ${where} RETURNING *`;
        const { rows } = await pool.query(sql, vals);
        return { data: rows, error: null };
      }

      return { data: null, error: { message: `Unknown query type: ${this._type}` } };
    } catch (err) {
      console.error(`[pgAdapter] Error on ${this._type} "${this._table}":`, err.message);
      return { data: null, error: { message: err.message, code: err.code } };
    }
  }

  then(resolve, reject) {
    return this._run().then(resolve, reject);
  }
}

// ── Storage stub (returns empty for any bucket op) ────────────────────────────
const storageSub = {
  from: () => ({
    getPublicUrl: (path) => ({ publicURL: `/storage/${path}` }),
    upload: async () => ({ data: {}, error: null }),
    download: async () => ({ data: null, error: null }),
    list: async () => ({ data: [], error: null }),
    remove: async () => ({ data: {}, error: null }),
  }),
};

// ── Auth stub ────────────────────────────────────────────────────────────────
const authStub = {
  getUser: async () => ({ data: { user: null }, error: null }),
  admin: {
    createUser: async () => ({ data: {}, error: null }),
    updateUserById: async () => ({ data: {}, error: null }),
  },
};

// ── Main client factory ───────────────────────────────────────────────────────
function createPgClient() {
  return {
    from: (table) => new QueryBuilder(table),
    storage: storageSub,
    auth: authStub,
    rpc: async (fn, args) => {
      console.warn(`[pgAdapter] rpc('${fn}') not implemented — returning empty`);
      return { data: null, error: null };
    },
  };
}

module.exports = { createPgClient, getPool };
