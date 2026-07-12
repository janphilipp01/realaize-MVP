import type { ActivityEntry } from '@/models/acquisition';
import type { Asset, Document, Unit, UsageType } from '@/models/core';
import type { Invoice, Offer, PropertyData } from '@/models/propertyData';

// ─── Development ─────────────────────────────────────────────────────────────

export type DevelopmentStatus = 'Planung' | 'Genehmigung' | 'Ausschreibung' | 'Bau' | 'Abnahme' | 'Fertiggestellt';
export type GeverkCategory =
  | 'Abbruch & Entsorgung' | 'Rohbau' | 'Dach & Abdichtung'
  | 'Fassade & Außenanlagen' | 'Fenster & Türen' | 'Innenausbau'
  | 'TGA – Heizung' | 'TGA – Sanitär' | 'TGA – Elektro' | 'TGA – Lüftung'
  | 'Aufzug' | 'Außenanlagen & Tiefbau' | 'Planung & Architektur'
  | 'Genehmigungen & Gebühren' | 'Reserve / Unvorhergesehenes' | 'Sonstiges';

export interface GeverkPosition {
  id: string;
  developmentId: string;
  category: GeverkCategory;
  description: string;
  unit: string; // m², Pauschal, Stk
  quantity: number;
  underwritingBudget: number; // EUR total
  benchmarkPerUnit?: number; // EUR/unit from advisor
  offerAmount?: number;
  contractAmount?: number;
  actualCost?: number;
  contractorId?: string; // linked address book contact
  status: 'Offen' | 'Ausgeschrieben' | 'Angebot' | 'Vergeben' | 'Abgeschlossen';
  ganttStart?: string; // YYYY-MM
  ganttDurationMonths?: number;
  notes?: string;
}

export interface DevelopmentProject {
  id: string;
  dealId?: string; // source acquisition deal
  assetId?: string; // if from existing asset
  name: string;
  address: string;
  city: string;
  zip: string;
  usageType: UsageType;
  developmentType: 'Neubau' | 'Kernsanierung' | 'Modernisierung' | 'Umbau' | 'Aufstockung' | 'Anbau';
  status: DevelopmentStatus;
  totalArea: number;
  startDate: string;
  plannedEndDate: string;
  actualEndDate?: string;
  gewerke: GeverkPosition[];
  units?: Unit[];
  documents: Document[];
  activityLog: ActivityEntry[];
  advisorMessages: AdvisorMessage[];
  images: ProjectImage[];
  completenessScore: number;
  notes?: string;
  // Financial
  purchasePrice: number;
  totalBudget: number; // sum of underwriting gewerke
  // Hold/Sell analysis
  projectedSalePrice?: number;
  underwritingCashFlows?: AnnualCashFlow[];
  holdSellDecision?: 'Hold' | 'Sell' | 'Offen';
  irr10Year?: number;
  sellNetProfit?: number;
  sellIRR?: number;
  debtAssumptions?: DevDebtAssumptions;
  valuationAssumptions?: DevValuationAssumptions;
  // New full property data model
  propertyData?: PropertyData;
  underwritingSnapshot?: PropertyData;
  offers?: Offer[];
  invoices?: Invoice[];
}

export interface DevDebtAssumptions {
  ltvPct: number;
  ltcPct: number;
  interestRatePct: number;
  loanType: 'Bullet' | 'Annuität';
  annuityTermYears?: number;
}

export interface DevValuationAssumptions {
  opexPct: number;
  exitYieldPct: number;
  purchasingCostsPct: number;
}

export interface AnnualCashFlow {
  year: number;
  noi: number;
  debtService: number;
  netCashFlow: number;
}

export interface AdvisorMessage {
  id: string;
  role: 'user' | 'advisor';
  content: string;
  timestamp: string;
  suggestedPositions?: Partial<GeverkPosition>[];
}

export interface ProjectImage {
  id: string;
  entityId: string; // assetId, dealId, developmentId, saleId
  entityType: 'Asset' | 'Deal' | 'Development' | 'Sale';
  url: string; // base64 or blob URL
  name: string;
  isTitleImage: boolean;
  uploadedAt: string;
}
