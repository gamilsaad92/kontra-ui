-- Minimal institutional onboarding substrate.
-- This migration deliberately does not create lending, reporting, or Deal Room
-- tables. Existing Deal Room transaction data remains untouched.

begin;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  title text,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'closed')),
  plan text not null default 'basic'
    check (plan in ('basic', 'pro', 'enterprise')),
  parent_id uuid references public.organizations(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  branding jsonb not null default '{}'::jsonb
    check (jsonb_typeof(branding) = 'object'),
  data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(data) = 'object'),
  kyc_approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.org_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'member')),
  status text not null default 'active'
    check (status in ('active', 'revoked')),
  invited_email text,
  created_by uuid references auth.users(id) on delete set null,
  data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint org_memberships_org_user_unique unique (org_id, user_id),
  constraint org_memberships_status_deleted_consistent
    check ((status = 'active' and deleted_at is null) or status = 'revoked')
);

create index org_memberships_user_status_idx
  on public.org_memberships(user_id, status, created_at);
create index org_memberships_org_status_idx
  on public.org_memberships(org_id, status, created_at);

-- Local-auth identities can participate only when an administrator has
-- explicitly linked them to a Supabase Auth UUID. Email matching is not used.
create table public.local_auth_identity_links (
  issuer text not null check (issuer = 'kontra-local'),
  subject text not null check (length(btrim(subject)) > 0),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (issuer, subject)
);

alter table public.organizations enable row level security;
alter table public.org_memberships enable row level security;
alter table public.local_auth_identity_links enable row level security;

-- The API uses the server-only Supabase service-role client. No direct
-- anon/authenticated table access is granted; there are intentionally no
-- client-side policies on these authorization tables.
revoke all on table public.organizations from public, anon, authenticated;
revoke all on table public.org_memberships from public, anon, authenticated;
revoke all on table public.local_auth_identity_links from public, anon, authenticated;
grant select, insert, update, delete on table public.organizations to service_role;
grant select, insert, update, delete on table public.org_memberships to service_role;
grant select, insert, update, delete on table public.local_auth_identity_links to service_role;

create or replace function public.create_organization_with_owner(
  p_name text,
  p_owner_user_id uuid,
  p_branding jsonb default '{}'::jsonb,
  p_parent_id uuid default null,
  p_data jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  normalized_name text := btrim(coalesce(p_name, ''));
  created_org public.organizations%rowtype;
  created_membership public.org_memberships%rowtype;
  parent_status text;
begin
  if length(normalized_name) < 1 or length(normalized_name) > 120 then
    raise exception using errcode = '22023', message = 'INVALID_ORGANIZATION_NAME';
  end if;

  if p_owner_user_id is null or not exists (
    select 1 from auth.users u where u.id = p_owner_user_id
  ) then
    raise exception using errcode = '22023', message = 'OWNER_AUTH_USER_REQUIRED';
  end if;

  if p_parent_id is not null then
    select o.status into parent_status
      from public.organizations o
      where o.id = p_parent_id
      for share;

    if parent_status is distinct from 'active' then
      raise exception using errcode = '22023', message = 'PARENT_ORGANIZATION_UNAVAILABLE';
    end if;

    perform 1
      from public.org_memberships m
      where m.org_id = p_parent_id
        and m.user_id = p_owner_user_id
        and m.role in ('owner', 'admin')
        and m.status = 'active'
        and m.deleted_at is null
      for share;

    if not found then
      raise exception using errcode = '42501', message = 'PARENT_ORGANIZATION_FORBIDDEN';
    end if;
  end if;

  insert into public.organizations (
    name, title, status, plan, parent_id, created_by, branding, data
  )
  values (
    normalized_name,
    normalized_name,
    'active',
    'basic',
    p_parent_id,
    p_owner_user_id,
    coalesce(p_branding, '{}'::jsonb),
    coalesce(p_data, '{}'::jsonb)
  )
  returning * into created_org;

  insert into public.org_memberships (
    org_id, user_id, role, status, created_by
  )
  values (
    created_org.id, p_owner_user_id, 'owner', 'active', p_owner_user_id
  )
  returning * into created_membership;

  return jsonb_build_object(
    'id', created_org.id,
    'name', created_org.name,
    'title', created_org.title,
    'status', created_org.status,
    'plan', created_org.plan,
    'parent_id', created_org.parent_id,
    'created_at', created_org.created_at,
    'membership_id', created_membership.id
  );
end;
$function$;

revoke all on function public.create_organization_with_owner(text, uuid, jsonb, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_organization_with_owner(text, uuid, jsonb, uuid, jsonb)
  to service_role;

commit;
