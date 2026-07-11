// Seed data for the Market Intelligence Pipeline (Module 06).
// Multi-broker benchmarks with provenance, the news layer, the report_sources
// catalog and refresh-job history. Values are illustrative but plausible.

import type {
  BenchmarkKpi,
  BenchmarkRecord,
  BenchmarkSourceRecord,
  BenchmarkSourceType,
  BrokerProvider,
  AssetClass,
  MarketEventRecord,
  RefreshJob,
  ReportSource,
} from '../models/types';
import {
  confidenceTierFor,
  KPI_UNIT,
  reconcile,
  validateBenchmark,
} from '../utils/marketIntelligence';

const PERIOD = '2026-Q1';

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

interface BrokerInput {
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

interface BenchmarkInput {
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

function makeBenchmark(input: BenchmarkInput): BenchmarkRecord {
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
function makeComp(
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
function makeMult(
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
function ruhrProfile(
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

export const mockBenchmarks: BenchmarkRecord[] = [
  // ── Düsseldorf · residential · full Big-Six ──
  makeBenchmark({
    city: 'Düsseldorf',
    assetClass: 'residential',
    kpi: 'prime_rent',
    priorValue: 21.6,
    brokers: [
      { provider: 'JLL', value: 22.4, pageNo: 42, originalText: 'Spitzenmiete Wohnen Düsseldorf: 22,40 €/m²/Monat' },
      { provider: 'CBRE', value: 22.1, pageNo: 18, originalText: 'Prime residential rent reached EUR 22.10/sqm' },
      { provider: 'BNP', value: 22.6, pageNo: 7, originalText: 'Spitzenmiete im Wohnsegment bei 22,60 €/m²' },
      { provider: 'Savills', value: 22.0, pageNo: 11, originalText: 'Top residential rents around EUR 22.00/sqm/month' },
      { provider: 'Colliers', value: 22.5, pageNo: 24, originalText: 'Wohnspitzenmiete: 22,50 €/m²/Monat' },
      { provider: 'C&W', value: 23.4, pageNo: 9, originalText: 'Prime residential rent up to EUR 23.40/sqm' },
    ],
  }),
  makeBenchmark({
    city: 'Düsseldorf',
    assetClass: 'residential',
    kpi: 'erv',
    priorValue: 15.4,
    brokers: [
      { provider: 'JLL', value: 15.8, pageNo: 43, originalText: 'Durchschnittsmiete Wohnen: 15,80 €/m²/Monat' },
      { provider: 'CBRE', value: 16.1, pageNo: 19, originalText: 'Average residential rent EUR 16.10/sqm' },
      { provider: 'BNP', value: 15.6, pageNo: 8, originalText: 'Durchschnittsmiete bei 15,60 €/m²' },
      { provider: 'Colliers', value: 16.0, pageNo: 25, originalText: 'Mittlere Wohnmiete: 16,00 €/m²/Monat' },
      { provider: 'Savills', value: 15.9, pageNo: 12, originalText: 'Average residential rent EUR 15.90/sqm' },
    ],
  }),
  makeBenchmark({
    city: 'Düsseldorf',
    assetClass: 'residential',
    kpi: 'net_initial_yield',
    priorValue: 3.6,
    brokers: [
      { provider: 'JLL', value: 3.55, pageNo: 6, originalText: 'Net initial yield residential: 3.55%' },
      { provider: 'CBRE', value: 3.6, pageNo: 5, originalText: 'Nettoanfangsrendite Wohnen 3,60%' },
      { provider: 'Colliers', value: 3.5, pageNo: 14, originalText: 'NIY residential at 3.50%' },
      { provider: 'BNP', value: 3.65, pageNo: 4, originalText: 'Spitzenrendite Wohnen 3,65%' },
    ],
  }),
  makeBenchmark({
    city: 'Düsseldorf',
    assetClass: 'residential',
    kpi: 'multiplier',
    priorValue: 27.5,
    brokers: [
      { provider: 'JLL', value: 28.2, pageNo: 6, originalText: 'Vervielfältiger Wohnen ca. 28,2-fach' },
      { provider: 'Colliers', value: 27.8, pageNo: 14, originalText: 'Faktor Wohninvestment: 27,8' },
      { provider: 'CBRE', value: 28.0, pageNo: 5, originalText: 'Residential multiplier around 28.0x' },
      { provider: 'BNP', value: 32.5, pageNo: 4, originalText: 'Einzeltransaktion mit Faktor 32,5 (Neubau)' },
    ],
  }),
  makeBenchmark({
    city: 'Düsseldorf',
    assetClass: 'residential',
    kpi: 'vacancy',
    priorValue: 2.1,
    brokers: [
      { provider: 'JLL', value: 2.0, pageNo: 44, originalText: 'Leerstandsquote Wohnen rund 2,0%' },
      { provider: 'Colliers', value: 2.2, pageNo: 26, originalText: 'Wohnungsleerstand bei 2,2%' },
      { provider: 'CBRE', value: 1.9, pageNo: 20, originalText: 'Residential vacancy approx. 1.9%' },
    ],
  }),

  // ── Düsseldorf submarkets · residential ERV ──
  makeBenchmark({
    city: 'Düsseldorf',
    submarket: 'Pempelfort',
    assetClass: 'residential',
    kpi: 'erv',
    priorValue: 17.8,
    brokers: [
      { provider: 'JLL', value: 18.2, pageNo: 42, originalText: 'Pempelfort: Durchschnittsmiete 18,20 €/m²' },
      { provider: 'Colliers', value: 18.5, pageNo: 25, originalText: 'Pempelfort mittlere Miete 18,50 €/m²' },
      { provider: 'CBRE', value: 18.0, pageNo: 19, originalText: 'Pempelfort average rent EUR 18.00/sqm' },
    ],
  }),
  makeBenchmark({
    city: 'Düsseldorf',
    submarket: 'Oberkassel',
    assetClass: 'residential',
    kpi: 'erv',
    priorValue: 19.9,
    brokers: [
      { provider: 'JLL', value: 20.4, pageNo: 42, originalText: 'Oberkassel: 20,40 €/m²/Monat' },
      { provider: 'Colliers', value: 20.8, pageNo: 25, originalText: 'Oberkassel Premiumlage 20,80 €/m²' },
    ],
  }),

  // ── Düsseldorf · office ──
  makeBenchmark({
    city: 'Düsseldorf',
    assetClass: 'office',
    kpi: 'prime_rent',
    priorValue: 30.0,
    brokers: [
      { provider: 'JLL', value: 30.5, pageNo: 3, originalText: 'Bürospitzenmiete CBD: 30,50 €/m²' },
      { provider: 'CBRE', value: 30.0, pageNo: 4, originalText: 'Prime office rent EUR 30.00/sqm' },
      { provider: 'BNP', value: 31.0, pageNo: 5, originalText: 'Spitzenmiete Büro 31,00 €/m²' },
      { provider: 'C&W', value: 30.5, pageNo: 6, originalText: 'Prime CBD office EUR 30.50/sqm' },
      { provider: 'Savills', value: 29.8, pageNo: 7, originalText: 'Top office rent EUR 29.80/sqm' },
      { provider: 'Colliers', value: 30.2, pageNo: 8, originalText: 'Bürospitzenmiete 30,20 €/m²' },
    ],
  }),
  makeBenchmark({
    city: 'Düsseldorf',
    assetClass: 'office',
    kpi: 'vacancy',
    priorValue: 10.4,
    brokers: [
      { provider: 'JLL', value: 10.8, pageNo: 9, originalText: 'Büroleerstand 10,8%' },
      { provider: 'CBRE', value: 11.2, pageNo: 10, originalText: 'Office vacancy 11.2%' },
      { provider: 'C&W', value: 10.5, pageNo: 11, originalText: 'Vacancy rate 10.5%' },
    ],
  }),

  // ── Top-7 · residential ERV (city level) ──
  makeBenchmark({
    city: 'Berlin',
    assetClass: 'residential',
    kpi: 'erv',
    priorValue: 17.5,
    brokers: [
      { provider: 'JLL', value: 18.0, pageNo: 30, originalText: 'Berlin Durchschnittsmiete 18,00 €/m²' },
      { provider: 'CBRE', value: 18.4, pageNo: 22, originalText: 'Berlin average rent EUR 18.40/sqm' },
      { provider: 'Colliers', value: 18.2, pageNo: 16, originalText: 'Berlin mittlere Miete 18,20 €/m²' },
    ],
  }),

  // ── Berlin · residential · full profile ──
  makeBenchmark({
    city: 'Berlin',
    assetClass: 'residential',
    kpi: 'prime_rent',
    priorValue: 28.5,
    brokers: [
      { provider: 'JLL', value: 29.5, pageNo: 41, originalText: 'Spitzenmiete Wohnen Berlin: 29,50 €/m²/Monat' },
      { provider: 'CBRE', value: 30.2, pageNo: 17, originalText: 'Prime residential rent EUR 30.20/sqm' },
      { provider: 'BNP', value: 30.8, pageNo: 6, originalText: 'Spitzenmiete im Wohnsegment bei 30,80 €/m²' },
      { provider: 'Savills', value: 29.0, pageNo: 10, originalText: 'Top residential rents around EUR 29.00/sqm/month' },
      { provider: 'Colliers', value: 30.0, pageNo: 23, originalText: 'Wohnspitzenmiete: 30,00 €/m²/Monat' },
      { provider: 'C&W', value: 31.5, pageNo: 8, originalText: 'Prime residential rent up to EUR 31.50/sqm' },
    ],
  }),
  makeBenchmark({
    city: 'Berlin',
    assetClass: 'residential',
    kpi: 'net_initial_yield',
    priorValue: 3.5,
    brokers: [
      { provider: 'JLL', value: 3.4, pageNo: 6, originalText: 'Net initial yield residential: 3.40%' },
      { provider: 'CBRE', value: 3.45, pageNo: 5, originalText: 'Nettoanfangsrendite Wohnen 3,45%' },
      { provider: 'Colliers', value: 3.35, pageNo: 14, originalText: 'NIY residential at 3.35%' },
      { provider: 'BNP', value: 3.5, pageNo: 4, originalText: 'Spitzenrendite Wohnen 3,50%' },
    ],
  }),
  makeBenchmark({
    city: 'Berlin',
    assetClass: 'residential',
    kpi: 'multiplier',
    priorValue: 28.0,
    brokers: [
      { provider: 'JLL', value: 28.5, pageNo: 6, originalText: 'Vervielfältiger Wohnen ca. 28,5-fach' },
      { provider: 'Colliers', value: 28.2, pageNo: 14, originalText: 'Faktor Wohninvestment: 28,2' },
      { provider: 'CBRE', value: 28.8, pageNo: 5, originalText: 'Residential multiplier around 28.8x' },
      { provider: 'BNP', value: 27.9, pageNo: 4, originalText: 'Kaufpreisfaktor Wohnen 27,9' },
    ],
  }),
  makeBenchmark({
    city: 'Berlin',
    assetClass: 'residential',
    kpi: 'vacancy',
    priorValue: 1.0,
    brokers: [
      { provider: 'JLL', value: 1.0, pageNo: 43, originalText: 'Leerstandsquote Wohnen rund 1,0%' },
      { provider: 'Colliers', value: 1.1, pageNo: 25, originalText: 'Wohnungsleerstand bei 1,1%' },
      { provider: 'CBRE', value: 0.9, pageNo: 19, originalText: 'Residential vacancy approx. 0.9%' },
    ],
  }),

  // ── Berlin · office ──
  makeBenchmark({
    city: 'Berlin',
    assetClass: 'office',
    kpi: 'prime_rent',
    priorValue: 43.0,
    brokers: [
      { provider: 'JLL', value: 44.0, pageNo: 3, originalText: 'Bürospitzenmiete CBD: 44,00 €/m²' },
      { provider: 'CBRE', value: 44.5, pageNo: 4, originalText: 'Prime office rent EUR 44.50/sqm' },
      { provider: 'BNP', value: 45.0, pageNo: 5, originalText: 'Spitzenmiete Büro 45,00 €/m²' },
      { provider: 'C&W', value: 43.5, pageNo: 6, originalText: 'Prime CBD office EUR 43.50/sqm' },
      { provider: 'Savills', value: 44.0, pageNo: 7, originalText: 'Top office rent EUR 44.00/sqm' },
      { provider: 'Colliers', value: 44.2, pageNo: 8, originalText: 'Bürospitzenmiete 44,20 €/m²' },
    ],
  }),
  makeBenchmark({
    city: 'Berlin',
    assetClass: 'office',
    kpi: 'vacancy',
    priorValue: 5.0,
    brokers: [
      { provider: 'JLL', value: 5.4, pageNo: 9, originalText: 'Büroleerstand 5,4%' },
      { provider: 'CBRE', value: 5.8, pageNo: 10, originalText: 'Office vacancy 5.8%' },
      { provider: 'C&W', value: 5.2, pageNo: 11, originalText: 'Vacancy rate 5.2%' },
    ],
  }),

  makeBenchmark({
    city: 'München',
    assetClass: 'residential',
    kpi: 'erv',
    priorValue: 21.0,
    brokers: [
      { provider: 'JLL', value: 21.8, pageNo: 30, originalText: 'München Durchschnittsmiete 21,80 €/m²' },
      { provider: 'CBRE', value: 22.0, pageNo: 22, originalText: 'Munich average rent EUR 22.00/sqm' },
      { provider: 'Colliers', value: 21.6, pageNo: 16, originalText: 'München mittlere Miete 21,60 €/m²' },
    ],
  }),
  makeBenchmark({
    city: 'Hamburg',
    assetClass: 'residential',
    kpi: 'erv',
    priorValue: 16.4,
    brokers: [
      { provider: 'JLL', value: 16.8, pageNo: 30, originalText: 'Hamburg Durchschnittsmiete 16,80 €/m²' },
      { provider: 'Colliers', value: 17.0, pageNo: 16, originalText: 'Hamburg mittlere Miete 17,00 €/m²' },
    ],
  }),

  // ── Tier-3 · AI qualitative suburb (Meerbusch) → indicative, pending ──
  makeBenchmark({
    city: 'Meerbusch',
    assetClass: 'residential',
    kpi: 'erv',
    sourceType: 'ai_qualitative',
    directValue: 14.5,
    providerLabel: 'Claude estimation',
    brokers: [],
    note:
      'Indicative — not IC-quotable. Derived from web listings + Düsseldorf gradient. Superseded once Lestate has transaction data in Meerbusch.',
  }),

  // ── Köln · residential · full profile ──
  makeBenchmark({
    city: 'Köln',
    assetClass: 'residential',
    kpi: 'prime_rent',
    priorValue: 18.8,
    brokers: [
      { provider: 'JLL', value: 19.5, pageNo: 40, originalText: 'Spitzenmiete Wohnen Köln: 19,50 €/m²/Monat' },
      { provider: 'CBRE', value: 19.8, pageNo: 16, originalText: 'Prime residential rent EUR 19.80/sqm' },
      { provider: 'BNP', value: 20.2, pageNo: 6, originalText: 'Spitzenmiete im Wohnsegment bei 20,20 €/m²' },
      { provider: 'Savills', value: 19.0, pageNo: 10, originalText: 'Top residential rents around EUR 19.00/sqm/month' },
      { provider: 'Colliers', value: 19.6, pageNo: 22, originalText: 'Wohnspitzenmiete: 19,60 €/m²/Monat' },
    ],
  }),
  makeBenchmark({
    city: 'Köln',
    assetClass: 'residential',
    kpi: 'erv',
    priorValue: 14.0,
    brokers: [
      { provider: 'JLL', value: 14.4, pageNo: 41, originalText: 'Durchschnittsmiete Wohnen: 14,40 €/m²/Monat' },
      { provider: 'CBRE', value: 14.8, pageNo: 17, originalText: 'Average residential rent EUR 14.80/sqm' },
      { provider: 'BNP', value: 14.2, pageNo: 7, originalText: 'Durchschnittsmiete bei 14,20 €/m²' },
      { provider: 'Colliers', value: 14.6, pageNo: 23, originalText: 'Mittlere Wohnmiete: 14,60 €/m²/Monat' },
      { provider: 'Savills', value: 14.5, pageNo: 11, originalText: 'Average residential rent EUR 14.50/sqm' },
    ],
  }),
  makeBenchmark({
    city: 'Köln',
    assetClass: 'residential',
    kpi: 'net_initial_yield',
    priorValue: 3.7,
    brokers: [
      { provider: 'JLL', value: 3.65, pageNo: 6, originalText: 'Net initial yield residential: 3.65%' },
      { provider: 'CBRE', value: 3.7, pageNo: 5, originalText: 'Nettoanfangsrendite Wohnen 3,70%' },
      { provider: 'Colliers', value: 3.6, pageNo: 14, originalText: 'NIY residential at 3.60%' },
      { provider: 'BNP', value: 3.75, pageNo: 4, originalText: 'Spitzenrendite Wohnen 3,75%' },
    ],
  }),
  // Multiplier with a flagged single-deal outlier (BNP 34,8) — median-cleaned.
  makeBenchmark({
    city: 'Köln',
    assetClass: 'residential',
    kpi: 'multiplier',
    priorValue: 26.0,
    brokers: [
      { provider: 'JLL', value: 26.4, pageNo: 6, originalText: 'Köln Faktor 26,4' },
      { provider: 'CBRE', value: 26.6, pageNo: 5, originalText: 'Residential multiplier around 26.6x' },
      { provider: 'Colliers', value: 26.8, pageNo: 14, originalText: 'Faktor Wohninvestment: 26,8' },
      { provider: 'BNP', value: 34.8, pageNo: 4, originalText: 'Ausreißertransaktion Faktor 34,8 (Neubau)', confidence: 0.7 },
    ],
  }),
  makeBenchmark({
    city: 'Köln',
    assetClass: 'residential',
    kpi: 'vacancy',
    priorValue: 1.7,
    brokers: [
      { provider: 'JLL', value: 1.6, pageNo: 43, originalText: 'Leerstandsquote Wohnen rund 1,6%' },
      { provider: 'Colliers', value: 1.8, pageNo: 25, originalText: 'Wohnungsleerstand bei 1,8%' },
      { provider: 'CBRE', value: 1.5, pageNo: 19, originalText: 'Residential vacancy approx. 1.5%' },
    ],
  }),

  // ── Köln · office ──
  makeBenchmark({
    city: 'Köln',
    assetClass: 'office',
    kpi: 'prime_rent',
    priorValue: 29.5,
    brokers: [
      { provider: 'JLL', value: 30.0, pageNo: 3, originalText: 'Bürospitzenmiete CBD: 30,00 €/m²' },
      { provider: 'CBRE', value: 30.5, pageNo: 4, originalText: 'Prime office rent EUR 30.50/sqm' },
      { provider: 'BNP', value: 31.0, pageNo: 5, originalText: 'Spitzenmiete Büro 31,00 €/m²' },
      { provider: 'C&W', value: 30.2, pageNo: 6, originalText: 'Prime CBD office EUR 30.20/sqm' },
      { provider: 'Colliers', value: 30.3, pageNo: 8, originalText: 'Bürospitzenmiete 30,30 €/m²' },
    ],
  }),
  makeBenchmark({
    city: 'Köln',
    assetClass: 'office',
    kpi: 'vacancy',
    priorValue: 4.5,
    brokers: [
      { provider: 'JLL', value: 4.4, pageNo: 9, originalText: 'Büroleerstand 4,4%' },
      { provider: 'CBRE', value: 4.8, pageNo: 10, originalText: 'Office vacancy 4.8%' },
      { provider: 'C&W', value: 4.2, pageNo: 11, originalText: 'Vacancy rate 4.2%' },
    ],
  }),

  // ── Essen · residential · full profile (Ruhrgebiet) ──
  makeBenchmark({
    city: 'Essen',
    assetClass: 'residential',
    kpi: 'prime_rent',
    priorValue: 12.8,
    brokers: [
      { provider: 'JLL', value: 13.2, pageNo: 39, originalText: 'Spitzenmiete Wohnen Essen: 13,20 €/m²/Monat' },
      { provider: 'CBRE', value: 13.5, pageNo: 15, originalText: 'Prime residential rent EUR 13.50/sqm' },
      { provider: 'Colliers', value: 13.8, pageNo: 21, originalText: 'Wohnspitzenmiete Rüttenscheid: 13,80 €/m²' },
      { provider: 'BNP', value: 13.0, pageNo: 6, originalText: 'Spitzenmiete im Wohnsegment bei 13,00 €/m²' },
    ],
  }),
  makeBenchmark({
    city: 'Essen',
    assetClass: 'residential',
    kpi: 'erv',
    priorValue: 9.4,
    brokers: [
      { provider: 'JLL', value: 9.8, pageNo: 40, originalText: 'Durchschnittsmiete Wohnen: 9,80 €/m²/Monat' },
      { provider: 'CBRE', value: 10.0, pageNo: 16, originalText: 'Average residential rent EUR 10.00/sqm' },
      { provider: 'Colliers', value: 9.6, pageNo: 22, originalText: 'Mittlere Wohnmiete: 9,60 €/m²/Monat' },
      { provider: 'BNP', value: 9.9, pageNo: 7, originalText: 'Durchschnittsmiete bei 9,90 €/m²' },
    ],
  }),
  makeBenchmark({
    city: 'Essen',
    assetClass: 'residential',
    kpi: 'net_initial_yield',
    priorValue: 4.5,
    brokers: [
      { provider: 'JLL', value: 4.4, pageNo: 6, originalText: 'Net initial yield residential: 4.40%' },
      { provider: 'CBRE', value: 4.5, pageNo: 5, originalText: 'Nettoanfangsrendite Wohnen 4,50%' },
      { provider: 'Colliers', value: 4.35, pageNo: 14, originalText: 'NIY residential at 4.35%' },
    ],
  }),
  makeBenchmark({
    city: 'Essen',
    assetClass: 'residential',
    kpi: 'multiplier',
    priorValue: 22.0,
    brokers: [
      { provider: 'JLL', value: 22.5, pageNo: 6, originalText: 'Vervielfältiger Wohnen ca. 22,5-fach' },
      { provider: 'Colliers', value: 22.2, pageNo: 14, originalText: 'Faktor Wohninvestment: 22,2' },
      { provider: 'CBRE', value: 22.8, pageNo: 5, originalText: 'Residential multiplier around 22.8x' },
    ],
  }),
  makeBenchmark({
    city: 'Essen',
    assetClass: 'residential',
    kpi: 'vacancy',
    priorValue: 3.1,
    brokers: [
      { provider: 'JLL', value: 3.0, pageNo: 43, originalText: 'Leerstandsquote Wohnen rund 3,0%' },
      { provider: 'Colliers', value: 3.2, pageNo: 25, originalText: 'Wohnungsleerstand bei 3,2%' },
      { provider: 'CBRE', value: 2.8, pageNo: 19, originalText: 'Residential vacancy approx. 2.8%' },
    ],
  }),

  // ── Essen · office ──
  makeBenchmark({
    city: 'Essen',
    assetClass: 'office',
    kpi: 'prime_rent',
    priorValue: 16.0,
    brokers: [
      { provider: 'JLL', value: 16.5, pageNo: 3, originalText: 'Bürospitzenmiete CBD: 16,50 €/m²' },
      { provider: 'CBRE', value: 16.8, pageNo: 4, originalText: 'Prime office rent EUR 16.80/sqm' },
      { provider: 'BNP', value: 16.2, pageNo: 5, originalText: 'Spitzenmiete Büro 16,20 €/m²' },
    ],
  }),
  makeBenchmark({
    city: 'Essen',
    assetClass: 'office',
    kpi: 'vacancy',
    priorValue: 4.6,
    brokers: [
      { provider: 'JLL', value: 4.5, pageNo: 9, originalText: 'Büroleerstand 4,5%' },
      { provider: 'CBRE', value: 4.8, pageNo: 10, originalText: 'Office vacancy 4.8%' },
      { provider: 'C&W', value: 4.2, pageNo: 11, originalText: 'Vacancy rate 4.2%' },
    ],
  }),

  // ── Bochum · residential · full profile (Ruhrgebiet) ──
  makeBenchmark({
    city: 'Bochum',
    assetClass: 'residential',
    kpi: 'prime_rent',
    priorValue: 12.0,
    brokers: [
      { provider: 'JLL', value: 12.5, pageNo: 39, originalText: 'Spitzenmiete Wohnen Bochum: 12,50 €/m²/Monat' },
      { provider: 'CBRE', value: 12.8, pageNo: 15, originalText: 'Prime residential rent EUR 12.80/sqm' },
      { provider: 'Colliers', value: 12.2, pageNo: 21, originalText: 'Wohnspitzenmiete Ehrenfeld: 12,20 €/m²' },
    ],
  }),
  makeBenchmark({
    city: 'Bochum',
    assetClass: 'residential',
    kpi: 'erv',
    priorValue: 8.5,
    brokers: [
      { provider: 'JLL', value: 8.9, pageNo: 40, originalText: 'Durchschnittsmiete Wohnen: 8,90 €/m²/Monat' },
      { provider: 'CBRE', value: 9.1, pageNo: 16, originalText: 'Average residential rent EUR 9.10/sqm' },
      { provider: 'Colliers', value: 8.7, pageNo: 22, originalText: 'Mittlere Wohnmiete: 8,70 €/m²/Monat' },
      { provider: 'BNP', value: 9.0, pageNo: 7, originalText: 'Durchschnittsmiete bei 9,00 €/m²' },
    ],
  }),
  makeBenchmark({
    city: 'Bochum',
    assetClass: 'residential',
    kpi: 'net_initial_yield',
    priorValue: 4.6,
    brokers: [
      { provider: 'JLL', value: 4.55, pageNo: 6, originalText: 'Net initial yield residential: 4.55%' },
      { provider: 'CBRE', value: 4.65, pageNo: 5, originalText: 'Nettoanfangsrendite Wohnen 4,65%' },
      { provider: 'Colliers', value: 4.5, pageNo: 14, originalText: 'NIY residential at 4.50%' },
    ],
  }),
  makeBenchmark({
    city: 'Bochum',
    assetClass: 'residential',
    kpi: 'multiplier',
    priorValue: 21.5,
    brokers: [
      { provider: 'JLL', value: 22.0, pageNo: 6, originalText: 'Vervielfältiger Wohnen ca. 22,0-fach' },
      { provider: 'Colliers', value: 21.6, pageNo: 14, originalText: 'Faktor Wohninvestment: 21,6' },
      { provider: 'CBRE', value: 22.3, pageNo: 5, originalText: 'Residential multiplier around 22.3x' },
    ],
  }),
  makeBenchmark({
    city: 'Bochum',
    assetClass: 'residential',
    kpi: 'vacancy',
    priorValue: 3.3,
    brokers: [
      { provider: 'JLL', value: 3.2, pageNo: 43, originalText: 'Leerstandsquote Wohnen rund 3,2%' },
      { provider: 'Colliers', value: 3.4, pageNo: 25, originalText: 'Wohnungsleerstand bei 3,4%' },
      { provider: 'CBRE', value: 3.0, pageNo: 19, originalText: 'Residential vacancy approx. 3.0%' },
    ],
  }),

  // ── Bochum · office ──
  makeBenchmark({
    city: 'Bochum',
    assetClass: 'office',
    kpi: 'prime_rent',
    priorValue: 14.0,
    brokers: [
      { provider: 'JLL', value: 14.5, pageNo: 3, originalText: 'Bürospitzenmiete Innenstadt: 14,50 €/m²' },
      { provider: 'CBRE', value: 14.8, pageNo: 4, originalText: 'Prime office rent EUR 14.80/sqm' },
      { provider: 'BNP', value: 14.2, pageNo: 5, originalText: 'Spitzenmiete Büro 14,20 €/m²' },
    ],
  }),
  makeBenchmark({
    city: 'Bochum',
    assetClass: 'office',
    kpi: 'vacancy',
    priorValue: 5.1,
    brokers: [
      { provider: 'JLL', value: 5.0, pageNo: 9, originalText: 'Büroleerstand 5,0%' },
      { provider: 'CBRE', value: 5.3, pageNo: 10, originalText: 'Office vacancy 5.3%' },
      { provider: 'C&W', value: 4.7, pageNo: 11, originalText: 'Vacancy rate 4.7%' },
    ],
  }),

  // ── Ruhrgebiet · residential profiles (realistic 2025/26 levels) ──
  // buy ≈ ERV × 12 × factor: Dortmund ~2.5k, Duisburg ~1.9k, Oberhausen ~2.0k,
  // Mülheim ~2.5k, Gelsenkirchen ~1.5k €/m².
  ...ruhrProfile('Dortmund', { prime: 12.8, erv: 9.0, niy: 4.35, mult: 23.0, vac: 2.8 }),
  ...ruhrProfile('Duisburg', { prime: 10.8, erv: 7.8, niy: 4.9, mult: 20.5, vac: 3.8 }),
  ...ruhrProfile('Oberhausen', { prime: 10.6, erv: 7.9, niy: 4.8, mult: 20.8, vac: 3.5 }),
  ...ruhrProfile('Mülheim an der Ruhr', { prime: 12.2, erv: 9.0, niy: 4.4, mult: 23.0, vac: 3.0 }),
  ...ruhrProfile('Gelsenkirchen', { prime: 9.5, erv: 7.0, niy: 5.4, mult: 18.5, vac: 4.5 }),

  // ── Dortmund · office (largest Ruhr office market) ──
  makeBenchmark({
    city: 'Dortmund',
    assetClass: 'office',
    kpi: 'prime_rent',
    priorValue: 15.5,
    brokers: [
      { provider: 'JLL', value: 16.0, pageNo: 3, originalText: 'Bürospitzenmiete City: 16,00 €/m²' },
      { provider: 'CBRE', value: 16.3, pageNo: 4, originalText: 'Prime office rent EUR 16.30/sqm' },
      { provider: 'BNP', value: 15.8, pageNo: 5, originalText: 'Spitzenmiete Büro 15,80 €/m²' },
    ],
  }),
  makeBenchmark({
    city: 'Dortmund',
    assetClass: 'office',
    kpi: 'vacancy',
    priorValue: 3.8,
    brokers: [
      { provider: 'JLL', value: 3.7, pageNo: 9, originalText: 'Büroleerstand 3,7%' },
      { provider: 'CBRE', value: 4.0, pageNo: 10, originalText: 'Office vacancy 4.0%' },
      { provider: 'C&W', value: 3.6, pageNo: 11, originalText: 'Vacancy rate 3.6%' },
    ],
  }),

  // ── Sourcing benchmarks · real market data (Düsseldorf + Speckgürtel, 2025/26) ──
  // rent = avg asking Kaltmiete €/m²/mo; multiplier = Kaufpreis €/m² ÷ (rent × 12).
  // Sources: Homeday/ImmoScout Preisatlas, wohnungsboerse, duesselraum Kaufpreisfaktor.
  ...makeComp('Düsseldorf', 'Flingern', 'residential', 15.70, 28.0), // buy ~5.294 €/m²
  ...makeComp('Düsseldorf', 'Bilk', 'residential', 15.30, 24.9),     // buy ~4.574 €/m²
  // Pempelfort & Oberkassel already carry a broker ERV — add only the multiplier
  // (consistent with their buy price) so they become screenable without duplicate ERV.
  makeMult('Düsseldorf', 'Pempelfort', 'residential', 24.5),         // buy ~5.356 €/m²
  makeMult('Düsseldorf', 'Oberkassel', 'residential', 26.6),         // buy ~6.520 €/m²
  ...makeComp('Düsseldorf', undefined, 'mixed_use', 14.00, 24.0),
  ...makeComp('Meerbusch', 'Büderich', 'residential', 15.00, 26.7),  // buy ~4.800 €/m²
  ...makeComp('Ratingen', undefined, 'residential', 12.48, 23.1),    // buy ~3.456 €/m²
  ...makeComp('Ratingen', undefined, 'mixed_use', 12.50, 23.0),
  ...makeComp('Neuss', undefined, 'residential', 12.05, 24.0),       // buy ~3.464 €/m²
  ...makeComp('Hilden', undefined, 'residential', 11.20, 24.6),      // buy ~3.300 €/m²
  ...makeComp('Erkrath', undefined, 'residential', 12.00, 21.9),     // buy ~3.150 €/m²

  // ── Köln catchment · residential comps (Speckgürtel) ──
  ...makeComp('Leverkusen', undefined, 'residential', 10.90, 23.5),  // buy ~3.074 €/m²
  ...makeComp('Langenfeld', undefined, 'residential', 11.80, 24.5),  // buy ~3.469 €/m²
  ...makeComp('Bonn', undefined, 'residential', 13.20, 26.5),        // buy ~4.198 €/m²
];

// ── Cross-validation · portfolio_realised vs broker (Phase 3 preview) ──
export const mockPortfolioBenchmark: BenchmarkRecord = makeBenchmark({
  city: 'Düsseldorf',
  submarket: 'Pempelfort',
  assetClass: 'residential',
  kpi: 'erv',
  sourceType: 'portfolio_realised',
  directValue: 24.15,
  providerLabel: 'Lestate',
  brokers: [],
  note:
    'Achieved rents Q1 2026, three leases in Pempelfort, refurbished stock. Feeds the “Lestate Premium Factor”.',
});

// ── News layer (market_events) ────────────────────────────────────────────────

export const mockMarketEvents: MarketEventRecord[] = [
  {
    id: 'evt-001',
    eventType: 'leasing',
    city: 'Düsseldorf',
    assetClass: 'office',
    impactTier: 'high',
    headline: 'Vodafone gibt Teilflächen am Düsseldorfer Campus auf',
    summary:
      'Rückgabe von rund 12.000 m² Bürofläche erhöht den lokalen Leerstand. Deskriptiver Kontext — keine automatische ERV-Anpassung.',
    sourceUrl: 'https://www.immobilien-zeitung.de/',
    publishedAt: '2026-06-12T08:00:00.000Z',
  },
  {
    id: 'evt-002',
    eventType: 'interest_rates',
    impactTier: 'medium',
    headline: 'EZB hält Leitzins stabil — Finanzierungskosten seitwärts',
    summary:
      'Stabile Zinsen stützen die Transaktionsaktivität im Wohnsegment. Relevanz für NIY-Annahmen, Bewertung durch Analyst.',
    sourceUrl: 'https://www.ecb.europa.eu/',
    publishedAt: '2026-06-05T12:00:00.000Z',
  },
  {
    id: 'evt-003',
    eventType: 'deal',
    city: 'Düsseldorf',
    assetClass: 'residential',
    impactTier: 'medium',
    headline: 'Wohnportfolio in Pempelfort für 48 Mio. € gehandelt',
    summary:
      'Faktor rund 28× — bestätigt das Multiplier-Niveau der Pipeline für Pempelfort.',
    sourceUrl: 'https://www.thomasdaily.de/',
    publishedAt: '2026-05-28T09:30:00.000Z',
  },
  {
    id: 'evt-004',
    eventType: 'regulation',
    city: 'Düsseldorf',
    assetClass: 'residential',
    impactTier: 'low',
    headline: 'Düsseldorf verlängert Milieuschutzsatzung in drei Stadtteilen',
    summary:
      'Eingeschränkte Modernisierungsumlage in betroffenen Quartieren. Kontext für Repositionierungs-Cases.',
    sourceUrl: 'https://www.duesseldorf.de/',
    publishedAt: '2026-05-20T07:00:00.000Z',
  },
  {
    id: 'evt-005',
    eventType: 'capital_markets',
    impactTier: 'medium',
    headline: 'Transaktionsvolumen Wohnen Top-7 zieht im Q1 deutlich an',
    summary:
      'Steigende Liquidität im Wohninvestmentmarkt — positiver Kontext für Exit-Annahmen.',
    sourceUrl: 'https://www.jll.de/',
    publishedAt: '2026-04-30T10:00:00.000Z',
  },
  {
    id: 'evt-006',
    eventType: 'macro',
    impactTier: 'low',
    headline: 'Nettozuwanderung Düsseldorf bleibt positiv',
    summary:
      'Anhaltender Bevölkerungszuwachs stützt die Wohnungsnachfrage mittelfristig.',
    sourceUrl: 'https://www.it.nrw/',
    publishedAt: '2026-04-22T06:00:00.000Z',
  },
  {
    id: 'evt-007',
    eventType: 'leasing',
    city: 'Berlin',
    assetClass: 'office',
    impactTier: 'high',
    headline: 'Tech-Konzern mietet 18.000 m² an der Mediaspree',
    summary:
      'Große Bürovermietung stützt die Berliner Spitzenmiete. Deskriptiver Kontext — keine automatische Anpassung.',
    sourceUrl: 'https://www.immobilien-zeitung.de/',
    publishedAt: '2026-06-10T08:00:00.000Z',
  },
  {
    id: 'evt-008',
    eventType: 'deal',
    city: 'Köln',
    assetClass: 'residential',
    impactTier: 'medium',
    headline: 'Wohnportfolio in Köln-Ehrenfeld für 62 Mio. € gehandelt',
    summary:
      'Faktor rund 26× — bestätigt das Multiplier-Niveau der Pipeline für Köln.',
    sourceUrl: 'https://www.thomasdaily.de/',
    publishedAt: '2026-05-26T09:30:00.000Z',
  },
  {
    id: 'evt-009',
    eventType: 'macro',
    city: 'Essen',
    assetClass: 'office',
    impactTier: 'low',
    headline: 'Essen: Konzernansiedlungen stützen die Büronachfrage im Südviertel',
    summary:
      'Stabile Nachfrage in der Essener Innenstadt/Rüttenscheid. Kontext für Büro-Underwriting im Ruhrgebiet.',
    sourceUrl: 'https://www.immobilien-zeitung.de/',
    publishedAt: '2026-05-14T07:00:00.000Z',
  },
  {
    id: 'evt-010',
    eventType: 'deal',
    city: 'Bochum',
    assetClass: 'residential',
    impactTier: 'medium',
    headline: 'Bochum: Wohnquartier am Mark 51°7 vermarktet',
    summary:
      'Neubau-Wohnungen mit überdurchschnittlicher Nachfrage — leichter Aufwärtsdruck auf die Durchschnittsmiete.',
    sourceUrl: 'https://www.thomasdaily.de/',
    publishedAt: '2026-05-08T09:00:00.000Z',
  },
];

// ── report_sources catalog ────────────────────────────────────────────────────

const catalog: Array<[BrokerProvider, AssetClass[], string]> = [
  // Düsseldorf — full Big-Six coverage.
  ['JLL', ['residential', 'office', 'retail', 'logistics'], 'Düsseldorf'],
  ['CBRE', ['residential', 'office', 'retail', 'logistics'], 'Düsseldorf'],
  ['BNP', ['residential', 'office', 'retail', 'logistics'], 'Düsseldorf'],
  ['Savills', ['residential', 'office', 'logistics'], 'Düsseldorf'],
  ['Colliers', ['residential', 'office', 'retail'], 'Düsseldorf'],
  ['C&W', ['office', 'retail', 'logistics'], 'Düsseldorf'],
  // Berlin — full Big-Six coverage.
  ['JLL', ['residential', 'office', 'retail', 'logistics'], 'Berlin'],
  ['CBRE', ['residential', 'office', 'retail', 'logistics'], 'Berlin'],
  ['BNP', ['residential', 'office', 'retail'], 'Berlin'],
  ['Savills', ['residential', 'office'], 'Berlin'],
  ['Colliers', ['residential', 'office'], 'Berlin'],
  ['C&W', ['office', 'retail'], 'Berlin'],
  // Köln — strong coverage.
  ['JLL', ['residential', 'office', 'retail'], 'Köln'],
  ['CBRE', ['residential', 'office', 'retail'], 'Köln'],
  ['BNP', ['residential', 'office'], 'Köln'],
  ['Colliers', ['residential', 'office'], 'Köln'],
  ['C&W', ['office', 'retail'], 'Köln'],
  // Essen — regional coverage (Ruhrgebiet).
  ['JLL', ['residential', 'office'], 'Essen'],
  ['CBRE', ['residential', 'office'], 'Essen'],
  ['Colliers', ['residential'], 'Essen'],
  ['BNP', ['office'], 'Essen'],
  // Bochum — regional coverage (Ruhrgebiet).
  ['JLL', ['residential', 'office'], 'Bochum'],
  ['CBRE', ['residential'], 'Bochum'],
  ['Colliers', ['residential'], 'Bochum'],
  ['BNP', ['office'], 'Bochum'],
];

const marketSlug = (m: string) =>
  m.toLowerCase().replace(/ü/g, 'ue').replace(/ö/g, 'oe').replace(/ä/g, 'ae').replace(/ß/g, 'ss').replace(/[^a-z]/g, '');

export const mockReportSources: ReportSource[] = catalog.flatMap(([provider, classes, market]) =>
  classes.map((assetClass, i) => ({
    id: `rs-${marketSlug(market)}-${provider.toLowerCase().replace(/[^a-z]/g, '')}-${assetClass}`,
    provider,
    assetClass,
    market,
    hubUrl: `https://www.${provider.toLowerCase().replace(/[^a-z]/g, '')}.de/research/${marketSlug(market)}/${assetClass}`,
    selectorPattern: `a[href*="${assetClass}"][href$=".pdf"]`,
    cadence: 'quarterly' as const,
    // One deliberately broken selector to exercise the "broken source" state.
    status: provider === 'C&W' && assetClass === 'retail' && market === 'Düsseldorf' && i === 1 ? ('broken' as const) : ('ok' as const),
    lastFetchedAt: '2026-06-15T03:05:00.000Z',
  })),
);

// ── Refresh-job history ────────────────────────────────────────────────────────

export const mockRefreshJobs: RefreshJob[] = [
  {
    id: 'rj-2026q1',
    triggeredAt: '2026-06-15T03:00:00.000Z',
    trigger: 'cron',
    triggeredBy: 'scheduler',
    status: 'completed',
    periodQuarter: PERIOD,
    reportsFetched: 31,
    dataPointsExtracted: 218,
    autoPassed: 196,
    pendingReview: 22,
    completedAt: '2026-06-15T03:48:00.000Z',
  },
  {
    id: 'rj-2025q4',
    triggeredAt: '2026-03-15T03:00:00.000Z',
    trigger: 'cron',
    triggeredBy: 'scheduler',
    status: 'completed',
    periodQuarter: '2025-Q4',
    reportsFetched: 29,
    dataPointsExtracted: 204,
    autoPassed: 181,
    pendingReview: 23,
    completedAt: '2026-03-15T03:51:00.000Z',
  },
];

export const CURRENT_PERIOD = PERIOD;
