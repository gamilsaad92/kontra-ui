create table if not exists public.pay_stablecoin_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  loan_id uuid,
  invoice_id uuid,
  draw_id uuid,
  reference text not null,
  status text not null default 'requested',
  token text not null default 'USDC',
  chain text not null default 'base',
  expected_amount numeric not null,
  received_amount numeric not null default 0,
  destination_address text not null,
  destination_memo text,
  provider text not null default 'custodial',
  provider_payment_id text,
  provider_customer_id text,
  auto_convert_to_usd boolean not null default true,
  tx_hash text,
  confirmations int not null default 0,
  block_time timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pay_stablecoin_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  request_id uuid not null references public.pay_stablecoin_requests(id) on delete cascade,
  event_type text not null,
  old_status text,
  new_status text,
  tx_hash text,
  amount numeric,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_pay_sc_req_org on public.pay_stablecoin_requests(org_id);
create index if not exists idx_pay_sc_req_status on public.pay_stablecoin_requests(org_id, status);
create index if not exists idx_pay_sc_req_addr on public.pay_stablecoin_requests(destination_address);
create index if not exists idx_pay_sc_events_req on public.pay_stablecoin_events(request_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_pay_sc_req_updated on public.pay_stablecoin_requests;
create trigger trg_pay_sc_req_updated
before update on public.pay_stablecoin_requests
for each row execute function public.set_updated_at();
