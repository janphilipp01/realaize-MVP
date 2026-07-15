import { describe, it, expect } from 'vitest';
import {
  screenValueAdd,
  resolveExitYieldBuffer,
  submarketsForCity,
  EXIT_BUFFER_PRIME,
  EXIT_BUFFER_STANDARD,
  type ValueAddInput,
} from '@/utils/valueAddScreening';

// Characterization tests for the value-add screener (residual / max-bid math).

const input: ValueAddInput = {
  area: 1_000,
  purchasePrice: 3_000_000,
  marketRent: 15,
  marketNIY: 3.5,
  scope: 'sanierung',
};

describe('screenValueAdd', () => {
  it('computes NOI, exit value and the pass/fail verdict', () => {
    const r = screenValueAdd(input);
    expect(r.screeningRent).toBe(18); // 15 average rent + 20%
    expect(r.noi).toBe(194_400); // 1000 * 18 * 12 * (1 - 0.10)
    expect(r.exitNIY).toBe(4.5); // 3.5 + 1.00 default buffer
    expect(r.exitValue).toBe(4_320_000); // 194.4k / 4.5%
    expect(r.buildCost).toBe(1_000_000);
    expect(r.totalCosts).toBe(4_636_500); // cost side is rent-independent
    expect(r.pass).toBe(false); // overpriced at 3.0m
  });

  it('honours a configurable rent uplift on the ERV basis', () => {
    expect(screenValueAdd({ ...input, profile: { rentUpliftPct: 0 } }).screeningRent).toBe(15);   // no uplift
    expect(screenValueAdd({ ...input, profile: { rentUpliftPct: 0 } }).noi).toBe(162_000);        // 1000 * 15 * 12 * 0.9
    expect(screenValueAdd({ ...input, profile: { rentUpliftPct: 30 } }).screeningRent).toBe(19.5); // 15 + 30%
  });

  it('maxBid is the residual where surplus is zero (monotonic around it)', () => {
    const { maxBid } = screenValueAdd(input);
    expect(screenValueAdd({ ...input, purchasePrice: maxBid }).surplus).toBeCloseTo(0, 2);
    expect(screenValueAdd({ ...input, purchasePrice: maxBid * 0.98 }).pass).toBe(true);
    expect(screenValueAdd({ ...input, purchasePrice: maxBid * 1.02 }).pass).toBe(false);
  });
});

describe('resolveExitYieldBuffer', () => {
  it('uses the tighter prime buffer only for prime Düsseldorf submarkets', () => {
    expect(resolveExitYieldBuffer('Düsseldorf', 'Oberkassel')).toBe(EXIT_BUFFER_PRIME);
    expect(resolveExitYieldBuffer('Düsseldorf', 'Neuss')).toBe(EXIT_BUFFER_STANDARD);
    expect(resolveExitYieldBuffer('Düsseldorf', undefined)).toBe(EXIT_BUFFER_STANDARD);
    expect(resolveExitYieldBuffer('Berlin', 'Mitte')).toBe(EXIT_BUFFER_STANDARD);
  });
});

describe('submarketsForCity', () => {
  const benchmarks = [
    { city: 'Köln', submarket: 'Ehrenfeld' },
    { city: 'Düsseldorf', submarket: 'Bilk' },
  ];
  it('merges benchmark submarkets with prime Düsseldorf districts, sorted', () => {
    const dus = submarketsForCity(benchmarks, 'Düsseldorf');
    expect(dus).toContain('Bilk');
    expect(dus).toContain('Oberkassel'); // injected prime district
    expect(dus).not.toContain('Ehrenfeld');
    expect([...dus]).toEqual([...dus].sort((a, b) => a.localeCompare(b, 'de')));
  });
  it('returns only benchmark submarkets for a non-Düsseldorf city', () => {
    expect(submarketsForCity(benchmarks, 'Köln')).toEqual(['Ehrenfeld']);
  });
});
