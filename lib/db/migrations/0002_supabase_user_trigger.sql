-- =============================================================================
-- 0002_supabase_user_trigger.sql — auto-provision public.users on signup
-- =============================================================================
-- Apply with: psql "$DATABASE_URL" -f lib/db/migrations/0002_supabase_user_trigger.sql
--
-- When a user signs up via Supabase Auth a row appears in auth.users.
-- This trigger mirrors that into public.users so we have a stable internal
-- identity to attach memberships and audit references to.
--
-- The api-server's POST /api/bootstrap then handles the *organization* and
-- *membership* creation (with seed data). The trigger only handles the user
-- mirror — keeping it small means the auth flow stays simple and idempotent.
--
-- This migration is idempotent.
-- =============================================================================

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.users (auth_id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', new.email)
  )
  on conflict (auth_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
