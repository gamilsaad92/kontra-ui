-- Kontra AI Orchestration Schema v1
-- Implements the workflow/agent infrastructure for automated servicing workflows.

-- ── workflow_runs ─────────────────────────────────────────────────────────────
create table if not exists workflow_runs (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references orgs(id) on delete cascade,
  loan_id           uuid references loans(id) on delete set null,
  workflow_type     text not null
                      check (workflow_type in (
                        'financial_review','inspection_review','draw_review',
                        'borrower_communication','risk_scoring',
                        'covenant_breach','occupancy_alert','missing_annuals'
                      )),
  status            text not null default 'queued'
                      check (status in ('queued','running','needs_review','completed','failed','cancelled')),
  priority          int not null default 5,
  source_entity_type text,
  source_entity_id   uuid,
  input_payload     jsonb not null default '{}',
  output_payload    jsonb,
  error_message     text,
  requested_by      uuid,
  started_at        timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists workflow_runs_org_id_idx on workflow_runs(org_id);
create index if not exists workflow_runs_loan_id_idx on workflow_runs(loan_id);
create index if not exists workflow_runs_status_idx on workflow_runs(status);
create index if not exists workflow_runs_workflow_type_idx on workflow_runs(workflow_type);

-- ── agent_steps ───────────────────────────────────────────────────────────────
create table if not exists agent_steps (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references orgs(id) on delete cascade,
  workflow_run_id  uuid not null references workflow_runs(id) on delete cascade,
  agent_name       text not null,
  step_name        text not null,
  status           text not null default 'pending'
                     check (status in ('pending','running','completed','failed','skipped')),
  input_payload    jsonb not null default '{}',
  output_payload   jsonb,
  error_message    text,
  started_at       timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists agent_steps_workflow_run_id_idx on agent_steps(workflow_run_id);
create index if not exists agent_steps_org_id_idx on agent_steps(org_id);

-- ── agent_artifacts ───────────────────────────────────────────────────────────
create table if not exists agent_artifacts (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references orgs(id) on delete cascade,
  workflow_run_id  uuid not null references workflow_runs(id) on delete cascade,
  artifact_type    text not null
                     check (artifact_type in (
                       'watchlist_comment','risk_score','email_draft',
                       'doc_checklist','decision_memo','narrative','structured_output'
                     )),
  content          jsonb not null default '{}',
  version          int not null default 1,
  created_at       timestamptz not null default now()
);
create index if not exists agent_artifacts_workflow_run_id_idx on agent_artifacts(workflow_run_id);
create index if not exists agent_artifacts_org_id_idx on agent_artifacts(org_id);

-- ── workflow_evidence ─────────────────────────────────────────────────────────
create table if not exists workflow_evidence (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references orgs(id) on delete cascade,
  workflow_run_id  uuid not null references workflow_runs(id) on delete cascade,
  file_id          text,
  source_type      text,
  source_reference text,
  excerpt          text,
  page_number      int,
  confidence       numeric(4,3),
  created_at       timestamptz not null default now()
);
create index if not exists workflow_evidence_workflow_run_id_idx on workflow_evidence(workflow_run_id);

-- ── human_reviews ──────────────────────────────────────────────────────────────
create table if not exists human_reviews (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references orgs(id) on delete cascade,
  workflow_run_id  uuid not null references workflow_runs(id) on delete cascade,
  review_status    text not null default 'pending'
                     check (review_status in ('pending','approved','rejected','changes_requested')),
  reviewer_id      uuid,
  review_notes     text,
  approved_output  jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists human_reviews_workflow_run_id_idx on human_reviews(workflow_run_id);
create index if not exists human_reviews_org_id_idx on human_reviews(org_id);

-- ── agent_memories ────────────────────────────────────────────────────────────
create table if not exists agent_memories (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references orgs(id) on delete cascade,
  loan_id          uuid references loans(id) on delete cascade,
  memory_type      text not null
                     check (memory_type in (
                       'financial_summary','inspection_history','draw_history',
                       'risk_profile','borrower_communications','covenant_tracker'
                     )),
  summary          text,
  facts            jsonb not null default '{}',
  last_updated_at  timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
create index if not exists agent_memories_loan_id_idx on agent_memories(loan_id);
create index if not exists agent_memories_org_id_idx on agent_memories(org_id);
create unique index if not exists agent_memories_loan_type_idx on agent_memories(org_id, loan_id, memory_type);
