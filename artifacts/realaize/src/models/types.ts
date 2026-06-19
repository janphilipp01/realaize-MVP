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

// ─── AI / Recommendations ────────────────────────────────────────────────────

export interface AIRecommendation {
  id: string;
  dealId: string;
  type: RecommendationType;
  title: string;
  body: string;
  confidence: ConfidenceLevel;
  deviationPercent?: number;
  benchmarkLabel?: string;
  benchmarkValue?: number;
  userValue?: number;
  generatedAt: string;
  isAlert: boolean;
}

// ─── Market Intelligence ─────────────────────────────────────────────────────

export interface MarketLocation {
  id: string;
  city: string;
  submarket: string;
  region: string;
  benchmarks: MarketBenchmark[];
  updateLog: MarketUpdateEntry[];
  lastUpdated: string;
}

export interface MarketBenchmark {
  id: string;
  locationId: string;
  usageType: UsageType;
  rentMin: number; // EUR/sqm/month
  rentMax: number;
  rentMedian: number;
  purchasePriceMin: number; // EUR/sqm
  purchasePriceMax: number;
  purchasePriceMedian: number;
  multiplierMin: number;
  multiplierMax: number;
  multiplierMedian: number;
  vacancyRatePercent: number;
  confidenceScore: number; // 0-100
  sourceLabel: string;
  lastUpdated: string;
  notes?: string;
}

export interface MarketUpdateEntry {
  id: string;
  locationId: string;
  timestamp: string;
  updatedBy: string;
  changes: string;
  sourceLabel: string;
}

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

// ─── Sales ───────────────────────────────────────────────────────────────────

export type SaleStatus = 'Vorbereitung' | 'Aktiv' | 'Closing' | 'Verkauft' | 'Zurückgezogen';
export type BuyerStage = 'Kontaktiert' | 'Besichtigung' | 'NDA' | 'Angebot' | 'LOI' | 'Due Diligence' | 'Signing' | 'Closing' | 'Abgesagt';

export interface SaleObject {
  id: string;
  sourceType: 'Asset' | 'Development';
  sourceId: string;
  name: string;
  address: string;
  city: string;
  zip: string;
  usageType: UsageType;
  status: SaleStatus;
  targetPrice: number;
  minimumPrice: number;
  askingPrice: number;
  totalCost: number; // purchase + development costs
  buyers: BuyerLead[];
  documents: Document[];
  activityLog: ActivityEntry[];
  images: ProjectImage[];
  createdAt: string;
  updatedAt: string;
  notes?: string;
  // sold fields
  soldAt?: string;
  soldPrice?: number;
  disposalGain?: number;
  // from source
  annualRent?: number;
  area?: number;
  noi?: number;
}

export interface BuyerLead {
  id: string;
  saleId: string;
  contactId?: string; // address book ref
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  stage: BuyerStage;
  offeredPrice?: number;
  notes?: string;
  lastContact: string;
  createdAt: string;
}

// ─── Address Book ─────────────────────────────────────────────────────────────

export type ContactCategory =
  | 'Handwerker' | 'Architekt & Planer' | 'Property Manager' | 'Facility Manager'
  | 'Hausverwaltung' | 'Mieter' | 'Potentieller Mieter' | 'Banker & Finanzierer'
  | 'Makler' | 'Potentieller Käufer' | 'Käufer' | 'Potentieller Investor'
  | 'Investor' | 'Stadtverwaltung' | 'Anderer Eigentümer' | 'Sonstiges';

export type HandwerkerSubcategory =
  | 'Rohbau' | 'Elektro' | 'Sanitär' | 'Heizung' | 'Trockenbau'
  | 'Maler & Lackierer' | 'Dach' | 'Fassade' | 'Aufzug' | 'Lüftung'
  | 'Fliesen' | 'Böden' | 'Schreiner' | 'Metall & Stahl' | 'Sonstiges';

export interface Contact {
  id: string;
  category: ContactCategory;
  subcategory?: HandwerkerSubcategory; // only for Handwerker
  firstName: string;
  lastName: string;
  company?: string;
  position?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  city?: string;
  website?: string;
  notes?: string;
  linkedObjectIds?: string[]; // asset/deal/dev/sale IDs
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

// ─── News & Daily Intelligence ──────────────────────────────────────────────

export type NewsCategory =
  | 'Deals & Transactions'
  | 'Leasing & Lettings'
  | 'Interest Rates & Monetary Policy'
  | 'Regulation & Policy'
  | 'Capital Markets'
  | 'Macro & Global Economy';

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;       // 1-2 sentence summary
  sourceLabel: string;    // e.g. "Immobilien Zeitung", "Handelsblatt"
  sourceUrl: string;      // link to original article
  category: NewsCategory;
  publishedAt: string;    // ISO date
  impactRating: 'high' | 'medium' | 'low'; // relevance for RE market
}

export interface DailyIntelligenceReport {
  id: string;
  date: string;           // YYYY-MM-DD
  articles: NewsArticle[];
  executiveSummary: string;  // AI-generated daily briefing
  marketImpactAnalysis: string; // AI analysis of impact on German RE
  generatedAt: string;    // ISO timestamp
}

// ─── Deal Radar / Transaction Finder ────────────────────────────────────────

export type RadarListingStatus = 'new' | 'reviewed' | 'shortlisted' | 'dismissed' | 'converted';

export interface DealRadarSearchCriteria {
  cities: string[];            // e.g. ['Berlin', 'München', 'Hamburg']
  usageTypes: UsageType[];     // e.g. ['Wohnen', 'Büro']
  priceMin: number;            // EUR
  priceMax: number;            // EUR
  minArea: number;             // sqm
  maxArea: number;             // sqm
}

export interface DealRadarListing {
  id: string;
  title: string;
  address: string;
  city: string;
  zip: string;
  usageType: UsageType;
  askingPrice: number;
  pricePerSqm: number;
  totalArea: number;
  yearBuilt?: number;
  description: string;
  sourceLabel: string;         // e.g. 'ImmobilienScout24', 'CBRE', 'JLL'
  sourceUrl: string;
  status: RadarListingStatus;
  aiNotes: string;             // AI assessment / quick take
  estimatedYield?: number;     // AI-estimated rough NIY
  imageUrl?: string;
  foundAt: string;             // ISO timestamp
  reviewedAt?: string;
  reviewNote?: string;
}

// ─── Calendar / Appointments ─────────────────────────────────────────────────

export type AppointmentCategory =
  | 'Kauf' | 'Verkauf' | 'Vermietung' | 'Bau'
  | 'Verwaltung' | 'Finanzierung' | 'Business Development'
  | 'Steuer' | 'Recht';

export interface Appointment {
  id: string;
  title: string;
  date: string;        // YYYY-MM-DD
  time: string;        // HH:MM
  endTime?: string;    // HH:MM
  location?: string;
  participants?: string;
  assetId?: string;    // optional link to portfolio asset
  category: AppointmentCategory;
  notes?: string;
  createdAt: string;
}

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
