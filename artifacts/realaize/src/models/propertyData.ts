import type { DealType } from '@/models/acquisition';
import type { UsageType } from '@/models/core';

// ─── Property Data Model (Underwriting) ────────────────────────────────────

export type FloorLevel = 'TG' | 'KG' | 'EG' | '1.OG' | '2.OG' | '3.OG' | '4.OG' | '5.OG' | '6.OG' | 'DG';

export interface AcquisitionCostItem {
  id: string;
  name: string;
  percent: number;
  active: boolean;
}

export type LeaseEndAction = 'Neuvermietung' | 'Leerstand';

export interface RentRollUnit {
  id: string;
  unitNumber: string;
  floor: FloorLevel;
  area: number;
  usageType: 'Wohnen' | 'Büro' | 'Einzelhandel' | 'Lager' | 'Stellplatz' | 'Sonstiges';
  tenant: string;
  leaseStart: string;              // ISO date — Mietstart
  leaseDurationMonths: number;     // Laufzeit in Monaten ab Mietstart
  leaseEndAction: LeaseEndAction;  // Was nach Ablauf passiert
  currentRentPerSqm: number;       // Ist €/m²/Monat
  ervPerSqm: number;               // ERV €/m²/Monat
  monthlyRent: number;             // bidirektional mit currentRentPerSqm
  indexationPercent: number;       // % der Inflation aus Market Assumptions (Default 100)
  nonRecoverableOpex: number;      // €/Monat
  sourceUnitId?: string;
}

export interface PropertyOperatingCosts {
  vacancyRatePercent: number;
  managementCostPercent: number;
  maintenanceReservePerSqm: number;
  insurancePerYear: number;
  propertyTaxPerYear: number;
  otherOpexPerYear: number;
  otherIncomePerYear: number;
}

export interface MarketAssumptionPerUsage {
  usageType: string;
  ervFromRentRoll: number;
  ervGrowthRatePercent: number;
  exitCapRatePercent: number;
  exitMultiplier: number;
  aiSuggested?: boolean;
}

export interface PropertyMarketAssumptions {
  perUsageType: MarketAssumptionPerUsage[];
  opexInflationPercent: number;
  capexInflationPercent: number;
  salesCostPercent: number;
  opexInflationAiSuggested?: boolean;
  capexInflationAiSuggested?: boolean;
}

export type CostDistribution = 'vorauszahlung' | 'linear' | '30-40-30' | 'endfällig';

export interface GewerkePosition {
  id: string;
  category: string;
  description: string;
  budgetInputMode: 'pauschal' | 'per_sqm';
  budgetAmount: number;
  budgetTotal: number;
  costPerSqm: number;
  startWeek: number;
  durationWeeks: number;
  endWeek: number;
  costDistribution: CostDistribution;
  status: 'Geplant' | 'Beauftragt' | 'Laufend' | 'Abgeschlossen';
  awardAmount?: number;
}

export interface Offer {
  id: string;
  gewerkId: string;
  gewerkCategory: string;
  description: string;
  measure: string;
  amountNet: number;
  amountGross: number;
  date: string;
}

export type InvoiceType = 'Anzahlung' | 'Vollzahlung' | 'Baufortschritt' | 'Schlussrechnung';

export interface Invoice {
  id: string;
  gewerkId: string;
  gewerkCategory: string;
  measure: string;
  invoiceType: InvoiceType;
  description: string;
  amountNet: number;
  amountGross: number;
  date: string;
}

export type FinancingType = 'Bankdarlehen' | 'Mezzanine' | 'Privates Darlehen' | 'Gesellschafterdarlehen';
export type RepaymentType = 'Annuität' | 'Endfällig';

export interface FinancingTranche {
  id: string;
  name: string;
  financingType: FinancingType;
  loanAmount: number;
  interestRate: number;
  fixedRatePeriod: number;
  loanTerm: number;
  repaymentType: RepaymentType;
  amortizationRate: number;
  disbursementDate?: string;
}

export interface PropertyData {
  name: string;
  address: string;
  city: string;
  zip: string;
  submarket?: string; // district / borough — drives prime vs edge market assumptions
  usageType: UsageType;
  dealType: DealType;
  developmentType?: string;
  floors: FloorLevel[];
  vendor: string;
  broker: string;
  purchasePrice: number;
  acquisitionCosts: AcquisitionCostItem[];
  acquisitionDate: string;
  unitsAsIs: RentRollUnit[];
  unitsTarget: RentRollUnit[];
  operatingCosts: PropertyOperatingCosts;
  marketAssumptions: PropertyMarketAssumptions;
  gewerke: GewerkePosition[];
  projectStart: string;
  contingencyPercent: number;
  financingTranches: FinancingTranche[];
  holdingPeriodYears: number;
}

export const DEFAULT_ACQUISITION_COSTS: AcquisitionCostItem[] = [
  { id: 'grest', name: 'Grunderwerbsteuer', percent: 6.0, active: true },
  { id: 'makler', name: 'Makler', percent: 1.5, active: true },
  { id: 'notar', name: 'Notar', percent: 1.5, active: true },
  { id: 'grundbuch', name: 'Grundbuch', percent: 0.5, active: true },
  { id: 'sonstige', name: 'Sonstiges', percent: 0.0, active: false },
];

export const DEFAULT_GEWERKE_CATEGORIES = [
  'Rohbau', 'Fassade', 'Dach', 'Haustechnik / TGA', 'Elektro',
  'Sanitär', 'Heizung / Klima', 'Aufzüge', 'Innenausbau',
  'Außenanlagen', 'Planung / Architektur', 'Statik',
  'Bauüberwachung', 'Genehmigungen', 'Versicherung', 'Sonstiges',
];

export const DEFAULT_ERV_GROWTH: Record<string, number> = {
  'Wohnen': 2.0, 'Büro': 1.5, 'Einzelhandel': 1.0, 'Logistik': 2.5,
  'Mixed Use': 1.8, 'Lager': 1.0, 'Stellplatz': 1.0, 'Sonstiges': 1.5,
};

export const DEFAULT_EXIT_CAP: Record<string, number> = {
  'Wohnen': 4.0, 'Büro': 5.0, 'Einzelhandel': 5.5, 'Logistik': 5.5,
  'Mixed Use': 5.0, 'Lager': 6.0, 'Stellplatz': 7.0, 'Sonstiges': 6.0,
};

export function createDefaultPropertyData(
  overrides: Partial<PropertyData> = {}
): PropertyData {
  return {
    name: '',
    address: '',
    city: '',
    zip: '',
    usageType: 'Büro',
    dealType: 'Investment',
    developmentType: undefined,
    floors: ['EG'],
    vendor: '',
    broker: '',
    purchasePrice: 0,
    acquisitionCosts: DEFAULT_ACQUISITION_COSTS.map(c => ({ ...c })),
    acquisitionDate: new Date().toISOString().split('T')[0],
    unitsAsIs: [],
    unitsTarget: [],
    operatingCosts: {
      vacancyRatePercent: 5,
      managementCostPercent: 3,
      maintenanceReservePerSqm: 10,
      insurancePerYear: 0,
      propertyTaxPerYear: 0,
      otherOpexPerYear: 0,
      otherIncomePerYear: 0,
    },
    marketAssumptions: {
      perUsageType: [],
      opexInflationPercent: 2.0,
      capexInflationPercent: 3.0,
      salesCostPercent: 1.5,
    },
    gewerke: [],
    projectStart: new Date().toISOString().split('T')[0],
    contingencyPercent: 10,
    financingTranches: [],
    holdingPeriodYears: 10,
    ...overrides,
  };
}
