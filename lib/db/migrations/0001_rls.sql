-- =============================================================================
-- 0001_rls.sql — RLS helper schema, helper functions, and policies
-- =============================================================================
-- Apply with: psql "$DATABASE_URL" -f lib/db/migrations/0001_rls.sql
-- (or via the Supabase SQL editor for the linked project).
--
-- This migration is idempotent — safe to re-run.
-- =============================================================================

-- ---- Helper schema -----------------------------------------------------------
create schema if not exists auth_helpers;

-- Resolve the current acting user. Two sources, in order:
--   1. `app.user_id` — set via SET LOCAL by our api-server in dbScope.ts.
--      Used when the api-server queries Postgres directly with a pg.Pool.
--   2. `auth.uid()` — provided by Supabase when the request comes via
--      PostgREST / supabase-js with an Authorization: Bearer JWT.
-- Returns NULL if neither is set; policies then deny access by default.
create or replace function auth_helpers.uid()
returns uuid
language sql
stable
security definer
set search_path = auth_helpers, public, pg_temp
as $$
  select coalesce(
    nullif(current_setting('app.user_id', true), '')::uuid,
    auth.uid()
  )
$$;

-- Convenience: the public.users.id (NOT the supabase auth_id) of the caller.
create or replace function auth_helpers.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = auth_helpers, public, pg_temp
as $$
  select id from public.users where auth_id = auth_helpers.uid()
$$;

-- All org_ids the caller is a member of.
create or replace function auth_helpers.org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = auth_helpers, public, pg_temp
as $$
  select org_id
  from public.memberships
  where user_id = auth_helpers.current_user_id()
$$;

-- The caller's role in a specific org (or NULL if not a member).
create or replace function auth_helpers.role_in(target_org uuid)
returns text
language sql
stable
security definer
set search_path = auth_helpers, public, pg_temp
as $$
  select role::text
  from public.memberships
  where org_id = target_org
    and user_id = auth_helpers.current_user_id()
$$;

-- Convenience boolean wrappers.
create or replace function auth_helpers.is_admin(target_org uuid)
returns boolean language sql stable as $$
  select auth_helpers.role_in(target_org) = 'admin'
$$;

create or replace function auth_helpers.can_write(target_org uuid)
returns boolean language sql stable as $$
  select auth_helpers.role_in(target_org) in ('admin', 'editor')
$$;

create or replace function auth_helpers.can_read(target_org uuid)
returns boolean language sql stable as $$
  select auth_helpers.role_in(target_org) in ('admin', 'editor', 'viewer')
$$;

-- ---- Enable RLS --------------------------------------------------------------
alter table public.users          enable row level security;
alter table public.organizations  enable row level security;
alter table public.memberships    enable row level security;
alter table public.audit_log      enable row level security;
alter table public.settings       enable row level security;

-- ---- public.users policies ---------------------------------------------------
-- Members may see other users that share at least one org with them.
drop policy if exists users_select on public.users;
create policy users_select on public.users
  for select using (
    id = auth_helpers.current_user_id()
    or exists (
      select 1
      from public.memberships m_self
      join public.memberships m_other on m_self.org_id = m_other.org_id
      where m_self.user_id = auth_helpers.current_user_id()
        and m_other.user_id = public.users.id
    )
  );

-- Users may update their own row (e.g. display_name). Email/auth_id stay read-only via app logic.
drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update using (id = auth_helpers.current_user_id())
  with check (id = auth_helpers.current_user_id());

-- INSERT is performed by the public.handle_new_auth_user trigger
-- (SECURITY DEFINER); no client-side INSERT policy.
-- DELETE is not exposed to clients.

-- ---- public.organizations policies -------------------------------------------
drop policy if exists orgs_select on public.organizations;
create policy orgs_select on public.organizations
  for select using (id in (select auth_helpers.org_ids()));

-- Any authenticated user may create a new organization (becomes its admin via
-- the bootstrap endpoint, which inserts the matching membership row).
drop policy if exists orgs_insert on public.organizations;
create policy orgs_insert on public.organizations
  for insert with check (auth_helpers.uid() is not null);

drop policy if exists orgs_update on public.organizations;
create policy orgs_update on public.organizations
  for update using (auth_helpers.is_admin(id))
  with check (auth_helpers.is_admin(id));

drop policy if exists orgs_delete on public.organizations;
create policy orgs_delete on public.organizations
  for delete using (auth_helpers.is_admin(id));

-- ---- public.memberships policies ---------------------------------------------
drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships
  for select using (org_id in (select auth_helpers.org_ids()));

-- INSERT: either an admin of the org, or the very first membership of a brand
-- new org (where no admin exists yet — used by the bootstrap flow).
drop policy if exists memberships_insert on public.memberships;
create policy memberships_insert on public.memberships
  for insert with check (
    auth_helpers.is_admin(org_id)
    or not exists (select 1 from public.memberships m where m.org_id = memberships.org_id)
  );

drop policy if exists memberships_update on public.memberships;
create policy memberships_update on public.memberships
  for update using (auth_helpers.is_admin(org_id))
  with check (auth_helpers.is_admin(org_id));

drop policy if exists memberships_delete on public.memberships;
create policy memberships_delete on public.memberships
  for delete using (auth_helpers.is_admin(org_id));

-- ---- public.audit_log policies -----------------------------------------------
drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log
  for select using (org_id in (select auth_helpers.org_ids()));

-- INSERT only via the api-server (which connects with elevated privileges or
-- uses set_config to scope user). No UPDATE/DELETE — log is append-only.
drop policy if exists audit_insert on public.audit_log;
create policy audit_insert on public.audit_log
  for insert with check (auth_helpers.can_read(org_id));

-- ---- public.settings policies ------------------------------------------------
drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings
  for select using (org_id in (select auth_helpers.org_ids()));

drop policy if exists settings_insert on public.settings;
create policy settings_insert on public.settings
  for insert with check (auth_helpers.can_write(org_id));

drop policy if exists settings_update on public.settings;
create policy settings_update on public.settings
  for update using (auth_helpers.is_admin(org_id))
  with check (auth_helpers.is_admin(org_id));

-- =============================================================================
-- Domain-table policies are added in subsequent migrations once the tables
-- exist (Phase 2: contacts, Phase 4: assets/deals/etc.). Each domain table
-- follows the same shape:
--   SELECT  → can_read(org_id)
--   INSERT  → can_write(org_id)
--   UPDATE  → can_write(org_id)
--   DELETE  → is_admin(org_id)
-- =============================================================================
