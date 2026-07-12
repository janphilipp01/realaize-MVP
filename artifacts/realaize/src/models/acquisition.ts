import type { AIRecommendation } from '@/models/ai';
import type { Asset, DealStage, Document, Unit, UsageType } from '@/models/core';
import type { DevDebtAssumptions, DevValuationAssumptions, GeverkCategory } from '@/models/development';
import type { PropertyData } from '@/models/propertyData';

// ─── Acquisition ─────────────────────────────────────────────────────────────

export type DealType = 'Investment' | 'Development';

export interface AcquisitionDeal {
  id: string;
  name: string;
  address: string;
  city: string;
  zip: string;
  usageType: UsageType;
  dealType: DealType; // Investment-Asset or Development-Asset
  stage: DealStage;
  submarket?: string; // district / borough — drives prime vs edge market assumptions
  askingPrice: number;
  underwritingAssumptions: UnderwritingAssumptions;
  financingAssumptions: FinancingAssumptions;
  documents: Document[];
  activityLog: ActivityEntry[];
  aiRecommendations: AIRecommendation[];
  icMemo?: ICMemo;
  notes?: string;
  completenessScore: number;
  createdAt: string;
  updatedAt: string;
  imageUrl?: string;
  targetYield?: number;
  broker?: string;
  vendorName?: string;
  totalArea?: number;
  marketLocationId?: string;
  // Extended property data (Investment)
  yearBuilt?: number;
  floors?: number;
  parkingSpaces?: number;
  lettableArea?: number;
  acquisitionDate?: string;
  units?: Unit[];
  // Development-specific fields (only when dealType === 'Development')
  developmentType?: 'Neubau' | 'Kernsanierung' | 'Modernisierung' | 'Umbau' | 'Aufstockung' | 'Anbau';
  estimatedDevBudget?: number;  // total construction budget
  estimatedDevDuration?: number; // months
  projectedRentAfterDev?: number; // annual rent after completion
  startDate?: string;
  plannedEndDate?: string;
  gewerke?: Array<{ id: string; category: GeverkCategory; description: string; underwritingBudget: number }>;
  debtAssumptions?: DevDebtAssumptions;
  valuationAssumptions?: DevValuationAssumptions;
  // New full property data model
  propertyData?: PropertyData;
}

export interface MarketAssumptions {
  ervGrowthRate: number;      // % p.a., ERV growth by usage type
  exitCapRate: number;        // %, exit NIY for sale valuation
  rentalGrowthRate: number;   // % p.a., actual rent growth (can differ from ERV)
  holdingPeriodYears: number; // default 10
}

export interface UnderwritingAssumptions {
  purchasePrice: number;
  closingCostPercent: number; // e.g. 6.5 for 6.5%
  brokerFeePercent: number;
  initialCapex: number;
  annualGrossRent: number;
  vacancyRatePercent: number;
  managementCostPercent: number; // of gross rent
  maintenanceReservePerSqm: number;
  nonRecoverableOpex: number;
  area: number; // sqm
  rentPerSqm: number; // monthly
  otherOperatingIncome: number;
  // Extended fields (optional for backward compat)
  ervPerSqm?: number;               // ERV €/m²/month (market rent after repositioning)
  projectedAnnualRent?: number;     // area × ERV × 12
  contingencyPercent?: number;      // default 10%, development only
  startDate?: string;               // construction start (dev only)
  plannedEndDate?: string;          // construction end (dev only)
  marketAssumptions?: MarketAssumptions;
}

export interface FinancingAssumptions {
  loanAmount: number;
  interestRate: number; // percent
  amortizationRate: number; // percent
  loanTerm: number; // years
  lenderName: string;
  fixedRatePeriod: number; // years
}

export interface ICMemo {
  dealId: string;
  executiveSummary: string;
  investmentRationale: string;
  riskFactors: string[];
  exitStrategy: string;
  recommendedAction: string;
  preparedBy: string;
  preparedAt: string;
}

export interface ActivityEntry {
  id: string;
  dealId?: string;
  assetId?: string;
  type: 'Note' | 'Document' | 'Status' | 'Transfer' | 'Export' | 'AI' | 'Edit';
  title: string;
  description: string;
  timestamp: string;
  user: string;
}
