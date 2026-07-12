import type { AcquisitionDeal } from '@/models/types';
import { mockDealRadarListings } from '@/data/mockData';
import type { SetState, GetState } from '@/store/slices/types';
import type { AppState } from '@/store/appState';

export const dealRadarSlice = (set: SetState, get: GetState): Pick<AppState, 'dealRadarListings' | 'dealRadarCriteria' | 'addRadarListings' | 'updateRadarListing' | 'dismissRadarListing' | 'convertToAcquisition' | 'updateRadarCriteria'> => ({
      dealRadarListings: mockDealRadarListings,
      dealRadarCriteria: {
        cities: ['Berlin', 'München', 'Hamburg', 'Frankfurt am Main', 'Düsseldorf'],
        usageTypes: ['Wohnen', 'Büro', 'Logistik'],
        priceMin: 2_000_000,
        priceMax: 50_000_000,
        minArea: 500,
        maxArea: 50_000,
      },

      // Deal Radar
      addRadarListings: (listings) =>
        set(s => {
          const existingIds = new Set(s.dealRadarListings.map(l => l.id));
          const newOnes = listings.filter(l => !existingIds.has(l.id));
          return { dealRadarListings: [...newOnes, ...s.dealRadarListings] };
        }),

      updateRadarListing: (id, patch) =>
        set(s => ({ dealRadarListings: s.dealRadarListings.map(l => l.id === id ? { ...l, ...patch } : l) })),

      dismissRadarListing: (id, note) =>
        set(s => ({ dealRadarListings: s.dealRadarListings.map(l =>
          l.id === id ? { ...l, status: 'dismissed' as const, reviewedAt: new Date().toISOString(), reviewNote: note || 'Abgelehnt' } : l
        )})),

      convertToAcquisition: (listingId) =>
        set(s => {
          const listing = s.dealRadarListings.find(l => l.id === listingId);
          if (!listing) return {};
          const now = new Date().toISOString();
          const newDeal: AcquisitionDeal = {
            id: `deal-${Date.now()}`,
            name: listing.title,
            address: listing.address,
            city: listing.city,
            zip: listing.zip,
            usageType: listing.usageType,
            dealType: 'Investment',
            stage: 'Screening',
            askingPrice: listing.askingPrice,
            underwritingAssumptions: {
              purchasePrice: listing.askingPrice,
              closingCostPercent: s.settings.defaultClosingCostPct,
              brokerFeePercent: s.settings.defaultBrokerFeePct,
              initialCapex: 0,
              annualGrossRent: 0,
              vacancyRatePercent: s.settings.defaultVacancyRate,
              managementCostPercent: s.settings.defaultMgmtCostPct,
              maintenanceReservePerSqm: s.settings.defaultMaintenancePerSqm,
              nonRecoverableOpex: 0,
              area: listing.totalArea,
              rentPerSqm: 0,
              otherOperatingIncome: 0,
            },
            financingAssumptions: { loanAmount: Math.round(listing.askingPrice * 0.65), interestRate: 4.0, amortizationRate: 2.0, loanTerm: 10, lenderName: '', fixedRatePeriod: 5 },
            documents: [], activityLog: [{ id: `act-${Date.now()}`, timestamp: now, type: 'Note', title: 'Aus Deal Radar übernommen', description: `Quelle: ${listing.sourceLabel}\nURL: ${listing.sourceUrl}\nAI-Notizen: ${listing.aiNotes}`, user: 'M. Wagner' }],
            aiRecommendations: [], completenessScore: 25, createdAt: now, updatedAt: now,
            totalArea: listing.totalArea, broker: listing.sourceLabel,
          };
          return {
            deals: [...s.deals, newDeal],
            dealRadarListings: s.dealRadarListings.map(l => l.id === listingId ? { ...l, status: 'converted' as const, reviewedAt: now } : l),
          };
        }),

      updateRadarCriteria: (criteria) =>
        set(s => ({ dealRadarCriteria: { ...s.dealRadarCriteria, ...criteria } })),
});
