// Market Intelligence Pipeline · reconciliation, validation & display helpers.
// Pure functions — the only place benchmark consolidation rules live.

import type {
  AssetClass,
  BenchmarkKpi,
  BenchmarkHistoryPoint,
  BenchmarkRecord,
  BenchmarkSourceRecord,
  BenchmarkUnit,
  ConfidenceTier,
  ConsolidationMethod,
  BenchmarkSourceType,
  ValidationStatus,
  ScreeningBenchmarkSeed,
} from '@/models/types';

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

// ── Benchmark history (time series) ───────────────────────────────────────────
// The single place quarter math and the modeled back-fill live. Real quarters
// are persisted on BenchmarkRecord.history; until enough accrue, `modeledHistory`
// reconstructs the prior quarters from the current value + prior-quarter value.

/** Sortable ordinal for an ISO quarter label, e.g. '2025-Q3' → 8103. */
export function quarterOrdinal(q: string): number {
  const [y, n] = q.split('-Q');
  return Number(y) * 4 + Number(n);
}

/** The `n` ISO quarter labels ending at `end` (inclusive), oldest → newest. */
export function quarterLabelsEnding(end: string, n: number): string[] {
  const [ys, qs] = end.split('-Q');
  let y = Number(ys), q = Number(qs);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.unshift(`${y}-Q${q}`);
    q -= 1;
    if (q === 0) { q = 4; y -= 1; }
  }
  return out;
}

function seededRng(str: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  let s = h >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic reconstructed history (past quarters only, oldest → newest,
 * excluding the current periodQuarter). Extends the most recent QoQ delta
 * backwards with damping + tiny seeded noise. Used to seed the persisted series
 * and as the History view's fallback until real quarters accrue.
 */
export function modeledHistory(
  rec: { id: string; value: number; priorValue?: number; periodQuarter: string },
  quarters = 8,
): BenchmarkHistoryPoint[] {
  const labels = quarterLabelsEnding(rec.periodQuarter, quarters);
  const rnd = seededRng(rec.id);
  const prior = rec.priorValue && rec.priorValue > 0 ? rec.priorValue : rec.value * 0.99;
  const g = rec.value / prior - 1;
  const vals = new Array<number>(quarters);
  vals[quarters - 1] = rec.value;
  for (let i = quarters - 2; i >= 0; i--) {
    const step = g * Math.pow(0.82, (quarters - 2) - i);
    const noise = i === quarters - 2 ? 0 : (rnd() - 0.5) * Math.abs(rec.value) * 0.006;
    vals[i] = Math.round((vals[i + 1] / (1 + step) + noise) * 100) / 100;
  }
  return labels.slice(0, quarters - 1).map((q, i) => ({ periodQuarter: q, value: vals[i] }));
}

/**
 * Full display series for a record: persisted history (or modeled fallback)
 * plus the current quarter, deduped by quarter (current value authoritative),
 * oldest → newest.
 */
export function benchmarkSeries(rec: BenchmarkRecord): BenchmarkHistoryPoint[] {
  const past = rec.history && rec.history.length > 0 ? rec.history : modeledHistory(rec);
  const byQuarter = new Map<string, number>();
  for (const p of past) byQuarter.set(p.periodQuarter, p.value);
  byQuarter.set(rec.periodQuarter, rec.value); // current is authoritative
  return Array.from(byQuarter.entries())
    .map(([periodQuarter, value]) => ({ periodQuarter, value }))
    .sort((a, b) => quarterOrdinal(a.periodQuarter) - quarterOrdinal(b.periodQuarter));
}
