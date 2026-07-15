// Frontend screening read-out — wraps the shared @workspace/screening engine
// (same formula the backend batch matcher uses) and resolves benchmark inputs
// from the Market Intelligence seed. See concept §05.

import {
  screenCandidate,
  type ScreeningProfile,
  type ScreeningCandidate,
  type ScreeningBenchmark,
} from '@workspace/screening';
import type {
  AcquisitionProfile,
  CandidateDeal,
  ProfileMatch,
  ScreeningBenchmarkSeed,
  CandidateStatus,
} from '@/models/types';

function toScreeningProfile(p: AcquisitionProfile, rentUpliftPct?: number): ScreeningProfile {
  return {
    id: p.id,
    name: p.name,
    screeningMode: p.screeningMode,
    cities: p.cities,
    submarkets: p.submarkets,
    assetClasses: p.assetClasses,
    priceMin: p.priceMin,
    priceMax: p.priceMax,
    areaMin: p.areaMin,
    areaMax: p.areaMax,
    minDiscountPricePct: p.minDiscountPricePct,
    minDiscountFactorPct: p.minDiscountFactorPct,
    minGrossYieldPct: p.minGrossYieldPct,
    rentUpliftPct,
  };
}

function toScreeningCandidate(c: CandidateDeal): ScreeningCandidate {
  return {
    city: c.city,
    submarket: c.submarket,
    assetClass: c.assetClass,
    askingPrice: c.askingPrice,
    areaSqm: c.areaSqm,
  };
}

/** Resolve the benchmark for a candidate: submarket first, city fallback. */
export function lookupBenchmark(
  c: CandidateDeal,
  benchmarks: ScreeningBenchmarkSeed[],
): ScreeningBenchmark | null {
  if (c.submarket) {
    const sub = benchmarks.find(
      (b) => b.city === c.city && b.submarket === c.submarket && b.assetClass === c.assetClass,
    );
    if (sub) return toBench(sub, 'submarket');
  }
  const city = benchmarks.find(
    (b) => b.city === c.city && !b.submarket && b.assetClass === c.assetClass,
  );
  if (city) return toBench(city, 'city_fallback');
  return null;
}

function toBench(b: ScreeningBenchmarkSeed, confidence: 'submarket' | 'city_fallback'): ScreeningBenchmark {
  return {
    pricePerSqm: b.pricePerSqm,
    rentPerSqmMonth: b.rentPerSqmMonth,
    factorMedian: b.factorMedian,
    asOf: b.asOf,
    confidence,
  };
}

/** Screen one candidate against all active profiles → matched read-outs (green/amber). */
export function screenCandidateAllProfiles(
  c: CandidateDeal,
  profiles: AcquisitionProfile[],
  benchmarks: ScreeningBenchmarkSeed[],
  rentUpliftPct?: number,
): ProfileMatch[] {
  const bench = lookupBenchmark(c, benchmarks);
  if (!bench) return [];
  const sc = toScreeningCandidate(c);
  const out: ProfileMatch[] = [];
  for (const p of profiles.filter((x) => x.active)) {
    const r = screenCandidate(sc, toScreeningProfile(p, rentUpliftPct), bench);
    if (r.signal === 'none') continue;
    out.push({
      profileId: p.id,
      profileName: p.name,
      profileLabel: p.shortLabel,
      screeningMode: p.screeningMode,
      benchmarkAsOf: r.benchmarkAsOf,
      benchmarkConfidence: r.benchmarkConfidence,
      askingPricePerSqm: r.askingPricePerSqm,
      benchmarkPricePerSqm: r.benchmarkPricePerSqm,
      discountPricePct: r.discountPricePct,
      annualErv: r.annualErv,
      impliedFactor: r.impliedFactor,
      impliedGrossYield: r.impliedGrossYield,
      benchmarkFactor: r.benchmarkFactor,
      discountFactorPct: r.discountFactorPct,
      passA: r.passA,
      passB: r.passB,
      signal: r.signal,
    });
  }
  return out;
}

/** Strongest signal across a candidate's matches (drives card colours). */
export function bestSignal(matches: ProfileMatch[]): MatchSignalLite {
  if (matches.some((m) => m.signal === 'green')) return 'green';
  if (matches.some((m) => m.signal === 'amber')) return 'amber';
  return 'none';
}
export type MatchSignalLite = 'green' | 'amber' | 'none';

/** Discount-to-market colour scale for the €/m² card subtext (independent of profile threshold). */
export function discountTone(discountPct: number): 'green' | 'amber' | 'gray' {
  if (discountPct >= 7.5) return 'green';
  if (discountPct >= 2.5) return 'amber';
  return 'gray';
}

/**
 * Re-screen a set of candidates against the active profiles (the local matcher).
 * Advances auto statuses (new/matched/unmatched) but never overrides user
 * actions (shortlisted/rejected/promoted). Returns the updated candidates.
 */
export function runLocalMatcher(
  candidates: CandidateDeal[],
  profiles: AcquisitionProfile[],
  benchmarks: ScreeningBenchmarkSeed[],
  rentUpliftPct?: number,
): CandidateDeal[] {
  const now = new Date().toISOString();
  return candidates.map((c) => {
    if (c.status === 'rejected' || c.status === 'promoted' || c.status === 'inactive') return c;
    const matches = screenCandidateAllProfiles(c, profiles, benchmarks, rentUpliftPct);
    const anyMatch = matches.length > 0;
    let status: CandidateStatus = c.status;
    if (c.status === 'new' || c.status === 'matched' || c.status === 'unmatched') {
      status = anyMatch ? 'matched' : 'unmatched';
    }
    return { ...c, matches, status, lastSeenAt: now };
  });
}
