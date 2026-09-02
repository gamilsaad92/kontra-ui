alter table if exists public.trade_participants add column if not exists org_id uuid;
alter table if exists public.trade_settlements add column if not exists org_id uuid;
alter table if exists public.trade_events add column if not exists org_id uuid;

update public.trade_participants tp
set org_id = t.org_id
from public.trades t
where tp.trade_id = t.id
  and tp.org_id is null
  and t.org_id is not null;

update public.trade_settlements ts
set org_id = t.org_id
from public.trades t
where ts.trade_id = t.id
  and ts.org_id is null
  and t.org_id is not null;

update public.trade_events te
set org_id = t.org_id
from public.trades t
where te.trade_id = t.id
  and te.org_id is null
  and t.org_id is not null;

create index if not exists idx_trade_participants_org_trade on public.trade_participants(org_id, trade_id);
create index if not exists idx_trade_settlements_org_trade on public.trade_settlements(org_id, trade_id);
create index if not exists idx_trade_events_org_trade on public.trade_events(org_id, trade_id);

alter table public.trade_participants enable row level security;
alter table public.trade_settlements enable row level security;
alter table public.trade_events enable row level security;

drop policy if exists trade_participants_tenant_select on public.trade_participants;
drop policy if exists trade_participants_tenant_insert on public.trade_participants;
drop policy if exists trade_participants_tenant_update on public.trade_participants;
drop policy if exists trade_participants_tenant_delete on public.trade_participants;
drop policy if exists trade_settlements_tenant_select on public.trade_settlements;
drop policy if exists trade_settlements_tenant_insert on public.trade_settlements;
drop policy if exists trade_settlements_tenant_update on public.trade_settlements;
drop policy if exists trade_settlements_tenant_delete on public.trade_settlements;
drop policy if exists trade_events_tenant_select on public.trade_events;
drop policy if exists trade_events_tenant_insert on public.trade_events;
drop policy if exists trade_events_tenant_update on public.trade_events;
drop policy if exists trade_events_tenant_delete on public.trade_events;

create policy trade_participants_tenant_select on public.trade_participants
  for select using (org_id in (select public.current_user_org_ids()));
create policy trade_participants_tenant_insert on public.trade_participants
  for insert with check (org_id in (select public.current_user_org_ids()));
create policy trade_participants_tenant_update on public.trade_participants
  for update using (org_id in (select public.current_user_org_ids()))
  with check (org_id in (select public.current_user_org_ids()));
create policy trade_participants_tenant_delete on public.trade_participants
  for delete using (org_id in (select public.current_user_org_ids()));

create policy trade_settlements_tenant_select on public.trade_settlements
  for select using (org_id in (select public.current_user_org_ids()));
create policy trade_settlements_tenant_insert on public.trade_settlements
  for insert with check (org_id in (select public.current_user_org_ids()));
create policy trade_settlements_tenant_update on public.trade_settlements
  for update using (org_id in (select public.current_user_org_ids()))
  with check (org_id in (select public.current_user_org_ids()));
create policy trade_settlements_tenant_delete on public.trade_settlements
  for delete using (org_id in (select public.current_user_org_ids()));

create policy trade_events_tenant_select on public.trade_events
  for select using (org_id in (select public.current_user_org_ids()));
create policy trade_events_tenant_insert on public.trade_events
  for insert with check (org_id in (select public.current_user_org_ids()));
create policy trade_events_tenant_update on public.trade_events
  for update using (org_id in (select public.current_user_org_ids()))
  with check (org_id in (select public.current_user_org_ids()));
create policy trade_events_tenant_delete on public.trade_events
  for delete using (org_id in (select public.current_user_org_ids()));
