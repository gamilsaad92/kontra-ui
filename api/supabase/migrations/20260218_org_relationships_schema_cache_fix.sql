alter table if exists public.organizations
  add column if not exists created_by text;

alter table if exists public.org_memberships
  add column if not exists org_id uuid,
  add column if not exists user_id text,
  add column if not exists role text;

alter table if exists public.org_memberships
  alter column role set default 'admin';

create unique index if not exists org_memberships_unique_org_user
  on public.org_memberships(org_id, user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'org_memberships_org_id_fkey'
      AND conrelid = 'public.org_memberships'::regclass
  ) THEN
    ALTER TABLE public.org_memberships
      ADD CONSTRAINT org_memberships_org_id_fkey
      FOREIGN KEY (org_id)
      REFERENCES public.organizations(id)
      ON DELETE CASCADE;
  END IF;
END $$;
