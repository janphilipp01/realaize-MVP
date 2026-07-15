import type { Asset, CashFlowEntry } from '@/models/types';


// ─── Assets (Owned Portfolio) ─────────────────────────────────────────────────
// Reines Wohn-Portfolio, Kaufpreis je Objekt < 3 Mio., Lagen Düsseldorf + NRW.

export const mockAssets: Asset[] = [
  {
    id: 'asset-001',
    name: 'Wohnhaus Oberkassel',
    address: 'Luegallee 42',
    city: 'Düsseldorf',
    zip: '40545',
    usageType: 'Wohnen',
    status: 'Bestand',
    acquisitionDate: '2021-05-01',
    purchasePrice: 2_850_000,
    currentValue: 3_100_000,
    totalArea: 720,
    lettableArea: 720,
    occupancyRate: 1.0,
    annualRent: 134_820,
    operatingCosts: {
      vacancyRatePercent: 2,
      managementCostPercent: 4,
      maintenanceReservePerSqm: 10,
      nonRecoverableOpex: 18_000,
      otherOperatingIncome: 4_200,
      rentalGrowthRate: 2.5,
    },
    completenessScore: 92,
    notes: 'Gepflegtes Gründerzeit-MFH in bester Oberkasseler Lage. Vollvermietet, stabile Mieterschaft, geringe Fluktuation.',
    units: [
      { id: 'u-001-1', assetId: 'asset-001', unitNumber: 'EG-01', floor: 0, area: 88, usageType: 'Wohnen', tenant: 'Fam. Vogel', rentPerSqm: 15.0, monthlyRent: 1_320, leaseStart: '2019-04-01', leaseEnd: '2027-03-31', leaseType: 'Vermietet' },
      { id: 'u-001-2', assetId: 'asset-001', unitNumber: 'EG-02', floor: 0, area: 82, usageType: 'Wohnen', tenant: 'M. Brandt', rentPerSqm: 15.2, monthlyRent: 1_246, leaseStart: '2020-08-01', leaseEnd: '2026-07-31', leaseType: 'Vermietet' },
      { id: 'u-001-3', assetId: 'asset-001', unitNumber: '1.OG-01', floor: 1, area: 96, usageType: 'Wohnen', tenant: 'Dr. Seeger', rentPerSqm: 15.8, monthlyRent: 1_517, leaseStart: '2021-06-01', leaseEnd: '2027-05-31', leaseType: 'Vermietet' },
      { id: 'u-001-4', assetId: 'asset-001', unitNumber: '1.OG-02', floor: 1, area: 90, usageType: 'Wohnen', tenant: 'K. Lorenz', rentPerSqm: 16.0, monthlyRent: 1_440, leaseStart: '2018-10-01', leaseEnd: '2026-09-30', leaseType: 'Vermietet' },
      { id: 'u-001-5', assetId: 'asset-001', unitNumber: '2.OG-01', floor: 2, area: 96, usageType: 'Wohnen', tenant: 'Fam. Weber', rentPerSqm: 16.2, monthlyRent: 1_555, leaseStart: '2022-01-01', leaseEnd: '2027-12-31', leaseType: 'Vermietet' },
      { id: 'u-001-6', assetId: 'asset-001', unitNumber: '2.OG-02', floor: 2, area: 90, usageType: 'Wohnen', tenant: 'S. Arnold', rentPerSqm: 16.0, monthlyRent: 1_440, leaseStart: '2020-03-01', leaseEnd: '2026-02-28', leaseType: 'Vermietet' },
      { id: 'u-001-7', assetId: 'asset-001', unitNumber: '3.OG-01', floor: 3, area: 94, usageType: 'Wohnen', tenant: 'T. Kühn', rentPerSqm: 15.5, monthlyRent: 1_457, leaseStart: '2019-09-01', leaseEnd: '2027-08-31', leaseType: 'Vermietet' },
      { id: 'u-001-8', assetId: 'asset-001', unitNumber: '3.OG-02', floor: 3, area: 84, usageType: 'Wohnen', tenant: 'P. Schuster', rentPerSqm: 15.0, monthlyRent: 1_260, leaseStart: '2021-11-01', leaseEnd: '2026-10-31', leaseType: 'Vermietet' },
    ],
    debtInstruments: [
      { id: 'debt-001-1', assetId: 'asset-001', lender: 'Stadtsparkasse Düsseldorf', type: 'Senior', amount: 1_700_000, outstandingAmount: 1_560_000, interestRate: 3.20, interestType: 'Fest', maturityDate: '2031-05-01', amortizationRate: 2.0, drawdownDate: '2021-05-01', currency: 'EUR', covenants: [] }
    ],
    covenants: [
      { id: 'cov-001-1', assetId: 'asset-001', name: 'LTV Covenant', type: 'LTV', threshold: 65, currentValue: 50.3, status: 'OK', testDate: '2025-12-31', description: 'Max. LTV 65%' },
      { id: 'cov-001-2', assetId: 'asset-001', name: 'DSCR Covenant', type: 'DSCR', threshold: 1.20, currentValue: 1.58, status: 'OK', testDate: '2025-12-31', description: 'Min. DSCR 1.20x' },
    ],
    cashFlows: generateCashFlows('asset-001', 134_820, -46_000),
    documents: [
      { id: 'doc-001-1', assetId: 'asset-001', name: 'Kaufvertrag Luegallee 42.pdf', category: 'Kaufvertrag', uploadDate: '2021-04-22', fileSize: '2.1 MB', tags: ['KV', 'Notariat'], uploadedBy: 'M. Wagner' },
      { id: 'doc-001-2', assetId: 'asset-001', name: 'Mietvertragsübersicht Oberkassel.xlsx', category: 'Mietvertrag', uploadDate: '2021-05-05', fileSize: '0.3 MB', tags: ['Rent Roll'], uploadedBy: 'S. Klein' },
    ],
    capexProjects: [],
    exitCapRate: 3.6,
    holdingPeriodYears: 10,
    ervPerSqm: 15.5,
  },
  {
    id: 'asset-002',
    name: 'Stadthaus Flingern',
    address: 'Birkenstraße 61',
    city: 'Düsseldorf',
    zip: '40233',
    usageType: 'Wohnen',
    status: 'Bestand',
    acquisitionDate: '2023-02-15',
    purchasePrice: 1_950_000,
    currentValue: 2_200_000,
    totalArea: 610,
    lettableArea: 610,
    occupancyRate: 0.88,
    annualRent: 80_268,
    operatingCosts: {
      vacancyRatePercent: 12,
      managementCostPercent: 4,
      maintenanceReservePerSqm: 12,
      nonRecoverableOpex: 22_000,
      otherOperatingIncome: 2_400,
      rentalGrowthRate: 3.0,
    },
    completenessScore: 74,
    notes: 'Value-Add: Untermietete Bestandsmieten (~13% unter Markt). Eine Einheit (2.OG-02) in Modernisierung, Neuvermietung zu Marktmiete geplant.',
    units: [
      { id: 'u-002-1', assetId: 'asset-002', unitNumber: 'EG-01', floor: 0, area: 68, usageType: 'Wohnen', tenant: 'H. Peters', rentPerSqm: 12.0, monthlyRent: 816, leaseStart: '2016-05-01', leaseEnd: '2026-04-30', leaseType: 'Vermietet' },
      { id: 'u-002-2', assetId: 'asset-002', unitNumber: 'EG-02', floor: 0, area: 72, usageType: 'Wohnen', tenant: 'A. Krause', rentPerSqm: 11.8, monthlyRent: 850, leaseStart: '2017-09-01', leaseEnd: '2026-08-31', leaseType: 'Vermietet' },
      { id: 'u-002-3', assetId: 'asset-002', unitNumber: '1.OG-01', floor: 1, area: 80, usageType: 'Wohnen', tenant: 'Fam. Sommer', rentPerSqm: 12.5, monthlyRent: 1_000, leaseStart: '2019-02-01', leaseEnd: '2027-01-31', leaseType: 'Vermietet' },
      { id: 'u-002-4', assetId: 'asset-002', unitNumber: '1.OG-02', floor: 1, area: 76, usageType: 'Wohnen', tenant: 'M. Ziegler', rentPerSqm: 12.8, monthlyRent: 973, leaseStart: '2018-07-01', leaseEnd: '2026-06-30', leaseType: 'Vermietet' },
      { id: 'u-002-5', assetId: 'asset-002', unitNumber: '2.OG-01', floor: 2, area: 84, usageType: 'Wohnen', tenant: 'B. Hoffmann', rentPerSqm: 12.5, monthlyRent: 1_050, leaseStart: '2020-04-01', leaseEnd: '2026-03-31', leaseType: 'Vermietet' },
      { id: 'u-002-6', assetId: 'asset-002', unitNumber: '2.OG-02', floor: 2, area: 72, usageType: 'Wohnen', rentPerSqm: 0, monthlyRent: 0, leaseType: 'Leerstand' },
      { id: 'u-002-7', assetId: 'asset-002', unitNumber: '3.OG-01', floor: 3, area: 90, usageType: 'Wohnen', tenant: 'C. Neumann', rentPerSqm: 13.0, monthlyRent: 1_170, leaseStart: '2021-08-01', leaseEnd: '2027-07-31', leaseType: 'Vermietet' },
      { id: 'u-002-8', assetId: 'asset-002', unitNumber: '3.OG-02', floor: 3, area: 68, usageType: 'Wohnen', tenant: 'L. Fischer', rentPerSqm: 12.2, monthlyRent: 830, leaseStart: '2019-11-01', leaseEnd: '2026-10-31', leaseType: 'Vermietet' },
    ],
    debtInstruments: [
      { id: 'debt-002-1', assetId: 'asset-002', lender: 'apoBank', type: 'Senior', amount: 1_350_000, outstandingAmount: 1_290_000, interestRate: 3.90, interestType: 'Fest', maturityDate: '2028-02-15', amortizationRate: 1.5, drawdownDate: '2023-02-15', currency: 'EUR', covenants: [] }
    ],
    covenants: [
      { id: 'cov-002-1', assetId: 'asset-002', name: 'LTV Covenant', type: 'LTV', threshold: 65, currentValue: 58.6, status: 'Warning', testDate: '2025-12-31', description: 'Annäherung an Schwellenwert. Nach Repositionierung Leerstand Rückführung geplant.' },
      { id: 'cov-002-2', assetId: 'asset-002', name: 'DSCR Covenant', type: 'DSCR', threshold: 1.20, currentValue: 1.28, status: 'OK', testDate: '2025-12-31', description: 'Min. DSCR 1.20x' },
    ],
    cashFlows: generateCashFlows('asset-002', 80_268, -34_000),
    documents: [
      { id: 'doc-002-1', assetId: 'asset-002', name: 'Kaufvertrag Birkenstraße 61.pdf', category: 'Kaufvertrag', uploadDate: '2023-02-08', fileSize: '1.9 MB', tags: ['KV'], uploadedBy: 'M. Wagner' },
      { id: 'doc-002-2', assetId: 'asset-002', name: 'Mietspiegel-Analyse Flingern 2025.pdf', category: 'Gutachten', uploadDate: '2025-01-30', fileSize: '1.4 MB', tags: ['Markt', 'Repositionierung'], uploadedBy: 'S. Klein' },
    ],
    capexProjects: [
      { id: 'capex-002-1', assetId: 'asset-002', name: 'Modernisierung Whg 2.OG-02', budget: 62_000, spent: 24_000, status: 'Laufend', startDate: '2026-03-01', endDate: '2026-08-31' }
    ],
    exitCapRate: 4.2,
    holdingPeriodYears: 7,
    ervPerSqm: 14.0,
  },
  {
    id: 'asset-003',
    name: 'Wohnanlage Ehrenfeld',
    address: 'Venloer Straße 389',
    city: 'Köln',
    zip: '50825',
    usageType: 'Wohnen',
    status: 'Bestand',
    acquisitionDate: '2022-09-01',
    purchasePrice: 2_450_000,
    currentValue: 2_600_000,
    totalArea: 640,
    lettableArea: 640,
    occupancyRate: 0.97,
    annualRent: 104_028,
    operatingCosts: {
      vacancyRatePercent: 3,
      managementCostPercent: 4,
      maintenanceReservePerSqm: 10,
      nonRecoverableOpex: 19_500,
      otherOperatingIncome: 3_000,
      rentalGrowthRate: 2.5,
    },
    completenessScore: 88,
    notes: 'Solides MFH in gefragter Ehrenfelder Lage. Gute Nahversorgung und ÖPNV-Anbindung, stabile Vermietung.',
    units: [
      { id: 'u-003-1', assetId: 'asset-003', unitNumber: 'EG-01', floor: 0, area: 96, usageType: 'Wohnen', tenant: 'Fam. Klein', rentPerSqm: 13.5, monthlyRent: 1_296, leaseStart: '2020-01-01', leaseEnd: '2026-12-31', leaseType: 'Vermietet' },
      { id: 'u-003-2', assetId: 'asset-003', unitNumber: 'EG-02', floor: 0, area: 88, usageType: 'Wohnen', tenant: 'R. Wolf', rentPerSqm: 13.2, monthlyRent: 1_162, leaseStart: '2021-05-01', leaseEnd: '2027-04-30', leaseType: 'Vermietet' },
      { id: 'u-003-3', assetId: 'asset-003', unitNumber: '1.OG-01', floor: 1, area: 102, usageType: 'Wohnen', tenant: 'Dr. Baumann', rentPerSqm: 14.0, monthlyRent: 1_428, leaseStart: '2019-08-01', leaseEnd: '2026-07-31', leaseType: 'Vermietet' },
      { id: 'u-003-4', assetId: 'asset-003', unitNumber: '1.OG-02', floor: 1, area: 94, usageType: 'Wohnen', tenant: 'S. Jung', rentPerSqm: 13.8, monthlyRent: 1_297, leaseStart: '2022-03-01', leaseEnd: '2028-02-29', leaseType: 'Vermietet' },
      { id: 'u-003-5', assetId: 'asset-003', unitNumber: '2.OG-01', floor: 2, area: 100, usageType: 'Wohnen', tenant: 'Fam. Schäfer', rentPerSqm: 13.6, monthlyRent: 1_360, leaseStart: '2020-10-01', leaseEnd: '2026-09-30', leaseType: 'Vermietet' },
      { id: 'u-003-6', assetId: 'asset-003', unitNumber: '2.OG-02', floor: 2, area: 92, usageType: 'Wohnen', tenant: 'M. Albrecht', rentPerSqm: 13.5, monthlyRent: 1_242, leaseStart: '2021-12-01', leaseEnd: '2027-11-30', leaseType: 'Vermietet' },
      { id: 'u-003-7', assetId: 'asset-003', unitNumber: '3.OG-01', floor: 3, area: 68, usageType: 'Wohnen', tenant: 'J. Roth', rentPerSqm: 13.0, monthlyRent: 884, leaseStart: '2023-02-01', leaseEnd: '2027-01-31', leaseType: 'Vermietet' },
    ],
    debtInstruments: [
      { id: 'debt-003-1', assetId: 'asset-003', lender: 'Kreissparkasse Köln', type: 'Senior', amount: 1_500_000, outstandingAmount: 1_410_000, interestRate: 3.35, interestType: 'Fest', maturityDate: '2029-09-01', amortizationRate: 2.0, drawdownDate: '2022-09-01', currency: 'EUR', covenants: [] }
    ],
    covenants: [
      { id: 'cov-003-1', assetId: 'asset-003', name: 'LTV Covenant', type: 'LTV', threshold: 65, currentValue: 54.2, status: 'OK', testDate: '2025-12-31', description: 'Max. LTV 65%' },
      { id: 'cov-003-2', assetId: 'asset-003', name: 'DSCR Covenant', type: 'DSCR', threshold: 1.20, currentValue: 1.46, status: 'OK', testDate: '2025-12-31', description: 'Min. DSCR 1.20x' },
    ],
    cashFlows: generateCashFlows('asset-003', 104_028, -40_000),
    documents: [
      { id: 'doc-003-1', assetId: 'asset-003', name: 'Kaufvertrag Venloer Straße 389.pdf', category: 'Kaufvertrag', uploadDate: '2022-08-24', fileSize: '2.0 MB', tags: ['KV'], uploadedBy: 'M. Wagner' },
    ],
    capexProjects: [],
    exitCapRate: 3.9,
    holdingPeriodYears: 10,
    ervPerSqm: 13.8,
  },
  {
    id: 'asset-004',
    name: 'Mehrfamilienhaus Neuss',
    address: 'Further Straße 88',
    city: 'Neuss',
    zip: '41462',
    usageType: 'Wohnen',
    status: 'Bestand',
    acquisitionDate: '2020-11-01',
    purchasePrice: 1_300_000,
    currentValue: 1_450_000,
    totalArea: 440,
    lettableArea: 440,
    occupancyRate: 0.90,
    annualRent: 52_800,
    operatingCosts: {
      vacancyRatePercent: 8,
      managementCostPercent: 5,
      maintenanceReservePerSqm: 11,
      nonRecoverableOpex: 15_000,
      otherOperatingIncome: 1_800,
      rentalGrowthRate: 2.0,
    },
    completenessScore: 70,
    notes: 'B-Lage Neuss, höhere Bruttorendite. DSCR nach Leerstand einer Einheit unter Schwellenwert — Anschlussfinanzierung oder Verkauf in Prüfung.',
    units: [
      { id: 'u-004-1', assetId: 'asset-004', unitNumber: 'EG-01', floor: 0, area: 96, usageType: 'Wohnen', tenant: 'Fam. Yilmaz', rentPerSqm: 10.8, monthlyRent: 1_037, leaseStart: '2018-06-01', leaseEnd: '2026-05-31', leaseType: 'Vermietet' },
      { id: 'u-004-2', assetId: 'asset-004', unitNumber: 'EG-02', floor: 0, area: 92, usageType: 'Wohnen', tenant: 'D. Schmitz', rentPerSqm: 11.0, monthlyRent: 1_012, leaseStart: '2019-10-01', leaseEnd: '2026-09-30', leaseType: 'Vermietet' },
      { id: 'u-004-3', assetId: 'asset-004', unitNumber: '1.OG-01', floor: 1, area: 100, usageType: 'Wohnen', tenant: 'M. Erdogan', rentPerSqm: 11.2, monthlyRent: 1_120, leaseStart: '2020-03-01', leaseEnd: '2027-02-28', leaseType: 'Vermietet' },
      { id: 'u-004-4', assetId: 'asset-004', unitNumber: '1.OG-02', floor: 1, area: 108, usageType: 'Wohnen', tenant: 'Fam. Kaya', rentPerSqm: 11.4, monthlyRent: 1_231, leaseStart: '2021-07-01', leaseEnd: '2026-06-30', leaseType: 'Vermietet' },
      { id: 'u-004-5', assetId: 'asset-004', unitNumber: '2.OG-01', floor: 2, area: 44, usageType: 'Wohnen', rentPerSqm: 0, monthlyRent: 0, leaseType: 'Leerstand' },
    ],
    debtInstruments: [
      { id: 'debt-004-1', assetId: 'asset-004', lender: 'Sparkasse Neuss', type: 'Senior', amount: 950_000, outstandingAmount: 915_000, interestRate: 4.40, interestType: 'Fest', maturityDate: '2026-11-01', amortizationRate: 1.0, drawdownDate: '2020-11-01', currency: 'EUR', covenants: [] }
    ],
    covenants: [
      { id: 'cov-004-1', assetId: 'asset-004', name: 'LTV Covenant', type: 'LTV', threshold: 70, currentValue: 63.1, status: 'OK', testDate: '2025-12-31', description: 'Max. LTV 70%' },
      { id: 'cov-004-2', assetId: 'asset-004', name: 'DSCR Covenant', type: 'DSCR', threshold: 1.25, currentValue: 1.16, status: 'Breach', testDate: '2025-12-31', description: 'Covenant verletzt nach Leerstand 2.OG-01. Gespräche mit Sparkasse Neuss zur Anschlussfinanzierung laufen.' },
    ],
    cashFlows: generateCashFlows('asset-004', 52_800, -24_000),
    documents: [
      { id: 'doc-004-1', assetId: 'asset-004', name: 'Kaufvertrag Further Straße 88.pdf', category: 'Kaufvertrag', uploadDate: '2020-10-26', fileSize: '1.7 MB', tags: ['KV'], uploadedBy: 'M. Wagner' },
    ],
    capexProjects: [],
    exitCapRate: 4.6,
    holdingPeriodYears: 8,
    ervPerSqm: 11.5,
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
