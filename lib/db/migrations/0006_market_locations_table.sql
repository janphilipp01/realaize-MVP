-- =============================================================================
-- 0006_market_locations_table.sql — create public.market_locations
-- =============================================================================
-- Idempotent.
-- =============================================================================

create table if not exists public.market_locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  location_key text not null,
  city text not null,
  region text not null,
  submarket text not null,
  last_updated text not null,
  benchmarks jsonb not null default '[]'::jsonb,
  update_log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists market_locations_org_idx on public.market_locations(org_id);
create index if not exists market_locations_key_idx on public.market_locations(org_id, location_key);
