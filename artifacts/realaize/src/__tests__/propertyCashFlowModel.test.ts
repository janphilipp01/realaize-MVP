import { describe, it, expect } from 'vitest';
import {
  pdComputeTotalAcquisitionCosts,
  pdComputeTotalArea,
  pdComputeAnnualRent,
  pdComputeWeightedERV,
  pdComputeTotalDevBudget,
  pdComputeTotalLoan,
  pdComputeAnnuity,
  pdComputePropertyKPIs,
  pdComputePropertyCashFlowMonthly,
} from '@/utils/propertyCashFlowModel';
import { createDefaultPropertyData } from '@/models/types';
import type { RentRollUnit, AcquisitionCostItem, GewerkePosition, FinancingTranche } from '@/models/types';

// Characterization tests for the property cash-flow model. Exact tests on the
// pure helpers + a smoke test that the full model runs and stays finite.

const units = [
  { area: 100, monthlyRent: 1_000, ervPerSqm: 10 },
  { area: 50, monthlyRent: 500, ervPerSqm: 16 },
] as unknown as RentRollUnit[];

describe('pure helpers', () => {
  it('acquisition costs sum only active items', () => {
    const items = [
      { id: 'a', name: 'GrESt', percent: 6, active: true },
      { id: 'b', name: 'Makler', percent: 1.5, active: true },
      { id: 'c', name: 'Off', percent: 2, active: false },
    ] as AcquisitionCostItem[];
    expect(pdComputeTotalAcquisitionCosts(1_000_000, items)).toBe(75_000); // 7.5%
  });

  it('area, annual rent and weighted ERV', () => {
    expect(pdComputeTotalArea(units)).toBe(150);
    expect(pdComputeAnnualRent(units)).toBe(18_000); // (1000+500)*12
    expect(pdComputeWeightedERV(units)).toBe(12); // (100*10 + 50*16)/150
  });

  it('dev budget adds contingency; total loan sums tranches', () => {
    const gewerke = [{ budgetTotal: 100_000 }, { budgetTotal: 50_000 }] as GewerkePosition[];
    expect(pdComputeTotalDevBudget(gewerke, 10)).toBe(165_000); // 150k * 1.1
    const tranches = [{ loanAmount: 600_000 }, { loanAmount: 200_000 }] as FinancingTranche[];
    expect(pdComputeTotalLoan(tranches)).toBe(800_000);
  });

  it('annuity: standard formula and zero-interest fallback', () => {
    expect(pdComputeAnnuity(1_000_000, 5, 10)).toBeCloseTo(129_504.57, 1);
    expect(pdComputeAnnuity(1_000, 0, 10)).toBe(100); // linear when rate is 0
  });
});

describe('full model smoke test', () => {
  it('runs without throwing and returns a monthly series', () => {
    const pd = createDefaultPropertyData({ purchasePrice: 1_000_000, holdingPeriodYears: 5 });
    expect(() => pdComputePropertyKPIs(pd)).not.toThrow();
    const months = pdComputePropertyCashFlowMonthly(pd);
    expect(Array.isArray(months)).toBe(true);
    expect(months.length).toBeGreaterThan(0);
  });
});
