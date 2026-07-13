import { useMemo, useState } from 'react';
import { useStore } from '@/store/useStore';
import { useLanguage } from '@/i18n/LanguageContext';
import { TABS, type TabKey } from '@/components/market-intelligence/shared';
import { BenchmarksTab, ReviewTab, NewsTab, CrossValTab, MemoTab, HistoryTab, SourcesTab } from '@/components/market-intelligence/tabs';
import { ReviewQueues } from '@/components/market-intelligence/ReviewQueues';
import { REVIEW_QUEUE_ITEMS } from '@/data/mock/reviewQueues';

export function MarketIntelligencePanel({ city }: { city: string }) {
  const { lang } = useLanguage();
  const allBenchmarks = useStore(s => s.benchmarks);
  const allEvents = useStore(s => s.marketEvents);
  const allSources = useStore(s => s.reportSources);
  const refreshJobs = useStore(s => s.refreshJobs);

  const benchmarks = useMemo(
    () => allBenchmarks.filter(b => b.city === city),
    [allBenchmarks, city],
  );
  const marketEvents = useMemo(
    () => allEvents.filter(e => !e.city || e.city === city),
    [allEvents, city],
  );
  const reportSources = useMemo(
    () => allSources.filter(r => r.market === city),
    [allSources, city],
  );

  const [tab, setTab] = useState<TabKey>('benchmarks');

  const pendingCount = benchmarks.filter(b => b.validationStatus === 'pending').length;

  return (
    <div>
      {/* KPI summary now sits inline next to the city title (see MarktPage). */}
      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-5 flex-wrap" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
        {TABS.map(tb => {
          const active = tab === tb.key;
          const count = tb.key === 'review' ? pendingCount : tb.key === 'queues' ? REVIEW_QUEUE_ITEMS.length : undefined;
          return (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className="flex items-center gap-2 text-sm"
              style={{
                padding: '9px 14px',
                fontWeight: active ? 700 : 500,
                color: active ? '#0a6cff' : 'rgba(60,60,67,0.6)',
                borderBottom: active ? '2px solid #0a6cff' : '2px solid transparent',
                marginBottom: -1,
                cursor: 'pointer',
                background: 'none',
              }}
            >
              <tb.icon size={14} />
              {tb.label}
              {count !== undefined && count > 0 && (
                <span style={{ background: 'rgba(255,149,0,0.16)', color: '#c2750a', borderRadius: 999, padding: '0 7px', fontSize: 11, fontWeight: 700 }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'benchmarks' && <BenchmarksTab benchmarks={benchmarks} lang={lang} hideCityFilter />}
      {tab === 'review' && <ReviewTab benchmarks={benchmarks} lang={lang} />}
      {tab === 'queues' && <ReviewQueues lang={lang} />}
      {tab === 'news' && <NewsTab events={marketEvents} lang={lang} />}
      {tab === 'crossval' && <CrossValTab benchmarks={benchmarks} lang={lang} />}
      {tab === 'memo' && <MemoTab benchmarks={benchmarks} events={marketEvents} lang={lang} lockedCity={city} />}
      {tab === 'history' && <HistoryTab benchmarks={benchmarks} lang={lang} />}
      {tab === 'sources' && <SourcesTab reportSources={reportSources} refreshJobs={refreshJobs} lang={lang} />}
    </div>
  );
}
