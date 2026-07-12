// Market Intelligence factory/helper functions — build BenchmarkRecords from raw
// broker inputs (provenance, reconciliation, modeled history). Pure builders;
// the seed data that calls them lives in ./marketIntelData.ts.

import type { BenchmarkKpi, BenchmarkRecord, BenchmarkSourceRecord, BenchmarkSourceType, BrokerProvider, AssetClass } from '@/models/types';
import { confidenceTierFor, KPI_UNIT, reconcile, validateBenchmark } from '@/utils/marketIntelligence';

export const PERIOD = '2026-Q1';

const TRUST: Record<BrokerProvider, number> = {
  JLL: 0.92,
  CBRE: 0.91,
  BNP: 0.88,
  Savills: 0.88,
  Colliers: 0.9,
  'C&W': 0.86,
  Lestate: 0.95,
};

let seq = 0;
const nextId = (p: string) => `${p}-${(++seq).toString().padStart(3, '0')}`;

export interface BrokerInput {
  provider: BrokerProvider;
  value: number;
  pageNo: number;
  originalText: string;
  confidence?: number;
}

function makeSources(
  kpi: BenchmarkKpi,
  inputs: BrokerInput[],
  publishedAt: string,
): BenchmarkSourceRecord[] {
  return inputs.map(i => ({
    id: nextId('src'),
    provider: i.provider,
    value: i.value,
    unit: KPI_UNIT[kpi],
    trustScore: TRUST[i.provider],
    confidenceScore: i.confidence ?? 0.9,
    documentTitle: `${i.provider} ${kpiDocTitle(kpi)} ${PERIOD}`,
    pageNo: i.pageNo,
    originalText: i.originalText,
    publishedAt,
  }));
}

function kpiDocTitle(kpi: BenchmarkKpi): string {
  if (kpi === 'multiplier' || kpi === 'erv' || kpi === 'prime_rent')
    return 'Residential Market Report';
  return 'Investment Market Report';
}

export interface BenchmarkInput {
  city: string;
  submarket?: string;
  assetClass: AssetClass;
  kpi: BenchmarkKpi;
  brokers: BrokerInput[];
  priorValue?: number;
  publishedAt?: string;
  sourceType?: BenchmarkSourceType;
  // override for non-extracted records (ai_qualitative / portfolio_realised)
  directValue?: number;
  providerLabel?: string;
  note?: string;
}

export function makeBenchmark(input: BenchmarkInput): BenchmarkRecord {
  const publishedAt = input.publishedAt ?? '2026-04-08T00:00:00.000Z';
  const sourceType: BenchmarkSourceType = input.sourceType ?? 'extracted_report';
  const sources = makeSources(input.kpi, input.brokers, publishedAt);

  let value: number;
  let consolidationMethod: BenchmarkRecord['consolidationMethod'];
  let sourceCount: number;
  let valueSpread: number | undefined;

  if (sourceType === 'extracted_report' && sources.length > 0) {
    const r = reconcile(sources);
    value = r.value;
    consolidationMethod = r.method;
    sourceCount = r.sourceCount;
    valueSpread = r.spread;
  } else {
    value = input.directValue ?? 0;
    consolidationMethod = 'single_source';
    sourceCount = sources.length || 1;
    valueSpread = undefined;
  }

  const confidenceScore =
    sourceType === 'ai_qualitative'
      ? 0.55
      : sourceType === 'portfolio_realised'
        ? 0.97
        : Math.min(
            0.98,
            sources.reduce((a, s) => a + s.confidenceScore, 0) /
              Math.max(1, sources.length) +
              (sourceCount >= 3 ? 0.04 : 0),
          );

  const validation = validateBenchmark({
    assetClass: input.assetClass,
    kpi: input.kpi,
    value,
    confidenceScore,
    priorValue: input.priorValue,
    sourceType,
  });

  return {
    id: nextId('bm'),
    city: input.city,
    submarket: input.submarket,
    assetClass: input.assetClass,
    kpi: input.kpi,
    value,
    unit: KPI_UNIT[input.kpi],
    periodQuarter: PERIOD,
    sourceType,
    sourceProvider:
      input.providerLabel ??
      (sourceCount > 1 ? `${sourceCount} brokers` : sources[0]?.provider ?? '—'),
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    confidenceTier: confidenceTierFor(sourceType),
    validationStatus: validation.status,
    dataAvailability: 'current',
    consolidationMethod,
    sourceCount,
    valueSpread,
    priorValue: input.priorValue,
    extractedAt: '2026-06-15T03:12:00.000Z',
    sources,
    validationFlags: validation.flags.length ? validation.flags : undefined,
    reviewNote: input.note,
  };
}

// ── Benchmarks ────────────────────────────────────────────────────────────────

// Compact submarket comp: one ERV + one multiplier record (single provider).
export function makeComp(
  city: string,
  submarket: string | undefined,
  assetClass: AssetClass,
  erv: number,
  multiplier: number,
): BenchmarkRecord[] {
  const where = submarket ?? city;
  return [
    makeBenchmark({
      city, submarket, assetClass, kpi: 'erv',
      brokers: [{ provider: 'Colliers', value: erv, pageNo: 1, originalText: `${where} Durchschnittsmiete ${erv.toFixed(2)} €/m²` }],
    }),
    makeBenchmark({
      city, submarket, assetClass, kpi: 'multiplier',
      brokers: [{ provider: 'Colliers', value: multiplier, pageNo: 1, originalText: `${where} Vervielfältiger ${multiplier.toFixed(1)}×` }],
    }),
  ];
}

// Single multiplier record (for submarkets that already carry an ERV).
export function makeMult(
  city: string,
  submarket: string | undefined,
  assetClass: AssetClass,
  multiplier: number,
): BenchmarkRecord {
  return makeBenchmark({
    city, submarket, assetClass, kpi: 'multiplier',
    brokers: [{ provider: 'Colliers', value: multiplier, pageNo: 1, originalText: `${submarket ?? city} Vervielfältiger ${multiplier.toFixed(1)}×` }],
  });
}

// Compact residential profile for a secondary market: three broker quotes per
// KPI around a central value, so reconciliation (median + spread) still applies.
export function ruhrProfile(
  city: string,
  v: { prime: number; erv: number; niy: number; mult: number; vac: number },
): BenchmarkRecord[] {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const trio = (val: number, spread: number, label: string): BrokerInput[] => [
    { provider: 'JLL', value: r2(val - spread), pageNo: 6, originalText: `${city} ${label}: ${r2(val - spread)}` },
    { provider: 'Colliers', value: r2(val), pageNo: 14, originalText: `${city} ${label}: ${r2(val)}` },
    { provider: 'CBRE', value: r2(val + spread), pageNo: 5, originalText: `${city} ${label}: ${r2(val + spread)}` },
  ];
  const mk = (kpi: BenchmarkKpi, val: number, spread: number, prior: number, label: string) =>
    makeBenchmark({ city, assetClass: 'residential', kpi, priorValue: prior, brokers: trio(val, spread, label) });
  return [
    mk('prime_rent', v.prime, 0.3, r2(v.prime * 0.97), 'Spitzenmiete Wohnen'),
    mk('erv', v.erv, 0.15, r2(v.erv * 0.96), 'Durchschnittsmiete Wohnen'),
    mk('net_initial_yield', v.niy, 0.05, r2(v.niy * 1.02), 'Nettoanfangsrendite Wohnen'),
    mk('multiplier', v.mult, 0.2, r2(v.mult * 0.98), 'Vervielfältiger Wohnen'),
    mk('vacancy', v.vac, 0.1, r2(v.vac * 1.03), 'Leerstandsquote Wohnen'),
  ];
}

