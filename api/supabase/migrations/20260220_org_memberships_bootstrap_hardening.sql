-- Ensure org_memberships supports bootstrap queries without relying on optional status column
alter table if exists public.org_memberships
  add column if not exists deleted_at timestamptz;

alter table if exists public.org_memberships
  add column if not exists data jsonb not null default '{}'::jsonb;

create index if not exists idx_org_memberships_user_active
  on public.org_memberships(user_id)
  where deleted_at is null;

create index if not exists idx_org_memberships_org_active
  on public.org_memberships(org_id)
  where deleted_at is null;

create unique index if not exists idx_org_memberships_org_user_unique
  on public.org_memberships(org_id, user_id);
