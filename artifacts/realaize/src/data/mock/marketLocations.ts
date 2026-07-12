import type { MarketLocation } from '@/models/types';


// ─── Market Locations ─────────────────────────────────────────────────────────

export const mockMarketLocations: MarketLocation[] = [
  {
    id: 'loc-berlin',
    city: 'Berlin',
    submarket: 'Prenzlauer Berg / Pankow',
    region: 'Berlin-Brandenburg',
    lastUpdated: '2024-12-15',
    benchmarks: [
      {
        id: 'bm-berlin-wohnen', locationId: 'loc-berlin', usageType: 'Wohnen',
        rentMin: 13.5, rentMax: 18.5, rentMedian: 15.2,
        purchasePriceMin: 4_500, purchasePriceMax: 7_200, purchasePriceMedian: 5_800,
        multiplierMin: 19, multiplierMax: 24, multiplierMedian: 21,
        vacancyRatePercent: 1.2, confidenceScore: 88,
        sourceLabel: 'JLL Wohnmarktreport Q4/2024', lastUpdated: '2024-12-15',
        notes: 'Mietpreisbremse aktiv. Neuvermietung an Mietspiegel orientiert.',
      },
      {
        id: 'bm-berlin-buero', locationId: 'loc-berlin', usageType: 'Büro',
        rentMin: 18.0, rentMax: 35.0, rentMedian: 25.5,
        purchasePriceMin: 8_000, purchasePriceMax: 16_000, purchasePriceMedian: 11_500,
        multiplierMin: 16, multiplierMax: 26, multiplierMedian: 20,
        vacancyRatePercent: 5.8, confidenceScore: 75,
        sourceLabel: 'CBRE Office Market Berlin Q3/2024', lastUpdated: '2024-11-30',
      },
    ],
    updateLog: [
      { id: 'ul-berlin-1', locationId: 'loc-berlin', timestamp: '2024-12-15T10:00:00', updatedBy: 'M. Wagner', changes: 'Wohnmarkt-Mieten Q4/2024 aktualisiert', sourceLabel: 'JLL Report' },
      { id: 'ul-berlin-2', locationId: 'loc-berlin', timestamp: '2024-11-30T14:00:00', updatedBy: 'System', changes: 'Büromarkt Q3/2024 importiert', sourceLabel: 'CBRE' },
    ],
  },
  {
    id: 'loc-frankfurt',
    city: 'Frankfurt am Main',
    submarket: 'CBD / Bankenviertel',
    region: 'Rhein-Main',
    lastUpdated: '2024-12-10',
    benchmarks: [
      {
        id: 'bm-frankfurt-buero', locationId: 'loc-frankfurt', usageType: 'Büro',
        rentMin: 22.0, rentMax: 48.0, rentMedian: 32.5,
        purchasePriceMin: 10_000, purchasePriceMax: 22_000, purchasePriceMedian: 15_000,
        multiplierMin: 14, multiplierMax: 22, multiplierMedian: 17.5,
        vacancyRatePercent: 8.2, confidenceScore: 82,
        sourceLabel: 'Savills Office Frankfurt Q4/2024', lastUpdated: '2024-12-10',
      },
      {
        id: 'bm-frankfurt-wohnen', locationId: 'loc-frankfurt', usageType: 'Wohnen',
        rentMin: 14.0, rentMax: 22.0, rentMedian: 17.5,
        purchasePriceMin: 5_000, purchasePriceMax: 9_500, purchasePriceMedian: 7_200,
        multiplierMin: 20, multiplierMax: 26, multiplierMedian: 22.5,
        vacancyRatePercent: 1.8, confidenceScore: 80,
        sourceLabel: 'empirica Wohnmarkt Rhein-Main Q3/2024', lastUpdated: '2024-11-15',
      },
    ],
    updateLog: [
      { id: 'ul-ffm-1', locationId: 'loc-frankfurt', timestamp: '2024-12-10T09:00:00', updatedBy: 'S. Klein', changes: 'Büromieten Savills Q4/2024', sourceLabel: 'Savills' },
    ],
  },
  {
    id: 'loc-muenchen',
    city: 'München',
    submarket: 'Stadtrand Nord',
    region: 'Oberbayern',
    lastUpdated: '2024-12-20',
    benchmarks: [
      {
        id: 'bm-munich-wohnen', locationId: 'loc-muenchen', usageType: 'Wohnen',
        rentMin: 17.0, rentMax: 28.0, rentMedian: 22.0,
        purchasePriceMin: 8_500, purchasePriceMax: 16_000, purchasePriceMedian: 12_000,
        multiplierMin: 25, multiplierMax: 38, multiplierMedian: 30,
        vacancyRatePercent: 0.8, confidenceScore: 90,
        sourceLabel: 'CBRE Wohnmarkt München Q4/2024', lastUpdated: '2024-12-20',
      },
      {
        id: 'bm-munich-retail', locationId: 'loc-muenchen', usageType: 'Einzelhandel',
        rentMin: 18.0, rentMax: 38.0, rentMedian: 26.8,
        purchasePriceMin: 5_500, purchasePriceMax: 12_000, purchasePriceMedian: 8_500,
        multiplierMin: 12, multiplierMax: 18, multiplierMedian: 14.5,
        vacancyRatePercent: 6.5, confidenceScore: 65,
        sourceLabel: 'BNP Paribas Retail München Q3/2024', lastUpdated: '2024-12-01',
        notes: 'Stadtrand-Einzelhandel unter Druck durch E-Commerce.',
      },
    ],
    updateLog: [
      { id: 'ul-muc-1', locationId: 'loc-muenchen', timestamp: '2024-12-20T11:00:00', updatedBy: 'M. Wagner', changes: 'Wohnmarkt Q4/2024', sourceLabel: 'CBRE' },
    ],
  },
  {
    id: 'loc-hamburg',
    city: 'Hamburg',
    submarket: 'Hafen / HafenCity',
    region: 'Metropolregion Hamburg',
    lastUpdated: '2024-11-25',
    benchmarks: [
      {
        id: 'bm-hamburg-logistik', locationId: 'loc-hamburg', usageType: 'Logistik',
        rentMin: 6.5, rentMax: 9.5, rentMedian: 7.8,
        purchasePriceMin: 1_200, purchasePriceMax: 2_200, purchasePriceMedian: 1_700,
        multiplierMin: 13, multiplierMax: 19, multiplierMedian: 16,
        vacancyRatePercent: 2.5, confidenceScore: 78,
        sourceLabel: 'JLL Industrial Hamburg Q3/2024', lastUpdated: '2024-11-25',
      },
    ],
    updateLog: [
      { id: 'ul-hh-1', locationId: 'loc-hamburg', timestamp: '2024-11-25T14:00:00', updatedBy: 'System', changes: 'Logistikmarkt Q3/2024', sourceLabel: 'JLL' },
    ],
  },
];
