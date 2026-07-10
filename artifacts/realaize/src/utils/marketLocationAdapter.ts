// Welt-B → Welt-A view adapter (SSoT-Migration · Phase 2).
// Presents the Market Intelligence master (BenchmarkRecord[]) in the legacy
// MarketLocation shape so the /markt overview, Portfolio and AI Copilot can read
// the single source of truth without their own data source. Read-only, never a
// writer. City-level aggregation (city-wide records preferred, else median across
// submarkets) keeps /markt a city overview rather than exploding into submarkets.

import type {
  AssetClass,
  BenchmarkKpi,
  BenchmarkRecord,
  MarketBenchmark,
  MarketLocation,
  UsageType,
} from '../models/types';
import { median } from './marketIntelligence';
import { assetClassToUsage, confidenceUnitToPct } from './marketVocab';
import { GERMAN_TOP_CITIES } from './marketResearchAgent';

const CITY_INFO = new Map(GERMAN_TOP_CITIES.map(c => [c.city, c] as const));

function citySlug(city: string): string {
  return city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const round2 = (n: number) => Math.round(n * 100) / 100;

interface Agg {
  median: number;
  min: number;
  max: number;
  conf: number; // 0–1
  source: string;
  updated: string;
}

/** Aggregate one KPI across a city's records: city-wide records win, else median of submarkets. */
function aggregate(records: BenchmarkRecord[], kpi: BenchmarkKpi): Agg | null {
  const forKpi = records.filter(r => r.kpi === kpi && r.validationStatus !== 'rejected');
  if (forKpi.length === 0) return null;
  const cityWide = forKpi.filter(r => !r.submarket);
  const chosen = cityWide.length ? cityWide : forKpi;
  const values = chosen.map(r => r.value);
  return {
    median: median(values),
    min: Math.min(...values),
    max: Math.max(...values),
    conf: chosen.reduce((a, r) => a + r.confidenceScore, 0) / chosen.length,
    source: chosen[0].sourceProvider,
    updated: chosen.map(r => r.extractedAt).sort().at(-1) ?? chosen[0].extractedAt,
  };
}

/**
 * FROZEN READ CONTRACT (SSoT-Migration · Phase 2).
 * The only sanctioned way for the legacy MarketLocation UI to read the Market
 * Intelligence master. Consumers MUST NOT reintroduce useListMarketLocations.
 */
export function benchmarkRecordsToMarketLocations(benchmarks: BenchmarkRecord[]): MarketLocation[] {
  const byCity = new Map<string, BenchmarkRecord[]>();
  for (const b of benchmarks) {
    const arr = byCity.get(b.city);
    if (arr) arr.push(b);
    else byCity.set(b.city, [b]);
  }

  const locations: MarketLocation[] = [];
  for (const [city, recs] of byCity) {
    const info = CITY_INFO.get(city);
    const locId = info?.id ?? `loc-${citySlug(city)}`;

    const byAsset = new Map<AssetClass, BenchmarkRecord[]>();
    for (const r of recs) {
      const arr = byAsset.get(r.assetClass);
      if (arr) arr.push(r);
      else byAsset.set(r.assetClass, [r]);
    }

    const marketBenchmarks: MarketBenchmark[] = [];
    let latest = '';
    for (const [assetClass, arecs] of byAsset) {
      const rent = aggregate(arecs, 'erv') ?? aggregate(arecs, 'prime_rent');
      if (!rent) continue; // rent basis required for a usable benchmark row
      const mult = aggregate(arecs, 'multiplier');
      const vac = aggregate(arecs, 'vacancy');
      const usageType: UsageType = assetClassToUsage(assetClass);
      const multMed = mult?.median ?? 0;
      const price = (r: number, m: number) => Math.round(r * 12 * m);

      const updated =
        [rent.updated, mult?.updated, vac?.updated].filter(Boolean).sort().at(-1) ?? rent.updated;
      if (updated > latest) latest = updated;

      marketBenchmarks.push({
        id: `${locId}-${assetClass}`,
        locationId: locId,
        usageType,
        rentMin: round2(rent.min),
        rentMax: round2(rent.max),
        rentMedian: round2(rent.median),
        purchasePriceMin: price(rent.min, mult?.min ?? multMed),
        purchasePriceMax: price(rent.max, mult?.max ?? multMed),
        purchasePriceMedian: price(rent.median, multMed),
        multiplierMin: round2(mult?.min ?? 0),
        multiplierMax: round2(mult?.max ?? 0),
        multiplierMedian: round2(multMed),
        vacancyRatePercent: round2(vac?.median ?? 0),
        confidenceScore: confidenceUnitToPct(rent.conf),
        sourceLabel: rent.source,
        lastUpdated: (updated || rent.updated).split('T')[0],
      });
    }

    if (marketBenchmarks.length === 0) continue;

    locations.push({
      id: locId,
      city,
      submarket: info?.submarket ?? 'City-wide',
      region: info?.region ?? '',
      benchmarks: marketBenchmarks,
      updateLog: [],
      lastUpdated: (latest || new Date().toISOString()).split('T')[0],
    });
  }

  return locations.sort((a, b) => a.city.localeCompare(b.city, 'de'));
}
