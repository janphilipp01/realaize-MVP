
// ─── Computed KPIs ───────────────────────────────────────────────────────────

export interface DealKPIs {
  totalAcquisitionCost: number;
  closingCosts: number;
  brokerFee: number;
  kaufpreisfaktor: number;
  bruttoanfangsrendite: number; // percent
  noi: number;
  netInitialYield: number; // percent
  equityInvested: number;
  annualDebtService: number;
  cashOnCashReturn: number; // percent
  dscr: number;
  ltv: number; // percent
  interestCoverageProxy: number;
  liquidityRunway?: number; // months
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: 'Asset' | 'Deal' | 'Document' | 'MarketData' | 'Export' | 'AI';
  entityId: string;
  entityName: string;
  user: string;
  timestamp: string;
  details: string;
}


export interface KPIFormulaDetail {
  label: string;
  formula: string;
  inputs: { label: string; value: string }[];
  result: string;
  interpretation: string;
  status: 'good' | 'warning' | 'danger' | 'neutral';
}
