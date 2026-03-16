-- Servicing AI enhancement schema
-- Adds support for draws, borrower_financials, escrows, management_items tables
-- and extends ai_reviews with new review types.

-- ── draws ────────────────────────────────────────────────────────────────────
create table if not exists draws (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  loan_id     uuid references loans(id) on delete set null,
  title       text,
  status      text not null default 'draft'
                check (status in ('draft','submitted','ai-review','approved','funded','rejected')),
  data        jsonb not null default '{}',
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists draws_org_id_idx on draws(org_id);
create index if not exists draws_loan_id_idx on draws(loan_id);

-- ── borrower_financials ───────────────────────────────────────────────────────
create table if not exists borrower_financials (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  loan_id     uuid references loans(id) on delete set null,
  title       text,
  period      text,
  status      text not null default 'pending'
                check (status in ('pending','reviewed','watchlist','cleared')),
  data        jsonb not null default '{}',
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists borrower_financials_org_id_idx on borrower_financials(org_id);
create index if not exists borrower_financials_loan_id_idx on borrower_financials(loan_id);

-- ── escrows ───────────────────────────────────────────────────────────────────
create table if not exists escrows (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  loan_id     uuid references loans(id) on delete set null,
  title       text,
  status      text not null default 'active'
                check (status in ('active','shortage','cured','closed')),
  data        jsonb not null default '{}',
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists escrows_org_id_idx on escrows(org_id);
create index if not exists escrows_loan_id_idx on escrows(loan_id);

-- ── management_items ──────────────────────────────────────────────────────────
create table if not exists management_items (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  loan_id     uuid references loans(id) on delete set null,
  title       text,
  change_type text,
  status      text not null default 'open'
                check (status in ('open','pending-consent','approved','rejected')),
  data        jsonb not null default '{}',
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists management_items_org_id_idx on management_items(org_id);
create index if not exists management_items_loan_id_idx on management_items(loan_id);

-- ── extend ai_reviews type check ─────────────────────────────────────────────
-- Alter the type constraint to include new review types.
-- Safe no-op if constraint doesn't exist; drop and recreate.
do $$ begin
  alter table ai_reviews drop constraint if exists ai_reviews_type_check;
exception when others then null;
end $$;

alter table ai_reviews
  add constraint ai_reviews_type_check
  check (type in ('payment','inspection','compliance','draw','financial','escrow','management'));
