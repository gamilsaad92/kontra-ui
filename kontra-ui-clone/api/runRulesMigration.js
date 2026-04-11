/**
 * One-time rules engine schema migration.
 * Called on API startup in dev mode, or via POST /api/admin/run-rules-migration.
 * Safe to run multiple times — all statements are idempotent.
 */

const { createClient } = require('@supabase/supabase-js');

const adminDb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Execute raw SQL via Supabase's rpc (requires pg_query or direct connection)
// We use a series of individual operations via the JS SDK instead.

async function runRulesMigration() {
  console.log('[rules-migration] Starting schema setup…');
  const results = [];

  // ── 1. Create policy_rules ─────────────────────────────────────
  const createRulesTable = `
    CREATE TABLE IF NOT EXISTS public.policy_rules (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id  BIGINT,
      name             TEXT NOT NULL,
      description      TEXT,
      category         TEXT NOT NULL DEFAULT 'compliance',
      rule_key         TEXT UNIQUE NOT NULL,
      jurisdictions    TEXT[]   DEFAULT '{}',
      loan_types       TEXT[]   DEFAULT '{}',
      token_types      TEXT[]   DEFAULT '{}',
      workflow_stages  TEXT[]   DEFAULT '{}',
      conditions       JSONB    NOT NULL DEFAULT '[]',
      condition_logic  TEXT     NOT NULL DEFAULT 'AND',
      actions          JSONB    NOT NULL DEFAULT '[]',
      severity         TEXT     NOT NULL DEFAULT 'medium',
      source_reference TEXT,
      version          INTEGER  NOT NULL DEFAULT 1,
      status           TEXT     NOT NULL DEFAULT 'draft',
      effective_date   TIMESTAMPTZ DEFAULT NOW(),
      end_date         TIMESTAMPTZ,
      created_by       UUID,
      updated_by       UUID,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      updated_at       TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  // ── 2. Create policy_rule_versions ─────────────────────────────
  const createVersionsTable = `
    CREATE TABLE IF NOT EXISTS public.policy_rule_versions (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_id     UUID NOT NULL,
      version     INTEGER NOT NULL,
      snapshot    JSONB NOT NULL,
      changed_by  UUID,
      change_note TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(rule_id, version)
    );
  `;

  // ── 3. Create policy_approvals ─────────────────────────────────
  const createApprovalsTable = `
    CREATE TABLE IF NOT EXISTS public.policy_approvals (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_id       UUID NOT NULL,
      rule_version  INTEGER NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending',
      submitted_by  UUID,
      submitted_at  TIMESTAMPTZ DEFAULT NOW(),
      reviewed_by   UUID,
      reviewed_at   TIMESTAMPTZ,
      review_note   TEXT,
      is_emergency  BOOLEAN DEFAULT FALSE
    );
  `;

  // ── 4. Create policy_audit_log ─────────────────────────────────
  const createAuditTable = `
    CREATE TABLE IF NOT EXISTS public.policy_audit_log (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type   TEXT NOT NULL,
      rule_id      UUID,
      rule_version INTEGER,
      actor_id     UUID,
      context      JSONB,
      result       JSONB,
      portal       TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  // ── 5. Add missing columns to existing policy_rules (if any) ───
  const alterStatements = [
    `ALTER TABLE public.policy_rules ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'compliance';`,
    `ALTER TABLE public.policy_rules ADD COLUMN IF NOT EXISTS organization_id BIGINT;`,
    `ALTER TABLE public.policy_rules ADD COLUMN IF NOT EXISTS jurisdictions TEXT[] DEFAULT '{}';`,
    `ALTER TABLE public.policy_rules ADD COLUMN IF NOT EXISTS loan_types TEXT[] DEFAULT '{}';`,
    `ALTER TABLE public.policy_rules ADD COLUMN IF NOT EXISTS token_types TEXT[] DEFAULT '{}';`,
    `ALTER TABLE public.policy_rules ADD COLUMN IF NOT EXISTS workflow_stages TEXT[] DEFAULT '{}';`,
    `ALTER TABLE public.policy_rules ADD COLUMN IF NOT EXISTS conditions JSONB DEFAULT '[]';`,
    `ALTER TABLE public.policy_rules ADD COLUMN IF NOT EXISTS condition_logic TEXT NOT NULL DEFAULT 'AND';`,
    `ALTER TABLE public.policy_rules ADD COLUMN IF NOT EXISTS actions JSONB DEFAULT '[]';`,
    `ALTER TABLE public.policy_rules ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'medium';`,
    `ALTER TABLE public.policy_rules ADD COLUMN IF NOT EXISTS source_reference TEXT;`,
    `ALTER TABLE public.policy_rules ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;`,
    `ALTER TABLE public.policy_rules ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';`,
    `ALTER TABLE public.policy_rules ADD COLUMN IF NOT EXISTS effective_date TIMESTAMPTZ DEFAULT NOW();`,
    `ALTER TABLE public.policy_rules ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;`,
    `ALTER TABLE public.policy_rules ADD COLUMN IF NOT EXISTS rule_key TEXT;`,
    `ALTER TABLE public.policy_rules ADD COLUMN IF NOT EXISTS created_by UUID;`,
    `ALTER TABLE public.policy_rules ADD COLUMN IF NOT EXISTS updated_by UUID;`,
    `ALTER TABLE public.policy_rules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`,
  ];

  // Run all SQL via Supabase Management API (requires service role for DDL)
  const MANAGEMENT_URL = `https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_REF ?? 'jfhojgtnmcfqretrrxam'}/database/query`;
  const SUPABASE_PAT = process.env.SUPABASE_ACCESS_TOKEN;

  // If we have PAT, use management API
  if (SUPABASE_PAT) {
    const allSql = [createRulesTable, createVersionsTable, createApprovalsTable, createAuditTable, ...alterStatements].join('\n');
    try {
      const r = await fetch(MANAGEMENT_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_PAT}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: allSql }),
      });
      const txt = await r.text();
      results.push({ via: 'management_api', status: r.status, ok: r.ok, body: txt.slice(0, 300) });
    } catch (e) {
      results.push({ via: 'management_api', error: e.message });
    }
  } else {
    // Fall back: use Supabase RPC if a helper function exists, or try each table
    // via select to determine existence, then report
    const tables = ['policy_rules', 'policy_rule_versions', 'policy_approvals', 'policy_audit_log'];
    for (const t of tables) {
      const { error } = await adminDb.from(t).select('id').limit(1);
      if (error?.code === '42P01') {
        results.push({ table: t, exists: false, note: 'Table missing — run SQL manually' });
      } else {
        results.push({ table: t, exists: true, columns_ok: !error });
      }
    }
  }

  console.log('[rules-migration] Results:', JSON.stringify(results, null, 2));
  return results;
}

module.exports = { runRulesMigration };
