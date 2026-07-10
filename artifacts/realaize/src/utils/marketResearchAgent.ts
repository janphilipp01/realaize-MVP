// AI market research agent — writes into the Market Intelligence master (Welt B).
// SSoT-Migration · Phase 1: research results are validated (Zod), reconciled and
// validated through the same pipeline as broker data, then land as ai_qualitative
// BenchmarkRecords in the store — the exact dataset the Deal Radar & wizards read.

import { z } from 'zod';
import { aiChat } from '@workspace/api-client-react';
import type {
  BenchmarkKpi,
  BenchmarkRecord,
  BenchmarkSourceRecord,
  UsageType,
} from '../models/types';
import { CURRENT_PERIOD } from '../data/marketIntelData';
import { confidenceTierFor, KPI_UNIT, reconcile, validateBenchmark } from './marketIntelligence';
import { USAGE_TYPES, confidencePctToUnit, usageToAssetClass } from './marketVocab';

export const GERMAN_TOP_CITIES = [
  { id: 'loc-berlin', city: 'Berlin', region: 'Berlin-Brandenburg', submarket: 'City-wide' },
  { id: 'loc-hamburg', city: 'Hamburg', region: 'Hamburg', submarket: 'City-wide' },
  { id: 'loc-muenchen', city: 'München', region: 'Oberbayern', submarket: 'City-wide' },
  { id: 'loc-koeln', city: 'Köln', region: 'Rheinland', submarket: 'City-wide' },
  { id: 'loc-frankfurt', city: 'Frankfurt am Main', region: 'Rhein-Main', submarket: 'City-wide' },
  { id: 'loc-stuttgart', city: 'Stuttgart', region: 'Baden-Württemberg', submarket: 'City-wide' },
  { id: 'loc-duesseldorf', city: 'Düsseldorf', region: 'Rheinland', submarket: 'City-wide' },
  { id: 'loc-leipzig', city: 'Leipzig', region: 'Sachsen', submarket: 'City-wide' },
  { id: 'loc-dortmund', city: 'Dortmund', region: 'Ruhrgebiet', submarket: 'City-wide' },
  { id: 'loc-essen', city: 'Essen', region: 'Ruhrgebiet', submarket: 'City-wide' },
  { id: 'loc-bremen', city: 'Bremen', region: 'Bremen', submarket: 'City-wide' },
  { id: 'loc-dresden', city: 'Dresden', region: 'Sachsen', submarket: 'City-wide' },
  { id: 'loc-hannover', city: 'Hannover', region: 'Niedersachsen', submarket: 'City-wide' },
  { id: 'loc-nuernberg', city: 'Nürnberg', region: 'Mittelfranken', submarket: 'City-wide' },
  { id: 'loc-duisburg', city: 'Duisburg', region: 'Ruhrgebiet', submarket: 'City-wide' },
  { id: 'loc-bochum', city: 'Bochum', region: 'Ruhrgebiet', submarket: 'City-wide' },
  { id: 'loc-wuppertal', city: 'Wuppertal', region: 'Bergisches Land', submarket: 'City-wide' },
  { id: 'loc-bielefeld', city: 'Bielefeld', region: 'Ostwestfalen', submarket: 'City-wide' },
  { id: 'loc-bonn', city: 'Bonn', region: 'Rheinland', submarket: 'City-wide' },
  { id: 'loc-muenster', city: 'Münster', region: 'Westfalen', submarket: 'City-wide' },
];

// ── AI response schema (MKT-F-07) ─────────────────────────────────────────────
// Tolerant: coerces numeric strings, ignores extra fields, defaults soft values.
// A parse failure aborts the ingest instead of writing garbage into the master.

const NumLoose = z.coerce.number().catch(0);

const AiBenchmarkSchema = z
  .object({
    usageType: z.string(),
    rentMedian: NumLoose,
    multiplierMedian: NumLoose,
    vacancyRatePercent: NumLoose.optional(),
    confidenceScore: NumLoose.optional(),
    sourceLabel: z.string().optional(),
    notes: z.string().optional(),
  })
  .passthrough();

const AiResearchSchema = z.object({
  benchmarks: z.array(AiBenchmarkSchema).min(1),
});

export interface CityBenchmarkResult {
  success: boolean;
  records: BenchmarkRecord[];
  error?: string;
}

function isUsageType(v: string): v is UsageType {
  return (USAGE_TYPES as readonly string[]).includes(v);
}

let seq = 0;

/** Build one ai_qualitative BenchmarkRecord for a single KPI value. */
function aiBenchmark(
  city: string,
  assetClass: BenchmarkRecord['assetClass'],
  kpi: BenchmarkKpi,
  value: number,
  confidenceUnit: number,
  sourceLabel?: string,
): BenchmarkRecord {
  const publishedAt = new Date().toISOString();
  const source: BenchmarkSourceRecord = {
    id: `src-ai-${++seq}`,
    provider: 'AI',
    value,
    unit: KPI_UNIT[kpi],
    trustScore: 0.5,
    confidenceScore: confidenceUnit,
    documentTitle: `AI Market Research · ${city} · ${CURRENT_PERIOD}`,
    originalText: `Claude web-search estimate for ${city}${sourceLabel ? ` (${sourceLabel})` : ''}`,
    publishedAt,
  };
  const r = reconcile([source]); // single source → single_source method
  const validation = validateBenchmark({
    assetClass,
    kpi,
    value: r.value,
    confidenceScore: confidenceUnit,
    sourceType: 'ai_qualitative',
  });

  return {
    id: `bm-ai-${city}-${assetClass}-${kpi}-${++seq}`,
    city,
    submarket: undefined, // city-wide research → serves as the city-fallback benchmark
    assetClass,
    kpi,
    value: r.value,
    unit: KPI_UNIT[kpi],
    periodQuarter: CURRENT_PERIOD,
    sourceType: 'ai_qualitative',
    sourceProvider: 'AI Research Agent',
    confidenceScore: Math.round(confidenceUnit * 100) / 100,
    confidenceTier: confidenceTierFor('ai_qualitative'),
    validationStatus: validation.status,
    dataAvailability: 'current',
    consolidationMethod: r.method,
    sourceCount: r.sourceCount,
    valueSpread: r.spread || undefined,
    extractedAt: publishedAt,
    sources: [source],
    validationFlags: validation.flags.length ? validation.flags : undefined,
  };
}

/**
 * Research current market data for a city and return Market Intelligence master
 * records (Welt B). erv + multiplier drive the Deal Radar screening seeds; vacancy
 * is added when reported. Records are ai_qualitative → land as "pending / AI
 * indicative" in the review queue, never auto-quotable for IC.
 */
export async function researchCityBenchmarks(
  _cityId: string,
  cityName: string,
): Promise<CityBenchmarkResult> {
  const prompt = `German real estate analyst. Do ONE web search for "${cityName} Immobilienmarkt Miete Kaufpreis 2024 2025" to get current market data.

Reply ONLY with this JSON (no markdown):
{"benchmarks":[
{"usageType":"Wohnen","rentMedian":0,"multiplierMedian":0,"vacancyRatePercent":0,"confidenceScore":80,"sourceLabel":"web search"},
{"usageType":"Büro","rentMedian":0,"multiplierMedian":0,"vacancyRatePercent":0,"confidenceScore":75,"sourceLabel":"web search"},
{"usageType":"Einzelhandel","rentMedian":0,"multiplierMedian":0,"vacancyRatePercent":0,"confidenceScore":70,"sourceLabel":"web search"},
{"usageType":"Logistik","rentMedian":0,"multiplierMedian":0,"vacancyRatePercent":0,"confidenceScore":70,"sourceLabel":"web search"}
]}

Fill in real values for ${cityName}. rentMedian in EUR/sqm/month, multiplierMedian = price/(rent×12), confidenceScore 0-100.`;

  try {
    const result = await aiChat({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1200,
      webSearch: true,
    });

    const cleanJson = result.text.replace(/```json|```/g, '').trim();

    let raw: unknown;
    try {
      raw = JSON.parse(cleanJson);
    } catch {
      return { success: false, records: [], error: 'AI-Antwort war kein gültiges JSON.' };
    }

    const parsed = AiResearchSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return {
        success: false,
        records: [],
        error: `AI-Antwort verletzt das Schema: ${first ? `${first.path.join('.')} — ${first.message}` : 'unbekannt'}.`,
      };
    }

    const records: BenchmarkRecord[] = [];
    for (const bm of parsed.data.benchmarks) {
      if (!isUsageType(bm.usageType)) continue;
      const assetClass = usageToAssetClass(bm.usageType);
      const confidenceUnit = confidencePctToUnit(bm.confidenceScore ?? 50);

      if (bm.rentMedian > 0) {
        records.push(aiBenchmark(cityName, assetClass, 'erv', bm.rentMedian, confidenceUnit, bm.sourceLabel));
      }
      if (bm.multiplierMedian > 0) {
        records.push(aiBenchmark(cityName, assetClass, 'multiplier', bm.multiplierMedian, confidenceUnit, bm.sourceLabel));
      }
      if (bm.vacancyRatePercent && bm.vacancyRatePercent > 0) {
        records.push(aiBenchmark(cityName, assetClass, 'vacancy', bm.vacancyRatePercent, confidenceUnit, bm.sourceLabel));
      }
    }

    if (records.length === 0) {
      return { success: false, records: [], error: 'Keine verwertbaren Benchmarks in der AI-Antwort.' };
    }

    return { success: true, records };
  } catch (error: any) {
    console.error('Market research (Market Intelligence) failed:', error);
    return { success: false, records: [], error: error?.message ?? 'Research fehlgeschlagen.' };
  }
}

/** Batch research across the German top cities, streaming results per city. */
export async function researchAllCities(
  onProgress: (cityName: string, index: number, total: number) => void,
  onResult: (cityId: string, result: CityBenchmarkResult) => void,
): Promise<void> {
  for (let i = 0; i < GERMAN_TOP_CITIES.length; i++) {
    const city = GERMAN_TOP_CITIES[i];
    onProgress(city.city, i, GERMAN_TOP_CITIES.length);
    const result = await researchCityBenchmarks(city.id, city.city);
    onResult(city.id, result);
    if (i < GERMAN_TOP_CITIES.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}
