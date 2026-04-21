do $$
declare
  scoped_table text;
  scoped_tables text[] := array['ai_reviews', 'loans', 'inspections', 'borrower_financials', 'payments', 'draws'];
begin
  foreach scoped_table in array scoped_tables
  loop
    execute format('alter table if exists public.%I add column if not exists organization_id uuid', scoped_table);
    execute format('update public.%I set organization_id = org_id where organization_id is null and org_id is not null', scoped_table);
    execute format('create index if not exists %I on public.%I(organization_id, updated_at desc)', scoped_table || '_organization_id_updated_idx', scoped_table);
  end loop;
end $$;

create or replace function public.sync_organization_id_from_org_id()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null and new.org_id is not null then
    new.organization_id := new.org_id;
  end if;

  if new.org_id is null and new.organization_id is not null then
    new.org_id := new.organization_id;
  end if;

  return new;
end;
$$;

do $$
declare
  scoped_table text;
  scoped_tables text[] := array['ai_reviews', 'loans', 'inspections', 'borrower_financials', 'payments', 'draws'];
begin
  foreach scoped_table in array scoped_tables
  loop
    execute format('drop trigger if exists %I on public.%I', scoped_table || '_sync_organization_id', scoped_table);
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function public.sync_organization_id_from_org_id()',
      scoped_table || '_sync_organization_id', scoped_table
    );

    execute format('drop policy if exists "%s_org_select" on public.%I', scoped_table, scoped_table);
    execute format('drop policy if exists "%s_org_insert" on public.%I', scoped_table, scoped_table);
    execute format('drop policy if exists "%s_org_update" on public.%I', scoped_table, scoped_table);
    execute format('drop policy if exists "%s_org_delete" on public.%I', scoped_table, scoped_table);

    execute format(
      'create policy "%s_org_select" on public.%I for select using (organization_id in (select public.current_user_org_ids()))',
      scoped_table, scoped_table
    );
    execute format(
      'create policy "%s_org_insert" on public.%I for insert with check (organization_id in (select public.current_user_org_ids()))',
      scoped_table, scoped_table
    );
    execute format(
      'create policy "%s_org_update" on public.%I for update using (organization_id in (select public.current_user_org_ids())) with check (organization_id in (select public.current_user_org_ids()))',
      scoped_table, scoped_table
    );
    execute format(
      'create policy "%s_org_delete" on public.%I for delete using (organization_id in (select public.current_user_org_ids()))',
      scoped_table, scoped_table
    );
  end loop;
end $$;
