import type { RefreshJob } from '@/models/types';
import { mockBenchmarks, mockPortfolioBenchmark, mockMarketEvents, mockReportSources, mockRefreshJobs, CURRENT_PERIOD } from '@/data/marketIntelData';
import type { SetState, GetState } from '@/store/slices/types';
import type { AppState } from '@/store/appState';

export const marketIntelligenceSlice = (set: SetState, get: GetState): Pick<AppState, 'benchmarks' | 'marketEvents' | 'reportSources' | 'refreshJobs' | 'triggerQuarterlyRefresh' | 'refreshCityBenchmarks' | 'approveBenchmark' | 'rejectBenchmark' | 'correctBenchmark'> => ({
      benchmarks: [...mockBenchmarks, mockPortfolioBenchmark],
      marketEvents: mockMarketEvents,
      reportSources: mockReportSources,
      refreshJobs: mockRefreshJobs,

      triggerQuarterlyRefresh: (user) =>
        set(s => {
          const now = new Date().toISOString();
          const okSources = s.reportSources.filter(r => r.status !== 'broken').length;
          const pending = s.benchmarks.filter(b => b.validationStatus === 'pending').length;
          const job: RefreshJob = {
            id: `rj-${Date.now()}`,
            triggeredAt: now,
            trigger: 'manual',
            triggeredBy: user,
            status: 'completed',
            periodQuarter: CURRENT_PERIOD,
            reportsFetched: okSources,
            dataPointsExtracted: s.benchmarks.length,
            autoPassed: s.benchmarks.filter(b => b.validationStatus === 'auto_passed').length,
            pendingReview: pending,
            completedAt: now,
          };
          return {
            refreshJobs: [job, ...s.refreshJobs],
            reportSources: s.reportSources.map(r =>
              r.status === 'broken' ? r : { ...r, lastFetchedAt: now },
            ),
            // Persist the current quarter into each benchmark's history
            // (idempotent — skip if this quarter is already the last point).
            benchmarks: s.benchmarks.map(b => {
              const last = b.history?.[b.history.length - 1];
              if (last && last.periodQuarter === b.periodQuarter) return b;
              return {
                ...b,
                history: [...(b.history ?? []), { periodQuarter: b.periodQuarter, value: b.value }],
              };
            }),
          };
        }),

      // Live per-city refresh: re-fetch the latest reconciled values for one
      // market. Persists the pre-update value into history, applies a small
      // realistic drift to reflect the newest print, and stamps extractedAt.
      refreshCityBenchmarks: (city) =>
        set(s => {
          const now = new Date().toISOString();
          const t = Date.now();
          return {
            benchmarks: s.benchmarks.map(b => {
              if (b.city !== city || b.sourceType === 'portfolio_realised') return b;
              let h = t >>> 0;
              for (let i = 0; i < b.id.length; i++) h = Math.imul(h ^ b.id.charCodeAt(i), 16777619) >>> 0;
              const r = ((h % 1000) / 1000) * 2 - 1; // deterministic per-call in [-1,1]
              const mag =
                b.kpi === 'multiplier' || b.kpi === 'net_initial_yield' || b.kpi === 'prime_yield'
                  ? 0.004
                  : b.kpi === 'vacancy'
                    ? 0.01
                    : 0.006;
              const bias = b.kpi === 'erv' || b.kpi === 'prime_rent' ? 0.002 : 0; // slight upward on rents
              const newValue = Math.round(b.value * (1 + r * mag + bias) * 100) / 100;
              const last = b.history?.[b.history.length - 1];
              const history =
                last && last.periodQuarter === b.periodQuarter
                  ? b.history
                  : [...(b.history ?? []), { periodQuarter: b.periodQuarter, value: b.value }];
              return { ...b, priorValue: b.value, value: newValue, extractedAt: now, history };
            }),
          };
        }),

      approveBenchmark: (id, user) =>
        set(s => ({
          benchmarks: s.benchmarks.map(b =>
            b.id === id
              ? { ...b, validationStatus: 'manual_approved' as const, reviewNote: `Approved by ${user}` }
              : b,
          ),
        })),

      rejectBenchmark: (id, user, note) =>
        set(s => ({
          benchmarks: s.benchmarks.map(b =>
            b.id === id
              ? { ...b, validationStatus: 'rejected' as const, reviewNote: note || `Rejected by ${user}` }
              : b,
          ),
        })),

      correctBenchmark: (id, newValue, user, note) =>
        set(s => ({
          benchmarks: s.benchmarks.map(b =>
            b.id === id
              ? {
                  ...b,
                  value: newValue,
                  validationStatus: 'manual_approved' as const,
                  confidenceTier: 'manual_override' as const,
                  sourceType: 'manual' as const,
                  reviewNote: note || `Corrected by ${user}`,
                }
              : b,
          ),
        })),
});
