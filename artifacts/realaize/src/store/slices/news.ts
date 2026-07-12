import { mockNewsReports } from '@/data/mockData';
import type { SetState, GetState } from '@/store/slices/types';
import type { AppState } from '@/store/appState';

export const newsSlice = (set: SetState, get: GetState): Pick<AppState, 'newsReports' | 'addNewsReport' | 'pruneOldReports'> => ({
      newsReports: mockNewsReports,

      addNewsReport: (report) =>
        set(s => {
          // Replace if same date exists, otherwise prepend
          const existing = s.newsReports.findIndex(r => r.date === report.date);
          if (existing >= 0) {
            const updated = [...s.newsReports];
            updated[existing] = report;
            return { newsReports: updated };
          }
          return { newsReports: [report, ...s.newsReports] };
        }),

      pruneOldReports: () =>
        set(s => {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 7);
          const cutoffStr = cutoff.toISOString().split('T')[0];
          return { newsReports: s.newsReports.filter(r => r.date >= cutoffStr) };
        }),
});
