# Kontra schema parity report

**Scope:** release-blocker audit only. No production schema was modified.

## Canonical migration map

| Capability | Canonical migration(s) |
| --- | --- |
| Room, analysis, participant submissions | `001_deal_rooms.sql`, `002_deal_analyses.sql`, `004_party_submissions.sql` |
| Invitations and verified participant sessions | `011_invite_security.sql` |
| Durable task engine | `007_deal_room_tasks.sql`, `019_transaction_pipeline.sql` |
| Transaction Record and provenance | `015_transaction_record.sql` |
| Lifecycle/settlement readiness | `017_settlement_capability.sql` |
| Transaction Seal atomic completion | `018_settlement_atomic_completion.sql` |
| Durable document/task/event pipeline | `019_transaction_pipeline.sql` |
| Notifications | `009_deal_notifications.sql` |

Migration 015 now explicitly adds its provenance columns when the three
Transaction Record tables already exist. Migration 019 now creates the base
`deal_events` table before adding pipeline columns, so both migrations are
safe to replay against older installations.

## Read-only findings

### Development database

Present:

- invitation tables and access sessions
- Transaction Record tables
- settlement mode/readiness/seal/completion columns
- post-completion analysis columns
- task-engine and durable pipeline columns
- event metadata columns

Missing from the current development schema:

- `transaction_record_fields.source_doc_version`
- `transaction_record_fields.source_file_hash`
- `transaction_record_approvals.is_manual`
- `transaction_record_approvals.source_doc_id`
- `transaction_record_approvals.source_file_hash`

These are covered by the updated canonical migration 015. They were not added
directly during this audit.

### Production Supabase

Present:

- all audited core tables except `deal_events`
- invitation and access-session tables
- Transaction Record tables and provenance columns
- settlement readiness, seal, completion, and post-completion columns
- `complete_settlement_transaction()`
- the Transaction Seal uniqueness index

Missing:

- the `deal_events` table
- migration 019 columns on `deal_analyses`
  (`processing_status`, `source_hash`, `processing_attempt`,
  `correlation_id`, `failure_reason`, `processing_started_at`,
  `processing_completed_at`)
- migration 019 columns on `deal_room_tasks`
  (`severity`, `blocking`, `category`, `source_document_id`, `source_page`,
  `source_excerpt`, `source_agent`, `source_run_id`, `correlation_id`,
  `required_approver_role`, `rejection_reason`, `send_back_reason`,
  `decision`, `decision_actor_id`, `decision_actor_role`, `decision_reason`,
  `decision_at`, `idempotency_key`, `execution_status`, `execution_result`,
  `executed_at`, `resolved_at`)
- migration 019 event metadata columns
  (`org_id`, `actor_id`, `actor_type`, `source`, `correlation_id`,
  `before_state`, `after_state`, `outcome`)
- migration 019 processing/correlation indexes and the generated-task
  uniqueness index

The production database has not been changed. The required production action
is to apply the committed, self-contained 019 migration through the authorized
Supabase migration path, then re-run the read-only audit. Development should
receive the updated 015 replay before the environments are considered equal.

## Release status

**NOT READY** — participant state is reconciled, but production schema parity
is not established and production migration approval is intentionally absent.