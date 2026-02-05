-- POLICY PACKS (enabled per org)
create table if not exists public.policy_packs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  name text not null,
  authority text not null,
  status text not null default 'active',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, name)
);

create table if not exists public.regulations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  pack_id uuid references public.policy_packs(id) on delete set null,
  authority text not null,
  title text not null,
  citation text,
  source_url text,
  effective_date date,
  supersedes_regulation_id uuid references public.regulations(id) on delete set null,
  tags text[] not null default '{}',
  raw_text text,
  summary text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.policy_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  pack_id uuid not null references public.policy_packs(id) on delete cascade,
  regulation_id uuid references public.regulations(id) on delete set null,
  name text not null,
  applies_to text not null default 'loan',
  status text not null default 'draft',
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.policy_rule_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  rule_id uuid not null references public.policy_rules(id) on delete cascade,
  version int not null default 1,
  status text not null default 'draft',
  effective_date date,
  change_note text,
  conditions jsonb not null default '{}'::jsonb,
  actions jsonb not null default '{}'::jsonb,
  severity text not null default 'medium',
  created_by text,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique(rule_id, version)
);

create table if not exists public.workflow_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  pack_id uuid references public.policy_packs(id) on delete set null,
  name text not null,
  applies_to text not null default 'loan',
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.compliance_findings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  entity_type text not null,
  entity_id uuid not null,
  pack_id uuid references public.policy_packs(id) on delete set null,
  rule_id uuid references public.policy_rules(id) on delete set null,
  rule_version_id uuid references public.policy_rule_versions(id) on delete set null,
  status text not null default 'open',
  severity text not null default 'medium',
  title text not null,
  details jsonb not null default '{}'::jsonb,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.compliance_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  finding_id uuid not null references public.compliance_findings(id) on delete cascade,
  title text not null,
  status text not null default 'open',
  owner text,
  due_date date,
  required_artifacts jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.compliance_overrides (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  finding_id uuid not null references public.compliance_findings(id) on delete cascade,
  action text not null,
  reason_code text not null,
  reason text,
  approved_by text,
  approved_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.policy_impact_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  pack_id uuid references public.policy_packs(id) on delete set null,
  rule_version_id uuid references public.policy_rule_versions(id) on delete set null,
  status text not null default 'running',
  summary jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.policy_impact_results (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  impact_run_id uuid not null references public.policy_impact_runs(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  would_trigger boolean not null default false,
  severity text,
  due_date date,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_packs_org on public.policy_packs(org_id);
create index if not exists idx_rules_org_pack on public.policy_rules(org_id, pack_id);
create index if not exists idx_rule_versions_rule on public.policy_rule_versions(rule_id);
create index if not exists idx_findings_org_entity on public.compliance_findings(org_id, entity_type, entity_id);
create index if not exists idx_tasks_org_finding on public.compliance_tasks(org_id, finding_id);
create index if not exists idx_overrides_org_finding on public.compliance_overrides(org_id, finding_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_policy_packs_updated on public.policy_packs;
create trigger trg_policy_packs_updated before update on public.policy_packs
for each row execute function public.set_updated_at();

drop trigger if exists trg_regs_updated on public.regulations;
create trigger trg_regs_updated before update on public.regulations
for each row execute function public.set_updated_at();

drop trigger if exists trg_policy_rules_updated on public.policy_rules;
create trigger trg_policy_rules_updated before update on public.policy_rules
for each row execute function public.set_updated_at();

drop trigger if exists trg_workflow_templates_updated on public.workflow_templates;
create trigger trg_workflow_templates_updated before update on public.workflow_templates
for each row execute function public.set_updated_at();

drop trigger if exists trg_findings_updated on public.compliance_findings;
create trigger trg_findings_updated before update on public.compliance_findings
for each row execute function public.set_updated_at();

drop trigger if exists trg_tasks_updated on public.compliance_tasks;
create trigger trg_tasks_updated before update on public.compliance_tasks
for each row execute function public.set_updated_at();
