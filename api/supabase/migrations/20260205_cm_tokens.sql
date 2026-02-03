-- TOKENS (definition)
create table if not exists public.cm_tokens (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  symbol text not null,
  name text not null,
  decimals int not null default 0,
  total_supply numeric not null default 0,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, symbol)
);

-- WHO OWNS WHAT (allocations)
create table if not exists public.cm_token_allocations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  token_id uuid not null references public.cm_tokens(id) on delete cascade,
  holder_type text not null default 'wallet',
  holder_ref text not null,
  balance numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, token_id, holder_type, holder_ref)
);

-- TRANSFER / MINT / BURN LOG
create table if not exists public.cm_token_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  token_id uuid not null references public.cm_tokens(id) on delete cascade,
  event_type text not null,
  from_holder_type text,
  from_holder_ref text,
  to_holder_type text,
  to_holder_ref text,
  amount numeric not null default 0,
  memo text,
  created_by text,
  created_at timestamptz not null default now()
);

-- INDEXES
create index if not exists idx_cm_tokens_org on public.cm_tokens(org_id);
create index if not exists idx_cm_alloc_org_token on public.cm_token_allocations(org_id, token_id);
create index if not exists idx_cm_events_org_token on public.cm_token_events(org_id, token_id);

-- UPDATED_AT TRIGGERS
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_cm_tokens_updated_at on public.cm_tokens;
create trigger trg_cm_tokens_updated_at
before update on public.cm_tokens
for each row execute function public.set_updated_at();

drop trigger if exists trg_cm_alloc_updated_at on public.cm_token_allocations;
create trigger trg_cm_alloc_updated_at
before update on public.cm_token_allocations
for each row execute function public.set_updated_at();
