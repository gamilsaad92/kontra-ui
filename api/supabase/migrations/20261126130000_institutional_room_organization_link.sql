-- Store institutional Deal Room associations separately from deal_rooms.
-- This avoids exposing organization identifiers through the existing anon and
-- authenticated SELECT grants on deal_rooms.
begin;

create table public.institutional_deal_room_links (
  property_id text primary key
    references public.deal_rooms(property_id) on delete cascade,
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  created_by uuid not null
    references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index institutional_deal_room_links_org_created_idx
  on public.institutional_deal_room_links (organization_id, created_at desc);

alter table public.institutional_deal_room_links enable row level security;
revoke all on table public.institutional_deal_room_links
  from public, anon, authenticated;
grant select, insert, delete on table public.institutional_deal_room_links
  to service_role;

comment on table public.institutional_deal_room_links is
  'Server-managed mapping from a Deal Room to one institution; participant room access remains independently session-scoped.';

commit;
