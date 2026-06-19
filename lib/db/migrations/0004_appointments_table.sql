-- =============================================================================
-- 0004_appointments_table.sql — create public.appointments
-- =============================================================================
-- Idempotent.
-- =============================================================================

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  date text not null,
  time text not null,
  end_time text,
  location text,
  participants text,
  asset_id text,
  category text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists appointments_org_idx on public.appointments(org_id);
create index if not exists appointments_date_idx on public.appointments(date);
