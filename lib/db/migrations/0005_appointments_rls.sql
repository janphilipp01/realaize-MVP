-- =============================================================================
-- 0004_appointments_rls.sql — RLS policies for public.appointments
-- =============================================================================
-- Idempotent.
-- =============================================================================

alter table public.appointments enable row level security;

drop policy if exists appointments_select on public.appointments;
create policy appointments_select on public.appointments
  for select using (auth_helpers.can_read(org_id));

drop policy if exists appointments_insert on public.appointments;
create policy appointments_insert on public.appointments
  for insert with check (auth_helpers.can_write(org_id));

drop policy if exists appointments_update on public.appointments;
create policy appointments_update on public.appointments
  for update using (auth_helpers.can_write(org_id))
  with check (auth_helpers.can_write(org_id));

drop policy if exists appointments_delete on public.appointments;
create policy appointments_delete on public.appointments
  for delete using (auth_helpers.can_write(org_id));
