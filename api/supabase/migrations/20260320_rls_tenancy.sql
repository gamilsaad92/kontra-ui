-- ============================================================
-- Migration: 20260320_rls_tenancy.sql
-- Full tenancy hardening: RLS, signup bootstrap, JWT enrichment
-- Idempotent — safe to re-run.
--
-- NOTE: organizations.id is bigint (serial) in this project.
-- All org_id references use bigint to match.
-- ============================================================

-- 1. Extensions -----------------------------------------------
create extension if not exists pgcrypto;

-- 2. Ensure users table exists --------------------------------
create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  supabase_user_id uuid unique not null,
  email         text,
  name          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_users_supabase_user_id on public.users(supabase_user_id);

-- 3. Ensure ai_reviews table exists with org_id (bigint to match organizations.id)
create table if not exists public.ai_reviews (
  id           uuid primary key default gen_random_uuid(),
  org_id       bigint,
  type         text not null,
  status       text not null default 'needs_review',
  title        text,
  summary      text,
  confidence   numeric,
  entity_id    uuid,
  entity_type  text,
  data         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- If ai_reviews.org_id was previously created as uuid, migrate it to bigint
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_reviews'
      and column_name = 'org_id'
      and data_type = 'uuid'
  ) then
    alter table public.ai_reviews drop column org_id;
    alter table public.ai_reviews add column org_id bigint;
  end if;
end $$;

alter table public.ai_reviews add column if not exists org_id bigint;
create index if not exists idx_ai_reviews_org_id on public.ai_reviews(org_id);
create index if not exists idx_ai_reviews_org_type_status on public.ai_reviews(org_id, type, status);
create index if not exists idx_ai_reviews_org_updated on public.ai_reviews(org_id, updated_at desc);

-- Add FK from ai_reviews to organizations (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_reviews_org_id_fkey'
      and conrelid = 'public.ai_reviews'::regclass
  ) then
    alter table public.ai_reviews
      add constraint ai_reviews_org_id_fkey
      foreign key (org_id) references public.organizations(id) on delete cascade;
  end if;
exception when others then null;
end $$;

-- 4. Backfill null org_ids on tenant tables with a sentinel org ----------
do $$
declare
  sentinel_org_id bigint;
  scoped_table text;
  scoped_tables text[] := array[
    'assets','loans','inspections','exchange_listings','payments','escrows',
    'draws','borrower_financials','management_items','pools','tokens',
    'compliance_items','legal_items','regulatory_scans','risk_items',
    'document_reviews','reports','ai_reviews'
  ];
begin
  -- Get or create a sentinel org for orphaned rows
  select id into sentinel_org_id
  from public.organizations
  where name = '__system_default__'
  limit 1;

  if sentinel_org_id is null then
    insert into public.organizations (name, status, created_by, data)
    values ('__system_default__', 'active', 'system', '{"system": true}'::jsonb)
    returning id into sentinel_org_id;
  end if;

  -- Backfill null org_ids on every tenant table
  foreach scoped_table in array scoped_tables
  loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = scoped_table
    ) then
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = scoped_table
          and column_name = 'org_id'
      ) then
        execute format(
          'update public.%I set org_id = %L where org_id is null',
          scoped_table, sentinel_org_id
        );
      end if;
    end if;
  end loop;
end $$;

-- 5. RLS helper function (returns bigint to match organizations.id) ------
-- Security-definer so it can read org_memberships bypassing RLS itself.
create or replace function public.current_user_org_ids()
returns setof bigint
language sql
security definer
stable
set search_path = public
as $$
  select org_id
  from public.org_memberships
  where user_id = auth.uid()::text
    and status = 'active'
    and deleted_at is null
$$;

-- 6. Enable RLS on all tenant tables ----------------------------
do $$
declare
  tbl text;
  tbls text[] := array[
    'organizations','org_memberships',
    'assets','loans','inspections','exchange_listings','payments','escrows',
    'draws','borrower_financials','management_items','pools','tokens',
    'compliance_items','legal_items','regulatory_scans','risk_items',
    'document_reviews','reports','ai_reviews','pool_loans','trades',
    'audit_log','tasks'
  ];
begin
  foreach tbl in array tbls
  loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = tbl
    ) then
      execute format('alter table public.%I enable row level security', tbl);
      execute format('alter table public.%I force row level security', tbl);
    end if;
  end loop;
end $$;

-- 7. Drop and recreate RLS policies (idempotent) ----------------

-- organizations: users can only see orgs they belong to
drop policy if exists "orgs_member_select" on public.organizations;
create policy "orgs_member_select" on public.organizations
  for select
  using (id in (select public.current_user_org_ids()));

drop policy if exists "orgs_member_insert" on public.organizations;
create policy "orgs_member_insert" on public.organizations
  for insert
  with check (true);

drop policy if exists "orgs_admin_update" on public.organizations;
create policy "orgs_admin_update" on public.organizations
  for update
  using (id in (select public.current_user_org_ids()));

-- org_memberships: members can read their own org's memberships
drop policy if exists "memberships_member_select" on public.org_memberships;
create policy "memberships_member_select" on public.org_memberships
  for select
  using (org_id in (select public.current_user_org_ids()));

drop policy if exists "memberships_admin_insert" on public.org_memberships;
create policy "memberships_admin_insert" on public.org_memberships
  for insert
  with check (org_id in (select public.current_user_org_ids()));

drop policy if exists "memberships_admin_update" on public.org_memberships;
create policy "memberships_admin_update" on public.org_memberships
  for update
  using (org_id in (select public.current_user_org_ids()));

-- Tenant tables: generated CRUD policies for each
do $$
declare
  tbl text;
  tbls text[] := array[
    'assets','loans','inspections','exchange_listings','payments','escrows',
    'draws','borrower_financials','management_items','pools','tokens',
    'compliance_items','legal_items','regulatory_scans','risk_items',
    'document_reviews','reports','ai_reviews','pool_loans','trades',
    'audit_log','tasks'
  ];
begin
  foreach tbl in array tbls
  loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = tbl
    ) then
      continue;
    end if;

    execute format('drop policy if exists "%s_tenant_select" on public.%I', tbl, tbl);
    execute format(
      'create policy "%s_tenant_select" on public.%I for select using (org_id in (select public.current_user_org_ids()))',
      tbl, tbl
    );

    execute format('drop policy if exists "%s_tenant_insert" on public.%I', tbl, tbl);
    execute format(
      'create policy "%s_tenant_insert" on public.%I for insert with check (org_id in (select public.current_user_org_ids()))',
      tbl, tbl
    );

    execute format('drop policy if exists "%s_tenant_update" on public.%I', tbl, tbl);
    execute format(
      'create policy "%s_tenant_update" on public.%I for update using (org_id in (select public.current_user_org_ids())) with check (org_id in (select public.current_user_org_ids()))',
      tbl, tbl
    );

    execute format('drop policy if exists "%s_tenant_delete" on public.%I', tbl, tbl);
    execute format(
      'create policy "%s_tenant_delete" on public.%I for delete using (org_id in (select public.current_user_org_ids()))',
      tbl, tbl
    );
  end loop;
end $$;

-- 8. Signup bootstrap trigger ----------------------------------
-- On new auth.users insert: creates a default org, membership, and enriches
-- the user's app_metadata with organization_id so it appears in the JWT.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  new_org_id bigint;
  local_user_id uuid;
  org_name text;
begin
  org_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1),
    'My Organization'
  );

  -- Upsert local user record
  insert into public.users (supabase_user_id, email)
  values (new.id, new.email)
  on conflict (supabase_user_id)
  do update set email = coalesce(excluded.email, users.email)
  returning id into local_user_id;

  -- Idempotent: skip if user already has an org
  select org_id into new_org_id
  from public.org_memberships
  where user_id = new.id::text
    and status = 'active'
    and deleted_at is null
  limit 1;

  if new_org_id is null then
    insert into public.organizations (name, status, created_by, data)
    values (org_name, 'active', new.id::text, jsonb_build_object('signup_email', new.email))
    returning id into new_org_id;

    insert into public.org_memberships (org_id, user_id, role, status)
    values (new_org_id, new.id::text, 'admin', 'active')
    on conflict (org_id, user_id) do nothing;
  end if;

  -- Enrich JWT metadata
  update auth.users
  set raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb) ||
    jsonb_build_object('organization_id', new_org_id::text)
  where id = new.id;

  return new;
exception when others then
  raise warning '[handle_new_user] bootstrap failed for user %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 9. Backfill existing users who have no org -------------------
do $$
declare
  u record;
  new_org_id bigint;
  org_name text;
begin
  for u in
    select au.id, au.email, au.raw_user_meta_data, au.raw_app_meta_data
    from auth.users au
    where not exists (
      select 1 from public.org_memberships om
      where om.user_id = au.id::text
        and om.status = 'active'
        and om.deleted_at is null
    )
  loop
    org_name := coalesce(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      split_part(u.email, '@', 1),
      'My Organization'
    );

    insert into public.users (supabase_user_id, email)
    values (u.id, u.email)
    on conflict (supabase_user_id) do update set email = coalesce(excluded.email, users.email);

    insert into public.organizations (name, status, created_by, data)
    values (org_name, 'active', u.id::text, jsonb_build_object('signup_email', u.email, 'backfilled', true))
    returning id into new_org_id;

    insert into public.org_memberships (org_id, user_id, role, status)
    values (new_org_id, u.id::text, 'admin', 'active')
    on conflict (org_id, user_id) do nothing;

    update auth.users
    set raw_app_meta_data =
      coalesce(raw_app_meta_data, '{}'::jsonb) ||
      jsonb_build_object('organization_id', new_org_id::text)
    where id = u.id;

    raise notice '[backfill] created org % for user %', new_org_id, u.id;
  end loop;
end $$;

-- 10. Updated_at trigger for users table -----------------------
drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- Done.
