import { aiChat } from '@workspace/api-client-react';
import type { MarketBenchmark, MarketUpdateEntry, UsageType } from '@/models/types';

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
  { id: 'loc-oberhausen', city: 'Oberhausen', region: 'Ruhrgebiet', submarket: 'City-wide' },
  { id: 'loc-muelheim', city: 'Mülheim an der Ruhr', region: 'Ruhrgebiet', submarket: 'City-wide' },
  { id: 'loc-gelsenkirchen', city: 'Gelsenkirchen', region: 'Ruhrgebiet', submarket: 'City-wide' },
  { id: 'loc-wuppertal', city: 'Wuppertal', region: 'Bergisches Land', submarket: 'City-wide' },
  { id: 'loc-bielefeld', city: 'Bielefeld', region: 'Ostwestfalen', submarket: 'City-wide' },
  { id: 'loc-bonn', city: 'Bonn', region: 'Rheinland', submarket: 'City-wide' },
  { id: 'loc-muenster', city: 'Münster', region: 'Westfalen', submarket: 'City-wide' },
];

const USAGE_LABELS: Record<string, string> = {
  'Wohnen': 'Residential',
  'Büro': 'Office',
  'Einzelhandel': 'Retail',
  'Logistik': 'Logistics',
  'Mixed Use': 'Mixed Use',
};

export interface ResearchResult {
  success: boolean;
  benchmarks: MarketBenchmark[];
  updateEntry: MarketUpdateEntry;
  error?: string;
}

export async function researchCityMarketData(
  cityId: string,
  cityName: string,
): Promise<ResearchResult> {
  const now = new Date().toISOString();

  const prompt = `German real estate analyst. Do ONE web search for "${cityName} Immobilienmarkt Miete Kaufpreis 2024 2025" to get current market data.

Reply ONLY with this JSON (no markdown):
{"benchmarks":[
{"usageType":"Wohnen","rentMin":0,"rentMax":0,"rentMedian":0,"purchasePriceMin":0,"purchasePriceMax":0,"purchasePriceMedian":0,"multiplierMin":0,"multiplierMax":0,"multiplierMedian":0,"vacancyRatePercent":0,"confidenceScore":80,"sourceLabel":"web search","notes":""},
{"usageType":"Büro","rentMin":0,"rentMax":0,"rentMedian":0,"purchasePriceMin":0,"purchasePriceMax":0,"purchasePriceMedian":0,"multiplierMin":0,"multiplierMax":0,"multiplierMedian":0,"vacancyRatePercent":0,"confidenceScore":75,"sourceLabel":"web search","notes":""},
{"usageType":"Einzelhandel","rentMin":0,"rentMax":0,"rentMedian":0,"purchasePriceMin":0,"purchasePriceMax":0,"purchasePriceMedian":0,"multiplierMin":0,"multiplierMax":0,"multiplierMedian":0,"vacancyRatePercent":0,"confidenceScore":70,"sourceLabel":"web search","notes":""},
{"usageType":"Logistik","rentMin":0,"rentMax":0,"rentMedian":0,"purchasePriceMin":0,"purchasePriceMax":0,"purchasePriceMedian":0,"multiplierMin":0,"multiplierMax":0,"multiplierMedian":0,"vacancyRatePercent":0,"confidenceScore":70,"sourceLabel":"web search","notes":""}
]}

Fill in real values for ${cityName}. Rents EUR/sqm/month, prices EUR/sqm. Multiplier=price/(rent×12).`;

  try {
    const result = await aiChat({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1200,
      webSearch: true,
    });

    const cleanJson = result.text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    if (!parsed.benchmarks || !Array.isArray(parsed.benchmarks)) {
      throw new Error('Invalid response structure: missing benchmarks array');
    }

    const benchmarks: MarketBenchmark[] = parsed.benchmarks.map((bm: any) => ({
      id: `bm-${cityId}-${bm.usageType?.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      locationId: cityId,
      usageType: bm.usageType as UsageType,
      rentMin: Number(bm.rentMin) || 0,
      rentMax: Number(bm.rentMax) || 0,
      rentMedian: Number(bm.rentMedian) || 0,
      purchasePriceMin: Number(bm.purchasePriceMin) || 0,
      purchasePriceMax: Number(bm.purchasePriceMax) || 0,
      purchasePriceMedian: Number(bm.purchasePriceMedian) || 0,
      multiplierMin: Number(bm.multiplierMin) || 0,
      multiplierMax: Number(bm.multiplierMax) || 0,
      multiplierMedian: Number(bm.multiplierMedian) || 0,
      vacancyRatePercent: Number(bm.vacancyRatePercent) || 0,
      confidenceScore: Number(bm.confidenceScore) || 50,
      sourceLabel: bm.sourceLabel || 'AI Research Agent',
      lastUpdated: now.split('T')[0],
      notes: bm.notes || undefined,
    }));

    const updateEntry: MarketUpdateEntry = {
      id: `ul-${cityId}-${Date.now()}`,
      locationId: cityId,
      timestamp: now,
      updatedBy: 'AI Research Agent',
      changes: `Market data refreshed: ${benchmarks.map(b => USAGE_LABELS[b.usageType] || b.usageType).join(', ')}`,
      sourceLabel: 'Claude Web Search',
    };

    return { success: true, benchmarks, updateEntry };
  } catch (error: unknown) {
    console.error('Market research failed:', error);
    return {
      success: false,
      benchmarks: [],
      updateEntry: {
        id: `ul-${cityId}-${Date.now()}`,
        locationId: cityId,
        timestamp: now,
        updatedBy: 'AI Research Agent',
        changes: `Research failed: ${error instanceof Error ? error.message : String(error)}`,
        sourceLabel: 'Error',
      },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function researchAllCities(
  existingLocations: string[],
  onProgress: (cityName: string, index: number, total: number) => void,
  onResult: (cityId: string, result: ResearchResult) => void,
): Promise<void> {
  for (let i = 0; i < GERMAN_TOP_CITIES.length; i++) {
    const city = GERMAN_TOP_CITIES[i];
    onProgress(city.city, i, GERMAN_TOP_CITIES.length);
    const result = await researchCityMarketData(city.id, city.city);
    onResult(city.id, result);
    if (i < GERMAN_TOP_CITIES.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}
