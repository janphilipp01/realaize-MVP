import type { Asset, CashFlowEntry } from '@/models/types';


// ─── Assets (Owned Portfolio) ─────────────────────────────────────────────────

export const mockAssets: Asset[] = [
  {
    id: 'asset-001',
    name: 'Westend Plaza',
    address: 'Bockenheimer Landstraße 47',
    city: 'Frankfurt',
    zip: '60325',
    usageType: 'Büro',
    status: 'Bestand',
    acquisitionDate: '2021-03-15',
    purchasePrice: 18_500_000,
    currentValue: 21_200_000,
    totalArea: 4_850,
    lettableArea: 4_600,
    occupancyRate: 0.89,
    annualRent: 1_105_200,
    operatingCosts: {
      vacancyRatePercent: 5,
      managementCostPercent: 3,
      maintenanceReservePerSqm: 12,
      nonRecoverableOpex: 85_000,
      otherOperatingIncome: 16_800,
      rentalGrowthRate: 2.0,
    },
    completenessScore: 88,
    notes: 'Hauptmieter Laufzeit bis 2027. Gespräche über Verlängerung laufen.',
    units: [
      { id: 'u-001-1', assetId: 'asset-001', unitNumber: 'EG-01', floor: 0, area: 580, usageType: 'Büro', tenant: 'Kanzlei Müller & Partner', rentPerSqm: 21.5, monthlyRent: 12_470, leaseStart: '2020-01-01', leaseEnd: '2027-12-31', leaseType: 'Vermietet' },
      { id: 'u-001-2', assetId: 'asset-001', unitNumber: '1.OG-01', floor: 1, area: 720, usageType: 'Büro', tenant: 'FinServ GmbH', rentPerSqm: 22.0, monthlyRent: 15_840, leaseStart: '2021-06-01', leaseEnd: '2026-05-31', leaseType: 'Vermietet' },
      { id: 'u-001-3', assetId: 'asset-001', unitNumber: '1.OG-02', floor: 1, area: 340, usageType: 'Büro', rentPerSqm: 0, monthlyRent: 0, leaseType: 'Leerstand' },
      { id: 'u-001-4', assetId: 'asset-001', unitNumber: '2.OG-01', floor: 2, area: 860, usageType: 'Büro', tenant: 'Consulting AG', rentPerSqm: 20.8, monthlyRent: 17_888, leaseStart: '2022-01-01', leaseEnd: '2027-12-31', leaseType: 'Vermietet' },
      { id: 'u-001-5', assetId: 'asset-001', unitNumber: '3.OG-01', floor: 3, area: 950, usageType: 'Büro', tenant: 'TechVenture SE', rentPerSqm: 23.5, monthlyRent: 22_325, leaseStart: '2023-03-01', leaseEnd: '2028-02-29', leaseType: 'Vermietet' },
      { id: 'u-001-6', assetId: 'asset-001', unitNumber: 'UG-Parking', floor: -1, area: 400, usageType: 'Sonstiges' as any, tenant: 'Diverse Mieter', rentPerSqm: 3.5, monthlyRent: 1_400, leaseStart: '2021-03-01', leaseEnd: '2024-02-29', leaseType: 'Vermietet' },
    ],
    debtInstruments: [
      { id: 'debt-001-1', assetId: 'asset-001', lender: 'Deutsche Pfandbriefbank', type: 'Senior', amount: 12_000_000, outstandingAmount: 11_200_000, interestRate: 3.45, interestType: 'Fest', maturityDate: '2028-03-15', amortizationRate: 2.0, drawdownDate: '2021-03-15', currency: 'EUR', covenants: [] }
    ],
    covenants: [
      { id: 'cov-001-1', assetId: 'asset-001', name: 'LTV Covenant', type: 'LTV', threshold: 60, currentValue: 52.8, status: 'OK', testDate: '2024-12-31', description: 'Max. LTV 60%' },
      { id: 'cov-001-2', assetId: 'asset-001', name: 'DSCR Covenant', type: 'DSCR', threshold: 1.25, currentValue: 1.42, status: 'OK', testDate: '2024-12-31', description: 'Min. DSCR 1.25x' },
    ],
    cashFlows: generateCashFlows('asset-001', 1_105_200, -420_000),
    documents: [
      { id: 'doc-001-1', assetId: 'asset-001', name: 'Kaufvertrag Westend Plaza.pdf', category: 'Kaufvertrag', uploadDate: '2021-03-10', fileSize: '2.4 MB', tags: ['KV', 'Notariat'], uploadedBy: 'M. Wagner' },
      { id: 'doc-001-2', assetId: 'asset-001', name: 'Mietvertrag Kanzlei Müller.pdf', category: 'Mietvertrag', uploadDate: '2021-01-15', fileSize: '1.8 MB', tags: ['MV', 'Büro'], uploadedBy: 'S. Klein' },
      { id: 'doc-001-3', assetId: 'asset-001', name: 'Wertgutachten 2023.pdf', category: 'Gutachten', uploadDate: '2023-11-20', fileSize: '4.2 MB', tags: ['Bewertung', 'CBRE'], uploadedBy: 'M. Wagner' },
    ],
    capexProjects: [
      { id: 'capex-001-1', assetId: 'asset-001', name: 'Lobby-Renovation EG', budget: 280_000, spent: 195_000, status: 'Laufend', startDate: '2024-01-01', endDate: '2024-06-30' }
    ],
    exitCapRate: 5.0,
    holdingPeriodYears: 8,
    ervPerSqm: 22.5,
  },
  {
    id: 'asset-002',
    name: 'Schwabing Wohnpark',
    address: 'Leopoldstraße 124',
    city: 'München',
    zip: '80804',
    usageType: 'Wohnen',
    status: 'Bestand',
    acquisitionDate: '2019-09-01',
    purchasePrice: 8_200_000,
    currentValue: 11_500_000,
    totalArea: 2_150,
    lettableArea: 2_080,
    occupancyRate: 0.96,
    annualRent: 598_080,
    operatingCosts: {
      vacancyRatePercent: 3,
      managementCostPercent: 4,
      maintenanceReservePerSqm: 10,
      nonRecoverableOpex: 42_000,
      otherOperatingIncome: 8_400,
      rentalGrowthRate: 2.5,
    },
    completenessScore: 95,
    units: [
      { id: 'u-002-1', assetId: 'asset-002', unitNumber: '1a', floor: 1, area: 68, usageType: 'Wohnen', tenant: 'Fam. Bauer', rentPerSqm: 19.5, monthlyRent: 1_326, leaseStart: '2020-01-01', leaseEnd: '2025-12-31', leaseType: 'Vermietet' },
      { id: 'u-002-2', assetId: 'asset-002', unitNumber: '1b', floor: 1, area: 52, usageType: 'Wohnen', tenant: 'P. Schmidt', rentPerSqm: 20.0, monthlyRent: 1_040, leaseStart: '2021-03-01', leaseEnd: '2026-02-28', leaseType: 'Vermietet' },
      { id: 'u-002-3', assetId: 'asset-002', unitNumber: '2a', floor: 2, area: 85, usageType: 'Wohnen', tenant: 'T. Hofmann', rentPerSqm: 21.0, monthlyRent: 1_785, leaseStart: '2019-10-01', leaseEnd: '2027-09-30', leaseType: 'Vermietet' },
      { id: 'u-002-4', assetId: 'asset-002', unitNumber: '2b', floor: 2, area: 72, usageType: 'Wohnen', rentPerSqm: 0, monthlyRent: 0, leaseType: 'Leerstand' },
      { id: 'u-002-5', assetId: 'asset-002', unitNumber: '3a', floor: 3, area: 92, usageType: 'Wohnen', tenant: 'K. Richter', rentPerSqm: 22.5, monthlyRent: 2_070, leaseStart: '2022-06-01', leaseEnd: '2025-05-31', leaseType: 'Vermietet' },
    ],
    debtInstruments: [
      { id: 'debt-002-1', assetId: 'asset-002', lender: 'Bayerische Landesbank', type: 'Senior', amount: 5_500_000, outstandingAmount: 4_900_000, interestRate: 2.10, interestType: 'Fest', maturityDate: '2026-09-01', amortizationRate: 2.5, drawdownDate: '2019-09-01', currency: 'EUR', covenants: [] }
    ],
    covenants: [
      { id: 'cov-002-1', assetId: 'asset-002', name: 'LTV Covenant', type: 'LTV', threshold: 65, currentValue: 42.6, status: 'OK', testDate: '2024-12-31' },
      { id: 'cov-002-2', assetId: 'asset-002', name: 'DSCR Covenant', type: 'DSCR', threshold: 1.20, currentValue: 1.85, status: 'OK', testDate: '2024-12-31' },
    ],
    cashFlows: generateCashFlows('asset-002', 598_080, -180_000),
    documents: [
      { id: 'doc-002-1', assetId: 'asset-002', name: 'Kaufvertrag Schwabing.pdf', category: 'Kaufvertrag', uploadDate: '2019-08-25', fileSize: '1.9 MB', tags: ['KV'], uploadedBy: 'M. Wagner' },
    ],
    capexProjects: [],
    exitCapRate: 4.0,
    holdingPeriodYears: 10,
    ervPerSqm: 20.5,
  },
  {
    id: 'asset-003',
    name: 'Hafenviertel Logistik',
    address: 'Am Lagerhaus 15',
    city: 'Hamburg',
    zip: '20457',
    usageType: 'Logistik',
    status: 'Bestand',
    acquisitionDate: '2022-06-01',
    purchasePrice: 22_000_000,
    currentValue: 24_800_000,
    totalArea: 12_500,
    lettableArea: 12_000,
    occupancyRate: 1.0,
    annualRent: 1_080_000,
    operatingCosts: {
      vacancyRatePercent: 0,
      managementCostPercent: 2.5,
      maintenanceReservePerSqm: 6,
      nonRecoverableOpex: 95_000,
      otherOperatingIncome: 24_000,
      rentalGrowthRate: 1.5,
    },
    completenessScore: 72,
    units: [
      { id: 'u-003-1', assetId: 'asset-003', unitNumber: 'Halle A', floor: 0, area: 6_000, usageType: 'Logistik', tenant: 'LogisTrans GmbH', rentPerSqm: 7.5, monthlyRent: 45_000, leaseStart: '2022-06-01', leaseEnd: '2032-05-31', leaseType: 'Vermietet' },
      { id: 'u-003-2', assetId: 'asset-003', unitNumber: 'Halle B', floor: 0, area: 6_000, usageType: 'Logistik', tenant: 'E-Commerce GmbH', rentPerSqm: 7.5, monthlyRent: 45_000, leaseStart: '2022-06-01', leaseEnd: '2029-05-31', leaseType: 'Vermietet' },
    ],
    debtInstruments: [
      { id: 'debt-003-1', assetId: 'asset-003', lender: 'Berlin Hyp', type: 'Senior', amount: 15_000_000, outstandingAmount: 14_400_000, interestRate: 4.25, interestType: 'Fest', maturityDate: '2025-06-01', amortizationRate: 2.0, drawdownDate: '2022-06-01', currency: 'EUR', covenants: [] }
    ],
    covenants: [
      { id: 'cov-003-1', assetId: 'asset-003', name: 'LTV Covenant', type: 'LTV', threshold: 65, currentValue: 58.1, status: 'Warning', testDate: '2024-12-31', description: 'Annäherung an Schwellenwert. Refinanzierung in Vorbereitung.' },
      { id: 'cov-003-2', assetId: 'asset-003', name: 'DSCR Covenant', type: 'DSCR', threshold: 1.20, currentValue: 1.18, status: 'Breach', testDate: '2024-12-31', description: 'Covenant verletzt. Gespräche mit Lender laufen.' },
    ],
    cashFlows: generateCashFlows('asset-003', 1_080_000, -380_000),
    documents: [],
    capexProjects: [],
    exitCapRate: 5.5,
    holdingPeriodYears: 10,
    ervPerSqm: 8.0,
  },
];

function generateCashFlows(assetId: string, annualRent: number, annualOpex: number) {
  const flows: CashFlowEntry[] = [];
  const now = new Date();
  for (let i = -11; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const isForecast = i > 0;
    const variance = 1 + (Math.random() - 0.5) * 0.08;
    flows.push({
      id: `cf-${assetId}-${period}-in`,
      assetId, period, isForecast,
      category: 'Mieteinnahmen',
      description: 'Nettomieteinnahmen',
      amount: Math.round((annualRent / 12) * variance),
    });
    flows.push({
      id: `cf-${assetId}-${period}-out`,
      assetId, period, isForecast,
      category: 'Instandhaltung',
      description: 'Betriebskosten & Instandhaltung',
      amount: Math.round((annualOpex / 12) * variance),
    });
  }
  return flows;
}
