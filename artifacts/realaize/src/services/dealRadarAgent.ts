import { aiChat } from '@workspace/api-client-react';
import type { DealRadarListing, DealRadarSearchCriteria, UsageType } from '@/models/types';

export interface DealRadarResult {
  success: boolean;
  listings: DealRadarListing[];
  error?: string;
}

export async function searchDealRadar(criteria: DealRadarSearchCriteria): Promise<DealRadarResult> {
  const citiesStr = criteria.cities.join(', ');
  const usageStr = criteria.usageTypes.join(', ');
  const priceRange = `€${(criteria.priceMin / 1e6).toFixed(1)}M - €${(criteria.priceMax / 1e6).toFixed(1)}M`;
  const areaRange = `${criteria.minArea} - ${criteria.maxArea} sqm`;

  const prompt = `You are a German real estate transaction scout. Search for current commercial and residential investment properties for sale in Germany.

Search criteria:
- Cities: ${citiesStr}
- Usage types: ${usageStr}
- Price range: ${priceRange}
- Area range: ${areaRange}

Do ONE web search for "Gewerbeimmobilien Anlageimmobilien kaufen ${criteria.cities[0]} ${criteria.cities[1] || ''} 2025 2026" to find current offerings from portals like ImmobilienScout24, Immowelt, BNP Paribas Real Estate, CBRE, JLL, Savills, Colliers, Engel & Völkers Commercial, DEAL Magazine.

Find 5-10 real, currently available investment properties. For each property provide a brief AI assessment.

Reply ONLY with valid JSON (no markdown):
{"listings":[{"title":"<property name/description>","address":"<street if available>","city":"<city>","zip":"<zip if available>","usageType":"Wohnen"|"Büro"|"Einzelhandel"|"Logistik"|"Mixed Use","askingPrice":0,"pricePerSqm":0,"totalArea":0,"yearBuilt":0,"description":"<2-3 sentence description>","sourceLabel":"<platform/broker name>","sourceUrl":"<URL or empty>","aiNotes":"<1-2 sentence AI assessment: is this interesting for a value-add investor?>","estimatedYield":0}]}`;

  try {
    const result = await aiChat({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 3000,
      webSearch: true,
    });

    const cleanJson = result.text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    if (!parsed.listings || !Array.isArray(parsed.listings)) {
      throw new Error('Invalid response: missing listings array');
    }

    const now = new Date().toISOString();
    const listings: DealRadarListing[] = parsed.listings
      .filter((l: any) => l.askingPrice >= criteria.priceMin * 0.8 && l.askingPrice <= criteria.priceMax * 1.2)
      .map((l: any, i: number) => ({
        id: `radar-${Date.now()}-${i}`,
        title: l.title || 'Untitled Property',
        address: l.address || '',
        city: l.city || criteria.cities[0],
        zip: l.zip || '',
        usageType: (l.usageType as UsageType) || 'Mixed Use',
        askingPrice: l.askingPrice || 0,
        pricePerSqm: l.pricePerSqm || (l.askingPrice && l.totalArea ? Math.round(l.askingPrice / l.totalArea) : 0),
        totalArea: l.totalArea || 0,
        yearBuilt: l.yearBuilt || undefined,
        description: l.description || '',
        sourceLabel: l.sourceLabel || 'Web Search',
        sourceUrl: l.sourceUrl || '',
        status: 'new' as const,
        aiNotes: l.aiNotes || '',
        estimatedYield: l.estimatedYield || undefined,
        foundAt: now,
      }));

    return { success: true, listings };
  } catch (error: any) {
    console.error('Deal Radar search failed:', error);
    return { success: false, listings: [], error: error.message };
  }
}
