// ─── Market Intelligence Pipeline · Module 06 ────────────────────────────────
// Source-attributed, multi-broker-validated market data layer.
// See concept: realaize · Market Intelligence Pipeline.

export type AssetClass = 'residential' | 'office' | 'retail' | 'logistics' | 'mixed_use';

export type BenchmarkKpi =
  | 'prime_rent'
  | 'erv'
  | 'prime_yield'
  | 'net_initial_yield'
  | 'vacancy'
  | 'multiplier';

export type BenchmarkUnit = 'eur_sqm_month' | 'percent' | 'factor';

export type BrokerProvider =
  | 'JLL'
  | 'CBRE'
  | 'BNP'
  | 'Savills'
  | 'Colliers'
  | 'C&W'
  | 'Lestate';

export type BenchmarkSourceType =
  | 'extracted_report'
  | 'ai_qualitative'
  | 'manual'
  | 'portfolio_realised';

export type ConfidenceTier =
  | 'pipeline_validated'
  | 'ai_indicative'
  | 'manual_override';

export type ValidationStatus =
  | 'auto_passed'
  | 'manual_approved'
  | 'pending'
  | 'rejected';

export type DataAvailability = 'current' | 'last_available' | 'unavailable';

export type ConsolidationMethod = 'median' | 'trust_weighted' | 'single_source';

// One persisted historical data point of a benchmark's reconciled value.
export interface BenchmarkHistoryPoint {
  periodQuarter: string; // ISO quarter, e.g. 2025-Q3
  value: number;         // reconciled value as of that quarter
}

// One reconciled master value per market × asset class × KPI × quarter.
export interface BenchmarkRecord {
  id: string;
  city: string;
  submarket?: string;
  assetClass: AssetClass;
  kpi: BenchmarkKpi;
  value: number;            // reconciled, normalized
  unit: BenchmarkUnit;
  periodQuarter: string;    // ISO quarter, e.g. 2026-Q1
  sourceType: BenchmarkSourceType;
  sourceProvider: string;   // reconciled label, e.g. "6 brokers" or "Lestate"
  confidenceScore: number;  // 0.00–1.00
  confidenceTier: ConfidenceTier;
  validationStatus: ValidationStatus;
  dataAvailability: DataAvailability;
  consolidationMethod: ConsolidationMethod;
  sourceCount: number;      // brokers contributing to this reconciled value
  valueSpread?: number;     // max − min across broker values
  priorValue?: number;      // prior-quarter value for QoQ check
  extractedAt: string;
  // Provenance sub-records (market_benchmarks_sources)
  sources: BenchmarkSourceRecord[];
  // Validation/review trail
  validationFlags?: string[];
  reviewNote?: string;
  // Persisted quarterly time series (oldest → newest, excludes the current
  // periodQuarter which is held by `value`). Each quarterly refresh appends the
  // then-current value here, so the History view reads real stored points.
  history?: BenchmarkHistoryPoint[];
}

// Individual broker contribution behind a reconciled master value.
export interface BenchmarkSourceRecord {
  id: string;
  provider: BrokerProvider;
  value: number;
  unit: BenchmarkUnit;
  trustScore: number;        // 0.00–1.00, used for ≤2-source weighting
  confidenceScore: number;
  documentTitle: string;
  pageNo?: number;
  originalText?: string;     // verbatim quote — audit trail
  isOutlier?: boolean;       // deviation >15% from median
  publishedAt: string;
}

export type MarketEventType =
  | 'deal'
  | 'leasing'
  | 'interest_rates'
  | 'regulation'
  | 'capital_markets'
  | 'macro';

export type ImpactTier = 'low' | 'medium' | 'high';

// News layer — descriptive only, JOINed to benchmarks at display time.
export interface MarketEventRecord {
  id: string;
  eventType: MarketEventType;
  city?: string;
  assetClass?: AssetClass;
  impactTier: ImpactTier;
  headline: string;
  summary: string;
  sourceUrl: string;
  publishedAt: string;
}

// report_sources catalog — one row per provider × asset class × market.
export interface ReportSource {
  id: string;
  provider: BrokerProvider;
  assetClass: AssetClass;
  market: string;
  hubUrl: string;
  selectorPattern: string;
  cadence: 'quarterly' | 'semi-annual' | 'annual';
  status: 'ok' | 'broken' | 'manual_upload';
  lastFetchedAt?: string;
}

export type RefreshTrigger = 'cron' | 'manual';
export type RefreshJobStatus = 'running' | 'completed' | 'failed';

export interface RefreshJob {
  id: string;
  triggeredAt: string;
  trigger: RefreshTrigger;
  triggeredBy: string;
  status: RefreshJobStatus;
  periodQuarter: string;
  reportsFetched: number;
  dataPointsExtracted: number;
  autoPassed: number;
  pendingReview: number;
  completedAt?: string;
}
