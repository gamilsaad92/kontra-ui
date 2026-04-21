alter table if exists public.organizations
  add column if not exists name text,
  add column if not exists created_by text;

update public.organizations
set name = coalesce(name, title, 'Organization')
where name is null;

alter table if exists public.organizations
  alter column name set not null;

update public.organizations
set created_by = coalesce(created_by, data->>'created_by', 'unknown')
where created_by is null;

alter table if exists public.organizations
  alter column created_by set not null;

alter table if exists public.org_memberships
  alter column role set default 'admin';

create index if not exists idx_org_memberships_user_id on public.org_memberships(user_id);
create index if not exists idx_org_memberships_org_id on public.org_memberships(org_id);

create unique index if not exists uq_org_memberships_org_user
  on public.org_memberships(org_id, user_id);
