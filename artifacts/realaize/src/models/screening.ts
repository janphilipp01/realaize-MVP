// Screening enums are owned by @workspace/screening (the shared engine). We
// import them for local use and re-export below, so app code keeps one import
// surface (models/types) and there is a single source of truth.
import type { ScreeningMode, ScreeningAssetClass, MatchSignal, BenchmarkConfidence } from '@workspace/screening';

// ─── Deal Sourcing & Screening Pipeline · Module 07 ──────────────────────────
// Two market-anchored tests (€/m² · Faktor) screen every candidate against the
// active acquisition profiles. See concept: realaize · Deal Sourcing & Screening.

export type { ScreeningMode, ScreeningAssetClass, MatchSignal, BenchmarkConfidence };

export type SourceChannel =
  | 'platform_immoscout' | 'platform_immowelt' | 'broker_crawl' | 'inbox' | 'manual_upload';

export type CandidateStatus =
  | 'pending_extraction' | 'new' | 'matched' | 'unmatched'
  | 'shortlisted' | 'rejected' | 'promoted' | 'inactive';

// Editable mandate definition (acquisition_profiles).
export interface AcquisitionProfile {
  id: string;
  name: string;
  shortLabel: string;            // "V-A" / "C+" chip
  screeningMode: ScreeningMode;
  cities: string[];
  submarkets?: string[];
  assetClasses: ScreeningAssetClass[];
  priceMin: number;
  priceMax: number;
  areaMin: number;
  areaMax: number;
  minDiscountPricePct: number;
  minDiscountFactorPct?: number | null;
  minGrossYieldPct?: number | null;
  active: boolean;
}

// Reconciled benchmark inputs (Market Intelligence) per submarket × asset class.
export interface ScreeningBenchmarkSeed {
  city: string;
  submarket?: string;
  assetClass: ScreeningAssetClass;
  pricePerSqm: number;           // €/m² transaction Vergleichswert
  rentPerSqmMonth: number;       // Kaltmiete €/m²/month (ERV basis)
  factorMedian: number;          // transaction multiplier on annual gross rent
  rentGrowthPaPct?: number;      // informational only
  asOf: string;                  // quarter label, e.g. 2026-Q2
}

// One screening read-out: candidate × profile (profile_matches).
export interface ProfileMatch {
  profileId: string;
  profileName: string;
  profileLabel: string;
  screeningMode: ScreeningMode;
  benchmarkAsOf: string;
  benchmarkConfidence: BenchmarkConfidence;
  askingPricePerSqm: number;
  benchmarkPricePerSqm: number;
  discountPricePct: number;
  annualErv: number;
  impliedFactor: number;
  impliedGrossYield: number;     // percent
  benchmarkFactor: number;
  discountFactorPct: number;
  passA: boolean;
  passB: boolean;
  signal: MatchSignal;
}

// One extracted opportunity (candidate_deals) with its profile matches attached.
export interface CandidateDeal {
  id: string;
  sourceChannel: SourceChannel;
  sourceRef: string;             // listing URL or message-id
  sourceLabel: string;           // human label, e.g. "Aengevelt"
  title: string;
  address: string;
  city: string;
  submarket?: string;
  assetClass: ScreeningAssetClass;
  askingPrice: number;
  areaSqm: number;
  currentRentPa?: number;
  yearBuilt?: number;
  vacancyState?: string;
  numUnits?: number;
  description?: string;
  aiNotes?: string;
  status: CandidateStatus;
  listingActive: boolean;
  rejectReason?: string;
  reviewNote?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  matches: ProfileMatch[];
}
