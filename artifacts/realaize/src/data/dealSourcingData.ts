// Deal Sourcing & Screening · seed data (Module 07).
// Two default acquisition profiles, the Market-Intelligence benchmark inputs the
// screening needs, and the representative candidate set from the concept's Deal
// Radar mock + worked example (Düsseldorf-Flingern). Matches are computed at load
// by the same engine the backend matcher uses, so the worked example reproduces.

import type {
  AcquisitionProfile,
  CandidateDeal,
  ScreeningBenchmarkSeed,
  UsageType,
  ScreeningAssetClass,
  DealRadarListing,
} from '../models/types';
import { screenCandidateAllProfiles } from '../utils/screening';

export const BENCHMARK_AS_OF = '2026-Q2';

// Düsseldorf + first Speckgürtel ring · €0.5–5 M / 100–1,500 m² sweet spot.
const DUS_RING = ['Düsseldorf', 'Meerbusch', 'Ratingen', 'Neuss', 'Hilden', 'Erkrath'];

export const defaultAcquisitionProfiles: AcquisitionProfile[] = [
  {
    id: 'profile-value-add',
    name: 'Düsseldorf Value-Add Residential',
    shortLabel: 'V-A',
    screeningMode: 'discount_to_market',
    cities: DUS_RING,
    submarkets: [],
    assetClasses: ['residential', 'mixed_use'],
    priceMin: 500_000,
    priceMax: 5_000_000,
    areaMin: 100,
    areaMax: 1_500,
    minDiscountPricePct: 10,
    minDiscountFactorPct: 5,
    minGrossYieldPct: null,
    active: true,
  },
  {
    id: 'profile-core-plus',
    name: 'Düsseldorf Core+ Residential',
    shortLabel: 'C+',
    screeningMode: 'absolute_yield_threshold',
    cities: DUS_RING,
    submarkets: [],
    assetClasses: ['residential', 'mixed_use'],
    priceMin: 500_000,
    priceMax: 5_000_000,
    areaMin: 100,
    areaMax: 1_500,
    minDiscountPricePct: 0,
    minDiscountFactorPct: null,
    minGrossYieldPct: 5.0,
    active: true,
  },
];

// Reconciled benchmark inputs (Market Intelligence) per submarket × asset class.
export const screeningBenchmarks: ScreeningBenchmarkSeed[] = [
  { city: 'Düsseldorf', submarket: 'Flingern', assetClass: 'residential', pricePerSqm: 3600, rentPerSqmMonth: 12.80, factorMedian: 22.5, rentGrowthPaPct: 3.8, asOf: BENCHMARK_AS_OF },
  { city: 'Düsseldorf', submarket: 'Bilk', assetClass: 'residential', pricePerSqm: 3800, rentPerSqmMonth: 12.92, factorMedian: 24.0, rentGrowthPaPct: 3.5, asOf: BENCHMARK_AS_OF },
  { city: 'Meerbusch', submarket: 'Büderich', assetClass: 'residential', pricePerSqm: 3520, rentPerSqmMonth: 15.22, factorMedian: 19.5, rentGrowthPaPct: 3.0, asOf: BENCHMARK_AS_OF },
  { city: 'Ratingen', assetClass: 'mixed_use', pricePerSqm: 3500, rentPerSqmMonth: 13.02, factorMedian: 23.0, rentGrowthPaPct: 2.8, asOf: BENCHMARK_AS_OF },
  // City-level fallbacks for off-submarket / AI-sourced candidates.
  { city: 'Düsseldorf', assetClass: 'residential', pricePerSqm: 3500, rentPerSqmMonth: 13.00, factorMedian: 23.0, rentGrowthPaPct: 3.5, asOf: BENCHMARK_AS_OF },
  { city: 'Düsseldorf', assetClass: 'mixed_use', pricePerSqm: 3400, rentPerSqmMonth: 13.50, factorMedian: 22.0, rentGrowthPaPct: 3.2, asOf: BENCHMARK_AS_OF },
];

const now = '2026-06-23T07:00:00.000Z';
const lastThu = '2026-06-18T07:00:00.000Z';

// Candidates without matches; matches are attached below by the engine.
const rawCandidates: Omit<CandidateDeal, 'matches'>[] = [
  {
    id: 'cand-flingern-01',
    sourceChannel: 'platform_immoscout',
    sourceRef: 'https://www.immobilienscout24.de/expose/flingern-mfh',
    sourceLabel: 'ImmoScout24',
    title: 'Wohn-MFH Düsseldorf-Flingern – partial vacancy',
    address: 'Birkenstraße, 40233 Düsseldorf',
    city: 'Düsseldorf',
    submarket: 'Flingern',
    assetClass: 'residential',
    askingPrice: 2_250_000,
    areaSqm: 720,
    currentRentPa: 81_216,            // ~€9,40/m² Ist-Miete
    yearBuilt: 1954,
    vacancyState: 'Teilweise vermietet',
    numUnits: 8,
    description:
      'MFH mit 8 Einheiten, teilweise leerstehend. Letzte Sanierung 2002. Aktuelle Ist-Miete bei ' +
      '€ 9,40 / m² (rund 27 % unter Markt) — Repositionierungspotenzial. Vollständige Gebäudedokumentation vorhanden.',
    aiNotes:
      'Asking price liegt 13,2 % unter Vergleichswert für Düsseldorf-Flingern und der implizite Faktor 20,35× ' +
      'ist 9,6 % unter dem Submarket-Median 22,5×. Bei Repositionierung auf Marktmiete (€ 12,80 / m²) steigt die ' +
      'Brutto-Rendite auf 5,7 % — eindeutige Value-Add-Anlage. Core+ scheitert knapp am 5,0 % Yield-Floor (4,92 %). ' +
      'Empfehlung: Underwriting im Value-Add-Profil starten.',
    status: 'new',
    listingActive: true,
    firstSeenAt: now,
    lastSeenAt: now,
  },
  {
    id: 'cand-buederich-02',
    sourceChannel: 'broker_crawl',
    sourceRef: 'https://www.aengevelt.com/objekt/meerbusch-mfh',
    sourceLabel: 'Aengevelt',
    title: 'Mehrfamilienhaus Meerbusch-Büderich – vermietet',
    address: 'Düsseldorfer Straße, 40667 Meerbusch',
    city: 'Meerbusch',
    submarket: 'Büderich',
    assetClass: 'residential',
    askingPrice: 3_400_000,
    areaSqm: 980,
    currentRentPa: 179_000,
    yearBuilt: 1998,
    vacancyState: 'Voll vermietet',
    numUnits: 11,
    description:
      'Voll vermietetes MFH in bevorzugter Büdericher Lage. Stabile Mieterstruktur, geringe Fluktuation. ' +
      'Brutto-Rendite oberhalb des 5 %-Floors — klassischer Core+-Halteansatz.',
    aiNotes:
      'Brutto-Rendite 5,26 % liegt über dem Core+-Floor von 5,0 %; Preisabschlag zum Vergleichswert nur −1,4 %. ' +
      'Kein Value-Add-Profil (Discount unter 10 %), aber solider Core+-Kandidat für den Bestand.',
    status: 'shortlisted',
    listingActive: true,
    firstSeenAt: lastThu,
    lastSeenAt: now,
  },
  {
    id: 'cand-bilk-03',
    sourceChannel: 'inbox',
    sourceRef: 'mid:larbig-mortag-bilk-2026-06',
    sourceLabel: 'Inbox · Larbig & Mortag',
    title: 'MFH Düsseldorf-Bilk – Sanierungsbedarf',
    address: 'Brunnenstraße, 40223 Düsseldorf',
    city: 'Düsseldorf',
    submarket: 'Bilk',
    assetClass: 'residential',
    askingPrice: 1_850_000,
    areaSqm: 540,
    currentRentPa: 58_000,
    yearBuilt: 1962,
    vacancyState: 'Teilweise vermietet',
    numUnits: 6,
    description:
      'MFH mit erheblichem Sanierungsstau in Bilk. Preis pro m² unter Submarket-Niveau, impliziter Faktor mit ' +
      'Abschlag zum Median — Value-Add-Tell bei aktuell niedrigen Ist-Mieten.',
    aiNotes:
      'Preisabschlag −9,8 % (knapp unter dem 10 %-Value-Add-Schwellwert für Test A), aber Faktor-Abschlag 7,9 % ' +
      'erfüllt Test B → Amber. Sanierungszustand prüfen.',
    status: 'new',
    listingActive: true,
    firstSeenAt: now,
    lastSeenAt: now,
  },
  {
    id: 'cand-ratingen-04',
    sourceChannel: 'platform_immowelt',
    sourceRef: 'https://www.immowelt.de/expose/ratingen-mixed',
    sourceLabel: 'Immowelt',
    title: 'Mixed-Use Ratingen – Wohnen & Praxis',
    address: 'Bahnstraße, 40878 Ratingen',
    city: 'Ratingen',
    assetClass: 'mixed_use',
    askingPrice: 4_200_000,
    areaSqm: 1_250,
    currentRentPa: 205_000,
    yearBuilt: 1989,
    vacancyState: 'Voll vermietet',
    numUnits: 14,
    description:
      'Gemischt genutzte Liegenschaft (Wohnen + Praxisflächen) in Ratingen. Preisabschlag moderat, ' +
      'Brutto-Rendite unter Core+-Floor.',
    aiNotes:
      'Preisabschlag −4,0 % und Brutto-Rendite 4,65 % unter dem Core+-Floor. Abgelehnt: Stock-Condition und ' +
      'Lage außerhalb des Kernfokus.',
    status: 'rejected',
    rejectReason: 'stock condition',
    listingActive: true,
    firstSeenAt: lastThu,
    lastSeenAt: now,
  },
];

export const mockCandidateDeals: CandidateDeal[] = rawCandidates.map((c) => ({
  ...c,
  matches: screenCandidateAllProfiles({ ...c, matches: [] }, defaultAcquisitionProfiles, screeningBenchmarks),
}));

// ── Map an AI-websearch listing into a screening candidate (the "Beides" path). ──
const USAGE_TO_ASSET: Record<UsageType, ScreeningAssetClass> = {
  Wohnen: 'residential',
  'Mixed Use': 'mixed_use',
  Büro: 'office',
  Einzelhandel: 'retail',
  Logistik: 'logistics',
};

export function listingToCandidate(l: DealRadarListing): Omit<CandidateDeal, 'matches'> {
  const ts = new Date().toISOString();
  return {
    id: `cand-${l.id}`,
    sourceChannel: 'manual_upload',
    sourceRef: l.sourceUrl || l.id,
    sourceLabel: l.sourceLabel || 'Web Search',
    title: l.title,
    address: l.address || '',
    city: l.city,
    submarket: undefined,
    assetClass: USAGE_TO_ASSET[l.usageType] ?? 'residential',
    askingPrice: l.askingPrice,
    areaSqm: l.totalArea,
    yearBuilt: l.yearBuilt,
    description: l.description,
    aiNotes: l.aiNotes,
    status: 'new',
    listingActive: true,
    firstSeenAt: ts,
    lastSeenAt: ts,
  };
}
