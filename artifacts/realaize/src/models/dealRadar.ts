import type { UsageType } from './core';

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
