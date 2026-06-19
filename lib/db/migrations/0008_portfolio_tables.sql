-- =============================================================================
-- 0008_portfolio_tables.sql — assets, deals, developments, sales
-- =============================================================================
-- Hybrid schema: id + orgId stable, everything else as JSONB document.
-- Idempotent.
-- =============================================================================

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists assets_org_idx on public.assets(org_id);

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists deals_org_idx on public.deals(org_id);

create table if not exists public.developments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists developments_org_idx on public.developments(org_id);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sales_org_idx on public.sales(org_id);
