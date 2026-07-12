import type { PropertyData } from '@/models/propertyData';

// ─── Core Domain Types ───────────────────────────────────────────────────────

export type UsageType = 'Wohnen' | 'Büro' | 'Einzelhandel' | 'Logistik' | 'Mixed Use';
export type AssetStatus = 'Bestand' | 'Acquisition' | 'Disposed';
export type DealStage = 'Screening' | 'LOI' | 'Due Diligence' | 'Signing' | 'Closing';
export type CovenantStatus = 'OK' | 'Warning' | 'Breach';
export type DocumentCategory = 'Kaufvertrag' | 'Mietvertrag' | 'Finanzierung' | 'Gutachten' | 'Due Diligence' | 'IC Memo' | 'Sonstiges';
export type RecommendationType = 'Miete' | 'Kaufpreis' | 'Finanzierung' | 'Allgemein';
export type ConfidenceLevel = 'Hoch' | 'Mittel' | 'Niedrig';

export interface Asset {
  id: string;
  name: string;
  address: string;
  city: string;
  zip: string;
  usageType: UsageType;
  status: AssetStatus;
  acquisitionDate: string;
  purchasePrice: number; // EUR
  currentValue: number; // EUR — current valuation / appraisal
  totalArea: number; // sqm
  lettableArea: number; // sqm
  occupancyRate: number; // 0-1
  annualRent: number; // EUR gross annual rent
  // Operating cost breakdown (editable)
  operatingCosts: AssetOperatingCosts;
  units: Unit[];
  debtInstruments: DebtInstrument[];
  covenants: Covenant[];
  cashFlows: CashFlowEntry[];
  documents: Document[];
  capexProjects: CapexProject[];
  completenessScore: number; // 0-100
  imageUrl?: string;
  notes?: string;
  // Market / cashflow assumptions (from underwriting or editable)
  exitCapRate?: number;        // % e.g. 5.0 — used for terminal value in cashflow model
  holdingPeriodYears?: number; // default 10
  ervPerSqm?: number;          // ERV €/m²/month
  // New full property data model (optional for backward compat with mock assets)
  propertyData?: PropertyData;
}

// Operating costs per asset — mirrors underwriting structure
export interface AssetOperatingCosts {
  vacancyRatePercent: number;       // e.g. 5 for 5%
  managementCostPercent: number;    // of gross rent, e.g. 3
  maintenanceReservePerSqm: number; // EUR/sqm/year
  nonRecoverableOpex: number;       // EUR/year
  otherOperatingIncome: number;     // EUR/year (e.g. parking, antennas)
  rentalGrowthRate: number;         // % p.a., default 2.0
}

export interface Unit {
  id: string;
  assetId: string;
  unitNumber: string;
  floor: number;
  area: number; // sqm
  usageType: UsageType;
  tenant?: string;
  rentPerSqm: number;
  monthlyRent: number;
  leaseStart?: string;
  leaseEnd?: string;
  leaseType: 'Vermietet' | 'Leerstand' | 'Eigennutzung';
}

export interface DebtInstrument {
  id: string;
  assetId: string;
  lender: string;
  type: 'Senior' | 'Mezzanine' | 'Junior';
  amount: number; // EUR
  outstandingAmount: number; // EUR
  interestRate: number; // percent p.a.
  interestType: 'Fest' | 'Variabel';
  maturityDate: string;
  amortizationRate: number; // percent p.a.
  drawdownDate: string;
  currency: 'EUR';
  covenants: Covenant[];
}

export interface Covenant {
  id: string;
  debtId?: string;
  assetId?: string;
  name: string;
  type: 'LTV' | 'DSCR' | 'ICR' | 'Custom';
  threshold: number;
  currentValue: number;
  status: CovenantStatus;
  testDate: string;
  description?: string;
}

export interface CashFlowEntry {
  id: string;
  assetId: string;
  period: string; // YYYY-MM
  category: 'Mieteinnahmen' | 'Nebenkosten' | 'Instandhaltung' | 'Verwaltung' | 'Capex' | 'Finanzierung' | 'Sonstiges';
  description: string;
  amount: number; // positive = inflow, negative = outflow
  isForecast: boolean;
}

export interface CapexProject {
  id: string;
  assetId: string;
  name: string;
  budget: number;
  spent: number;
  status: 'Geplant' | 'Laufend' | 'Abgeschlossen';
  startDate: string;
  endDate: string;
}

export interface Document {
  id: string;
  assetId?: string;
  dealId?: string;
  name: string;
  category: DocumentCategory;
  uploadDate: string;
  fileSize: string;
  tags: string[];
  linkedObject?: string;
  url?: string;
  uploadedBy: string;
  // For local storage — base64 encoded file data (until Supabase migration)
  fileData?: string;
  mimeType?: string;
}
