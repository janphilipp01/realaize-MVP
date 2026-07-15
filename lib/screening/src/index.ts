// =============================================================================
// @workspace/screening — Deal Sourcing & Screening engine (Module 07)
// =============================================================================
// Pure, framework-agnostic screening logic shared by the backend batch matcher
// (artifacts/api-server) and the frontend live read-out (artifacts/realaize).
//
// Two market-anchored tests decide whether a candidate enters the Deal Radar:
//   Test A · €/m²  · Vergleichswert-Methode  (asking €/m² vs. submarket price)
//   Test B · Faktor · Ertragswert-Methode    (implied multiplier / gross yield)
//
// Every benchmark input comes from Market Intelligence; every threshold comes
// from the active acquisition profile. No assumption is hardcoded here.
// See concept: realaize · Deal Sourcing & Screening Pipeline · §05.
// =============================================================================

export type ScreeningMode = "discount_to_market" | "absolute_yield_threshold";
export type ScreeningAssetClass =
  | "residential"
  | "mixed_use"
  | "office"
  | "retail"
  | "logistics";
export type MatchSignal = "green" | "amber" | "none";
export type BenchmarkConfidence = "submarket" | "city_fallback";

/** The four required, screening-grade fields extracted from a listing. */
export interface ScreeningCandidate {
  city: string;
  submarket?: string | null;
  assetClass: ScreeningAssetClass;
  askingPrice: number; // € net
  areaSqm: number; // total m²
}

/** Editable mandate thresholds (acquisition_profiles). */
export interface ScreeningProfile {
  id: string;
  name: string;
  screeningMode: ScreeningMode;
  cities: string[];
  submarkets?: string[]; // optional whitelist within cities
  assetClasses: ScreeningAssetClass[];
  priceMin: number;
  priceMax: number;
  areaMin: number;
  areaMax: number;
  minDiscountPricePct: number; // Test A threshold (floor 0 in core+)
  minDiscountFactorPct?: number | null; // Test B threshold · value-add
  minGrossYieldPct?: number | null; // Test B threshold · core+
}

/** Reconciled benchmark inputs for the candidate's submarket × asset class. */
export interface ScreeningBenchmark {
  pricePerSqm: number; // €/m² transaction Vergleichswert
  rentPerSqmMonth: number; // Kaltmiete €/m²/month (ERV basis — never listing rent)
  factorMedian: number; // transaction multiplier on annual gross rent
  asOf: string; // quarter label, e.g. "2026-Q2"
  confidence: BenchmarkConfidence;
}

export interface HardFilterResult {
  cityOk: boolean;
  assetOk: boolean;
  priceOk: boolean;
  areaOk: boolean;
  passed: boolean;
}

export interface ScreeningResult {
  profileId: string;
  passedHardFilters: boolean;
  hardFilters: HardFilterResult;
  // Test A
  askingPricePerSqm: number;
  benchmarkPricePerSqm: number;
  discountPricePct: number;
  passA: boolean;
  // Test B
  annualErv: number;
  impliedFactor: number;
  impliedGrossYield: number; // percent
  benchmarkFactor: number;
  discountFactorPct: number;
  passB: boolean;
  // Outcome
  signal: MatchSignal;
  benchmarkAsOf: string;
  benchmarkConfidence: BenchmarkConfidence;
}

const round = (n: number, dp = 2): number => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

/**
 * Screening uplift on the market average rent (Durchschnittsmiete) per location.
 * §05 · Test B always screens against +20 % of the submarket/city average rent —
 * the ERV basis reflects achievable post-reletting rent, not today's average.
 */
export const SCREENING_RENT_UPLIFT_PCT = 20;
const rentUpliftFactor = 1 + SCREENING_RENT_UPLIFT_PCT / 100;

/** §05 · Pre-screening hard filters. Any failure ends evaluation for the profile. */
export function runHardFilters(
  candidate: ScreeningCandidate,
  profile: ScreeningProfile,
): HardFilterResult {
  const cityListed = profile.cities.includes(candidate.city);
  const submarketOk =
    !profile.submarkets ||
    profile.submarkets.length === 0 ||
    (candidate.submarket != null && profile.submarkets.includes(candidate.submarket));
  const cityOk = cityListed && submarketOk;
  const assetOk = profile.assetClasses.includes(candidate.assetClass);
  const priceOk =
    candidate.askingPrice >= profile.priceMin && candidate.askingPrice <= profile.priceMax;
  const areaOk = candidate.areaSqm >= profile.areaMin && candidate.areaSqm <= profile.areaMax;
  return {
    cityOk,
    assetOk,
    priceOk,
    areaOk,
    passed: cityOk && assetOk && priceOk && areaOk,
  };
}

/** §05 · Test A · €/m² vs. submarket transaction benchmark. */
export function runTestA(
  candidate: ScreeningCandidate,
  profile: ScreeningProfile,
  bench: ScreeningBenchmark,
) {
  const askingPricePerSqm = candidate.askingPrice / candidate.areaSqm;
  const discountPricePct =
    ((bench.pricePerSqm - askingPricePerSqm) / bench.pricePerSqm) * 100;
  // Both modes test the same direction; the floor differs (10 % vs 0 %),
  // which is encoded in profile.minDiscountPricePct.
  const passA = discountPricePct >= profile.minDiscountPricePct;
  return {
    askingPricePerSqm: round(askingPricePerSqm),
    discountPricePct: round(discountPricePct),
    passA,
  };
}

/** §05 · Test B · implied multiplier / gross yield vs. submarket factor benchmark. */
export function runTestB(
  candidate: ScreeningCandidate,
  profile: ScreeningProfile,
  bench: ScreeningBenchmark,
) {
  // Market rent from MI is the ERV basis — never the listing's stated rent.
  // Always screen against the location average rent + SCREENING_RENT_UPLIFT_PCT.
  const upliftedRentPerSqmMonth = bench.rentPerSqmMonth * rentUpliftFactor;
  const annualErv = upliftedRentPerSqmMonth * candidate.areaSqm * 12;
  const impliedFactor = candidate.askingPrice / annualErv;
  const impliedGrossYield = (1 / impliedFactor) * 100;
  const discountFactorPct =
    ((bench.factorMedian - impliedFactor) / bench.factorMedian) * 100;

  let passB: boolean;
  if (profile.screeningMode === "discount_to_market") {
    passB = discountFactorPct >= (profile.minDiscountFactorPct ?? 0);
  } else {
    passB = impliedGrossYield >= (profile.minGrossYieldPct ?? 0);
  }

  return {
    annualErv: round(annualErv),
    impliedFactor: round(impliedFactor),
    impliedGrossYield: round(impliedGrossYield),
    discountFactorPct: round(discountFactorPct),
    passB,
  };
}

/** Map test outcomes to a Radar signal. */
export function signalFor(passA: boolean, passB: boolean): MatchSignal {
  if (passA && passB) return "green";
  if (passA || passB) return "amber";
  return "none";
}

/**
 * Screen one candidate against one profile using one reconciled benchmark.
 * Returns the full computed read-out. `signal === "none"` (or failed hard
 * filters) means the candidate is unmatched for this profile and stays hidden
 * from the Radar — but is still persisted for sourcing-performance audit.
 */
export function screenCandidate(
  candidate: ScreeningCandidate,
  profile: ScreeningProfile,
  bench: ScreeningBenchmark,
): ScreeningResult {
  const hardFilters = runHardFilters(candidate, profile);
  const a = runTestA(candidate, profile, bench);
  const b = runTestB(candidate, profile, bench);

  const passA = hardFilters.passed && a.passA;
  const passB = hardFilters.passed && b.passB;
  const signal = hardFilters.passed ? signalFor(passA, passB) : "none";

  return {
    profileId: profile.id,
    passedHardFilters: hardFilters.passed,
    hardFilters,
    askingPricePerSqm: a.askingPricePerSqm,
    benchmarkPricePerSqm: round(bench.pricePerSqm),
    discountPricePct: a.discountPricePct,
    passA,
    annualErv: b.annualErv,
    impliedFactor: b.impliedFactor,
    impliedGrossYield: b.impliedGrossYield,
    benchmarkFactor: round(bench.factorMedian),
    discountFactorPct: b.discountFactorPct,
    passB,
    signal,
    benchmarkAsOf: bench.asOf,
    benchmarkConfidence: bench.confidence,
  };
}

/** Screen against all active profiles; returns one result per profile that matched (green/amber). */
export function screenAll(
  candidate: ScreeningCandidate,
  profiles: ScreeningProfile[],
  benchFor: (candidate: ScreeningCandidate) => ScreeningBenchmark | null,
): ScreeningResult[] {
  const bench = benchFor(candidate);
  if (!bench) return [];
  return profiles
    .map((p) => screenCandidate(candidate, p, bench))
    .filter((r) => r.signal !== "none");
}
