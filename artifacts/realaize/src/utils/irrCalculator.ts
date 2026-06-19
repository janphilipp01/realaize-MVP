import type { AnnualCashFlow } from '../models/types';

// ══════════════════════════════════════════════════════════
// Newton-Raphson IRR calculation
// ══════════════════════════════════════════════════════════

export function calculateIRR(cashFlows: number[], initialInvestment: number): number {
  const flows = [-initialInvestment, ...cashFlows];
  let rate = 0.1;
  for (let i = 0; i < 200; i++) {
    let npv = 0;
    let dnpv = 0;
    flows.forEach((cf, t) => {
      npv += cf / Math.pow(1 + rate, t);
      dnpv -= t * cf / Math.pow(1 + rate, t + 1);
    });
    if (Math.abs(npv) < 0.01) break;
    if (dnpv === 0) break;
    rate = rate - npv / dnpv;
    // Guard against divergence
    if (rate < -0.99) { rate = -0.99; break; }
    if (rate > 10) { rate = 10; break; }
  }
  return rate * 100; // percent
}

export function calculateNPV(cashFlows: number[], rate: number): number {
  return cashFlows.reduce((npv, cf, t) => npv + cf / Math.pow(1 + rate / 100, t + 1), 0);
}

// ══════════════════════════════════════════════════════════
// Hold / Sell Analysis
// ══════════════════════════════════════════════════════════

export interface HoldSellAnalysis {
  holdIRR: number;
  holdNPV: number;
  sellNetProfit: number;
  sellROI: number;
  sellIRR: number;
  totalCost: number;
  recommendation: 'Hold' | 'Sell' | 'Neutral';
  hurrleRate: number;
  taxRate: number;
  reasoning: string;
}

export function analyzeHoldSell(params: {
  purchasePrice: number;
  totalDevelopmentCost: number;
  annualCashFlows: AnnualCashFlow[];
  projectedSalePrice: number;
  hurrleRate: number;           // %
  taxRate: number;              // %
  exitMultiplier: number;       // configurable, e.g. 18x NOI
  developmentStartDate?: string; // ISO date string
  developmentEndDate?: string;   // ISO date string
  exitValueYear10?: number;
}): HoldSellAnalysis {
  const {
    purchasePrice, totalDevelopmentCost, annualCashFlows,
    projectedSalePrice, hurrleRate, taxRate, exitMultiplier,
    developmentStartDate, developmentEndDate,
  } = params;

  const totalCost = purchasePrice + totalDevelopmentCost;

  // ── Hold: 10-year IRR from net cash flows + terminal value ──
  const netCFs = annualCashFlows.slice(0, 10).map(cf => cf.netCashFlow);
  // Terminal value: use provided exitValue or calculate from exit multiplier × last year NOI
  const lastYearNOI = annualCashFlows[Math.min(9, annualCashFlows.length - 1)]?.noi || 0;
  const terminalValue = params.exitValueYear10 || (lastYearNOI * exitMultiplier);
  const holdFlows = [...netCFs];
  if (holdFlows.length > 0) {
    holdFlows[holdFlows.length - 1] = (holdFlows[holdFlows.length - 1] || 0) + terminalValue;
  }
  const holdIRR = holdFlows.length > 0 ? calculateIRR(holdFlows, totalCost) : 0;
  const holdNPV = calculateNPV(netCFs, hurrleRate);

  // ── Sell: profit after tax ──
  const grossProfit = projectedSalePrice - totalCost;
  const taxAmount = grossProfit > 0 ? grossProfit * (taxRate / 100) : 0;
  const sellNetProfit = grossProfit - taxAmount;
  const sellROI = totalCost > 0 ? (sellNetProfit / totalCost) * 100 : 0;

  // ── Sell IRR: based on actual development duration ──
  // Calculate development duration in years from actual dates
  let devDurationYears = 2; // fallback
  if (developmentStartDate && developmentEndDate) {
    const startMs = new Date(developmentStartDate).getTime();
    const endMs = new Date(developmentEndDate).getTime();
    const diffYears = (endMs - startMs) / (1000 * 60 * 60 * 24 * 365.25);
    if (diffYears > 0) {
      devDurationYears = diffYears;
    }
  }

  // Build sell cash flow: year 0 = investment, year N = sale proceeds
  // Create array with zeros for intermediate years, proceeds at end
  const sellFlows: number[] = [];
  const fullYears = Math.max(1, Math.ceil(devDurationYears));
  for (let y = 0; y < fullYears - 1; y++) {
    sellFlows.push(0); // no cash flow during development
  }
  sellFlows.push(projectedSalePrice - taxAmount); // proceeds at completion
  const sellIRR = calculateIRR(sellFlows, totalCost);

  // ── Recommendation logic ──
  let recommendation: 'Hold' | 'Sell' | 'Neutral' = 'Neutral';
  let reasoning = '';

  if (holdIRR >= hurrleRate && holdIRR > sellIRR) {
    recommendation = 'Hold';
    reasoning = `Hold IRR of ${holdIRR.toFixed(1)}% exceeds the Hurdle Rate of ${hurrleRate}% and outperforms Sell IRR of ${sellIRR.toFixed(1)}%. Long-term hold recommended.`;
  } else if (sellROI > 20 && sellIRR > holdIRR) {
    recommendation = 'Sell';
    reasoning = `Sale generates ${sellNetProfit.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })} net profit (${sellROI.toFixed(1)}% ROI after tax). Sell IRR ${sellIRR.toFixed(1)}% exceeds Hold IRR of ${holdIRR.toFixed(1)}%.`;
  } else if (holdIRR < hurrleRate) {
    recommendation = 'Sell';
    reasoning = `Hold IRR of ${holdIRR.toFixed(1)}% is below the Hurdle Rate of ${hurrleRate}%. Capital better deployed via sale or reinvestment.`;
  } else {
    reasoning = `Hold IRR (${holdIRR.toFixed(1)}%) and Sell IRR (${sellIRR.toFixed(1)}%) are close. Strategic preference is decisive.`;
  }

  return { holdIRR, holdNPV, sellNetProfit, sellROI, sellIRR, totalCost, recommendation, hurrleRate, taxRate, reasoning };
}
