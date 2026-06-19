import type { UnderwritingAssumptions, FinancingAssumptions, DealKPIs, Asset, AssetOperatingCosts } from '../models/types';

// ══════════════════════════════════════════════════════════
// ASSET-LEVEL NOI CALCULATION (real data, no hardcoded %)
// ══════════════════════════════════════════════════════════

export interface AssetNOIBreakdown {
  grossRent: number;
  vacancyLoss: number;
  effectiveGrossIncome: number; // gross rent - vacancy + other income
  managementCost: number;
  maintenanceReserve: number;
  nonRecoverableOpex: number;
  totalOperatingExpenses: number;
  noi: number;
  operatingCostRatio: number; // total opex / gross rent (percent)
}

export function computeAssetNOI(asset: Asset): AssetNOIBreakdown {
  const oc = asset.operatingCosts;
  const grossRent = asset.annualRent;
  const vacancyLoss = grossRent * (oc.vacancyRatePercent / 100);
  const managementCost = grossRent * (oc.managementCostPercent / 100);
  const maintenanceReserve = oc.maintenanceReservePerSqm * asset.lettableArea;
  const nonRecoverableOpex = oc.nonRecoverableOpex;
  const otherIncome = oc.otherOperatingIncome;

  const effectiveGrossIncome = grossRent - vacancyLoss + otherIncome;
  const totalOperatingExpenses = managementCost + maintenanceReserve + nonRecoverableOpex;
  const noi = effectiveGrossIncome - totalOperatingExpenses;
  const operatingCostRatio = grossRent > 0 ? (totalOperatingExpenses / grossRent) * 100 : 0;

  return {
    grossRent,
    vacancyLoss,
    effectiveGrossIncome,
    managementCost,
    maintenanceReserve,
    nonRecoverableOpex,
    totalOperatingExpenses,
    noi,
    operatingCostRatio,
  };
}

// Monthly inflow/outflow for an asset (for CashFlow page)
export function computeAssetMonthlyCashFlow(asset: Asset): { monthlyIncome: number; monthlyExpenses: number; monthlyNet: number } {
  const breakdown = computeAssetNOI(asset);
  // Monthly income = effective gross income (rent after vacancy + other income)
  const monthlyIncome = breakdown.effectiveGrossIncome / 12;
  // Monthly expenses = total operating expenses
  const monthlyExpenses = breakdown.totalOperatingExpenses / 12;
  const monthlyNet = monthlyIncome - monthlyExpenses;
  return { monthlyIncome, monthlyExpenses, monthlyNet };
}

// ══════════════════════════════════════════════════════════
// PORTFOLIO-LEVEL AGGREGATION
// ══════════════════════════════════════════════════════════

export function computePortfolioNOI(assets: Asset[]): number {
  return assets.reduce((sum, a) => sum + computeAssetNOI(a).noi, 0);
}

export function computePortfolioNIY(assets: Asset[]): number {
  const totalNOI = computePortfolioNOI(assets);
  const totalValue = assets.reduce((sum, a) => sum + a.currentValue, 0);
  return totalValue > 0 ? (totalNOI / totalValue) * 100 : 0;
}

// ══════════════════════════════════════════════════════════
// DEAL KPI CALCULATION (Acquisition underwriting)
// ══════════════════════════════════════════════════════════

export function computeDealKPIs(uw: UnderwritingAssumptions, fin: FinancingAssumptions): DealKPIs {
  // 1. Costs
  const closingCosts = uw.purchasePrice * (uw.closingCostPercent / 100);
  const brokerFee = uw.purchasePrice * (uw.brokerFeePercent / 100);
  const totalAcquisitionCost = uw.purchasePrice + closingCosts + brokerFee + uw.initialCapex;

  // 2. Rent metrics
  const vacancyLoss = uw.annualGrossRent * (uw.vacancyRatePercent / 100);
  const effectiveGrossRent = uw.annualGrossRent - vacancyLoss;
  const managementCost = uw.annualGrossRent * (uw.managementCostPercent / 100);
  const maintenanceReserve = uw.maintenanceReservePerSqm * uw.area;
  const noi = effectiveGrossRent + uw.otherOperatingIncome - uw.nonRecoverableOpex - managementCost - maintenanceReserve;

  // 3. Purchase metrics
  const kaufpreisfaktor = uw.annualGrossRent > 0 ? uw.purchasePrice / uw.annualGrossRent : 0;
  const bruttoanfangsrendite = uw.purchasePrice > 0 ? (uw.annualGrossRent / uw.purchasePrice) * 100 : 0;
  const netInitialYield = totalAcquisitionCost > 0 ? (noi / totalAcquisitionCost) * 100 : 0;

  // 4. Financing / equity
  const equityInvested = totalAcquisitionCost - fin.loanAmount;
  const annualInterest = fin.loanAmount * (fin.interestRate / 100);
  const annualAmortization = fin.loanAmount * (fin.amortizationRate / 100);
  const annualDebtService = annualInterest + annualAmortization;

  // 5. Returns
  const leverCashFlow = noi - annualDebtService;
  const cashOnCashReturn = equityInvested > 0 ? (leverCashFlow / equityInvested) * 100 : 0;

  // 6. Risk ratios
  const dscr = annualDebtService > 0 ? noi / annualDebtService : 999;
  // LTV for Acquisitions: loan / purchase price (not valuation)
  const ltv = uw.purchasePrice > 0 ? (fin.loanAmount / uw.purchasePrice) * 100 : 0;
  const interestCoverageProxy = annualInterest > 0 ? noi / annualInterest : 999;

  // 7. Liquidity runway (months of reserves if negative CF)
  const avgMonthlyNet = (noi - annualDebtService) / 12;
  const liquidityRunway = avgMonthlyNet < 0 ? Math.abs(equityInvested * 0.05 / avgMonthlyNet) : undefined;

  return {
    totalAcquisitionCost,
    closingCosts,
    brokerFee,
    kaufpreisfaktor,
    bruttoanfangsrendite,
    noi,
    netInitialYield,
    equityInvested,
    annualDebtService,
    cashOnCashReturn,
    dscr,
    ltv,
    interestCoverageProxy,
    liquidityRunway,
  };
}

// ══════════════════════════════════════════════════════════
// ASSET-LEVEL LTV (uses currentValue / valuation)
// ══════════════════════════════════════════════════════════

export function computeAssetLTV(asset: Asset): number {
  const totalDebt = asset.debtInstruments.reduce((s, d) => s + d.outstandingAmount, 0);
  // Bestand: LTV based on current valuation
  return asset.currentValue > 0 ? (totalDebt / asset.currentValue) * 100 : 0;
}

// ══════════════════════════════════════════════════════════
// DEVELOPMENT LTV (uses purchase price + capex)
// ══════════════════════════════════════════════════════════

export function computeDevelopmentLTV(purchasePrice: number, totalBudget: number, loanAmount: number): number {
  const totalCost = purchasePrice + totalBudget;
  return totalCost > 0 ? (loanAmount / totalCost) * 100 : 0;
}

// ══════════════════════════════════════════════════════════
// KPI FORMULA DETAILS (for info drawer)
// ══════════════════════════════════════════════════════════

export interface KPIFormulaDetail {
  label: string;
  formula: string;
  inputs: { label: string; value: string }[];
  result: string;
  interpretation: string;
  status: 'good' | 'warning' | 'danger' | 'neutral';
}

export function getKPIFormulaDetails(kpiKey: string, kpis: DealKPIs, uw: UnderwritingAssumptions, fin: FinancingAssumptions): KPIFormulaDetail {
  const fmt = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
  const fmtPct = (n: number) => `${n.toFixed(2)}%`;
  const fmtX = (n: number) => `${n.toFixed(1)}x`;

  const definitions: Record<string, KPIFormulaDetail> = {
    totalAcquisitionCost: {
      label: 'Total Acquisition Cost',
      formula: 'Purchase Price + Closing Costs + Broker Fee + Initial Capex',
      inputs: [
        { label: 'Purchase Price', value: fmt(uw.purchasePrice) },
        { label: 'Closing Costs', value: `${fmt(kpis.closingCosts)} (${uw.closingCostPercent}%)` },
        { label: 'Broker Fee', value: `${fmt(kpis.brokerFee)} (${uw.brokerFeePercent}%)` },
        { label: 'Initial Capex', value: fmt(uw.initialCapex) },
      ],
      result: fmt(kpis.totalAcquisitionCost),
      interpretation: 'Total investment cost incl. all acquisition costs. Base for NIY and CoC calculation.',
      status: 'neutral',
    },
    kaufpreisfaktor: {
      label: 'Purchase Price Multiple',
      formula: 'Purchase Price ÷ Annual Gross Rent',
      inputs: [
        { label: 'Purchase Price', value: fmt(uw.purchasePrice) },
        { label: 'Annual Gross Rent', value: fmt(uw.annualGrossRent) },
      ],
      result: fmtX(kpis.kaufpreisfaktor),
      interpretation: `${kpis.kaufpreisfaktor.toFixed(1)}x – ${kpis.kaufpreisfaktor < 18 ? 'Attractively priced' : kpis.kaufpreisfaktor < 22 ? 'Market-level' : 'Aggressively priced'}`,
      status: kpis.kaufpreisfaktor < 20 ? 'good' : kpis.kaufpreisfaktor < 24 ? 'warning' : 'danger',
    },
    bruttoanfangsrendite: {
      label: 'Gross Initial Yield',
      formula: 'Annual Gross Rent ÷ Purchase Price × 100',
      inputs: [
        { label: 'Annual Gross Rent', value: fmt(uw.annualGrossRent) },
        { label: 'Purchase Price', value: fmt(uw.purchasePrice) },
      ],
      result: fmtPct(kpis.bruttoanfangsrendite),
      interpretation: `${kpis.bruttoanfangsrendite.toFixed(2)}% gross rental yield before costs and vacancy.`,
      status: kpis.bruttoanfangsrendite > 5.5 ? 'good' : kpis.bruttoanfangsrendite > 4.0 ? 'warning' : 'danger',
    },
    noi: {
      label: 'NOI (Net Operating Income)',
      formula: 'Effective Gross Income + Other Income − Non-Recoverable Opex − Management − Maintenance Reserve',
      inputs: [
        { label: 'Annual Gross Rent', value: fmt(uw.annualGrossRent) },
        { label: '− Vacancy Loss', value: fmt(uw.annualGrossRent * uw.vacancyRatePercent / 100) },
        { label: '+ Other Operating Income', value: fmt(uw.otherOperatingIncome) },
        { label: '− Non-Recoverable Opex', value: fmt(uw.nonRecoverableOpex) },
        { label: '− Management Cost', value: fmt(uw.annualGrossRent * uw.managementCostPercent / 100) },
        { label: '− Maintenance Reserve', value: fmt(uw.maintenanceReservePerSqm * uw.area) },
      ],
      result: fmt(kpis.noi),
      interpretation: `Net operating surplus before financing. ${kpis.noi > 0 ? 'Positive.' : 'Negative – review assumptions.'}`,
      status: kpis.noi > 0 ? 'good' : 'danger',
    },
    netInitialYield: {
      label: 'Net Initial Yield (NIY)',
      formula: 'NOI ÷ Total Acquisition Cost × 100',
      inputs: [
        { label: 'NOI', value: fmt(kpis.noi) },
        { label: 'Total Acquisition Cost', value: fmt(kpis.totalAcquisitionCost) },
      ],
      result: fmtPct(kpis.netInitialYield),
      interpretation: `${kpis.netInitialYield.toFixed(2)}% net yield on total cost. ${kpis.netInitialYield > 4.5 ? 'Attractive' : kpis.netInitialYield > 3.0 ? 'Market-level' : 'Low – review risk'}.`,
      status: kpis.netInitialYield > 4.5 ? 'good' : kpis.netInitialYield > 3.0 ? 'warning' : 'danger',
    },
    cashOnCashReturn: {
      label: 'Cash-on-Cash Return',
      formula: 'Levered Cash Flow ÷ Equity Invested × 100',
      inputs: [
        { label: 'NOI', value: fmt(kpis.noi) },
        { label: '− Annual Debt Service', value: fmt(kpis.annualDebtService) },
        { label: 'Equity Invested', value: fmt(kpis.equityInvested) },
      ],
      result: fmtPct(kpis.cashOnCashReturn),
      interpretation: `${kpis.cashOnCashReturn.toFixed(2)}% current equity return. ${kpis.cashOnCashReturn > 4 ? 'Solid' : kpis.cashOnCashReturn > 1 ? 'Acceptable' : 'Low/Negative – review financing structure'}.`,
      status: kpis.cashOnCashReturn > 4 ? 'good' : kpis.cashOnCashReturn > 1 ? 'warning' : 'danger',
    },
    dscr: {
      label: 'DSCR (Debt Service Coverage Ratio)',
      formula: 'NOI ÷ Annual Debt Service',
      inputs: [
        { label: 'NOI', value: fmt(kpis.noi) },
        { label: 'Annual Debt Service', value: fmt(kpis.annualDebtService) },
      ],
      result: fmtX(kpis.dscr),
      interpretation: `${kpis.dscr.toFixed(2)}x coverage. ${kpis.dscr > 1.5 ? 'Comfortable' : kpis.dscr > 1.2 ? 'Acceptable (typical min: 1.2x)' : 'Critical – below covenant threshold'}.`,
      status: kpis.dscr > 1.5 ? 'good' : kpis.dscr > 1.2 ? 'warning' : 'danger',
    },
    ltv: {
      label: 'LTV (Loan-to-Value)',
      formula: 'Loan Amount ÷ Purchase Price × 100',
      inputs: [
        { label: 'Loan Amount', value: fmt(fin.loanAmount) },
        { label: 'Purchase Price', value: fmt(uw.purchasePrice) },
      ],
      result: fmtPct(kpis.ltv),
      interpretation: `${kpis.ltv.toFixed(1)}% loan-to-value. ${kpis.ltv < 55 ? 'Conservative' : kpis.ltv < 70 ? 'Standard market range' : 'High – review covenant risk'}.`,
      status: kpis.ltv < 55 ? 'good' : kpis.ltv < 70 ? 'warning' : 'danger',
    },
    interestCoverageProxy: {
      label: 'Interest Coverage Ratio (ICR)',
      formula: 'NOI ÷ Annual Interest',
      inputs: [
        { label: 'NOI', value: fmt(kpis.noi) },
        { label: 'Annual Interest', value: fmt(fin.loanAmount * fin.interestRate / 100) },
      ],
      result: fmtX(kpis.interestCoverageProxy),
      interpretation: `${kpis.interestCoverageProxy.toFixed(2)}x interest coverage. ${kpis.interestCoverageProxy > 2.5 ? 'Very solid' : kpis.interestCoverageProxy > 1.5 ? 'Sufficient' : 'Low – interest rate risk'}.`,
      status: kpis.interestCoverageProxy > 2.5 ? 'good' : kpis.interestCoverageProxy > 1.5 ? 'warning' : 'danger',
    },
    equityInvested: {
      label: 'Equity Invested',
      formula: 'Total Acquisition Cost − Loan Amount',
      inputs: [
        { label: 'Total Acquisition Cost', value: fmt(kpis.totalAcquisitionCost) },
        { label: '− Loan Amount', value: fmt(fin.loanAmount) },
      ],
      result: fmt(kpis.equityInvested),
      interpretation: `Equity deployed. Equity ratio: ${(kpis.equityInvested / kpis.totalAcquisitionCost * 100).toFixed(1)}%.`,
      status: 'neutral',
    },
  };

  return definitions[kpiKey] || {
    label: kpiKey, formula: 'N/A', inputs: [], result: 'N/A', interpretation: '', status: 'neutral',
  };
}

// ══════════════════════════════════════════════════════════
// FORMATTERS
// ══════════════════════════════════════════════════════════

export function formatEUR(n: number, compact = false): string {
  if (compact && Math.abs(n) >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)} Mio.`;
  }
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

export function formatPct(n: number, digits = 2): string {
  return `${n.toFixed(digits)}%`;
}

export function formatX(n: number): string {
  return `${n.toFixed(1)}x`;
}
