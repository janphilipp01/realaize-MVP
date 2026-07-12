import { describe, it, expect } from 'vitest';
import {
  computeAssetNOI,
  computeAssetLTV,
  computeDevelopmentLTV,
  computeDealKPIs,
  formatEUR,
  formatPct,
  formatX,
} from '@/utils/kpiEngine';
import type { Asset, UnderwritingAssumptions, FinancingAssumptions } from '@/models/types';

// Characterization tests for the KPI engine — the numbers driving underwriting.

const asset = {
  annualRent: 100_000,
  lettableArea: 2_000,
  currentValue: 2_000_000,
  operatingCosts: {
    vacancyRatePercent: 5,
    managementCostPercent: 3,
    maintenanceReservePerSqm: 10,
    nonRecoverableOpex: 5_000,
    otherOperatingIncome: 2_000,
    rentalGrowthRate: 2,
  },
  debtInstruments: [{ outstandingAmount: 1_200_000 }],
} as unknown as Asset;

describe('computeAssetNOI', () => {
  it('breaks gross rent down to NOI', () => {
    const b = computeAssetNOI(asset);
    expect(b.effectiveGrossIncome).toBe(97_000); // 100k - 5k vacancy + 2k other
    expect(b.totalOperatingExpenses).toBe(28_000); // 3k mgmt + 20k maint + 5k nonRec
    expect(b.noi).toBe(69_000);
    expect(b.operatingCostRatio).toBeCloseTo(28, 6);
  });
});

describe('computeAssetLTV / computeDevelopmentLTV', () => {
  it('asset LTV uses current valuation', () => {
    expect(computeAssetLTV(asset)).toBe(60); // 1.2m / 2.0m
  });
  it('development LTV uses purchase + budget', () => {
    expect(computeDevelopmentLTV(1_000_000, 500_000, 900_000)).toBe(60); // 0.9m / 1.5m
  });
});

describe('computeDealKPIs', () => {
  const uw = {
    purchasePrice: 1_000_000,
    closingCostPercent: 6.5,
    brokerFeePercent: 1.5,
    initialCapex: 0,
    annualGrossRent: 50_000,
    vacancyRatePercent: 5,
    managementCostPercent: 3,
    maintenanceReservePerSqm: 10,
    nonRecoverableOpex: 0,
    area: 1_000,
    rentPerSqm: 0,
    otherOperatingIncome: 0,
  } as UnderwritingAssumptions;
  const fin = {
    loanAmount: 600_000,
    interestRate: 3,
    amortizationRate: 2,
    loanTerm: 10,
    lenderName: 'Bank',
    fixedRatePeriod: 5,
  } as FinancingAssumptions;

  it('computes costs, yields, leverage and risk ratios', () => {
    const k = computeDealKPIs(uw, fin);
    expect(k.closingCosts).toBe(65_000);
    expect(k.brokerFee).toBe(15_000);
    expect(k.totalAcquisitionCost).toBe(1_080_000);
    expect(k.noi).toBe(36_000);
    expect(k.kaufpreisfaktor).toBe(20);
    expect(k.bruttoanfangsrendite).toBe(5);
    expect(k.netInitialYield).toBeCloseTo(3.3333, 3);
    expect(k.equityInvested).toBe(480_000);
    expect(k.annualDebtService).toBe(30_000);
    expect(k.cashOnCashReturn).toBeCloseTo(1.25, 4);
    expect(k.dscr).toBeCloseTo(1.2, 4);
    expect(k.ltv).toBe(60);
    expect(k.interestCoverageProxy).toBe(2);
    expect(k.liquidityRunway).toBeUndefined(); // positive cash flow
  });
});

describe('formatters', () => {
  it('formats compact EUR, percent and factor', () => {
    expect(formatEUR(1_500_000, true)).toBe('1.5 Mio.');
    expect(formatPct(3.333)).toBe('3.33%');
    expect(formatX(20)).toBe('20.0x');
  });
});
