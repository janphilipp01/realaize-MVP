-- =============================================================================
-- 0007_market_locations_rls.sql — RLS policies for public.market_locations
-- =============================================================================
-- Idempotent.
-- =============================================================================

alter table public.market_locations enable row level security;

drop policy if exists market_locations_select on public.market_locations;
create policy market_locations_select on public.market_locations
  for select using (auth_helpers.can_read(org_id));

drop policy if exists market_locations_insert on public.market_locations;
create policy market_locations_insert on public.market_locations
  for insert with check (auth_helpers.can_write(org_id));

drop policy if exists market_locations_update on public.market_locations;
create policy market_locations_update on public.market_locations
  for update using (auth_helpers.can_write(org_id))
  with check (auth_helpers.can_write(org_id));

drop policy if exists market_locations_delete on public.market_locations;
create policy market_locations_delete on public.market_locations
  for delete using (auth_helpers.can_write(org_id));
