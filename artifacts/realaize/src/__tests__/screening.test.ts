import { describe, it, expect } from 'vitest';
import {
  runHardFilters,
  runTestA,
  runTestB,
  signalFor,
  screenCandidate,
  type ScreeningCandidate,
  type ScreeningProfile,
  type ScreeningBenchmark,
} from '@workspace/screening';

// Characterization tests for the shared screening engine (Module 07). These
// lock in the current behaviour so the refactor can't silently change it.

const candidate: ScreeningCandidate = {
  city: 'Düsseldorf',
  submarket: 'Pempelfort',
  assetClass: 'residential',
  askingPrice: 1_000_000,
  areaSqm: 500,
};

const profile: ScreeningProfile = {
  id: 'p1',
  name: 'Value-Add',
  screeningMode: 'discount_to_market',
  cities: ['Düsseldorf'],
  assetClasses: ['residential'],
  priceMin: 100_000,
  priceMax: 5_000_000,
  areaMin: 100,
  areaMax: 2_000,
  minDiscountPricePct: 10,
  minDiscountFactorPct: 0,
};

// asking €/m² = 2000
const bench: ScreeningBenchmark = {
  pricePerSqm: 2500,
  rentPerSqmMonth: 10,
  factorMedian: 25,
  asOf: '2026-Q1',
  confidence: 'submarket',
};

describe('runHardFilters', () => {
  it('passes when everything is in range', () => {
    expect(runHardFilters(candidate, profile).passed).toBe(true);
  });
  it('fails on city, asset class, price and area independently', () => {
    expect(runHardFilters({ ...candidate, city: 'Berlin' }, profile).cityOk).toBe(false);
    expect(runHardFilters({ ...candidate, assetClass: 'office' }, profile).assetOk).toBe(false);
    expect(runHardFilters({ ...candidate, askingPrice: 10 }, profile).priceOk).toBe(false);
    expect(runHardFilters({ ...candidate, areaSqm: 10 }, profile).areaOk).toBe(false);
  });
  it('honours a submarket whitelist', () => {
    const p = { ...profile, submarkets: ['Oberkassel'] };
    expect(runHardFilters(candidate, p).cityOk).toBe(false);
    expect(runHardFilters({ ...candidate, submarket: 'Oberkassel' }, p).cityOk).toBe(true);
  });
});

describe('runTestA (€/m² vs benchmark)', () => {
  it('computes discount and pass against the profile floor', () => {
    const a = runTestA(candidate, profile, bench);
    expect(a.askingPricePerSqm).toBe(2000);
    expect(a.discountPricePct).toBe(20); // (2500-2000)/2500
    expect(a.passA).toBe(true);
  });
});

describe('runTestB (implied factor / yield)', () => {
  it('uses MI rent +20% as the ERV basis, not the listing rent', () => {
    const b = runTestB(candidate, profile, bench);
    expect(b.annualErv).toBe(72_000); // 10 * 1.20 * 500 * 12
    expect(b.impliedFactor).toBe(13.89); // 1,000,000 / 72,000
    expect(b.impliedGrossYield).toBe(7.2); // 1/13.8889
    expect(b.discountFactorPct).toBe(44.44); // (25-13.8889)/25
    expect(b.passB).toBe(true); // discount_to_market, floor 0
  });
  it('supports absolute_yield_threshold mode', () => {
    const p = { ...profile, screeningMode: 'absolute_yield_threshold' as const, minGrossYieldPct: 5 };
    expect(runTestB(candidate, p, bench).passB).toBe(true); // 7.2 >= 5
    expect(runTestB(candidate, { ...p, minGrossYieldPct: 8 }, bench).passB).toBe(false);
  });
});

describe('signalFor', () => {
  it('maps A/B outcomes to a radar signal', () => {
    expect(signalFor(true, true)).toBe('green');
    expect(signalFor(true, false)).toBe('amber');
    expect(signalFor(false, true)).toBe('amber');
    expect(signalFor(false, false)).toBe('none');
  });
});

describe('screenCandidate (integration)', () => {
  it('returns a green match for the reference case', () => {
    const r = screenCandidate(candidate, profile, bench);
    expect(r.passedHardFilters).toBe(true);
    expect(r.passA).toBe(true);
    expect(r.passB).toBe(true);
    expect(r.signal).toBe('green');
    expect(r.benchmarkConfidence).toBe('submarket');
  });
  it('is "none" when hard filters fail, regardless of the tests', () => {
    const r = screenCandidate({ ...candidate, city: 'Berlin' }, profile, bench);
    expect(r.passedHardFilters).toBe(false);
    expect(r.signal).toBe('none');
  });
});
