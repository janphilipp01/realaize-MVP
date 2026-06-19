-- =============================================================================
-- 0003_contacts_rls.sql — RLS policies for public.contacts
-- =============================================================================
-- Idempotent.
-- =============================================================================

alter table public.contacts enable row level security;

-- Members of the contact's org can read it.
drop policy if exists contacts_select on public.contacts;
create policy contacts_select on public.contacts
  for select using (auth_helpers.can_read(org_id));

-- Admin or editor can insert (org_id must be one they belong to).
drop policy if exists contacts_insert on public.contacts;
create policy contacts_insert on public.contacts
  for insert with check (auth_helpers.can_write(org_id));

-- Admin or editor can update.
drop policy if exists contacts_update on public.contacts;
create policy contacts_update on public.contacts
  for update using (auth_helpers.can_write(org_id))
  with check (auth_helpers.can_write(org_id));

-- Admin or editor can delete.
drop policy if exists contacts_delete on public.contacts;
create policy contacts_delete on public.contacts
  for delete using (auth_helpers.can_write(org_id));
