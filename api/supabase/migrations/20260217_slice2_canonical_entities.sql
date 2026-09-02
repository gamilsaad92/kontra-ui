create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  status text not null default 'active',
  title text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  status text not null default 'active',
  title text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (like public.assets including defaults);
create table if not exists public.inspections (like public.assets including defaults);
create table if not exists public.draws (like public.assets including defaults);
create table if not exists public.escrows (like public.assets including defaults);
create table if not exists public.borrower_financials (like public.assets including defaults);
create table if not exists public.management_items (like public.assets including defaults);
create table if not exists public.compliance_items (like public.assets including defaults);
alter table public.compliance_items alter column status set default 'open';
create table if not exists public.legal_items (like public.assets including defaults);
create table if not exists public.regulatory_scans (like public.assets including defaults);
create table if not exists public.risk_items (like public.assets including defaults);
create table if not exists public.document_reviews (like public.assets including defaults);
create table if not exists public.pools (like public.assets including defaults);
create table if not exists public.tokens (like public.assets including defaults);
create table if not exists public.trades (like public.assets including defaults);
create table if not exists public.exchange_listings (like public.assets including defaults);
create table if not exists public.reports (like public.assets including defaults);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  status text not null default 'active',
  title text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.org_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  user_id text not null,
  role text not null default 'member',
  status text not null default 'active',
  title text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pool_loans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  pool_id uuid not null references public.pools(id) on delete cascade,
  loan_id uuid not null references public.loans(id) on delete cascade,
  status text not null default 'active',
  title text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(pool_id, loan_id)
);

create table if not exists public.audit_log (like public.assets including defaults);
create table if not exists public.tasks (like public.assets including defaults);

create index if not exists idx_loans_org_created_at on public.loans(org_id, created_at desc);
create index if not exists idx_loans_org_status on public.loans(org_id, status);
create index if not exists idx_assets_org_created_at on public.assets(org_id, created_at desc);
create index if not exists idx_assets_org_status on public.assets(org_id, status);
create index if not exists idx_payments_org_created_at on public.payments(org_id, created_at desc);
create index if not exists idx_payments_org_status on public.payments(org_id, status);
create index if not exists idx_inspections_org_created_at on public.inspections(org_id, created_at desc);
create index if not exists idx_inspections_org_status on public.inspections(org_id, status);
create index if not exists idx_draws_org_created_at on public.draws(org_id, created_at desc);
create index if not exists idx_draws_org_status on public.draws(org_id, status);
create index if not exists idx_escrows_org_created_at on public.escrows(org_id, created_at desc);
create index if not exists idx_escrows_org_status on public.escrows(org_id, status);
create index if not exists idx_borrower_financials_org_created_at on public.borrower_financials(org_id, created_at desc);
create index if not exists idx_borrower_financials_org_status on public.borrower_financials(org_id, status);
create index if not exists idx_management_items_org_created_at on public.management_items(org_id, created_at desc);
create index if not exists idx_management_items_org_status on public.management_items(org_id, status);
create index if not exists idx_compliance_items_org_created_at on public.compliance_items(org_id, created_at desc);
create index if not exists idx_compliance_items_org_status on public.compliance_items(org_id, status);
create index if not exists idx_legal_items_org_created_at on public.legal_items(org_id, created_at desc);
create index if not exists idx_legal_items_org_status on public.legal_items(org_id, status);
create index if not exists idx_regulatory_scans_org_created_at on public.regulatory_scans(org_id, created_at desc);
create index if not exists idx_regulatory_scans_org_status on public.regulatory_scans(org_id, status);
create index if not exists idx_risk_items_org_created_at on public.risk_items(org_id, created_at desc);
create index if not exists idx_risk_items_org_status on public.risk_items(org_id, status);
create index if not exists idx_document_reviews_org_created_at on public.document_reviews(org_id, created_at desc);
create index if not exists idx_document_reviews_org_status on public.document_reviews(org_id, status);
create index if not exists idx_pools_org_created_at on public.pools(org_id, created_at desc);
create index if not exists idx_pools_org_status on public.pools(org_id, status);
create index if not exists idx_tokens_org_created_at on public.tokens(org_id, created_at desc);
create index if not exists idx_tokens_org_status on public.tokens(org_id, status);
create index if not exists idx_trades_org_created_at on public.trades(org_id, created_at desc);
create index if not exists idx_trades_org_status on public.trades(org_id, status);
create index if not exists idx_exchange_listings_org_created_at on public.exchange_listings(org_id, created_at desc);
create index if not exists idx_exchange_listings_org_status on public.exchange_listings(org_id, status);
create index if not exists idx_reports_org_created_at on public.reports(org_id, created_at desc);
create index if not exists idx_reports_org_status on public.reports(org_id, status);
create index if not exists idx_organizations_id_created_at on public.organizations(id, created_at desc);
create index if not exists idx_organizations_id_status on public.organizations(id, status);
create index if not exists idx_org_memberships_org_created_at on public.org_memberships(org_id, created_at desc);
create index if not exists idx_org_memberships_org_status on public.org_memberships(org_id, status);

DO $$
DECLARE tbl text;
BEGIN
  FOR tbl IN SELECT unnest(array['loans','assets','payments','inspections','draws','escrows','borrower_financials','management_items','compliance_items','legal_items','regulatory_scans','risk_items','document_reviews','pools','tokens','trades','exchange_listings','reports','organizations','org_memberships','pool_loans','audit_log','tasks'])
  LOOP
    EXECUTE format('drop trigger if exists trg_%I_updated_at on public.%I', tbl, tbl);
    EXECUTE format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', tbl, tbl);
  END LOOP;
END $$;
