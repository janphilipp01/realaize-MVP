import { describe, it, expect } from 'vitest';
import {
  median,
  reconcile,
  validateBenchmark,
  confidenceTierFor,
  formatBenchmarkValue,
  quarterOrdinal,
  quarterLabelsEnding,
  modeledHistory,
  benchmarkSeries,
  benchmarksToScreeningSeeds,
} from '@/utils/marketIntelligence';
import type { BenchmarkRecord, BenchmarkSourceRecord } from '@/models/types';

// Characterization tests for the Market Intelligence reconciliation, validation
// and history helpers — the single place the benchmark rules live.

function src(partial: Partial<BenchmarkSourceRecord> & { value: number }): BenchmarkSourceRecord {
  return {
    id: `s-${Math.random().toString(36).slice(2, 7)}`,
    provider: 'JLL',
    unit: 'eur_sqm_month',
    trustScore: 0.9,
    confidenceScore: 0.9,
    documentTitle: 'doc',
    publishedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

function bench(partial: Partial<BenchmarkRecord> & { kpi: BenchmarkRecord['kpi']; value: number }): BenchmarkRecord {
  return {
    id: `b-${partial.kpi}`,
    city: 'Teststadt',
    assetClass: 'residential',
    unit: 'eur_sqm_month',
    periodQuarter: '2026-Q1',
    sourceType: 'extracted_report',
    sourceProvider: 'JLL',
    confidenceScore: 0.9,
    confidenceTier: 'pipeline_validated',
    validationStatus: 'auto_passed',
    dataAvailability: 'current',
    consolidationMethod: 'single_source',
    sourceCount: 1,
    extractedAt: '2026-01-01T00:00:00.000Z',
    sources: [],
    ...partial,
  };
}

describe('median', () => {
  it('handles odd, even and empty', () => {
    expect(median([1, 2, 3])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});

describe('reconcile', () => {
  it('single source → value taken directly', () => {
    const r = reconcile([src({ value: 10 })]);
    expect(r.method).toBe('single_source');
    expect(r.value).toBe(10);
    expect(r.sourceCount).toBe(1);
  });
  it('two sources → trust-weighted average', () => {
    const r = reconcile([
      src({ value: 10, trustScore: 0.9 }),
      src({ value: 12, trustScore: 0.7 }),
    ]);
    expect(r.method).toBe('trust_weighted');
    expect(r.value).toBe(10.87); // (10*0.9 + 12*0.7)/1.6 = 10.875, round2 → 10.87 (FP)
    expect(r.spread).toBe(2);
  });
  it('three sources → outlier-cleaned median', () => {
    const outlier = src({ value: 20 });
    const r = reconcile([src({ value: 10 }), src({ value: 10.5 }), outlier]);
    expect(r.method).toBe('median');
    expect(r.value).toBe(10.25); // median of the two non-outliers
    expect(r.flaggedOutliers).toContain(outlier.id);
    expect(outlier.isOutlier).toBe(true);
  });
});

describe('validateBenchmark', () => {
  it('auto-passes an in-range, high-confidence value', () => {
    const v = validateBenchmark({ assetClass: 'residential', kpi: 'erv', value: 15, confidenceScore: 0.9, sourceType: 'extracted_report' });
    expect(v.status).toBe('auto_passed');
    expect(v.flags).toHaveLength(0);
  });
  it('flags an out-of-range value → pending', () => {
    const v = validateBenchmark({ assetClass: 'residential', kpi: 'erv', value: 2, confidenceScore: 0.9, sourceType: 'extracted_report' });
    expect(v.status).toBe('pending');
    expect(v.flags.some(f => f.startsWith('Out of'))).toBe(true);
  });
  it('flags a large QoQ jump → pending', () => {
    const v = validateBenchmark({ assetClass: 'residential', kpi: 'erv', value: 20, priorValue: 15, confidenceScore: 0.9, sourceType: 'extracted_report' });
    expect(v.status).toBe('pending');
    expect(v.flags.some(f => f.startsWith('QoQ'))).toBe(true);
  });
});

describe('confidenceTierFor', () => {
  it('maps source types to tiers', () => {
    expect(confidenceTierFor('ai_qualitative')).toBe('ai_indicative');
    expect(confidenceTierFor('manual')).toBe('manual_override');
    expect(confidenceTierFor('extracted_report')).toBe('pipeline_validated');
  });
});

describe('formatBenchmarkValue', () => {
  it('formats each unit', () => {
    expect(formatBenchmarkValue(22.45, 'eur_sqm_month')).toBe('22.45 €/sqm');
    expect(formatBenchmarkValue(3.5, 'percent')).toBe('3.50 %');
    expect(formatBenchmarkValue(28, 'factor')).toBe('28.0×');
  });
});

describe('quarter helpers', () => {
  it('quarterOrdinal is monotonic', () => {
    expect(quarterOrdinal('2025-Q3')).toBe(2025 * 4 + 3);
    expect(quarterOrdinal('2026-Q1')).toBeGreaterThan(quarterOrdinal('2025-Q4'));
  });
  it('quarterLabelsEnding walks back inclusive', () => {
    expect(quarterLabelsEnding('2026-Q1', 4)).toEqual(['2025-Q2', '2025-Q3', '2025-Q4', '2026-Q1']);
  });
});

describe('history', () => {
  it('modeledHistory returns past quarters only, ending one before current', () => {
    const h = modeledHistory({ id: 'x', value: 20, priorValue: 19.5, periodQuarter: '2026-Q1' }, 8);
    expect(h).toHaveLength(7);
    expect(h[h.length - 1].periodQuarter).toBe('2025-Q4');
    expect(h.every(p => Number.isFinite(p.value))).toBe(true);
  });
  it('benchmarkSeries appends current and dedupes by quarter', () => {
    const rec = bench({ kpi: 'erv', value: 20, history: [{ periodQuarter: '2025-Q4', value: 19.5 }] });
    const s = benchmarkSeries(rec);
    expect(s).toEqual([
      { periodQuarter: '2025-Q4', value: 19.5 },
      { periodQuarter: '2026-Q1', value: 20 },
    ]);
    // current quarter present in history must be overridden by the current value
    const rec2 = bench({ kpi: 'erv', value: 21, history: [{ periodQuarter: '2026-Q1', value: 18 }] });
    expect(benchmarkSeries(rec2)).toEqual([{ periodQuarter: '2026-Q1', value: 21 }]);
  });
});

describe('benchmarksToScreeningSeeds', () => {
  it('derives rent = ERV, factor = multiplier, price = ERV*12*factor', () => {
    const seeds = benchmarksToScreeningSeeds([
      bench({ kpi: 'erv', value: 15, submarket: 'Pempelfort' }),
      bench({ kpi: 'multiplier', value: 24, unit: 'factor', submarket: 'Pempelfort' }),
    ]);
    expect(seeds).toHaveLength(1);
    expect(seeds[0]).toMatchObject({
      submarket: 'Pempelfort',
      rentPerSqmMonth: 15,
      factorMedian: 24,
      pricePerSqm: 15 * 12 * 24,
      asOf: '2026-Q1',
    });
  });
  it('skips rejected and portfolio_realised records', () => {
    const seeds = benchmarksToScreeningSeeds([
      bench({ kpi: 'erv', value: 15, validationStatus: 'rejected' }),
      bench({ kpi: 'multiplier', value: 24, unit: 'factor' }),
    ]);
    expect(seeds).toHaveLength(0);
  });
});
