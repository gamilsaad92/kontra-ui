-- Baseline schema alignment for API multi-tenant resources.
-- Idempotent by design.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  title text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  user_id text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'active',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'org_memberships_org_id_fkey'
      AND conrelid = 'org_memberships'::regclass
  ) THEN
    ALTER TABLE org_memberships
      ADD CONSTRAINT org_memberships_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES organizations(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS org_memberships_org_id_idx ON org_memberships(org_id);
CREATE INDEX IF NOT EXISTS org_memberships_user_id_idx ON org_memberships(user_id);

-- Ensure common expected columns on existing core tables.
ALTER TABLE IF EXISTS assets ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE IF EXISTS assets ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE IF EXISTS assets ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE IF EXISTS assets ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS assets ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS assets ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS loans ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE IF EXISTS loans ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE IF EXISTS loans ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE IF EXISTS loans ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS loans ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS loans ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS inspections ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE IF EXISTS inspections ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE IF EXISTS inspections ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE IF EXISTS inspections ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS inspections ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS inspections ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS exchange_listings ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE IF EXISTS exchange_listings ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE IF EXISTS exchange_listings ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE IF EXISTS exchange_listings ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS exchange_listings ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS exchange_listings ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS escrows ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE IF EXISTS escrows ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE IF EXISTS escrows ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE IF EXISTS escrows ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS escrows ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS escrows ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'escrows'
  ) THEN
    ALTER TABLE escrows ADD COLUMN IF NOT EXISTS id uuid;
    ALTER TABLE escrows ALTER COLUMN id SET DEFAULT gen_random_uuid();
    UPDATE escrows SET id = gen_random_uuid() WHERE id IS NULL;
    ALTER TABLE escrows ALTER COLUMN id SET NOT NULL;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'escrows'::regclass
        AND contype = 'p'
    ) THEN
      ALTER TABLE escrows ADD CONSTRAINT escrows_pkey PRIMARY KEY (id);
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS draws (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  title text,
  status text NOT NULL DEFAULT 'active',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS borrower_financials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  title text,
  status text NOT NULL DEFAULT 'active',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS management_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  title text,
  status text NOT NULL DEFAULT 'active',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  title text,
  status text NOT NULL DEFAULT 'active',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  pool_id uuid,
  symbol text,
  supply numeric,
  title text,
  status text NOT NULL DEFAULT 'active',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compliance_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  title text,
  status text NOT NULL DEFAULT 'active',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS legal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  title text,
  status text NOT NULL DEFAULT 'active',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS regulatory_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  title text,
  status text NOT NULL DEFAULT 'active',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS risk_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  title text,
  status text NOT NULL DEFAULT 'active',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  title text,
  status text NOT NULL DEFAULT 'active',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  title text,
  status text NOT NULL DEFAULT 'active',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure expected columns on potentially pre-existing tables.
ALTER TABLE IF EXISTS draws ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE IF EXISTS draws ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE IF EXISTS draws ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE IF EXISTS draws ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS draws ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS draws ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS borrower_financials ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE IF EXISTS borrower_financials ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE IF EXISTS borrower_financials ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE IF EXISTS borrower_financials ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS borrower_financials ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS borrower_financials ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS management_items ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE IF EXISTS management_items ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE IF EXISTS management_items ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE IF EXISTS management_items ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS management_items ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS management_items ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS pools ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE IF EXISTS pools ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE IF EXISTS pools ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE IF EXISTS pools ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS pools ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS pools ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS tokens ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE IF EXISTS tokens ADD COLUMN IF NOT EXISTS pool_id uuid;
ALTER TABLE IF EXISTS tokens ADD COLUMN IF NOT EXISTS symbol text;
ALTER TABLE IF EXISTS tokens ADD COLUMN IF NOT EXISTS supply numeric;
ALTER TABLE IF EXISTS tokens ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE IF EXISTS tokens ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE IF EXISTS tokens ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS tokens ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS tokens ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS compliance_items ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE IF EXISTS compliance_items ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE IF EXISTS compliance_items ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE IF EXISTS compliance_items ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS compliance_items ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS compliance_items ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS legal_items ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE IF EXISTS legal_items ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE IF EXISTS legal_items ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE IF EXISTS legal_items ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS legal_items ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS legal_items ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS regulatory_scans ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE IF EXISTS regulatory_scans ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE IF EXISTS regulatory_scans ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE IF EXISTS regulatory_scans ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS regulatory_scans ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS regulatory_scans ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS risk_items ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE IF EXISTS risk_items ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE IF EXISTS risk_items ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE IF EXISTS risk_items ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS risk_items ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS risk_items ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS document_reviews ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE IF EXISTS document_reviews ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE IF EXISTS document_reviews ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE IF EXISTS document_reviews ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS document_reviews ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS document_reviews ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS reports ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE IF EXISTS reports ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE IF EXISTS reports ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE IF EXISTS reports ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS reports ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS reports ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
DECLARE
  scoped_table text;
  scoped_tables text[] := ARRAY[
    'assets', 'loans', 'inspections', 'exchange_listings', 'payments', 'escrows',
    'draws', 'borrower_financials', 'management_items', 'pools', 'tokens',
    'compliance_items', 'legal_items', 'regulatory_scans', 'risk_items',
    'document_reviews', 'reports'
  ];
BEGIN
  FOREACH scoped_table IN ARRAY scoped_tables
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = scoped_table
    ) THEN
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON %I(org_id)',
        scoped_table || '_org_id_idx',
        scoped_table
      );

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = scoped_table || '_org_id_fkey'
          AND conrelid = to_regclass('public.' || scoped_table)
      ) THEN
        EXECUTE format(
          'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE',
          scoped_table,
          scoped_table || '_org_id_fkey'
        );
      END IF;
    END IF;
  END LOOP;
END $$;
