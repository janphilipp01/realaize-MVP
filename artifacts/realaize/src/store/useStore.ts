import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Asset, AcquisitionDeal, AuditLogEntry, ActivityEntry, DevelopmentProject, SaleObject, Contact, ProjectImage, GeverkPosition, BuyerLead, DailyIntelligenceReport, Document, DealRadarListing, DealRadarSearchCriteria, PropertyData, Offer, Invoice, GewerkePosition, Unit, BenchmarkRecord, MarketEventRecord, ReportSource, RefreshJob, CandidateDeal, AcquisitionProfile, UsageType } from '../models/types';
import { mockAssets, mockDeals, mockAuditLog, mockDevelopments, mockSales, mockContacts, mockNewsReports, mockDealRadarListings } from '../data/mockData';
import { mockBenchmarks, mockPortfolioBenchmark, mockMarketEvents, mockReportSources, mockRefreshJobs, CURRENT_PERIOD } from '../data/marketIntelData';
import { mockCandidateDeals, defaultAcquisitionProfiles, listingToCandidate } from '../data/dealSourcingData';
import { runLocalMatcher } from '../utils/screening';
import { benchmarksToScreeningSeeds } from '../utils/marketIntelligence';
import { assetClassToUsage } from '../utils/marketVocab';
import { DEFAULT_ACQUISITION_COSTS } from '../models/types';

interface AppSettings {
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
  defaultAcquisitionCosts: import('../models/types').AcquisitionCostItem[];
}

interface AppState {
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
  ingestResearchedBenchmarks: (records: BenchmarkRecord[]) => void; // AI research → Welt B master
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

const defaultSettings: AppSettings = {
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

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      assets: mockAssets,
      deals: mockDeals,
      developments: mockDevelopments,
      sales: mockSales,
      contacts: mockContacts,
      images: [],
      auditLog: mockAuditLog,
      newsReports: mockNewsReports,
      dealRadarListings: mockDealRadarListings,
      dealRadarCriteria: {
        cities: ['Berlin', 'München', 'Hamburg', 'Frankfurt am Main', 'Düsseldorf'],
        usageTypes: ['Wohnen', 'Büro', 'Logistik'],
        priceMin: 2_000_000,
        priceMax: 50_000_000,
        minArea: 500,
        maxArea: 50_000,
      },
      settings: defaultSettings,

      // ── Deal Sourcing & Screening (Module 07) ──
      candidateDeals: mockCandidateDeals,
      acquisitionProfiles: defaultAcquisitionProfiles,
      lastScreeningAt: '2026-06-23T07:00:00.000Z',

      // ── Market Intelligence Pipeline ──
      benchmarks: [...mockBenchmarks, mockPortfolioBenchmark],
      marketEvents: mockMarketEvents,
      reportSources: mockReportSources,
      refreshJobs: mockRefreshJobs,

      triggerQuarterlyRefresh: (user) =>
        set(s => {
          const now = new Date().toISOString();
          const okSources = s.reportSources.filter(r => r.status !== 'broken').length;
          const pending = s.benchmarks.filter(b => b.validationStatus === 'pending').length;
          const job: RefreshJob = {
            id: `rj-${Date.now()}`,
            triggeredAt: now,
            trigger: 'manual',
            triggeredBy: user,
            status: 'completed',
            periodQuarter: CURRENT_PERIOD,
            reportsFetched: okSources,
            dataPointsExtracted: s.benchmarks.length,
            autoPassed: s.benchmarks.filter(b => b.validationStatus === 'auto_passed').length,
            pendingReview: pending,
            completedAt: now,
          };
          return {
            refreshJobs: [job, ...s.refreshJobs],
            reportSources: s.reportSources.map(r =>
              r.status === 'broken' ? r : { ...r, lastFetchedAt: now },
            ),
          };
        }),

      // AI research (Welt B). Upserts by market×asset×KPI×quarter, then re-screens
      // so a market-data change is immediately reflected in the Deal Radar.
      ingestResearchedBenchmarks: (records) =>
        set(s => {
          if (records.length === 0) return {};
          const keyOf = (b: BenchmarkRecord) =>
            `${b.city}|${b.submarket ?? ''}|${b.assetClass}|${b.kpi}|${b.periodQuarter}`;
          const incoming = new Set(records.map(keyOf));
          const kept = s.benchmarks.filter(b => !incoming.has(keyOf(b)));
          const merged = [...kept, ...records];
          return {
            benchmarks: merged,
            candidateDeals: runLocalMatcher(s.candidateDeals, s.acquisitionProfiles, benchmarksToScreeningSeeds(merged)),
            lastScreeningAt: new Date().toISOString(),
          };
        }),

      approveBenchmark: (id, user) =>
        set(s => ({
          benchmarks: s.benchmarks.map(b =>
            b.id === id
              ? { ...b, validationStatus: 'manual_approved' as const, reviewNote: `Approved by ${user}` }
              : b,
          ),
        })),

      rejectBenchmark: (id, user, note) =>
        set(s => ({
          benchmarks: s.benchmarks.map(b =>
            b.id === id
              ? { ...b, validationStatus: 'rejected' as const, reviewNote: note || `Rejected by ${user}` }
              : b,
          ),
        })),

      correctBenchmark: (id, newValue, user, note) =>
        set(s => ({
          benchmarks: s.benchmarks.map(b =>
            b.id === id
              ? {
                  ...b,
                  value: newValue,
                  validationStatus: 'manual_approved' as const,
                  confidenceTier: 'manual_override' as const,
                  sourceType: 'manual' as const,
                  reviewNote: note || `Corrected by ${user}`,
                }
              : b,
          ),
        })),

      updateAsset: (id, patch) =>
        set(s => ({ assets: s.assets.map(a => a.id === id ? { ...a, ...patch } : a) })),

      deleteAsset: (id) =>
        set(s => ({ assets: s.assets.filter(a => a.id !== id) })),

      addDeal: (deal) =>
        set(s => ({
          deals: [...s.deals, deal],
          auditLog: [{
            id: `audit-${Date.now()}`,
            action: 'New Deal Created',
            entityType: 'Deal',
            entityId: deal.id,
            entityName: deal.name,
            user: 'M. Wagner',
            timestamp: new Date().toISOString(),
            details: `Deal "${deal.name}" created in stage ${deal.stage}.`,
          }, ...s.auditLog],
        })),

      updateDeal: (id, patch) =>
        set(s => ({ deals: s.deals.map(d => d.id === id ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d) })),

      addActivityToDeal: (dealId, entry) =>
        set(s => ({ deals: s.deals.map(d => d.id === dealId ? { ...d, activityLog: [entry, ...d.activityLog] } : d) })),

      deleteDeal: (dealId) =>
        set(s => ({ deals: s.deals.filter(d => d.id !== dealId) })),

      transferToBestand: (dealId) => {
        const deal = get().deals.find(d => d.id === dealId);
        if (!deal) return;
        const ma = deal.underwritingAssumptions.marketAssumptions;
        const s = get().settings;
        const newAsset: Asset = {
          id: `asset-${Date.now()}`, name: deal.name, address: deal.address, city: deal.city, zip: deal.zip,
          usageType: deal.usageType, status: 'Bestand', acquisitionDate: new Date().toISOString().split('T')[0],
          purchasePrice: deal.underwritingAssumptions.purchasePrice, currentValue: deal.underwritingAssumptions.purchasePrice,
          totalArea: deal.totalArea || deal.underwritingAssumptions.area, lettableArea: deal.underwritingAssumptions.area,
          occupancyRate: 1 - deal.underwritingAssumptions.vacancyRatePercent / 100,
          annualRent: deal.underwritingAssumptions.annualGrossRent,
          operatingCosts: {
            vacancyRatePercent: deal.underwritingAssumptions.vacancyRatePercent,
            managementCostPercent: deal.underwritingAssumptions.managementCostPercent,
            maintenanceReservePerSqm: deal.underwritingAssumptions.maintenanceReservePerSqm,
            nonRecoverableOpex: deal.underwritingAssumptions.nonRecoverableOpex,
            otherOperatingIncome: deal.underwritingAssumptions.otherOperatingIncome,
            rentalGrowthRate: ma?.rentalGrowthRate ?? s.defaultRentalGrowthRate,
          },
          exitCapRate: ma?.exitCapRate ?? (s.defaultExitCapRates[deal.usageType] || 5.0),
          holdingPeriodYears: ma?.holdingPeriodYears ?? s.defaultHoldingPeriod,
          ervPerSqm: deal.underwritingAssumptions.ervPerSqm || deal.underwritingAssumptions.rentPerSqm,
          units: (deal.units || []).map(u => ({ ...u, assetId: newAsset.id })),
          debtInstruments: [], covenants: [], cashFlows: [], documents: deal.documents, capexProjects: [],
          completenessScore: (deal.units || []).length > 0 ? 60 : 40,
        };
        set(s => ({
          assets: [...s.assets, newAsset],
          deals: s.deals.filter(d => d.id !== dealId),
          auditLog: [{ id: `audit-${Date.now()}`, action: 'In Bestand überführt', entityType: 'Asset', entityId: newAsset.id, entityName: deal.name, user: 'M. Wagner', timestamp: new Date().toISOString(), details: `Deal "${deal.name}" in Bestand überführt.` }, ...s.auditLog],
        }));
      },

      transferToDevelopment: (dealId) => {
        const deal = get().deals.find(d => d.id === dealId);
        if (!deal) return;
        const newDevId = `dev-${Date.now()}`;
        const now = new Date().toISOString();
        const devPropertyData = deal.propertyData
          ? JSON.parse(JSON.stringify(deal.propertyData))
          : undefined;
        const snapshot = devPropertyData
          ? JSON.parse(JSON.stringify(devPropertyData))
          : undefined;
        const newDev: DevelopmentProject = {
          id: newDevId, dealId, name: deal.name, address: deal.address, city: deal.city, zip: deal.zip,
          usageType: deal.usageType,
          developmentType: deal.developmentType || (devPropertyData?.developmentType as any) || 'Modernisierung',
          status: 'Planung',
          totalArea: deal.totalArea || deal.underwritingAssumptions.area,
          startDate: devPropertyData?.projectStart || deal.underwritingAssumptions.startDate || new Date().toISOString().split('T')[0],
          plannedEndDate: deal.underwritingAssumptions.plannedEndDate
            || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * ((deal.estimatedDevDuration || 24) / 12)).toISOString().split('T')[0],
          purchasePrice: devPropertyData?.purchasePrice || deal.underwritingAssumptions.purchasePrice,
          totalBudget: deal.estimatedDevBudget || deal.underwritingAssumptions.initialCapex,
          gewerke: (deal.gewerke || []).map(g => ({
            id: g.id, developmentId: newDevId,
            category: g.category, description: g.description,
            underwritingBudget: g.underwritingBudget,
            unit: 'Pauschal', quantity: 1, status: 'Offen' as const,
          })),
          units: (deal.units || []).map(u => ({ ...u, assetId: newDevId })),
          documents: deal.documents, activityLog: [], advisorMessages: [], images: [],
          completenessScore: (deal.gewerke || []).length > 0 ? 55 : 30, holdSellDecision: 'Offen',
          propertyData: devPropertyData,
          underwritingSnapshot: snapshot,
          offers: [],
          invoices: [],
        };
        set(s => ({
          developments: [...s.developments, newDev],
          deals: s.deals.filter(d => d.id !== dealId),
          auditLog: [{ id: `audit-${Date.now()}`, action: 'In Development überführt', entityType: 'Asset', entityId: newDev.id, entityName: deal.name, user: 'M. Wagner', timestamp: now, details: `Deal "${deal.name}" in Development überführt.` }, ...s.auditLog],
        }));
      },

      updateDevelopment: (id, patch) =>
        set(s => ({ developments: s.developments.map(d => d.id === id ? { ...d, ...patch } : d) })),

      deleteDevelopment: (id) =>
        set(s => ({ developments: s.developments.filter(d => d.id !== id) })),

      addGewerk: (devId, gw) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId ? { ...d, gewerke: [...d.gewerke, gw] } : d) })),

      updateGewerk: (devId, gwId, patch) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId ? { ...d, gewerke: d.gewerke.map(g => g.id === gwId ? { ...g, ...patch } : g) } : d) })),

      deleteGewerk: (devId, gwId) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId ? { ...d, gewerke: d.gewerke.filter(g => g.id !== gwId) } : d) })),

      addActivityToDevelopment: (devId, entry) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId ? { ...d, activityLog: [entry, ...d.activityLog] } : d) })),

      addDevUnit: (devId, unit) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId ? { ...d, units: [...(d.units || []), unit] } : d) })),

      updateDevUnit: (devId, unitId, patch) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId ? { ...d, units: (d.units || []).map(u => u.id === unitId ? { ...u, ...patch } : u) } : d) })),

      deleteDevUnit: (devId, unitId) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId ? { ...d, units: (d.units || []).filter(u => u.id !== unitId) } : d) })),

      transferDevToBestand: (devId) => {
        const dev = get().developments.find(d => d.id === devId);
        if (!dev) return;
        const newAssetId = `asset-${Date.now()}`;
        const cfg = get().settings;

        // If dev has propertyData, use it with target→asIs swap
        let assetPropertyData: PropertyData | undefined;
        if (dev.propertyData) {
          const pd: PropertyData = JSON.parse(JSON.stringify(dev.propertyData));
          if (pd.unitsTarget.length > 0) {
            pd.unitsAsIs = pd.unitsTarget;
            pd.unitsTarget = [];
          }
          assetPropertyData = pd;
        }

        const units = (dev.units || []).map(u => ({ ...u, assetId: newAssetId }));
        const annualRent = assetPropertyData
          ? assetPropertyData.unitsAsIs.reduce((s, u) => s + u.monthlyRent, 0) * 12
          : units.reduce((s, u) => s + u.monthlyRent * 12, 0);
        const lettedUnits = units.filter(u => u.leaseType === 'Vermietet');
        const occupancyRate = units.length > 0 ? lettedUnits.length / units.length : 0;
        const newAsset: Asset = {
          id: newAssetId, name: dev.name, address: dev.address, city: dev.city, zip: dev.zip,
          usageType: dev.usageType, status: 'Bestand', acquisitionDate: new Date().toISOString().split('T')[0],
          purchasePrice: dev.purchasePrice + dev.totalBudget, currentValue: dev.projectedSalePrice || dev.purchasePrice + dev.totalBudget,
          totalArea: dev.totalArea, lettableArea: dev.totalArea * 0.9,
          occupancyRate, annualRent,
          operatingCosts: {
            vacancyRatePercent: cfg.defaultVacancyRate,
            managementCostPercent: cfg.defaultMgmtCostPct,
            maintenanceReservePerSqm: cfg.defaultMaintenancePerSqm,
            nonRecoverableOpex: 0,
            otherOperatingIncome: 0,
            rentalGrowthRate: cfg.defaultRentalGrowthRate,
          },
          exitCapRate: cfg.defaultExitCapRates[dev.usageType] || 5.0,
          holdingPeriodYears: cfg.defaultHoldingPeriod,
          units, debtInstruments: [], covenants: [], cashFlows: [], documents: dev.documents, capexProjects: [],
          completenessScore: assetPropertyData ? 70 : 45,
          propertyData: assetPropertyData,
        };
        set(st => ({
          assets: [...st.assets, newAsset],
          developments: st.developments.map(d => d.id === devId ? { ...d, status: 'Fertiggestellt', holdSellDecision: 'Hold' } : d),
          auditLog: [{ id: `audit-${Date.now()}`, action: 'Development → Bestand', entityType: 'Asset', entityId: newAsset.id, entityName: dev.name, user: 'M. Wagner', timestamp: new Date().toISOString(), details: `Development "${dev.name}" in Bestand überführt.` }, ...st.auditLog],
        }));
      },

      transferDevToSale: (devId) => {
        const dev = get().developments.find(d => d.id === devId);
        if (!dev) return;
        const newSale: SaleObject = {
          id: `sale-${Date.now()}`, sourceType: 'Development', sourceId: devId,
          name: `${dev.name} — Verkauf`, address: dev.address, city: dev.city, zip: dev.zip,
          usageType: dev.usageType, status: 'Vorbereitung',
          targetPrice: dev.projectedSalePrice || dev.purchasePrice * 1.3,
          minimumPrice: (dev.purchasePrice + dev.totalBudget) * 1.1,
          askingPrice: dev.projectedSalePrice || dev.purchasePrice * 1.35,
          totalCost: dev.purchasePrice + dev.totalBudget,
          area: dev.totalArea, documents: dev.documents, buyers: [], activityLog: [], images: [],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        set(s => ({
          sales: [...s.sales, newSale],
          developments: s.developments.map(d => d.id === devId ? { ...d, status: 'Fertiggestellt', holdSellDecision: 'Sell' } : d),
          auditLog: [{ id: `audit-${Date.now()}`, action: 'Development → Sales', entityType: 'Asset', entityId: newSale.id, entityName: dev.name, user: 'M. Wagner', timestamp: new Date().toISOString(), details: `Development "${dev.name}" in Sales überführt.` }, ...s.auditLog],
        }));
      },

      // Offers & Invoices
      addOffer: (devId, offer) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId ? { ...d, offers: [...(d.offers || []), offer] } : d) })),
      updateOffer: (devId, offerId, patch) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId ? { ...d, offers: (d.offers || []).map(o => o.id === offerId ? { ...o, ...patch } : o) } : d) })),
      deleteOffer: (devId, offerId) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId ? { ...d, offers: (d.offers || []).filter(o => o.id !== offerId) } : d) })),
      addInvoice: (devId, invoice) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId ? { ...d, invoices: [...(d.invoices || []), invoice] } : d) })),
      updateInvoice: (devId, invoiceId, patch) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId ? { ...d, invoices: (d.invoices || []).map(i => i.id === invoiceId ? { ...i, ...patch } : i) } : d) })),
      deleteInvoice: (devId, invoiceId) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId ? { ...d, invoices: (d.invoices || []).filter(i => i.id !== invoiceId) } : d) })),
      // New Gewerke positions (PropertyData model)
      addGewerkePosition: (devId, gw) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId && d.propertyData ? { ...d, propertyData: { ...d.propertyData, gewerke: [...d.propertyData.gewerke, gw] } } : d) })),
      updateGewerkePosition: (devId, gwId, patch) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId && d.propertyData ? { ...d, propertyData: { ...d.propertyData, gewerke: d.propertyData.gewerke.map(g => g.id === gwId ? { ...g, ...patch } : g) } } : d) })),
      deleteGewerkePosition: (devId, gwId) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId && d.propertyData ? { ...d, propertyData: { ...d.propertyData, gewerke: d.propertyData.gewerke.filter(g => g.id !== gwId) } } : d) })),
      // PropertyData update
      updateDealPropertyData: (dealId, pd) =>
        set(s => ({ deals: s.deals.map(d => d.id === dealId ? { ...d, propertyData: pd } : d) })),
      updateDevelopmentPropertyData: (devId, pd) =>
        set(s => ({ developments: s.developments.map(d => d.id === devId ? { ...d, propertyData: pd } : d) })),

      updateSale: (id, patch) =>
        set(s => ({ sales: s.sales.map(sale => sale.id === id ? { ...sale, ...patch, updatedAt: new Date().toISOString() } : sale) })),

      deleteSale: (id) =>
        set(s => ({ sales: s.sales.filter(sale => sale.id !== id) })),

      markSaleAsSold: (id, soldPrice, soldAt) =>
        set(s => ({
          sales: s.sales.map(sale => sale.id === id
            ? { ...sale, status: 'Verkauft' as const, soldPrice, soldAt, disposalGain: soldPrice - sale.totalCost, updatedAt: new Date().toISOString() }
            : sale),
        })),

      returnSaleToBestand: (id) => {
        const sale = get().sales.find(s => s.id === id);
        if (!sale) return;
        const newAsset: import('../models/types').Asset = {
          id: `asset-${Date.now()}`,
          name: sale.name,
          address: sale.address,
          city: sale.city,
          zip: sale.zip,
          usageType: sale.usageType,
          status: 'Bestand',
          acquisitionDate: new Date().toISOString().split('T')[0],
          currentValue: sale.askingPrice,
          purchasePrice: sale.totalCost,
          annualRent: sale.annualRent || 0,
          occupancyRate: 1,
          totalArea: sale.area || 0,
          lettableArea: sale.area || 0,
          operatingCosts: { vacancyRatePercent: 5, managementCostPercent: 3, maintenanceReservePerSqm: 8, nonRecoverableOpex: 0, otherOperatingIncome: 0, rentalGrowthRate: 2 },
          units: [],
          debtInstruments: [],
          covenants: [],
          cashFlows: [],
          documents: [],
          capexProjects: [],
          completenessScore: 20,
        };
        set(s => ({ sales: s.sales.filter(sale => sale.id !== id), assets: [...s.assets, newAsset] }));
      },

      addBuyer: (saleId, buyer) =>
        set(s => ({ sales: s.sales.map(sale => sale.id === saleId ? { ...sale, buyers: [...sale.buyers, buyer] } : sale) })),

      updateBuyer: (saleId, buyerId, patch) =>
        set(s => ({ sales: s.sales.map(sale => sale.id === saleId ? { ...sale, buyers: sale.buyers.map(b => b.id === buyerId ? { ...b, ...patch } : b) } : sale) })),

      addContact: (contact) => set(s => ({ contacts: [...s.contacts, contact] })),
      updateContact: (id, patch) => set(s => ({ contacts: s.contacts.map(c => c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c) })),
      deleteContact: (id) => set(s => ({ contacts: s.contacts.filter(c => c.id !== id) })),

      addImage: (image) => set(s => ({ images: [...s.images, image] })),
      setTitleImage: (entityId, imageId) =>
        set(s => ({ images: s.images.map(img => img.entityId === entityId ? { ...img, isTitleImage: img.id === imageId } : img) })),
      deleteImage: (imageId) => set(s => ({ images: s.images.filter(img => img.id !== imageId) })),

      addDocumentToAsset: (assetId, doc) =>
        set(s => ({ assets: s.assets.map(a => a.id === assetId ? { ...a, documents: [...a.documents, doc] } : a) })),

      addDocumentToDeal: (dealId, doc) =>
        set(s => ({ deals: s.deals.map(d => d.id === dealId ? { ...d, documents: [...d.documents, doc] } : d) })),

      deleteDocument: (entityType, entityId, docId) =>
        set(s => entityType === 'asset'
          ? { assets: s.assets.map(a => a.id === entityId ? { ...a, documents: a.documents.filter(d => d.id !== docId) } : a) }
          : { deals: s.deals.map(d => d.id === entityId ? { ...d, documents: d.documents.filter(doc => doc.id !== docId) } : d) }
        ),

      addAuditEntry: (entry) => set(s => ({ auditLog: [entry, ...s.auditLog] })),

      addNewsReport: (report) =>
        set(s => {
          // Replace if same date exists, otherwise prepend
          const existing = s.newsReports.findIndex(r => r.date === report.date);
          if (existing >= 0) {
            const updated = [...s.newsReports];
            updated[existing] = report;
            return { newsReports: updated };
          }
          return { newsReports: [report, ...s.newsReports] };
        }),

      pruneOldReports: () =>
        set(s => {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 7);
          const cutoffStr = cutoff.toISOString().split('T')[0];
          return { newsReports: s.newsReports.filter(r => r.date >= cutoffStr) };
        }),

      // Deal Radar
      addRadarListings: (listings) =>
        set(s => {
          const existingIds = new Set(s.dealRadarListings.map(l => l.id));
          const newOnes = listings.filter(l => !existingIds.has(l.id));
          return { dealRadarListings: [...newOnes, ...s.dealRadarListings] };
        }),

      updateRadarListing: (id, patch) =>
        set(s => ({ dealRadarListings: s.dealRadarListings.map(l => l.id === id ? { ...l, ...patch } : l) })),

      dismissRadarListing: (id, note) =>
        set(s => ({ dealRadarListings: s.dealRadarListings.map(l =>
          l.id === id ? { ...l, status: 'dismissed' as const, reviewedAt: new Date().toISOString(), reviewNote: note || 'Abgelehnt' } : l
        )})),

      convertToAcquisition: (listingId) =>
        set(s => {
          const listing = s.dealRadarListings.find(l => l.id === listingId);
          if (!listing) return {};
          const now = new Date().toISOString();
          const newDeal: AcquisitionDeal = {
            id: `deal-${Date.now()}`,
            name: listing.title,
            address: listing.address,
            city: listing.city,
            zip: listing.zip,
            usageType: listing.usageType,
            dealType: 'Investment',
            stage: 'Screening',
            askingPrice: listing.askingPrice,
            underwritingAssumptions: {
              purchasePrice: listing.askingPrice,
              closingCostPercent: s.settings.defaultClosingCostPct,
              brokerFeePercent: s.settings.defaultBrokerFeePct,
              initialCapex: 0,
              annualGrossRent: 0,
              vacancyRatePercent: s.settings.defaultVacancyRate,
              managementCostPercent: s.settings.defaultMgmtCostPct,
              maintenanceReservePerSqm: s.settings.defaultMaintenancePerSqm,
              nonRecoverableOpex: 0,
              area: listing.totalArea,
              rentPerSqm: 0,
              otherOperatingIncome: 0,
            },
            financingAssumptions: { loanAmount: Math.round(listing.askingPrice * 0.65), interestRate: 4.0, amortizationRate: 2.0, loanTerm: 10, lenderName: '', fixedRatePeriod: 5 },
            documents: [], activityLog: [{ id: `act-${Date.now()}`, timestamp: now, type: 'Note', title: 'Aus Deal Radar übernommen', description: `Quelle: ${listing.sourceLabel}\nURL: ${listing.sourceUrl}\nAI-Notizen: ${listing.aiNotes}`, user: 'M. Wagner' }],
            aiRecommendations: [], completenessScore: 25, createdAt: now, updatedAt: now,
            totalArea: listing.totalArea, broker: listing.sourceLabel,
          };
          return {
            deals: [...s.deals, newDeal],
            dealRadarListings: s.dealRadarListings.map(l => l.id === listingId ? { ...l, status: 'converted' as const, reviewedAt: now } : l),
          };
        }),

      updateRadarCriteria: (criteria) =>
        set(s => ({ dealRadarCriteria: { ...s.dealRadarCriteria, ...criteria } })),

      // ── Deal Sourcing & Screening (Module 07) ──
      runScreening: () =>
        set(s => ({
          candidateDeals: runLocalMatcher(s.candidateDeals, s.acquisitionProfiles, benchmarksToScreeningSeeds(s.benchmarks)),
          lastScreeningAt: new Date().toISOString(),
        })),

      ingestCandidatesFromListings: (listings) =>
        set(s => {
          const existingRefs = new Set(s.candidateDeals.map(c => c.sourceRef));
          const fresh = listings
            .map(listingToCandidate)
            .filter(c => !existingRefs.has(c.sourceRef))
            .map(c => ({ ...c, matches: [] }));
          const merged = runLocalMatcher([...fresh, ...s.candidateDeals], s.acquisitionProfiles, benchmarksToScreeningSeeds(s.benchmarks));
          return { candidateDeals: merged, lastScreeningAt: new Date().toISOString() };
        }),

      shortlistCandidate: (id, note) =>
        set(s => ({ candidateDeals: s.candidateDeals.map(c =>
          c.id === id ? { ...c, status: 'shortlisted' as const, reviewNote: note ?? c.reviewNote } : c) })),

      rejectCandidate: (id, reason) =>
        set(s => ({ candidateDeals: s.candidateDeals.map(c =>
          c.id === id ? { ...c, status: 'rejected' as const, rejectReason: reason } : c) })),

      promoteCandidate: (id) =>
        set(s => {
          const c = s.candidateDeals.find(x => x.id === id);
          if (!c) return {};
          const now = new Date().toISOString();
          // Seed Market Assumptions from the benchmark used for screening.
          const m = c.matches[0];
          const usageType: UsageType = assetClassToUsage(c.assetClass);
          const benchRentPerSqm = m && m.annualErv ? m.annualErv / c.areaSqm / 12 : 0;
          const newDeal: AcquisitionDeal = {
            id: `deal-${Date.now()}`,
            name: c.title,
            address: c.address,
            city: c.city,
            zip: '',
            submarket: c.submarket,
            usageType,
            dealType: 'Investment',
            stage: 'Screening',
            askingPrice: c.askingPrice,
            underwritingAssumptions: {
              purchasePrice: c.askingPrice,
              closingCostPercent: s.settings.defaultClosingCostPct,
              brokerFeePercent: s.settings.defaultBrokerFeePct,
              initialCapex: 0,
              annualGrossRent: m && m.annualErv ? Math.round(m.annualErv) : (c.currentRentPa ?? 0),
              vacancyRatePercent: s.settings.defaultVacancyRate,
              managementCostPercent: s.settings.defaultMgmtCostPct,
              maintenanceReservePerSqm: s.settings.defaultMaintenancePerSqm,
              nonRecoverableOpex: 0,
              area: c.areaSqm,
              rentPerSqm: benchRentPerSqm ? Math.round(benchRentPerSqm * 100) / 100 : 0,
              otherOperatingIncome: 0,
            },
            financingAssumptions: { loanAmount: Math.round(c.askingPrice * 0.65), interestRate: 4.0, amortizationRate: 2.0, loanTerm: 10, lenderName: '', fixedRatePeriod: 5 },
            documents: [],
            activityLog: [{
              id: `act-${Date.now()}`, timestamp: now, type: 'Note',
              title: 'Aus Deal Radar übernommen',
              description: `Quelle: ${c.sourceLabel}\nRef: ${c.sourceRef}` +
                (m ? `\nScreening (${m.profileName}): €/m² ${m.askingPricePerSqm} (${m.discountPricePct > 0 ? '−' : ''}${Math.abs(m.discountPricePct)} %), Faktor ${m.impliedFactor}×, Brutto-Rendite ${m.impliedGrossYield} % · Benchmark ${m.benchmarkAsOf}` : ''),
              user: 'M. Wagner',
            }],
            aiRecommendations: [], completenessScore: 30, createdAt: now, updatedAt: now,
            totalArea: c.areaSqm, broker: c.sourceLabel,
          };
          return {
            deals: [...s.deals, newDeal],
            candidateDeals: s.candidateDeals.map(x => x.id === id ? { ...x, status: 'promoted' as const } : x),
          };
        }),

      updateAcquisitionProfile: (id, patch) =>
        set(s => {
          const profiles = s.acquisitionProfiles.map(p => p.id === id ? { ...p, ...patch } : p);
          return {
            acquisitionProfiles: profiles,
            candidateDeals: runLocalMatcher(s.candidateDeals, profiles, benchmarksToScreeningSeeds(s.benchmarks)),
            lastScreeningAt: new Date().toISOString(),
          };
        }),

      updateSettings: (patch) => set(s => ({ settings: { ...s.settings, ...patch } })),

      resetToMockData: () => set({ assets: mockAssets, deals: mockDeals, developments: mockDevelopments, sales: mockSales, contacts: mockContacts, images: [], auditLog: mockAuditLog, newsReports: mockNewsReports, dealRadarListings: mockDealRadarListings, dealRadarCriteria: { cities: ['Berlin', 'München', 'Hamburg', 'Frankfurt am Main', 'Düsseldorf'], usageTypes: ['Wohnen', 'Büro', 'Logistik'], priceMin: 2_000_000, priceMax: 50_000_000, minArea: 500, maxArea: 50_000 }, settings: defaultSettings, benchmarks: [...mockBenchmarks, mockPortfolioBenchmark], marketEvents: mockMarketEvents, reportSources: mockReportSources, refreshJobs: mockRefreshJobs, candidateDeals: mockCandidateDeals, acquisitionProfiles: defaultAcquisitionProfiles, lastScreeningAt: '2026-06-23T07:00:00.000Z' }),
    }),
    {
      name: 'restate-storage-v3',
      // contacts removed from partialize — now served by /api/contacts (React Query)
      partialize: (s) => ({ assets: s.assets, deals: s.deals, developments: s.developments, sales: s.sales, images: s.images, auditLog: s.auditLog, newsReports: s.newsReports, dealRadarListings: s.dealRadarListings, dealRadarCriteria: s.dealRadarCriteria, settings: s.settings, benchmarks: s.benchmarks, marketEvents: s.marketEvents, reportSources: s.reportSources, refreshJobs: s.refreshJobs, candidateDeals: s.candidateDeals, acquisitionProfiles: s.acquisitionProfiles, lastScreeningAt: s.lastScreeningAt }),
    }
  )
);
