create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by text,
  created_at timestamptz not null default now()
);

alter table if exists public.organizations
  add column if not exists created_by text;

create table if not exists public.org_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  user_id text not null,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

alter table if exists public.org_memberships
  add column if not exists org_id uuid,
  add column if not exists user_id text,
  add column if not exists role text,
  add column if not exists created_at timestamptz not null default now();

alter table if exists public.org_memberships
  alter column role set default 'admin';

create unique index if not exists org_memberships_unique_org_user
  on public.org_memberships(org_id, user_id);

create index if not exists org_memberships_user_id_idx
  on public.org_memberships(user_id);

create index if not exists org_memberships_org_id_idx
  on public.org_memberships(org_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'organizations'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'org_memberships_org_id_fkey'
      AND conrelid = 'public.org_memberships'::regclass
  ) THEN
    ALTER TABLE public.org_memberships
      ADD CONSTRAINT org_memberships_org_id_fkey
      FOREIGN KEY (org_id)
      REFERENCES public.organizations(id)
      ON DELETE CASCADE;
  END IF;
END $$;
