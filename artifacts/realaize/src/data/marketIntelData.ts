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

  // ── Pending review · out-of-range residential multiplier (manual check) ──
  makeBenchmark({
    city: 'Köln',
    assetClass: 'residential',
    kpi: 'multiplier',
    priorValue: 26.0,
    brokers: [
      { provider: 'JLL', value: 26.4, pageNo: 6, originalText: 'Köln Faktor 26,4' },
      { provider: 'BNP', value: 34.8, pageNo: 4, originalText: 'Ausreißertransaktion Faktor 34,8', confidence: 0.7 },
    ],
  }),

  // ── Sourcing submarket comps (ERV + multiplier) — feed the Deal Radar screen ──
  // Single source of market assumptions for the sourcing stage; values carried
  // over from the former Module-07 screening seed so screening stays consistent.
  ...makeComp('Düsseldorf', 'Flingern', 'residential', 12.80, 22.5),
  ...makeComp('Düsseldorf', 'Bilk', 'residential', 12.92, 24.0),
  ...makeComp('Meerbusch', 'Büderich', 'residential', 15.22, 19.5),
  ...makeComp('Ratingen', undefined, 'mixed_use', 13.02, 23.0),
  ...makeComp('Düsseldorf', undefined, 'mixed_use', 13.50, 22.0),
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
];

// ── report_sources catalog ────────────────────────────────────────────────────

const catalog: Array<[BrokerProvider, AssetClass[], string]> = [
  ['JLL', ['residential', 'office', 'retail', 'logistics'], 'Düsseldorf'],
  ['CBRE', ['residential', 'office', 'retail', 'logistics'], 'Düsseldorf'],
  ['BNP', ['residential', 'office', 'retail', 'logistics'], 'Düsseldorf'],
  ['Savills', ['residential', 'office', 'logistics'], 'Düsseldorf'],
  ['Colliers', ['residential', 'office', 'retail'], 'Düsseldorf'],
  ['C&W', ['office', 'retail', 'logistics'], 'Düsseldorf'],
];

export const mockReportSources: ReportSource[] = catalog.flatMap(([provider, classes, market]) =>
  classes.map((assetClass, i) => ({
    id: `rs-${provider.toLowerCase().replace(/[^a-z]/g, '')}-${assetClass}`,
    provider,
    assetClass,
    market,
    hubUrl: `https://www.${provider.toLowerCase().replace(/[^a-z]/g, '')}.de/research/${assetClass}`,
    selectorPattern: `a[href*="${assetClass}"][href$=".pdf"]`,
    cadence: 'quarterly' as const,
    status: provider === 'C&W' && assetClass === 'retail' && i === 1 ? ('broken' as const) : ('ok' as const),
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
