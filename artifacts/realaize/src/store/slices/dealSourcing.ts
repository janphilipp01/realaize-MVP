import type { AcquisitionDeal, UsageType } from '@/models/types';
import { mockCandidateDeals, defaultAcquisitionProfiles, listingToCandidate } from '@/data/dealSourcingData';
import { runLocalMatcher } from '@/utils/screening';
import { benchmarksToScreeningSeeds } from '@/utils/marketIntelligence';
import type { SetState, GetState } from '@/store/slices/types';
import type { AppState } from '@/store/appState';

export const dealSourcingSlice = (set: SetState, get: GetState): Pick<AppState, 'candidateDeals' | 'acquisitionProfiles' | 'lastScreeningAt' | 'runScreening' | 'ingestCandidatesFromListings' | 'shortlistCandidate' | 'rejectCandidate' | 'promoteCandidate' | 'updateAcquisitionProfile'> => ({
      candidateDeals: mockCandidateDeals,
      acquisitionProfiles: defaultAcquisitionProfiles,
      lastScreeningAt: '2026-06-23T07:00:00.000Z',

      // ── Deal Sourcing & Screening (Module 07) ──
      runScreening: () =>
        set(s => ({
          candidateDeals: runLocalMatcher(s.candidateDeals, s.acquisitionProfiles, benchmarksToScreeningSeeds(s.benchmarks)),
          lastScreeningAt: new Date().toISOString(),
        })),

      ingestCandidatesFromListings: (listings) =>
        set(s => {
          const existingRefs = new Set(s.candidateDeals.map(c => c.sourceRef));
          const fresh = listings
            .map(listingToCandidate)
            .filter(c => !existingRefs.has(c.sourceRef))
            .map(c => ({ ...c, matches: [] }));
          const merged = runLocalMatcher([...fresh, ...s.candidateDeals], s.acquisitionProfiles, benchmarksToScreeningSeeds(s.benchmarks));
          return { candidateDeals: merged, lastScreeningAt: new Date().toISOString() };
        }),

      shortlistCandidate: (id, note) =>
        set(s => ({ candidateDeals: s.candidateDeals.map(c =>
          c.id === id ? { ...c, status: 'shortlisted' as const, reviewNote: note ?? c.reviewNote } : c) })),

      rejectCandidate: (id, reason) =>
        set(s => ({ candidateDeals: s.candidateDeals.map(c =>
          c.id === id ? { ...c, status: 'rejected' as const, rejectReason: reason } : c) })),

      promoteCandidate: (id) =>
        set(s => {
          const c = s.candidateDeals.find(x => x.id === id);
          if (!c) return {};
          const now = new Date().toISOString();
          // Seed Market Assumptions from the benchmark used for screening.
          const m = c.matches[0];
          const usageMap: Record<typeof c.assetClass, UsageType> = { residential: 'Wohnen', mixed_use: 'Mixed Use', office: 'Büro', retail: 'Einzelhandel', logistics: 'Logistik' };
          const usageType: UsageType = usageMap[c.assetClass];
          const benchRentPerSqm = m && m.annualErv ? m.annualErv / c.areaSqm / 12 : 0;
          const newDeal: AcquisitionDeal = {
            id: `deal-${Date.now()}`,
            name: c.title,
            address: c.address,
            city: c.city,
            zip: '',
            submarket: c.submarket,
            usageType,
            dealType: 'Investment',
            stage: 'Screening',
            askingPrice: c.askingPrice,
            underwritingAssumptions: {
              purchasePrice: c.askingPrice,
              closingCostPercent: s.settings.defaultClosingCostPct,
              brokerFeePercent: s.settings.defaultBrokerFeePct,
              initialCapex: 0,
              annualGrossRent: m && m.annualErv ? Math.round(m.annualErv) : (c.currentRentPa ?? 0),
              vacancyRatePercent: s.settings.defaultVacancyRate,
              managementCostPercent: s.settings.defaultMgmtCostPct,
              maintenanceReservePerSqm: s.settings.defaultMaintenancePerSqm,
              nonRecoverableOpex: 0,
              area: c.areaSqm,
              rentPerSqm: benchRentPerSqm ? Math.round(benchRentPerSqm * 100) / 100 : 0,
              otherOperatingIncome: 0,
            },
            financingAssumptions: { loanAmount: Math.round(c.askingPrice * 0.65), interestRate: 4.0, amortizationRate: 2.0, loanTerm: 10, lenderName: '', fixedRatePeriod: 5 },
            documents: [],
            activityLog: [{
              id: `act-${Date.now()}`, timestamp: now, type: 'Note',
              title: 'Aus Deal Radar übernommen',
              description: `Quelle: ${c.sourceLabel}\nRef: ${c.sourceRef}` +
                (m ? `\nScreening (${m.profileName}): €/m² ${m.askingPricePerSqm} (${m.discountPricePct > 0 ? '−' : ''}${Math.abs(m.discountPricePct)} %), Faktor ${m.impliedFactor}×, Brutto-Rendite ${m.impliedGrossYield} % · Benchmark ${m.benchmarkAsOf}` : ''),
              user: 'M. Wagner',
            }],
            aiRecommendations: [], completenessScore: 30, createdAt: now, updatedAt: now,
            totalArea: c.areaSqm, broker: c.sourceLabel,
          };
          return {
            deals: [...s.deals, newDeal],
            candidateDeals: s.candidateDeals.map(x => x.id === id ? { ...x, status: 'promoted' as const } : x),
          };
        }),

      updateAcquisitionProfile: (id, patch) =>
        set(s => {
          const profiles = s.acquisitionProfiles.map(p => p.id === id ? { ...p, ...patch } : p);
          return {
            acquisitionProfiles: profiles,
            candidateDeals: runLocalMatcher(s.candidateDeals, profiles, benchmarksToScreeningSeeds(s.benchmarks)),
            lastScreeningAt: new Date().toISOString(),
          };
        }),
});
