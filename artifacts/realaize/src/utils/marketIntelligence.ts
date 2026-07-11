// Market Intelligence Pipeline · reconciliation, validation & display helpers.
// Pure functions — the only place benchmark consolidation rules live.

import type {
  AssetClass,
  BenchmarkKpi,
  BenchmarkRecord,
  BenchmarkSourceRecord,
  BenchmarkUnit,
  ConfidenceTier,
  ConsolidationMethod,
  BenchmarkSourceType,
  ValidationStatus,
  ScreeningBenchmarkSeed,
} from '../models/types';

// ── Labels ──────────────────────────────────────────────────────────────────

export const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  residential: 'Residential',
  office: 'Office',
  retail: 'Retail',
  logistics: 'Logistics',
  mixed_use: 'Mixed Use',
};

export const KPI_LABEL: Record<BenchmarkKpi, string> = {
  prime_rent: 'Prime rent',
  erv: 'Average rent / ERV',
  prime_yield: 'Prime yield',
  net_initial_yield: 'Net initial yield',
  vacancy: 'Vacancy rate',
  multiplier: 'Multiplier',
};

export const KPI_UNIT: Record<BenchmarkKpi, BenchmarkUnit> = {
  prime_rent: 'eur_sqm_month',
  erv: 'eur_sqm_month',
  prime_yield: 'percent',
  net_initial_yield: 'percent',
  vacancy: 'percent',
  multiplier: 'factor',
};

export function formatBenchmarkValue(value: number, unit: BenchmarkUnit): string {
  switch (unit) {
    case 'eur_sqm_month':
      return `${value.toFixed(2)} €/sqm`;
    case 'percent':
      return `${value.toFixed(2)} %`;
    case 'factor':
      return `${value.toFixed(1)}×`;
  }
}

// ── Plausibility ranges per asset class × KPI ────────────────────────────────
// Initial values based on known German market ranges; calibrated iteratively.

type Range = { min: number; max: number };

export const PLAUSIBILITY_RANGES: Partial<
  Record<AssetClass, Partial<Record<BenchmarkKpi, Range>>>
> = {
  residential: {
    // Widened at the low end to admit weaker Ruhr/B-markets alongside the
    // Top-7 (e.g. Gelsenkirchen ERV ~7 €/m², factor ~18×, NIY ~5.4%).
    prime_rent: { min: 9, max: 40 },
    erv: { min: 6.5, max: 30 },
    net_initial_yield: { min: 2.5, max: 6.0 },
    prime_yield: { min: 2.5, max: 5.5 },
    vacancy: { min: 0, max: 8 },
    multiplier: { min: 16, max: 32 },
  },
  office: {
    prime_rent: { min: 14, max: 55 },
    erv: { min: 8, max: 40 },
    net_initial_yield: { min: 3.0, max: 6.5 },
    prime_yield: { min: 3.0, max: 6.0 },
    vacancy: { min: 1, max: 14 },
  },
  retail: {
    prime_rent: { min: 20, max: 320 },
    erv: { min: 8, max: 200 },
    net_initial_yield: { min: 3.5, max: 7.0 },
    prime_yield: { min: 3.5, max: 6.5 },
    vacancy: { min: 1, max: 15 },
  },
  logistics: {
    prime_rent: { min: 4, max: 12 },
    erv: { min: 3, max: 10 },
    net_initial_yield: { min: 3.5, max: 6.5 },
    prime_yield: { min: 3.5, max: 6.0 },
    vacancy: { min: 0, max: 8 },
  },
};

// ── Statistics ───────────────────────────────────────────────────────────────

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

const OUTLIER_THRESHOLD = 0.15; // >15% deviation from median

export interface ReconciliationResult {
  value: number;
  method: ConsolidationMethod;
  sourceCount: number;
  spread: number; // max − min across non-outlier sources
  flaggedOutliers: string[]; // source ids
}

/**
 * Multi-broker reconciliation.
 *  ≥3 sources → median (outlier-cleaned), spread as quality indicator.
 *  2 sources  → trust-score-weighted average.
 *  1 source   → value taken directly, single-source flag.
 * Mutates `isOutlier` on the passed source records.
 */
export function reconcile(sources: BenchmarkSourceRecord[]): ReconciliationResult {
  const present = sources.filter(s => Number.isFinite(s.value));
  const n = present.length;

  if (n === 0) {
    return { value: 0, method: 'single_source', sourceCount: 0, spread: 0, flaggedOutliers: [] };
  }

  if (n === 1) {
    present[0].isOutlier = false;
    return {
      value: present[0].value,
      method: 'single_source',
      sourceCount: 1,
      spread: 0,
      flaggedOutliers: [],
    };
  }

  if (n === 2) {
    const totalTrust = present.reduce((acc, s) => acc + s.trustScore, 0) || 1;
    const weighted =
      present.reduce((acc, s) => acc + s.value * s.trustScore, 0) / totalTrust;
    present.forEach(s => (s.isOutlier = false));
    const vals = present.map(s => s.value);
    return {
      value: round2(weighted),
      method: 'trust_weighted',
      sourceCount: 2,
      spread: round2(Math.max(...vals) - Math.min(...vals)),
      flaggedOutliers: [],
    };
  }

  // ≥3 sources → median with outlier flagging
  const med = median(present.map(s => s.value));
  const flaggedOutliers: string[] = [];
  present.forEach(s => {
    const deviation = med === 0 ? 0 : Math.abs(s.value - med) / med;
    s.isOutlier = deviation > OUTLIER_THRESHOLD;
    if (s.isOutlier) flaggedOutliers.push(s.id);
  });
  const clean = present.filter(s => !s.isOutlier);
  const reconciledValue = median(clean.map(s => s.value));
  const cleanVals = clean.map(s => s.value);
  return {
    value: round2(reconciledValue),
    method: 'median',
    sourceCount: present.length,
    spread: round2(Math.max(...cleanVals) - Math.min(...cleanVals)),
    flaggedOutliers,
  };
}

export function confidenceTierFor(sourceType: BenchmarkSourceType): ConfidenceTier {
  switch (sourceType) {
    case 'ai_qualitative':
      return 'ai_indicative';
    case 'manual':
      return 'manual_override';
    default:
      return 'pipeline_validated';
  }
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface ValidationResult {
  status: ValidationStatus;
  flags: string[];
}

const QOQ_JUMP_THRESHOLD = 0.15; // ±15% vs prior quarter

/**
 * Range + plausibility + QoQ checks.
 * In-range AND confidence ≥0.85 → auto_passed. Otherwise → pending.
 */
export function validateBenchmark(
  record: Pick<
    BenchmarkRecord,
    'assetClass' | 'kpi' | 'value' | 'confidenceScore' | 'priorValue' | 'sourceType'
  >,
): ValidationResult {
  const flags: string[] = [];
  const range = PLAUSIBILITY_RANGES[record.assetClass]?.[record.kpi];

  if (range && (record.value < range.min || record.value > range.max)) {
    flags.push(
      `Out of plausibility range (${range.min}–${range.max})`,
    );
  }

  if (record.priorValue && record.priorValue > 0) {
    const jump = Math.abs(record.value - record.priorValue) / record.priorValue;
    if (jump > QOQ_JUMP_THRESHOLD) {
      flags.push(`QoQ jump ${(jump * 100).toFixed(1)}% vs prior quarter`);
    }
  }

  if (record.sourceType === 'ai_qualitative') {
    flags.push('AI qualitative — indicative, not IC-quotable');
  }

  const inRange = !flags.some(f => f.startsWith('Out of') || f.startsWith('QoQ'));
  const status: ValidationStatus =
    inRange && record.confidenceScore >= 0.85 && record.sourceType !== 'ai_qualitative'
      ? 'auto_passed'
      : 'pending';

  return { status, flags };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Adapter → Deal Sourcing screening benchmarks ──────────────────────────────
// Makes Market Intelligence the single source of market assumptions across every
// stage. Derives the screening benchmark seeds the Deal Radar / matcher consume
// from the validated benchmark master:
//   rentPerSqmMonth = ERV, factorMedian = multiplier (or (1−nonRec)/NIY),
//   pricePerSqm     = ERV × 12 × factor.

const SCREEN_NON_RECOVERABLE = 0.10;

export function benchmarksToScreeningSeeds(
  benchmarks: BenchmarkRecord[],
): ScreeningBenchmarkSeed[] {
  const groups = new Map<string, BenchmarkRecord[]>();
  for (const b of benchmarks) {
    if (b.validationStatus === 'rejected') continue;
    if (b.sourceType === 'portfolio_realised') continue; // realized, not a market comp
    const key = `${b.city}|${b.submarket ?? ''}|${b.assetClass}`;
    const arr = groups.get(key);
    if (arr) arr.push(b);
    else groups.set(key, [b]);
  }

  const seeds: ScreeningBenchmarkSeed[] = [];
  for (const recs of groups.values()) {
    const pick = (kpi: BenchmarkKpi) => recs.find(r => r.kpi === kpi);
    const ervRec = pick('erv') ?? pick('prime_rent');
    if (!ervRec) continue; // rent basis is required

    const multRec = pick('multiplier');
    const niyRec = pick('net_initial_yield') ?? pick('prime_yield');
    let factorMedian: number;
    if (multRec) {
      factorMedian = multRec.value;
    } else if (niyRec && niyRec.value > 0) {
      factorMedian = (1 - SCREEN_NON_RECOVERABLE) / (niyRec.value / 100);
    } else {
      continue; // no factor derivable
    }

    seeds.push({
      city: ervRec.city,
      submarket: ervRec.submarket,
      assetClass: ervRec.assetClass,
      pricePerSqm: Math.round(ervRec.value * 12 * factorMedian),
      rentPerSqmMonth: ervRec.value,
      factorMedian: Math.round(factorMedian * 10) / 10,
      asOf: ervRec.periodQuarter,
    });
  }
  return seeds;
}
