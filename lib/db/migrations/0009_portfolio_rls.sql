-- =============================================================================
-- 0009_portfolio_rls.sql — RLS for assets, deals, developments, sales
-- =============================================================================
-- Idempotent.
-- =============================================================================

do $$
declare
  t text;
begin
  foreach t in array array['assets', 'deals', 'developments', 'sales']
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select using (auth_helpers.can_read(org_id))', t || '_select', t);

    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('create policy %I on public.%I for insert with check (auth_helpers.can_write(org_id))', t || '_insert', t);

    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('create policy %I on public.%I for update using (auth_helpers.can_write(org_id)) with check (auth_helpers.can_write(org_id))', t || '_update', t);

    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for delete using (auth_helpers.can_write(org_id))', t || '_delete', t);
  end loop;
end $$;
