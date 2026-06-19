// Snapshot of mockData market locations — seeded for every new org on first bootstrap.
// Smaller subset; users can extend via the AI research agent.

export interface SeedBenchmark {
  id: string;
  locationId: string;
  usageType: string;
  rentMin: number; rentMax: number; rentMedian: number;
  purchasePriceMin: number; purchasePriceMax: number; purchasePriceMedian: number;
  multiplierMin: number; multiplierMax: number; multiplierMedian: number;
  vacancyRatePercent: number;
  confidenceScore: number;
  sourceLabel: string;
  lastUpdated: string;
  notes?: string;
}

export interface SeedUpdateEntry {
  id: string;
  locationId: string;
  timestamp: string;
  updatedBy: string;
  changes: string;
  sourceLabel: string;
}

export interface SeedMarketLocation {
  locationKey: string;
  city: string;
  region: string;
  submarket: string;
  lastUpdated: string;
  benchmarks: SeedBenchmark[];
  updateLog: SeedUpdateEntry[];
}

export const MOCK_MARKET_LOCATIONS: SeedMarketLocation[] = [
  {
    locationKey: 'loc-berlin',
    city: 'Berlin',
    region: 'Berlin-Brandenburg',
    submarket: 'Prenzlauer Berg / Pankow',
    lastUpdated: '2024-12-15',
    benchmarks: [
      {
        id: 'bm-berlin-wohnen', locationId: 'loc-berlin', usageType: 'Wohnen',
        rentMin: 13.5, rentMax: 18.5, rentMedian: 15.2,
        purchasePriceMin: 4500, purchasePriceMax: 7200, purchasePriceMedian: 5800,
        multiplierMin: 19, multiplierMax: 24, multiplierMedian: 21,
        vacancyRatePercent: 1.2, confidenceScore: 88,
        sourceLabel: 'JLL Wohnmarktreport Q4/2024', lastUpdated: '2024-12-15',
        notes: 'Mietpreisbremse aktiv.',
      },
      {
        id: 'bm-berlin-buero', locationId: 'loc-berlin', usageType: 'Büro',
        rentMin: 18.0, rentMax: 35.0, rentMedian: 25.5,
        purchasePriceMin: 8000, purchasePriceMax: 16000, purchasePriceMedian: 11500,
        multiplierMin: 16, multiplierMax: 26, multiplierMedian: 20,
        vacancyRatePercent: 5.8, confidenceScore: 75,
        sourceLabel: 'CBRE Office Market Berlin Q3/2024', lastUpdated: '2024-11-30',
      },
    ],
    updateLog: [
      { id: 'ul-berlin-1', locationId: 'loc-berlin', timestamp: '2024-12-15T10:00:00', updatedBy: 'M. Wagner', changes: 'Wohnmarkt-Mieten Q4/2024 aktualisiert', sourceLabel: 'JLL Report' },
    ],
  },
  {
    locationKey: 'loc-frankfurt',
    city: 'Frankfurt am Main',
    region: 'Rhein-Main',
    submarket: 'CBD / Bankenviertel',
    lastUpdated: '2024-12-10',
    benchmarks: [
      {
        id: 'bm-frankfurt-buero', locationId: 'loc-frankfurt', usageType: 'Büro',
        rentMin: 22.0, rentMax: 48.0, rentMedian: 32.5,
        purchasePriceMin: 10000, purchasePriceMax: 22000, purchasePriceMedian: 15000,
        multiplierMin: 14, multiplierMax: 22, multiplierMedian: 17.5,
        vacancyRatePercent: 8.2, confidenceScore: 82,
        sourceLabel: 'Savills Office Frankfurt Q4/2024', lastUpdated: '2024-12-10',
      },
    ],
    updateLog: [
      { id: 'ul-ffm-1', locationId: 'loc-frankfurt', timestamp: '2024-12-10T09:00:00', updatedBy: 'S. Klein', changes: 'Büromieten Savills Q4/2024', sourceLabel: 'Savills' },
    ],
  },
  {
    locationKey: 'loc-muenchen',
    city: 'München',
    region: 'Oberbayern',
    submarket: 'Schwabing / Maxvorstadt',
    lastUpdated: '2024-11-20',
    benchmarks: [
      {
        id: 'bm-muenchen-wohnen', locationId: 'loc-muenchen', usageType: 'Wohnen',
        rentMin: 18.0, rentMax: 28.0, rentMedian: 22.5,
        purchasePriceMin: 8000, purchasePriceMax: 14000, purchasePriceMedian: 10500,
        multiplierMin: 22, multiplierMax: 30, multiplierMedian: 26,
        vacancyRatePercent: 0.6, confidenceScore: 90,
        sourceLabel: 'empirica München Q4/2024', lastUpdated: '2024-11-20',
      },
    ],
    updateLog: [
      { id: 'ul-muc-1', locationId: 'loc-muenchen', timestamp: '2024-11-20T11:00:00', updatedBy: 'M. Wagner', changes: 'Wohnmarkt München Q4/2024', sourceLabel: 'empirica' },
    ],
  },
];
