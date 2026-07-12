import type { Asset, AcquisitionDeal, AuditLogEntry, ActivityEntry, DevelopmentProject, SaleObject, Contact, ProjectImage, GeverkPosition, BuyerLead, DailyIntelligenceReport, Document, DealRadarListing, DealRadarSearchCriteria, PropertyData, Offer, Invoice, GewerkePosition, Unit, BenchmarkRecord, MarketEventRecord, ReportSource, RefreshJob, CandidateDeal, AcquisitionProfile, UsageType } from '@/models/types';
import { DEFAULT_ACQUISITION_COSTS } from '@/models/types';

export interface AppSettings {
  hurrleRate: number; // percent, default 15
  taxRate: number; // percent, default 25
  advisorLanguage: 'de' | 'en';
  minDSCR: number;
  maxLTV: number;
  targetNIY: number;
  defaultExitMultiplier: number; // e.g. 18 for 18x NOI terminal value
  // Default Operating Costs for new assets
  defaultVacancyRate: number;     // %, default 5
  defaultMgmtCostPct: number;     // %, default 3
  defaultMaintenancePerSqm: number; // €/m²/yr, default 10
  defaultClosingCostPct: number;  // %, default 6.5
  defaultBrokerFeePct: number;    // %, default 1.5
  defaultRentalGrowthRate: number; // % p.a., default 2.0
  // Market assumptions (per usage type)
  defaultErvGrowthRates: Record<string, number>;  // % p.a. per Nutzungsart
  defaultExitCapRates: Record<string, number>;     // % per Nutzungsart
  defaultHoldingPeriod: number;                    // years, default 10
  defaultContingencyPercent: number;               // %, default 10
  // New market defaults
  defaultOpexInflation: number;    // % p.a., default 2.0
  defaultCapexInflation: number;   // % p.a., default 3.0
  defaultSalesCostPercent: number; // %, default 1.5
  defaultAcquisitionCosts: import('@/models/types').AcquisitionCostItem[];
}

export interface AppState {
  assets: Asset[];
  deals: AcquisitionDeal[];
  developments: DevelopmentProject[];
  sales: SaleObject[];
  contacts: Contact[];
  images: ProjectImage[];
  auditLog: AuditLogEntry[];
  newsReports: DailyIntelligenceReport[];
  dealRadarListings: DealRadarListing[];
  dealRadarCriteria: DealRadarSearchCriteria;
  settings: AppSettings;

  // Market Intelligence Pipeline (Module 06)
  benchmarks: BenchmarkRecord[];
  marketEvents: MarketEventRecord[];
  reportSources: ReportSource[];
  refreshJobs: RefreshJob[];
  triggerQuarterlyRefresh: (user: string) => void;
  refreshCityBenchmarks: (city: string) => void;
  approveBenchmark: (id: string, user: string) => void;
  rejectBenchmark: (id: string, user: string, note?: string) => void;
  correctBenchmark: (id: string, newValue: number, user: string, note?: string) => void;

  // Asset
  updateAsset: (id: string, patch: Partial<Asset>) => void;
  deleteAsset: (id: string) => void;

  // Deal
  addDeal: (deal: AcquisitionDeal) => void;
  updateDeal: (id: string, patch: Partial<AcquisitionDeal>) => void;
  addActivityToDeal: (dealId: string, entry: ActivityEntry) => void;
  deleteDeal: (dealId: string) => void;
  transferToBestand: (dealId: string) => void;
  transferToDevelopment: (dealId: string) => void;

  // Development
  updateDevelopment: (id: string, patch: Partial<DevelopmentProject>) => void;
  deleteDevelopment: (id: string) => void;
  addGewerk: (devId: string, gw: GeverkPosition) => void;
  updateGewerk: (devId: string, gwId: string, patch: Partial<GeverkPosition>) => void;
  deleteGewerk: (devId: string, gwId: string) => void;
  addActivityToDevelopment: (devId: string, entry: ActivityEntry) => void;
  addDevUnit: (devId: string, unit: Unit) => void;
  updateDevUnit: (devId: string, unitId: string, patch: Partial<Unit>) => void;
  deleteDevUnit: (devId: string, unitId: string) => void;
  transferDevToBestand: (devId: string) => void;
  transferDevToSale: (devId: string) => void;
  // Offers & Invoices
  addOffer: (devId: string, offer: Offer) => void;
  updateOffer: (devId: string, offerId: string, patch: Partial<Offer>) => void;
  deleteOffer: (devId: string, offerId: string) => void;
  addInvoice: (devId: string, invoice: Invoice) => void;
  updateInvoice: (devId: string, invoiceId: string, patch: Partial<Invoice>) => void;
  deleteInvoice: (devId: string, invoiceId: string) => void;
  // New Gewerke (PropertyData model)
  addGewerkePosition: (devId: string, gw: GewerkePosition) => void;
  updateGewerkePosition: (devId: string, gwId: string, patch: Partial<GewerkePosition>) => void;
  deleteGewerkePosition: (devId: string, gwId: string) => void;
  // PropertyData update
  updateDealPropertyData: (dealId: string, pd: PropertyData) => void;
  updateDevelopmentPropertyData: (devId: string, pd: PropertyData) => void;

  // Sales
  updateSale: (id: string, patch: Partial<SaleObject>) => void;
  deleteSale: (id: string) => void;
  markSaleAsSold: (id: string, soldPrice: number, soldAt: string) => void;
  returnSaleToBestand: (id: string) => void;
  addBuyer: (saleId: string, buyer: BuyerLead) => void;
  updateBuyer: (saleId: string, buyerId: string, patch: Partial<BuyerLead>) => void;

  // Contacts
  addContact: (contact: Contact) => void;
  updateContact: (id: string, patch: Partial<Contact>) => void;
  deleteContact: (id: string) => void;


  // Images
  addImage: (image: ProjectImage) => void;
  setTitleImage: (entityId: string, imageId: string) => void;
  deleteImage: (imageId: string) => void;

  // Documents
  addDocumentToAsset: (assetId: string, doc: Document) => void;
  addDocumentToDeal: (dealId: string, doc: Document) => void;
  deleteDocument: (entityType: 'asset' | 'deal', entityId: string, docId: string) => void;

  // Market

  // Audit
  addAuditEntry: (entry: AuditLogEntry) => void;

  // News
  addNewsReport: (report: DailyIntelligenceReport) => void;
  pruneOldReports: () => void; // keep only last 7 days

  // Deal Radar
  addRadarListings: (listings: DealRadarListing[]) => void;
  updateRadarListing: (id: string, patch: Partial<DealRadarListing>) => void;
  dismissRadarListing: (id: string, note?: string) => void;
  convertToAcquisition: (listingId: string) => void;
  updateRadarCriteria: (criteria: Partial<DealRadarSearchCriteria>) => void;

  // Deal Sourcing & Screening (Module 07)
  candidateDeals: CandidateDeal[];
  acquisitionProfiles: AcquisitionProfile[];
  lastScreeningAt: string | null;
  runScreening: () => void;                                   // re-run the matcher over all candidates
  ingestCandidatesFromListings: (listings: DealRadarListing[]) => void; // AI websearch → candidates
  shortlistCandidate: (id: string, note?: string) => void;
  rejectCandidate: (id: string, reason: string) => void;
  promoteCandidate: (id: string) => void;                     // → new deal in Acquisition Wizard
  updateAcquisitionProfile: (id: string, patch: Partial<AcquisitionProfile>) => void;

  // Settings
  updateSettings: (patch: Partial<AppSettings>) => void;

  // Reset
  resetToMockData: () => void;
}

export const defaultSettings: AppSettings = {
  hurrleRate: 15,
  taxRate: 25,
  advisorLanguage: 'de',
  minDSCR: 1.25,
  maxLTV: 65,
  targetNIY: 4.5,
  defaultExitMultiplier: 18,
  defaultVacancyRate: 5,
  defaultMgmtCostPct: 3,
  defaultMaintenancePerSqm: 10,
  defaultClosingCostPct: 6.5,
  defaultBrokerFeePct: 1.5,
  defaultRentalGrowthRate: 2.0,
  defaultErvGrowthRates: { 'Wohnen': 2.0, 'Büro': 1.5, 'Einzelhandel': 1.0, 'Logistik': 2.5, 'Mixed Use': 1.8, 'Lager': 1.0, 'Stellplatz': 1.0, 'Sonstiges': 1.5 },
  defaultExitCapRates:   { 'Wohnen': 4.0, 'Büro': 5.0, 'Einzelhandel': 5.5, 'Logistik': 5.5, 'Mixed Use': 5.0, 'Lager': 6.0, 'Stellplatz': 7.0, 'Sonstiges': 6.0 },
  defaultHoldingPeriod: 10,
  defaultContingencyPercent: 10,
  defaultOpexInflation: 2.0,
  defaultCapexInflation: 3.0,
  defaultSalesCostPercent: 1.5,
  defaultAcquisitionCosts: DEFAULT_ACQUISITION_COSTS.map(c => ({ ...c })),
};
