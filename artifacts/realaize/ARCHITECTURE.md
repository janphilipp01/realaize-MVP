# realaize frontend — architecture

A React 19 + Vite + Zustand SPA. This document orients a new developer after the
2026-07 cleanup. Everything under `artifacts/realaize/`.

## Directory layout (`src/`)

```
app entry        App.tsx (routing), main.tsx, components/AuthGuard.tsx
pages/           one file per route: Portfolio, Assets, Acquisition, Developments,
                 Sales, Debt, CashFlow, Markt, DealRadar, Documents, AICopilot,
                 News, Settings, Login … Large tab-based pages are thin shells that
                 compose co-located tab components (see components/ below).
components/
  market-intelligence/   the MI feature: MarketIntelligencePanel.tsx, tabs.tsx,
                         shared.tsx (Badge, styles, ProvenanceDrilldown, constants)
  developments/          Developments detail tabs: OverviewTab, RentRollTab,
                         BudgetTab, GanttTab, DebtTab, ValuationTab, AdvisorTab,
                         HoldSellTab, CashFlowTab, DocumentsTab + constants.ts
  acquisition-wizard/    the deal-entry wizard: shared.tsx (constants, tab
                         registry, field primitives) + tabs.tsx (the Tab* steps);
                         orchestrated by pages/AcquisitionWizard.tsx
  shared.tsx, layout/    cross-page building blocks
  ui/                    generated shadcn/ui primitives — do not hand-edit
store/
  useStore.ts            composition root: create()(persist(...)) over the slices
  appState.ts            AppState / AppSettings interfaces + defaultSettings
  slices/                one file per domain: marketIntelligence, portfolio,
                         contacts, media, news, dealRadar, dealSourcing, settings
models/          domain types, one file per domain, re-exported by the barrel
                 types.ts (import everything from '../models/types')
services/        API-calling "agents": marketResearchAgent, newsAgent, dealRadarAgent
utils/           pure logic & helpers: kpiEngine, propertyCashFlowModel,
                 marketIntelligence (reconcile/validate/history/seeds),
                 screening (adapter), valueAddScreening, exportUtils
data/            seed/mock data. mockData.ts is a barrel over mock/* (one file
                 per domain: assets, deals, developments, sales, contacts, …).
                 marketIntelData.ts holds the MI seed + derived exports; its
                 builder functions live in marketIntelFactories.ts. dealSourcingData
i18n/            LanguageContext + translations
lib/             api client, supabase, dev auth, cn() util
hooks/           small React hooks
```

Shared workspace packages live at the repo root under `lib/` — notably
`@workspace/screening` (the framework-agnostic Deal-Sourcing engine) and
`@workspace/api-client-react` (generated API hooks).

## State: the store

`useStore` is one Zustand store assembled from domain **slices**. Each slice is a
`(set, get) => Pick<AppState, …>` creator in `store/slices/`. To add state or an
action: put it in the matching slice (or a new one), add its key(s) to the
`AppState` interface in `store/appState.ts`, and — if it should survive reloads —
to the `partialize` list in `store/useStore.ts`. The public API is unchanged:
components call `useStore(s => s.something)`.

## Market Intelligence (Module 06) & screening (Module 07)

- Benchmark master, reconciliation, validation, history and the screening-seed
  adapter live in `utils/marketIntelligence.ts`. Seed/mock data in
  `data/marketIntelData.ts` (built by `data/marketIntelFactories.ts`). UI in `components/market-intelligence/`, surfaced by
  the merged **Markt** page (`pages/Markt.tsx`).
- The **screening engine** (`runHardFilters`, `runTestA/B`, `screenCandidate`) is
  owned by `@workspace/screening` — the single source of truth. Its enums
  (`ScreeningMode`, `ScreeningAssetClass`, `MatchSignal`, `BenchmarkConfidence`)
  are re-exported from `models/types` so app code has one import surface. The ERV
  basis in screening always comes from Market Intelligence, never the listing rent.

## Tests & verification (the safety net)

```
pnpm --filter @workspace/realaize test     # Vitest unit tests (pure domain logic + store)
pnpm --filter @workspace/realaize typecheck
SMOKE_START_SERVER=1 pnpm --filter @workspace/realaize smoke   # loads every route, fails on render errors
```

Unit tests cover `kpiEngine`, `propertyCashFlowModel`, the screening engine,
`marketIntelligence`, `valueAddScreening` and the store actions. Run them (plus a
production build) before shipping non-trivial changes.

## Conventions

- Import shared types from `@/models/types` (the barrel), not the domain files.
- Use the `@/` alias for all intra-`src` imports (no `./` / `../`) so files move freely.
- Keep pure logic in `utils/`, side-effecting/API code in `services/`.
- Don't edit `components/ui/*` (generated). Don't put multiple pages in one file.
- `noUnusedLocals` is on: the typecheck fails on unused imports/vars, so it doubles
  as the linter — keep imports tight.
