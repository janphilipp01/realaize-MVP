import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState } from '@/store/appState';
import { defaultSettings } from '@/store/appState';
import { mockAssets, mockDeals, mockAuditLog, mockDevelopments, mockSales, mockContacts, mockNewsReports, mockDealRadarListings } from '@/data/mockData';
import { mockBenchmarks, mockPortfolioBenchmark, mockMarketEvents, mockReportSources, mockRefreshJobs } from '@/data/marketIntelData';
import { mockCandidateDeals, defaultAcquisitionProfiles } from '@/data/dealSourcingData';
import { marketIntelligenceSlice } from '@/store/slices/marketIntelligence';
import { portfolioSlice } from '@/store/slices/portfolio';
import { contactsSlice } from '@/store/slices/contacts';
import { mediaSlice } from '@/store/slices/media';
import { newsSlice } from '@/store/slices/news';
import { dealRadarSlice } from '@/store/slices/dealRadar';
import { dealSourcingSlice } from '@/store/slices/dealSourcing';
import { settingsSlice } from '@/store/slices/settings';

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...marketIntelligenceSlice(set, get),
      ...portfolioSlice(set, get),
      ...contactsSlice(set, get),
      ...mediaSlice(set, get),
      ...newsSlice(set, get),
      ...dealRadarSlice(set, get),
      ...dealSourcingSlice(set, get),
      ...settingsSlice(set, get),
      resetToMockData: () => set({ assets: mockAssets, deals: mockDeals, developments: mockDevelopments, sales: mockSales, contacts: mockContacts, images: [], auditLog: mockAuditLog, newsReports: mockNewsReports, dealRadarListings: mockDealRadarListings, dealRadarCriteria: { cities: ['Berlin', 'München', 'Hamburg', 'Frankfurt am Main', 'Düsseldorf'], usageTypes: ['Wohnen', 'Büro', 'Logistik'], priceMin: 2_000_000, priceMax: 50_000_000, minArea: 500, maxArea: 50_000 }, settings: defaultSettings, benchmarks: [...mockBenchmarks, mockPortfolioBenchmark], marketEvents: mockMarketEvents, reportSources: mockReportSources, refreshJobs: mockRefreshJobs, candidateDeals: mockCandidateDeals, acquisitionProfiles: defaultAcquisitionProfiles, lastScreeningAt: '2026-06-23T07:00:00.000Z' }),
    }),
    {
      name: 'restate-storage-v3',
      // contacts removed from partialize — now served by /api/contacts (React Query)
      partialize: (s) => ({ assets: s.assets, deals: s.deals, developments: s.developments, sales: s.sales, images: s.images, auditLog: s.auditLog, newsReports: s.newsReports, dealRadarListings: s.dealRadarListings, dealRadarCriteria: s.dealRadarCriteria, settings: s.settings, benchmarks: s.benchmarks, marketEvents: s.marketEvents, reportSources: s.reportSources, refreshJobs: s.refreshJobs, candidateDeals: s.candidateDeals, acquisitionProfiles: s.acquisitionProfiles, lastScreeningAt: s.lastScreeningAt }),
      // Backfill newly added settings keys for state persisted before they existed.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        return { ...current, ...p, settings: { ...defaultSettings, ...(p.settings ?? {}) } };
      },
    }
  )
)
