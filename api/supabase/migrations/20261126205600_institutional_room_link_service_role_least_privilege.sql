-- Supabase default privileges grant broad table rights to service_role.
-- Keep only the operations used by the institutional room-link API.
begin;

revoke all on table public.institutional_deal_room_links from service_role;
grant select, insert, delete on table public.institutional_deal_room_links to service_role;

commit;
