create table payments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid,
  amount numeric,
  method text check (method in ('ACH', 'Check', 'Wire')),
  status text,
  date_received timestamp default now()
);

create table loan_ledger (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid,
  amount numeric,
  type text,
  posted boolean default false,
  created_at timestamp default now()
);

create table accounting_reports (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid,
  summary text,
  created_at timestamp default now()
);

create table wire_transfers (
  id uuid primary key default gen_random_uuid(),
  securitization_id uuid,
  amount numeric,
  status text,
  created_at timestamp default now()
);
