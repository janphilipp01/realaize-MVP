import type { UsageType } from '@/models/core';

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
