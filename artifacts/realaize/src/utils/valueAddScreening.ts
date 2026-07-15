// Value-Add deal screening — deterministic pass/fail + residual (max bid).
//
// Decisions (with Jan, 2026-07):
//  1) Exit value = NOI / market NIY   (no KNK factor)
//  2) Financing  = flat % of (purchase + KNK + build)   [2b]
//  3) Contingency = % of (build + financing)             [3a, incl. financing]
//  4) Profit hurdle = % of exit value (GDV)              [4a]
//
// Market rent comes from Market Intelligence in EUR/m²/MONTH → annualized ×12.
// As in the Deal-Radar screening engine, the stabilized ERV is the location
// average rent + SCREENING_RENT_UPLIFT_PCT (+20%) — the exit value is derived
// from achievable post-reletting rent, not today's average.

import { SCREENING_RENT_UPLIFT_PCT } from '@workspace/screening';
import type { AssetClass, BenchmarkRecord, UsageType } from '@/models/types';

export type RenovationScope = 'modernisierung' | 'sanierung' | 'ausbau' | 'redevelopment';

/** Build cost €/m² per renovation scope. */
export const BUILD_COST_RATES: Record<RenovationScope, number> = {
  modernisierung: 500,
  sanierung: 1000,
  ausbau: 1500,
  redevelopment: 3000,
};

export const SCOPE_LABEL: Record<RenovationScope, { de: string; en: string }> = {
  modernisierung: { de: 'Modernisierung', en: 'Modernisation' },
  sanierung: { de: 'Sanierung', en: 'Refurbishment' },
  ausbau: { de: 'Ausbau / Neuherstellung', en: 'Fit-out / New build' },
  redevelopment: { de: 'Redevelopment', en: 'Redevelopment' },
};

/** Fixed profile assumptions — overridable per call. */
export interface ScreenProfile {
  knkPct: number;            // purchase costs, of purchase price
  nonRecoverablePct: number; // non-recoverable opex, of gross rent
  profitMarginPct: number;   // required profit, of exit value (GDV)
  contingencyPct: number;    // contingency, of (build + financing)
  financingPct: number;      // financing, of (purchase + KNK + build)
  exitYieldBufferPct: number; // added to market NIY for a conservative exit yield (bps as %)
  rentUpliftPct: number;     // % uplift on the location average rent → stabilized ERV
}

export const DEFAULT_SCREEN_PROFILE: ScreenProfile = {
  knkPct: 0.10,
  nonRecoverablePct: 0.10,
  profitMarginPct: 0.20,
  contingencyPct: 0.10,
  financingPct: 0.05,
  exitYieldBufferPct: 1.00, // standard/edge exit buffer; prime uses less (see below)
  rentUpliftPct: SCREENING_RENT_UPLIFT_PCT, // default +20% on the location average rent
};

// Prime Düsseldorf residential submarkets → tighter exit buffer (0.75%).
// Everything else (other districts, the Speckgürtel/edge suburbs, city fallback)
// takes the conservative standard buffer (1.00%).
export const EXIT_BUFFER_PRIME = 0.75;
export const EXIT_BUFFER_STANDARD = 1.00;
export const PRIME_SUBMARKETS = new Set<string>([
  'Oberkassel', 'Carlstadt', 'Altstadt', 'Pempelfort', 'Golzheim',
  'Düsseltal', 'Zooviertel', 'Stadtmitte', 'Unterbilk', 'Flingern',
]);

/** Exit-yield buffer for a location: 0.75% in prime Düsseldorf, else 1.00%. */
export function resolveExitYieldBuffer(city: string, submarket?: string): number {
  const isPrime = city === 'Düsseldorf' && !!submarket && PRIME_SUBMARKETS.has(submarket);
  return isPrime ? EXIT_BUFFER_PRIME : EXIT_BUFFER_STANDARD;
}

/** Known submarkets for a city: those present in the benchmark master, plus the
 *  prime Düsseldorf districts. Feeds the wizard's submarket combobox. */
export function submarketsForCity(
  benchmarks: { city: string; submarket?: string }[],
  city: string,
): string[] {
  const set = new Set<string>();
  for (const b of benchmarks) if (b.city === city && b.submarket) set.add(b.submarket);
  if (city === 'Düsseldorf') for (const s of PRIME_SUBMARKETS) set.add(s);
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'de'));
}

export interface ValueAddInput {
  area: number;          // m²
  purchasePrice: number; // €
  marketRent: number;    // €/m²/MONTH (from market intelligence)
  marketNIY: number;     // percent, e.g. 4.0
  scope: RenovationScope;
  profile?: Partial<ScreenProfile>;
}

export interface ValueAddResult {
  noi: number;
  marketRent: number;     // location average rent (€/m²/month), as supplied
  screeningRent: number;  // stabilized ERV = marketRent + 20% (€/m²/month)
  exitValue: number;
  buildCost: number;
  knk: number;
  financing: number;
  contingency: number;
  totalCosts: number;
  profitHurdle: number;   // profitMarginPct × exitValue
  profit: number;         // exitValue − totalCosts
  marginPct: number;      // profit / exitValue × 100
  surplus: number;        // profit − profitHurdle  (≥0 ⇒ pass)
  pass: boolean;
  maxBid: number;         // max purchase price that still meets the hurdle
  marketNIY: number;      // market entry NIY (%), as supplied
  exitNIY: number;        // conservative exit NIY used for the valuation (%)
  profile: ScreenProfile;
}

export function screenValueAdd(input: ValueAddInput): ValueAddResult {
  const p: ScreenProfile = { ...DEFAULT_SCREEN_PROFILE, ...input.profile };
  const { area, purchasePrice, marketRent, marketNIY, scope } = input;

  // Stabilized NOI (simplified: single non-recoverable haircut on gross rent).
  // ERV basis is the location average rent + the profile's rent uplift
  // (default SCREENING_RENT_UPLIFT_PCT).
  const screeningRent = marketRent * (1 + p.rentUpliftPct / 100);
  const noi = area * screeningRent * 12 * (1 - p.nonRecoverablePct);

  // Potential stabilized value (Exit = NOI / exit NIY). Decision 1a: no KNK factor.
  // Exit yield is deliberately softer than the (currently hot) market entry yield.
  const exitNIY = marketNIY + p.exitYieldBufferPct;
  const exitValue = exitNIY > 0 ? noi / (exitNIY / 100) : 0;

  const buildCost = area * BUILD_COST_RATES[scope];
  const knk = purchasePrice * p.knkPct;
  const financing = p.financingPct * (purchasePrice + knk + buildCost);       // 2b
  const contingency = p.contingencyPct * (buildCost + financing);             // 3a
  const totalCosts = purchasePrice + knk + buildCost + financing + contingency;

  const profitHurdle = p.profitMarginPct * exitValue;                         // 4a
  const profit = exitValue - totalCosts;
  const marginPct = exitValue > 0 ? (profit / exitValue) * 100 : 0;
  const surplus = profit - profitHurdle;

  return {
    noi,
    marketRent,
    screeningRent,
    exitValue,
    buildCost,
    knk,
    financing,
    contingency,
    totalCosts,
    profitHurdle,
    profit,
    marginPct,
    surplus,
    pass: surplus >= 0,
    maxBid: computeMaxBid(exitValue, buildCost, p),
    marketNIY,
    exitNIY,
    profile: p,
  };
}

/**
 * Residual max purchase price P where surplus(P) = 0.
 * All cost terms are linear in P, so this is closed-form.
 *
 *  X            = (1+k)·P + B                      (purchase + KNK + build)
 *  financing    = f·X
 *  contingency  = c·(B + f·X)
 *  totalCosts   = X·(1 + f + c·f) + c·B
 *  surplus      = E·(1 − m) − totalCosts = 0
 *  ⇒ X = [E·(1−m) − c·B] / (1 + f + c·f)
 *  ⇒ P = (X − B) / (1+k)
 */
function computeMaxBid(exitValue: number, buildCost: number, p: ScreenProfile): number {
  const { knkPct: k, financingPct: f, contingencyPct: c, profitMarginPct: m } = p;
  const denom = 1 + f + c * f;
  if (denom === 0) return 0;
  const X = (exitValue * (1 - m) - c * buildCost) / denom;
  const maxBid = (X - buildCost) / (1 + k);
  return Math.max(0, maxBid);
}

// ── Market-assumption lookup from the Market Intelligence benchmarks ──────────

const USAGE_TO_ASSET_CLASS: Record<UsageType, AssetClass> = {
  Wohnen: 'residential',
  Büro: 'office',
  Einzelhandel: 'retail',
  Logistik: 'logistics',
  'Mixed Use': 'residential',
};

export interface MarketAssumptionLookup {
  marketRent?: number;   // €/m²/month
  rentSource?: string;
  marketNIY?: number;    // percent
  yieldSource?: string;
  assetClass: AssetClass;
}

/**
 * Pull market rent (ERV) and net initial yield for a city + usage type from the
 * validated benchmark master. When a submarket is given, its records win over
 * city-level ones; otherwise city-level is preferred.
 */
export function lookupMarketAssumptions(
  benchmarks: BenchmarkRecord[],
  city: string,
  usageType: UsageType,
  submarket?: string,
): MarketAssumptionLookup {
  const assetClass = USAGE_TO_ASSET_CLASS[usageType];
  const usable = benchmarks.filter(
    b =>
      b.city === city &&
      b.assetClass === assetClass &&
      b.sourceType !== 'portfolio_realised' &&
      b.validationStatus !== 'rejected',
  );

  // Rank: exact submarket match first (when asked), then city-wide, then any.
  const rank = (b: BenchmarkRecord) =>
    submarket && b.submarket === submarket ? 0 : !b.submarket ? 1 : 2;
  const pick = (kpi: BenchmarkRecord['kpi']) =>
    usable.filter(b => b.kpi === kpi).sort((a, b) => rank(a) - rank(b))[0];

  const rent = pick('erv');
  const niy = pick('net_initial_yield');

  return {
    assetClass,
    marketRent: rent?.value,
    rentSource: rent ? `${rent.sourceProvider} · ${rent.periodQuarter}` : undefined,
    marketNIY: niy?.value,
    yieldSource: niy ? `${niy.sourceProvider} · ${niy.periodQuarter}` : undefined,
  };
}
