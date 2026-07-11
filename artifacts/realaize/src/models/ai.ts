import type { ConfidenceLevel, RecommendationType } from './core';

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
