-- Generated AI rooms retain their approved transaction identity and proposal
-- separately from the internal compatibility Workflow Pack.
alter table deal_rooms add column if not exists base_pack text;
alter table deal_rooms add column if not exists transaction_type text;
alter table deal_rooms add column if not exists transaction_subtype text;
alter table deal_rooms add column if not exists transaction_context jsonb;
alter table deal_rooms add column if not exists generated_proposal jsonb;

create index if not exists deal_rooms_generated_transaction_type_idx
  on deal_rooms(transaction_type)
  where generated_proposal is not null;