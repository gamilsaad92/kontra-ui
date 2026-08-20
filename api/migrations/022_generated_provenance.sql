-- Generated proposals can cite the creator-provided transaction description.
-- Keep this source distinct from uploaded documents and AI recommendations.
alter table if exists transaction_generation_sources
  drop constraint if exists transaction_generation_sources_source_type_check;

alter table if exists transaction_generation_sources
  add constraint transaction_generation_sources_source_type_check
  check (source_type in ('authoritative', 'uploaded', 'transaction_description', 'template', 'ai_recommendation'));