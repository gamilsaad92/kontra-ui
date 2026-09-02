- Multi-Tenancy tables
CREATE TABLE IF NOT EXISTS organizations (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id BIGINT REFERENCES organizations(id),
  branding JSONB,
   plan TEXT DEFAULT 'basic',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_members (
  user_id UUID PRIMARY KEY,
  organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'borrower',
  account_type TEXT DEFAULT 'borrower'
);

CREATE TABLE IF NOT EXISTS organization_invites (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE,
  token UUID NOT NULL,
  role TEXT DEFAULT 'member',
  accepted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
