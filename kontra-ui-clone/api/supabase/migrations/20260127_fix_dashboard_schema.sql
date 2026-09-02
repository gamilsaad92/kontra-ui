begin;

create extension if not exists "pgcrypto";

alter table if exists public.exchange_listings
  add column if not exists marketplace_metrics jsonb;

update public.exchange_listings
  set marketplace_metrics = '{}'::jsonb
  where marketplace_metrics is null;

alter table if exists public.exchange_listings
  alter column marketplace_metrics set default '{}'::jsonb;

alter table if exists public.exchange_listings
  alter column marketplace_metrics set not null;

alter table if exists public.collections
  add column if not exists updated_at timestamptz;

update public.collections
  set updated_at = coalesce(updated_at, now())
  where updated_at is null;

alter table if exists public.collections
  alter column updated_at set default now();

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'collections'
  ) then
    if not exists (
      select 1
      from pg_trigger
      where tgname = 'collections_set_updated_at'
    ) then
      create trigger collections_set_updated_at
      before update on public.collections
      for each row
      execute function public.set_updated_at();
    end if;
  end if;
end;
$$;

create index if not exists collections_updated_at_idx
  on public.collections (updated_at);

alter table if exists public.loan_applications
  add column if not exists status text;

update public.loan_applications
  set status = 'draft'
  where status is null;

alter table if exists public.loan_applications
  alter column status set default 'draft';

alter table if exists public.loan_applications
  alter column status set not null;

create index if not exists loan_applications_status_idx
  on public.loan_applications (status);

create table if not exists public.application_orchestrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  applicant jsonb,
  status text,
  outputs jsonb,
  tasks jsonb,
  document_url text,
  package_filename text,
  review_status text,
  submitted_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists application_orchestrations_org_idx
  on public.application_orchestrations (organization_id);

create index if not exists application_orchestrations_submitted_at_idx
  on public.application_orchestrations (submitted_at);

create table if not exists public.report_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  name text,
  status text,
  config jsonb,
  result jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  generated_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists report_runs_org_idx
  on public.report_runs (organization_id);

create index if not exists report_runs_generated_at_idx
  on public.report_runs (generated_at);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'application_orchestrations'
  ) then
    if not exists (
      select 1
      from pg_trigger
      where tgname = 'application_orchestrations_set_updated_at'
    ) then
      create trigger application_orchestrations_set_updated_at
      before update on public.application_orchestrations
      for each row
      execute function public.set_updated_at();
    end if;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'report_runs'
  ) then
    if not exists (
      select 1
      from pg_trigger
      where tgname = 'report_runs_set_updated_at'
    ) then
      create trigger report_runs_set_updated_at
      before update on public.report_runs
      for each row
      execute function public.set_updated_at();
    end if;
  end if;
end;
$$;

commit;
