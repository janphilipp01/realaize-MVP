import type { Asset, PropertyData, RentRollUnit, GewerkePosition, AcquisitionCostItem, FinancingTranche, SaleObject } from '../models/types';
import { computeAssetNOI } from './kpiEngine';
import { calculateIRR, calculateNPV } from './irrCalculator';

// ══════════════════════════════════════════════════════════
// PROPERTY CASHFLOW MODEL — annual DCF over holding period
// ══════════════════════════════════════════════════════════

export interface AnnualPropertyCashFlow {
  year: number;
  grossRent: number;
  vacancyLoss: number;
  effectiveGrossIncome: number;
  managementCost: number;
  maintenanceReserve: number;
  nonRecoverableOpex: number;
  noi: number;
  debtService: number;
  leveredCashFlow: number;
  cumulative: number;
}

export interface PropertyCashFlowResult {
  annualRows: AnnualPropertyCashFlow[];
  terminalValue: number;
  exitCapRate: number;
  holdingPeriodYears: number;
  totalEquityInvested: number;
  unleveredIRR: number;     // IRR on total asset cost (NOI + terminal)
  leveredIRR: number;       // IRR on equity (levered CF + terminal - debt repaid)
  unleveredNPV: number;     // NPV at hurdle rate
  equityMultiple: number;
  totalNOI: number;
  totalDebtService: number;
}

interface ComputeOptions {
  holdingPeriodYears?: number;
  exitCapRate?: number;        // % — if 0 uses asset field or default
  hurdleRate?: number;         // % for NPV, default 8
  annualDebtService?: number;  // annual total debt service (interest + amort)
  equityInvested?: number;     // equity (purchase price + costs - loan)
}

export function computePropertyCashFlow(
  asset: Asset,
  opts: ComputeOptions = {}
): PropertyCashFlowResult {
  const holdingPeriodYears = opts.holdingPeriodYears ?? asset.holdingPeriodYears ?? 10;
  const exitCap = (opts.exitCapRate && opts.exitCapRate > 0)
    ? opts.exitCapRate
    : (asset.exitCapRate ?? 5.0);
  const hurdleRate = opts.hurdleRate ?? 8.0;
  const annualDebtService = opts.annualDebtService ?? 0;

  // Derive equity
  const totalDebt = asset.debtInstruments.reduce((s, d) => s + d.outstandingAmount, 0);
  const equityInvested = opts.equityInvested ?? (asset.currentValue - totalDebt);

  // Growth rates
  const rentGrowth = (asset.operatingCosts.rentalGrowthRate ?? 2.0) / 100;
  const ervGrowth = rentGrowth; // simplification — can extend

  // Year-1 base from asset NOI
  const baseNOI = computeAssetNOI(asset);

  const annualRows: AnnualPropertyCashFlow[] = [];
  const unleveredFlows: number[] = [];
  const leveredFlows: number[] = [];

  let cumulative = 0;

  for (let year = 1; year <= holdingPeriodYears; year++) {
    const g = Math.pow(1 + rentGrowth, year - 1);
    const grossRent = baseNOI.grossRent * g;
    const vacancyLoss = grossRent * (asset.operatingCosts.vacancyRatePercent / 100);
    const effectiveGrossIncome = grossRent - vacancyLoss + baseNOI.noi - (baseNOI.effectiveGrossIncome - baseNOI.totalOperatingExpenses);
    // Recompute properly:
    const mgmtCost = grossRent * (asset.operatingCosts.managementCostPercent / 100);
    const maintenance = asset.operatingCosts.maintenanceReservePerSqm * asset.lettableArea;
    const nonRecOpex = asset.operatingCosts.nonRecoverableOpex;
    const otherIncome = asset.operatingCosts.otherOperatingIncome ?? 0;
    const egi = grossRent - vacancyLoss + otherIncome;
    const noi = egi - mgmtCost - maintenance - nonRecOpex;
    const leveredCF = noi - annualDebtService;

    cumulative += leveredCF;

    annualRows.push({
      year,
      grossRent,
      vacancyLoss,
      effectiveGrossIncome: egi,
      managementCost: mgmtCost,
      maintenanceReserve: maintenance,
      nonRecoverableOpex: nonRecOpex,
      noi,
      debtService: annualDebtService,
      leveredCashFlow: leveredCF,
      cumulative,
    });

    unleveredFlows.push(noi);
    leveredFlows.push(leveredCF);
  }

  // Terminal value at exit cap rate based on last-year NOI
  const lastYearNOI = annualRows[holdingPeriodYears - 1].noi;
  const terminalValue = exitCap > 0 ? (lastYearNOI / (exitCap / 100)) : 0;

  // Total equity returned = levered CFs + terminal value - remaining debt at exit
  const remainingDebt = totalDebt * Math.pow(1 - (asset.debtInstruments[0]?.amortizationRate ?? 2) / 100, holdingPeriodYears);
  const equityAtExit = terminalValue - remainingDebt;

  // IRR calculations
  const unleveredWithTerminal = [...unleveredFlows];
  unleveredWithTerminal[unleveredWithTerminal.length - 1] += terminalValue;

  const leveredWithTerminal = [...leveredFlows];
  leveredWithTerminal[leveredWithTerminal.length - 1] += equityAtExit;

  const investmentBase = asset.purchasePrice;
  const unleveredIRR = unleveredFlows.length > 0
    ? calculateIRR(unleveredWithTerminal, investmentBase)
    : 0;

  const leveredIRR = leveredFlows.length > 0 && equityInvested > 0
    ? calculateIRR(leveredWithTerminal, equityInvested)
    : 0;

  const unleveredNPV = calculateNPV(unleveredWithTerminal, hurdleRate);

  const totalNOI = annualRows.reduce((s, r) => s + r.noi, 0);
  const totalDebtService = annualDebtService * holdingPeriodYears;

  const totalReturns = totalNOI + terminalValue;
  const equityMultiple = equityInvested > 0 ? (equityInvested + totalNOI - totalDebtService + equityAtExit) / equityInvested : 0;

  return {
    annualRows,
    terminalValue,
    exitCapRate: exitCap,
    holdingPeriodYears,
    totalEquityInvested: equityInvested,
    unleveredIRR,
    leveredIRR,
    unleveredNPV,
    equityMultiple,
    totalNOI,
    totalDebtService,
  };
}

// ══════════════════════════════════════════════════════════
// DEAL-LEVEL CASHFLOW (from underwriting, pre-acquisition)
// ══════════════════════════════════════════════════════════

import type { UnderwritingAssumptions, FinancingAssumptions } from '../models/types';
import { computeDealKPIs } from './kpiEngine';

export interface DealAnnualCashFlow {
  year: number;
  grossRent: number;
  vacancyLoss: number;
  egi: number;
  noi: number;
  annualDebtService: number;
  leveredCashFlow: number;
  cumulative: number;
}

export interface DealCashFlowResult {
  annualRows: DealAnnualCashFlow[];
  terminalValue: number;
  exitCapRate: number;
  holdingPeriodYears: number;
  equityInvested: number;
  unleveredIRR: number;
  leveredIRR: number;
  equityMultiple: number;
}

export function computeDealCashFlow(
  uw: UnderwritingAssumptions,
  fin: FinancingAssumptions
): DealCashFlowResult {
  const kpis = computeDealKPIs(uw, fin);
  const ma = uw.marketAssumptions || { rentGrowthRate: 2, exitCapRate: 5, holdingPeriodYears: 10, ervGrowthRate: 2, rentalGrowthRate: 2 };
  const holdingPeriod = ma.holdingPeriodYears || 10;
  const exitCap = ma.exitCapRate || 5.0;
  const rentGrowthRate = (ma.rentalGrowthRate || 2.0) / 100;

  const rows: DealAnnualCashFlow[] = [];
  const unleveredFlows: number[] = [];
  const leveredFlows: number[] = [];
  let cumulative = 0;

  for (let year = 1; year <= holdingPeriod; year++) {
    const g = Math.pow(1 + rentGrowthRate, year - 1);
    const grossRent = uw.annualGrossRent * g;
    const vacancyLoss = grossRent * (uw.vacancyRatePercent / 100);
    const egi = grossRent - vacancyLoss + uw.otherOperatingIncome;
    const mgmt = grossRent * (uw.managementCostPercent / 100);
    const maint = uw.maintenanceReservePerSqm * uw.area;
    const noi = egi - mgmt - maint - uw.nonRecoverableOpex;
    const debtService = kpis.annualDebtService;
    const levered = noi - debtService;
    cumulative += levered;

    rows.push({ year, grossRent, vacancyLoss, egi, noi, annualDebtService: debtService, leveredCashFlow: levered, cumulative });
    unleveredFlows.push(noi);
    leveredFlows.push(levered);
  }

  const lastNOI = rows[holdingPeriod - 1].noi;
  const terminalValue = exitCap > 0 ? lastNOI / (exitCap / 100) : 0;

  const unleveredWithTV = [...unleveredFlows];
  unleveredWithTV[unleveredWithTV.length - 1] += terminalValue;

  const equityAtExit = terminalValue - fin.loanAmount;
  const leveredWithTV = [...leveredFlows];
  leveredWithTV[leveredWithTV.length - 1] += equityAtExit;

  const unleveredIRR = calculateIRR(unleveredWithTV, uw.purchasePrice);
  const leveredIRR = kpis.equityInvested > 0 ? calculateIRR(leveredWithTV, kpis.equityInvested) : 0;

  const totalLevered = leveredFlows.reduce((s, f) => s + f, 0) + equityAtExit;
  const equityMultiple = kpis.equityInvested > 0 ? (kpis.equityInvested + totalLevered) / kpis.equityInvested : 0;

  return {
    annualRows: rows,
    terminalValue,
    exitCapRate: exitCap,
    holdingPeriodYears: holdingPeriod,
    equityInvested: kpis.equityInvested,
    unleveredIRR,
    leveredIRR,
    equityMultiple,
  };
}

// ══════════════════════════════════════════════════════════
// PROPERTY DATA MODEL CALCULATION ENGINE
// Full underwriting model using PropertyData
// ══════════════════════════════════════════════════════════

export function pdComputeTotalAcquisitionCosts(purchasePrice: number, costItems: AcquisitionCostItem[]): number {
  const totalPercent = costItems.filter(c => c.active).reduce((sum, c) => sum + c.percent, 0);
  return purchasePrice * totalPercent / 100;
}

export function pdComputeTotalArea(units: RentRollUnit[]): number {
  return units.reduce((sum, u) => sum + u.area, 0);
}

export function pdComputeAnnualRent(units: RentRollUnit[]): number {
  return units.reduce((sum, u) => sum + u.monthlyRent, 0) * 12;
}

export function pdComputeWeightedERV(units: RentRollUnit[]): number {
  const totalArea = pdComputeTotalArea(units);
  if (totalArea === 0) return 0;
  return units.reduce((sum, u) => sum + u.ervPerSqm * u.area, 0) / totalArea;
}

export function pdComputeWALT(units: RentRollUnit[], referenceDate: string): number {
  const ref = new Date(referenceDate);
  let weightedSum = 0;
  let totalArea = 0;
  units.forEach(u => {
    if (u.tenant && u.leaseStart && u.leaseDurationMonths > 0) {
      const leaseEnd = new Date(u.leaseStart);
      leaseEnd.setMonth(leaseEnd.getMonth() + u.leaseDurationMonths);
      const remainingYears = Math.max(0, (leaseEnd.getTime() - ref.getTime()) / (365.25 * 86400 * 1000));
      weightedSum += u.area * remainingYears;
      totalArea += u.area;
    }
  });
  return totalArea > 0 ? weightedSum / totalArea : 0;
}

/**
 * Compute the rent for a single unit at a given calendar date.
 *  - Before lease start: 0
 *  - During lease term: monthlyRent indexed annually by `opexInflationPercent * indexationPercent / 100`
 *    (only applied for completed full years since leaseStart)
 *  - After lease term:
 *      • leaseEndAction = 'Leerstand': 0
 *      • leaseEndAction = 'Neuvermietung': 1 month vacancy, then continues at the last
 *        indexed rent and keeps indexing yearly from the new start.
 * `opexInflationPercent` is the annual percent (e.g. 2.5), not a multiplier.
 */
export function pdComputeUnitRentForMonth(
  unit: RentRollUnit,
  currentDate: Date,
  opexInflationPercent: number,
): number {
  if (!unit.leaseStart || unit.monthlyRent <= 0) return 0;
  const leaseStart = new Date(unit.leaseStart);
  if (Number.isNaN(leaseStart.getTime())) return 0;
  if (currentDate < leaseStart) return 0;

  const annualIncrease = (opexInflationPercent * (unit.indexationPercent ?? 100)) / 100 / 100;
  const MS_PER_YEAR = 365.25 * 86400 * 1000;
  const MS_PER_MONTH = 30.44 * 86400 * 1000;

  const duration = unit.leaseDurationMonths ?? 0;
  const leaseEndDate = new Date(leaseStart);
  if (duration > 0) leaseEndDate.setMonth(leaseEndDate.getMonth() + duration);

  // No fixed end / open-ended lease → keep indexing forever
  if (duration <= 0) {
    const yearsSinceStart = (currentDate.getTime() - leaseStart.getTime()) / MS_PER_YEAR;
    return unit.monthlyRent * Math.pow(1 + annualIncrease, Math.floor(yearsSinceStart));
  }

  // During original lease term
  if (currentDate <= leaseEndDate) {
    const yearsSinceStart = (currentDate.getTime() - leaseStart.getTime()) / MS_PER_YEAR;
    return unit.monthlyRent * Math.pow(1 + annualIncrease, Math.floor(yearsSinceStart));
  }

  // After lease term
  if (unit.leaseEndAction === 'Leerstand') return 0;

  // Neuvermietung: 1 month vacancy, then continue at the rent reached at lease end and keep indexing
  const monthsAfterEnd = (currentDate.getTime() - leaseEndDate.getTime()) / MS_PER_MONTH;
  if (monthsAfterEnd <= 1) return 0;

  const completedYearsAtEnd = Math.floor(duration / 12);
  const rentAtLeaseEnd = unit.monthlyRent * Math.pow(1 + annualIncrease, completedYearsAtEnd);
  const yearsAfterRenewal = (monthsAfterEnd - 1) / 12;
  return rentAtLeaseEnd * Math.pow(1 + annualIncrease, Math.floor(yearsAfterRenewal));
}

export function pdComputeUnitsRentForMonth(
  units: RentRollUnit[],
  currentDate: Date,
  opexInflationPercent: number,
): number {
  return units.reduce((sum, u) => sum + pdComputeUnitRentForMonth(u, currentDate, opexInflationPercent), 0);
}

export function pdComputeTotalNonRecoverable(units: RentRollUnit[]): number {
  return units.reduce((sum, u) => sum + u.nonRecoverableOpex, 0) * 12;
}

export function pdComputeTotalDevBudget(gewerke: GewerkePosition[], contingencyPercent: number): number {
  const base = gewerke.reduce((sum, g) => sum + g.budgetTotal, 0);
  return base * (1 + contingencyPercent / 100);
}

export function pdComputeTotalCapitalRequirement(pd: PropertyData): number {
  const acqCosts = pdComputeTotalAcquisitionCosts(pd.purchasePrice, pd.acquisitionCosts);
  const devBudget = pd.dealType === 'Development'
    ? pdComputeTotalDevBudget(pd.gewerke, pd.contingencyPercent)
    : 0;
  return pd.purchasePrice + acqCosts + devBudget;
}

export function pdComputeTotalLoan(tranches: FinancingTranche[]): number {
  return tranches.reduce((sum, t) => sum + t.loanAmount, 0);
}

export function pdComputeEquity(pd: PropertyData): number {
  return pdComputeTotalCapitalRequirement(pd) - pdComputeTotalLoan(pd.financingTranches);
}

export function pdComputeAnnuity(loanAmount: number, interestRate: number, loanTerm: number): number {
  if (interestRate === 0 || loanTerm === 0) return loanTerm > 0 ? loanAmount / loanTerm : 0;
  const i = interestRate / 100;
  return loanAmount * (i * Math.pow(1 + i, loanTerm)) / (Math.pow(1 + i, loanTerm) - 1);
}

export function pdComputeInitialAmortizationRate(tranche: FinancingTranche): number {
  if (tranche.repaymentType === 'Endfällig') return 0;
  const annuity = pdComputeAnnuity(tranche.loanAmount, tranche.interestRate, tranche.loanTerm);
  const interestYear1 = tranche.loanAmount * tranche.interestRate / 100;
  const amortYear1 = annuity - interestYear1;
  return tranche.loanAmount > 0 ? (amortYear1 / tranche.loanAmount) * 100 : 0;
}

export interface UnitNOIBreakdown {
  unitId: string;
  usageType: string;
  area: number;
  annualRent: number;
  vacancyLoss: number;
  managementCost: number;
  maintenance: number;
  insuranceAllocation: number;
  propertyTaxAllocation: number;
  otherOpexAllocation: number;
  nonRecoverableOpex: number;
  otherIncomeAllocation: number;
  noi: number;
}

export function pdComputeUnitNOIs(pd: PropertyData, useTargetRents: boolean): UnitNOIBreakdown[] {
  const units = useTargetRents && pd.unitsTarget.length > 0 ? pd.unitsTarget : pd.unitsAsIs;
  const totalArea = pdComputeTotalArea(units);
  if (totalArea === 0 || units.length === 0) return [];
  const grossRentAll = pdComputeAnnualRent(units);

  return units.map(u => {
    const annualRent = u.monthlyRent * 12;
    const areaShare = totalArea > 0 ? u.area / totalArea : 0;
    const vacancyLoss = annualRent * pd.operatingCosts.vacancyRatePercent / 100;
    const mgmt = grossRentAll * pd.operatingCosts.managementCostPercent / 100 * areaShare;
    const maintenance = u.area * pd.operatingCosts.maintenanceReservePerSqm;
    const insAlloc = pd.operatingCosts.insurancePerYear * areaShare;
    const taxAlloc = pd.operatingCosts.propertyTaxPerYear * areaShare;
    const otherOpexAlloc = pd.operatingCosts.otherOpexPerYear * areaShare;
    const nonRec = u.nonRecoverableOpex * 12;
    const otherIncAlloc = pd.operatingCosts.otherIncomePerYear * areaShare;
    const noi = annualRent - vacancyLoss + otherIncAlloc
              - mgmt - maintenance - insAlloc - taxAlloc - otherOpexAlloc - nonRec;
    return {
      unitId: u.id, usageType: u.usageType, area: u.area,
      annualRent, vacancyLoss, managementCost: mgmt, maintenance,
      insuranceAllocation: insAlloc, propertyTaxAllocation: taxAlloc,
      otherOpexAllocation: otherOpexAlloc, nonRecoverableOpex: nonRec,
      otherIncomeAllocation: otherIncAlloc, noi,
    };
  });
}

export function pdComputePropertyNOI(pd: PropertyData, useTargetRents: boolean): number {
  return pdComputeUnitNOIs(pd, useTargetRents).reduce((sum, u) => sum + u.noi, 0);
}

export function pdComputeExitValue(
  pd: PropertyData,
  exitYearIndex: number,
  devCompletionYearIndex: number
): number {
  const useTarget = pd.unitsTarget.length > 0;
  const unitNOIs = pdComputeUnitNOIs(pd, useTarget);
  const units = useTarget ? pd.unitsTarget : pd.unitsAsIs;
  let totalExitValue = 0;

  unitNOIs.forEach(unitNOI => {
    const unit = units.find(u => u.id === unitNOI.unitId);
    if (!unit) return;
    const marketAssumption = pd.marketAssumptions.perUsageType.find(m => m.usageType === unit.usageType);
    const ervGrowth = marketAssumption?.ervGrowthRatePercent ?? 2.0;
    const exitCap = marketAssumption?.exitCapRatePercent ?? 5.0;
    const opexInflation = pd.marketAssumptions.opexInflationPercent;
    const yearsOfGrowth = Math.max(0, exitYearIndex - devCompletionYearIndex);
    const futureRent = unitNOI.annualRent * Math.pow(1 + ervGrowth / 100, yearsOfGrowth);
    const opexRatio = unitNOI.annualRent > 0
      ? (unitNOI.annualRent - unitNOI.noi - unitNOI.otherIncomeAllocation) / unitNOI.annualRent
      : 0.25;
    const futureOpex = (futureRent * opexRatio) * Math.pow(1 + opexInflation / 100, yearsOfGrowth) / Math.pow(1 + ervGrowth / 100, yearsOfGrowth);
    const futureNOI = futureRent - futureOpex;
    const teilwert = exitCap > 0 ? futureNOI / (exitCap / 100) : 0;
    totalExitValue += teilwert;
  });

  return totalExitValue;
}

export interface PropertyCashFlowMonth {
  monthIndex: number;
  calendarDate: string;
  grossRentalIncome: number;
  operatingCosts: number;
  capexConstructionCosts: number;
  noi: number;
  acquisitionPrice: number;
  acquisitionCosts: number;
  salesProceeds: number;
  salesCosts: number;
  transactionsCashflow: number;
  loanReceived: number;
  interestPayments: number;
  loanRepayments: number;
  debtCashflow: number;
  freeCashflow: number;
  cumulativeFreeCashflow: number;
}

export interface PropertyCashFlowYear {
  yearIndex: number;
  label: string;
  grossRentalIncome: number;
  operatingCosts: number;
  capexConstructionCosts: number;
  noi: number;
  acquisitionPrice: number;
  acquisitionCosts: number;
  salesProceeds: number;
  salesCosts: number;
  transactionsCashflow: number;
  loanReceived: number;
  interestPayments: number;
  loanRepayments: number;
  debtCashflow: number;
  freeCashflow: number;
  cumulativeFreeCashflow: number;
}

export function pdComputePropertyCashFlowMonthly(pd: PropertyData, sale?: SaleObject): PropertyCashFlowMonth[] {
  const months: PropertyCashFlowMonth[] = [];
  const holdingYears = pd.holdingPeriodYears || 10;
  const acqDate = new Date(pd.acquisitionDate || new Date().toISOString());
  let exitDate = new Date(acqDate);
  exitDate.setFullYear(exitDate.getFullYear() + holdingYears);
  if (sale?.soldAt) exitDate = new Date(sale.soldAt);

  const totalMonths = Math.max(1, Math.round((exitDate.getTime() - acqDate.getTime()) / (30.44 * 86400 * 1000)));
  const isDev = pd.dealType === 'Development';
  const devStartDate = isDev && pd.projectStart ? new Date(pd.projectStart) : acqDate;
  const lastGewerkEndWeek = pd.gewerke.length > 0
    ? Math.max(...pd.gewerke.map(g => g.startWeek + g.durationWeeks - 1))
    : 0;
  const devEndDate = new Date(devStartDate);
  devEndDate.setDate(devEndDate.getDate() + lastGewerkEndWeek * 7);
  const devCompletionMonth = isDev
    ? Math.max(0, Math.round((devEndDate.getTime() - acqDate.getTime()) / (30.44 * 86400 * 1000)))
    : 0;

  const capexPerMonth = new Array(totalMonths + 2).fill(0);
  if (isDev) {
    pd.gewerke.forEach(g => {
      const gStartDate = new Date(devStartDate);
      gStartDate.setDate(gStartDate.getDate() + (g.startWeek - 1) * 7);
      const gEndDate = new Date(gStartDate);
      gEndDate.setDate(gEndDate.getDate() + g.durationWeeks * 7);
      const gStartMonth = Math.round((gStartDate.getTime() - acqDate.getTime()) / (30.44 * 86400 * 1000));
      const gEndMonth = Math.round((gEndDate.getTime() - acqDate.getTime()) / (30.44 * 86400 * 1000));
      const gDurationMonths = Math.max(1, gEndMonth - gStartMonth);
      switch (g.costDistribution) {
        case 'vorauszahlung':
          if (gStartMonth >= 0 && gStartMonth < capexPerMonth.length) capexPerMonth[gStartMonth] += g.budgetTotal;
          break;
        case 'endfällig': {
          const endIdx = Math.min(gEndMonth - 1, capexPerMonth.length - 1);
          if (endIdx >= 0) capexPerMonth[endIdx] += g.budgetTotal;
          break;
        }
        case '30-40-30': {
          const firstIdx = gStartMonth;
          const midIdx = gStartMonth + Math.floor(gDurationMonths / 2);
          const lastIdx = Math.min(gEndMonth - 1, capexPerMonth.length - 1);
          if (firstIdx >= 0 && firstIdx < capexPerMonth.length) capexPerMonth[firstIdx] += g.budgetTotal * 0.30;
          if (midIdx >= 0 && midIdx < capexPerMonth.length) capexPerMonth[midIdx] += g.budgetTotal * 0.40;
          if (lastIdx >= 0 && lastIdx < capexPerMonth.length) capexPerMonth[lastIdx] += g.budgetTotal * 0.30;
          break;
        }
        default: {
          const perMonth = g.budgetTotal / gDurationMonths;
          for (let m = gStartMonth; m < gEndMonth && m < capexPerMonth.length; m++) {
            if (m >= 0) capexPerMonth[m] += perMonth;
          }
        }
      }
    });
    const contMultiplier = 1 + pd.contingencyPercent / 100;
    for (let i = 0; i < capexPerMonth.length; i++) {
      capexPerMonth[i] *= contMultiplier;
      const yearsFromAcq = i / 12;
      capexPerMonth[i] *= Math.pow(1 + pd.marketAssumptions.capexInflationPercent / 100, yearsFromAcq);
    }
  }

  const totalAcqCosts = pdComputeTotalAcquisitionCosts(pd.purchasePrice, pd.acquisitionCosts);
  const exitValue = sale?.soldPrice
    ? sale.soldPrice
    : pdComputeExitValue(pd, totalMonths / 12, devCompletionMonth / 12);
  const salesCostAmount = exitValue * pd.marketAssumptions.salesCostPercent / 100;

  const trancheState = pd.financingTranches.map(t => ({
    ...t,
    outstanding: t.loanAmount,
    annuityAnnual: t.repaymentType === 'Annuität'
      ? pdComputeAnnuity(t.loanAmount, t.interestRate, t.loanTerm)
      : 0,
  }));

  let cumulativeCF = 0;
  const useTarget = pd.unitsTarget.length > 0;
  const activeUnits = useTarget ? pd.unitsTarget : pd.unitsAsIs;

  for (let m = 0; m < totalMonths; m++) {
    const calDate = new Date(acqDate);
    calDate.setMonth(calDate.getMonth() + m);
    const calYMD = `${calDate.getFullYear()}-${String(calDate.getMonth() + 1).padStart(2, '0')}`;

    const isDevPeriod = isDev && m < devCompletionMonth;
    const rentalFraction = isDev
      ? (m < devCompletionMonth ? 0 : 1)
      : 1;
    const yearsElapsed = m / 12;

    // Per-unit rent: each unit indexes from its own leaseStart using its own indexationPercent
    // applied to the property's opex inflation rate. Handles lease end + Neuvermietung/Leerstand.
    const grossRent = rentalFraction * pdComputeUnitsRentForMonth(
      activeUnits,
      calDate,
      pd.marketAssumptions.opexInflationPercent,
    );
    const vacancyLoss = grossRent * pd.operatingCosts.vacancyRatePercent / 100;
    const otherIncome = pd.operatingCosts.otherIncomePerYear / 12;
    const egi = grossRent - vacancyLoss + otherIncome;
    const opexInflation = Math.pow(1 + pd.marketAssumptions.opexInflationPercent / 100, yearsElapsed);
    const totalAreaPd = pdComputeTotalArea(useTarget ? pd.unitsTarget : pd.unitsAsIs);
    const mgmt = grossRent * pd.operatingCosts.managementCostPercent / 100;
    const maint = totalAreaPd * pd.operatingCosts.maintenanceReservePerSqm / 12 * opexInflation;
    const insurance = pd.operatingCosts.insurancePerYear / 12 * opexInflation;
    const propTax = pd.operatingCosts.propertyTaxPerYear / 12 * opexInflation;
    const otherOpex = pd.operatingCosts.otherOpexPerYear / 12 * opexInflation;
    const nonRec = pdComputeTotalNonRecoverable(useTarget ? pd.unitsTarget : pd.unitsAsIs) / 12;
    const totalOpex = mgmt + maint + insurance + propTax + otherOpex + nonRec;
    const noi = isDevPeriod ? 0 : egi - totalOpex;

    const acqPrice = m === 0 ? -pd.purchasePrice : 0;
    const acqCosts = m === 0 ? -totalAcqCosts : 0;
    const saleProceeds = m === totalMonths - 1 ? exitValue : 0;
    const saleCosts = m === totalMonths - 1 ? -salesCostAmount : 0;
    const transactionsCF = acqPrice + acqCosts + saleProceeds + saleCosts;

    let loanReceived = 0;
    let interestPayment = 0;
    let loanRepayment = 0;

    for (const t of trancheState) {
      const disbMonth = t.disbursementDate
        ? Math.round((new Date(t.disbursementDate).getTime() - acqDate.getTime()) / (30.44 * 86400 * 1000))
        : 0;
      if (m === disbMonth && t.outstanding > 0 && m === disbMonth) {
        loanReceived += t.loanAmount;
      }
      if (t.outstanding > 0 && m >= disbMonth) {
        const monthlyInterest = t.outstanding * t.interestRate / 100 / 12;
        interestPayment += monthlyInterest;
        if (t.repaymentType === 'Annuität') {
          const monthlyAmort = t.annuityAnnual / 12 - monthlyInterest;
          const actualAmort = Math.min(monthlyAmort, t.outstanding);
          loanRepayment += actualAmort;
          t.outstanding = Math.max(0, t.outstanding - actualAmort);
        } else if (m === totalMonths - 1) {
          loanRepayment += t.outstanding;
          t.outstanding = 0;
        }
      }
    }

    const debtCF = loanReceived - interestPayment - loanRepayment;
    const capex = capexPerMonth[m] || 0;
    const freeCF = noi - capex + transactionsCF + debtCF;
    cumulativeCF += freeCF;

    months.push({
      monthIndex: m,
      calendarDate: calYMD,
      grossRentalIncome: grossRent,
      operatingCosts: totalOpex,
      capexConstructionCosts: capex,
      noi,
      acquisitionPrice: -acqPrice,
      acquisitionCosts: -acqCosts,
      salesProceeds: saleProceeds,
      salesCosts: -saleCosts,
      transactionsCashflow: transactionsCF,
      loanReceived,
      interestPayments: -interestPayment,
      loanRepayments: -loanRepayment,
      debtCashflow: debtCF,
      freeCashflow: freeCF,
      cumulativeFreeCashflow: cumulativeCF,
    });
  }

  return months;
}

export function pdAggregateToYears(months: PropertyCashFlowMonth[]): PropertyCashFlowYear[] {
  const yearMap = new Map<number, PropertyCashFlowYear>();
  for (const m of months) {
    const yearIndex = Math.floor(m.monthIndex / 12);
    if (!yearMap.has(yearIndex)) {
      yearMap.set(yearIndex, {
        yearIndex,
        label: `Jahr ${yearIndex + 1}`,
        grossRentalIncome: 0, operatingCosts: 0, capexConstructionCosts: 0, noi: 0,
        acquisitionPrice: 0, acquisitionCosts: 0, salesProceeds: 0, salesCosts: 0,
        transactionsCashflow: 0, loanReceived: 0, interestPayments: 0, loanRepayments: 0,
        debtCashflow: 0, freeCashflow: 0, cumulativeFreeCashflow: 0,
      });
    }
    const y = yearMap.get(yearIndex)!;
    y.grossRentalIncome += m.grossRentalIncome;
    y.operatingCosts += m.operatingCosts;
    y.capexConstructionCosts += m.capexConstructionCosts;
    y.noi += m.noi;
    y.acquisitionPrice += m.acquisitionPrice;
    y.acquisitionCosts += m.acquisitionCosts;
    y.salesProceeds += m.salesProceeds;
    y.salesCosts += m.salesCosts;
    y.transactionsCashflow += m.transactionsCashflow;
    y.loanReceived += m.loanReceived;
    y.interestPayments += m.interestPayments;
    y.loanRepayments += m.loanRepayments;
    y.debtCashflow += m.debtCashflow;
    y.freeCashflow += m.freeCashflow;
    y.cumulativeFreeCashflow = m.cumulativeFreeCashflow;
  }
  return Array.from(yearMap.values()).sort((a, b) => a.yearIndex - b.yearIndex);
}

export interface PropertyKPIs {
  niyAtAcquisition: number;
  multiple: number;
  dscr: number;
  ltv: number;
  cashOnCashYear1: number;
  gri: number;
  noiIst: number;
  noiZiel: number;
  irr10Year: number;
  equityMultiple10Year: number;
  irrDevelopment: number;
  developmentProfit: number;
  profitOnCost: number;
  netDevelopmentYield: number;
  cashOnCash10YearAvg: number;
  peakEquity: number;
  paybackPeriodYears: number;
}

function computeHoldIRR(pd: PropertyData, months: PropertyCashFlowMonth[]): number {
  const equity = pdComputeEquity(pd);
  if (equity <= 0) return 0;
  const years = pdAggregateToYears(months);
  const flows: number[] = years.map(y => y.freeCashflow);
  if (flows.length === 0) return 0;
  return calculateIRR(flows, equity);
}

function computeDevIRR(pd: PropertyData, months: PropertyCashFlowMonth[]): number {
  if (pd.dealType !== 'Development' || pd.gewerke.length === 0) return 0;
  const equity = pdComputeEquity(pd);
  if (equity <= 0) return 0;
  const devEndDate = (() => {
    const devStart = new Date(pd.projectStart);
    const lastWk = Math.max(...pd.gewerke.map(g => g.startWeek + g.durationWeeks - 1));
    const d = new Date(devStart);
    d.setDate(d.getDate() + lastWk * 7);
    return d;
  })();
  const acqDate = new Date(pd.acquisitionDate);
  const devEndMonth = Math.round((devEndDate.getTime() - acqDate.getTime()) / (30.44 * 86400 * 1000));
  const devMonths = months.slice(0, devEndMonth + 1);
  if (devMonths.length === 0) return 0;
  const flows: number[] = devMonths.map(m => m.freeCashflow);
  return calculateIRR(flows, equity);
}

export function pdComputePropertyKPIs(pd: PropertyData, sale?: SaleObject): PropertyKPIs {
  const months = pdComputePropertyCashFlowMonthly(pd, sale);
  const years = pdAggregateToYears(months);

  const noiIst = pdComputePropertyNOI(pd, false);
  const noiZiel = pd.unitsTarget.length > 0 ? pdComputePropertyNOI(pd, true) : noiIst;
  const totalAcqCosts = pdComputeTotalAcquisitionCosts(pd.purchasePrice, pd.acquisitionCosts);
  const totalDevBudget = pd.dealType === 'Development'
    ? pdComputeTotalDevBudget(pd.gewerke, pd.contingencyPercent) : 0;
  const totalCostBasis = pd.purchasePrice + totalAcqCosts + totalDevBudget;
  const totalCapReq = pdComputeTotalCapitalRequirement(pd);
  const totalLoan = pdComputeTotalLoan(pd.financingTranches);
  const equity = totalCapReq - totalLoan;

  const totalDS = pd.financingTranches.reduce((sum, t) => {
    const interest = t.loanAmount * t.interestRate / 100;
    const amort = t.repaymentType === 'Annuität'
      ? pdComputeAnnuity(t.loanAmount, t.interestRate, t.loanTerm) - interest
      : 0;
    return sum + interest + amort;
  }, 0);

  const irr10 = computeHoldIRR(pd, months);
  const irrDev = computeDevIRR(pd, months);

  const totalReturns = years.reduce((sum, y) => sum + Math.max(0, y.freeCashflow + (y.yearIndex === 0 ? equity : 0)), 0);
  const equityMultiple = equity > 0 ? totalReturns / equity : 0;

  let devProfit = 0;
  if (pd.dealType === 'Development' && pd.gewerke.length > 0) {
    const devStart = new Date(pd.projectStart);
    const lastWk = Math.max(...pd.gewerke.map(g => g.startWeek + g.durationWeeks - 1));
    const devEnd = new Date(devStart);
    devEnd.setDate(devEnd.getDate() + lastWk * 7);
    const devEndMonthIdx = Math.round((devEnd.getTime() - new Date(pd.acquisitionDate).getTime()) / (30.44 * 86400 * 1000));
    const valueAtCompletion = pdComputeExitValue(pd, devEndMonthIdx / 12, devEndMonthIdx / 12);
    const finCostsDuringDev = months.slice(0, devEndMonthIdx + 1)
      .reduce((sum, m) => sum + Math.abs(m.interestPayments), 0);
    devProfit = valueAtCompletion - pd.purchasePrice - totalAcqCosts - totalDevBudget - finCostsDuringDev;
  }

  const profitOnCost = totalCostBasis > 0 ? (devProfit / totalCostBasis) * 100 : 0;
  const netDevYield = totalCostBasis > 0 ? (noiZiel / totalCostBasis) * 100 : 0;

  const annualCoCs = years.slice(1).map(y => {
    const cashAfterDebt = y.noi + y.debtCashflow;
    return equity > 0 ? (cashAfterDebt / equity) * 100 : 0;
  });
  const avgCoC = annualCoCs.length > 0 ? annualCoCs.reduce((s, v) => s + v, 0) / annualCoCs.length : 0;

  let peakEquity = 0;
  let paybackYear = years.length;
  years.forEach(y => {
    if (y.cumulativeFreeCashflow < peakEquity) peakEquity = y.cumulativeFreeCashflow;
    if (y.cumulativeFreeCashflow > 0 && y.yearIndex < paybackYear) paybackYear = y.yearIndex;
  });

  const unitsForGRI = pd.unitsTarget.length > 0 ? pd.unitsTarget : pd.unitsAsIs;

  return {
    niyAtAcquisition: pd.purchasePrice > 0 ? (noiIst / pd.purchasePrice) * 100 : 0,
    multiple: noiIst > 0 ? pd.purchasePrice / pdComputeAnnualRent(pd.unitsAsIs) : 0,
    dscr: totalDS > 0 ? noiZiel / totalDS : 999,
    ltv: totalCapReq > 0 ? (totalLoan / totalCapReq) * 100 : 0,
    cashOnCashYear1: equity > 0 ? ((noiIst - totalDS) / equity) * 100 : 0,
    gri: pdComputeAnnualRent(unitsForGRI),
    noiIst,
    noiZiel,
    irr10Year: irr10,
    equityMultiple10Year: equityMultiple,
    irrDevelopment: irrDev,
    developmentProfit: devProfit,
    profitOnCost,
    netDevelopmentYield: netDevYield,
    cashOnCash10YearAvg: avgCoC,
    peakEquity: Math.abs(peakEquity),
    paybackPeriodYears: paybackYear,
  };
}
