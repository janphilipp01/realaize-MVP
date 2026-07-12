import { useState } from 'react';
import { RefreshCw, AlertTriangle, X, Zap, Download, TrendingUp, Newspaper, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { PageHeader, GlassPanel, SectionHeader } from '@/components/shared';
import { exportNewsReportPDF, exportNewsExcel } from '@/utils/exportUtils';
import { useLanguage, useDateLocale } from '@/i18n/LanguageContext';
import { generateDailyIntelligenceReport } from '@/services/newsAgent';

// ══════════════════════════════════════════════════════════
// NEWS & INTELLIGENCE PAGE
// ══════════════════════════════════════════════════════════

const CATEGORY_COLORS: Record<string, string> = {
  'Deals & Transactions': '#c9a96e',
  'Leasing & Lettings': '#60a5fa',
  'Interest Rates & Monetary Policy': '#f87171',
  'Regulation & Policy': '#a78bfa',
  'Capital Markets': '#4ade80',
  'Macro & Global Economy': '#fbbf24',
};

const IMPACT_STYLES: Record<string, { bg: string; border: string; color: string; label_de: string; label_en: string }> = {
  high: { bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)', color: '#f87171', label_de: 'Hohe Relevanz', label_en: 'High Impact' },
  medium: { bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)', color: '#fbbf24', label_de: 'Mittlere Relevanz', label_en: 'Medium Impact' },
  low: { bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.2)', color: '#4ade80', label_de: 'Geringe Relevanz', label_en: 'Low Impact' },
};

export function NewsPage() {
  const { newsReports, addNewsReport, pruneOldReports } = useStore();
  const { t, lang } = useLanguage();
  const dateLocale = useDateLocale();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Date navigation: default to today
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);

  // Get available report dates sorted descending
  const reportDates = newsReports.map(r => r.date).sort((a, b) => b.localeCompare(a));
  const currentReport = newsReports.find(r => r.date === selectedDate);

  const navigateDay = (direction: -1 | 1) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + direction);
    const newDate = d.toISOString().split('T')[0];
    // Don't go into the future
    if (newDate > today) return;
    // Don't go beyond 7 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    if (newDate < cutoff.toISOString().split('T')[0]) return;
    setSelectedDate(newDate);
  };

  const formatDateDisplay = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    if (dateStr === today) return lang === 'de' ? 'Heute' : 'Today';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateStr === yesterday.toISOString().split('T')[0]) return lang === 'de' ? 'Gestern' : 'Yesterday';
    return d.toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const handleGenerate = async (forceRefresh = false) => {
    // Cache check: don't call API if report already exists for this date
    if (!forceRefresh && currentReport && currentReport.articles.length > 0) {
      return; // already have a report
    }
    setGenerating(true);
    setError(null);
    try {
      pruneOldReports();
      const result = await generateDailyIntelligenceReport(selectedDate);
      if (result.success && result.report) {
        addNewsReport(result.report);
      } else {
        setError(result.error || (lang === 'de' ? 'Report konnte nicht generiert werden.' : 'Failed to generate report.'));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  };

  // Group articles by category
  const articlesByCategory = currentReport?.articles.reduce((acc, article) => {
    if (!acc[article.category]) acc[article.category] = [];
    acc[article.category].push(article);
    return acc;
  }, {} as Record<string, typeof currentReport.articles>) || {};

  const highImpactCount = currentReport?.articles.filter(a => a.impactRating === 'high').length || 0;

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <PageHeader
        title={t('news.title')}
        subtitle={t('news.subtitle')}
        badge={currentReport ? `${currentReport.articles.length} ${lang === 'de' ? 'Artikel' : 'Articles'}` : undefined}
        actions={
          <div className="flex gap-2">
            {currentReport && (
              <>
                <button onClick={() => exportNewsReportPDF(currentReport)} className="btn-glass px-3 py-2 rounded-xl text-sm flex items-center gap-2" style={{ cursor: 'pointer' }}>
                  <Download size={13} /> PDF
                </button>
                <button onClick={() => exportNewsExcel(currentReport)} className="btn-glass px-3 py-2 rounded-xl text-sm flex items-center gap-2" style={{ cursor: 'pointer' }}>
                  <Download size={13} /> Excel
                </button>
              </>
            )}
            <button onClick={() => handleGenerate(true)} disabled={generating}
              className="btn-accent px-4 py-2 rounded-xl text-sm flex items-center gap-2"
              style={{ cursor: generating ? 'wait' : 'pointer', opacity: generating ? 0.7 : 1 }}>
              {generating ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
              {generating ? t('news.generating') : t('news.generateReport')}
            </button>
          </div>
        }
      />

      {/* Date Navigation */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <button onClick={() => navigateDay(-1)}
          className="btn-glass p-2 rounded-xl"
          style={{ cursor: 'pointer' }}>
          <ChevronLeft size={18} />
        </button>
        <div className="text-center" style={{ minWidth: 220 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1c1c1e' }}>{formatDateDisplay(selectedDate)}</div>
          <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)' }}>
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <button onClick={() => navigateDay(1)}
          disabled={selectedDate >= today}
          className="btn-glass p-2 rounded-xl"
          style={{ cursor: selectedDate >= today ? 'not-allowed' : 'pointer', opacity: selectedDate >= today ? 0.3 : 1 }}>
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Report date indicators */}
      <div className="flex justify-center gap-1.5 mb-6">
        {Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          const dateStr = d.toISOString().split('T')[0];
          const hasReport = reportDates.includes(dateStr);
          const isSelected = dateStr === selectedDate;
          return (
            <button key={dateStr} onClick={() => setSelectedDate(dateStr)}
              style={{
                width: 32, height: 32, borderRadius: 8, fontSize: 11, fontWeight: isSelected ? 700 : 500,
                background: isSelected ? '#007aff' : hasReport ? 'rgba(0,122,255,0.10)' : 'rgba(0,0,0,0.04)',
                color: isSelected ? '#fff' : hasReport ? '#007aff' : 'rgba(60,60,67,0.35)',
                border: `1px solid ${isSelected ? '#007aff' : hasReport ? 'rgba(0,122,255,0.2)' : 'rgba(0,0,0,0.06)'}`,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              {d.toLocaleDateString(dateLocale, { weekday: 'narrow' })}
            </button>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-xl flex items-center gap-3"
          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
          <AlertTriangle size={14} color="#f87171" />
          <span style={{ fontSize: 13, color: '#f87171', flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={12} color="rgba(60,60,67,0.45)" />
          </button>
        </div>
      )}

      {/* Report Content */}
      {currentReport ? (
        <div className="space-y-6 animate-fade-in">
          {/* Executive Summary */}
          <GlassPanel style={{ padding: 24 }}>
            <div className="flex items-center gap-3 mb-4">
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(0,122,255,0.10)', border: '1px solid rgba(0,122,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Newspaper size={16} color="#007aff" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1c1c1e' }}>{t('news.executiveSummary')}</div>
                <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>
                  {new Date(currentReport.generatedAt).toLocaleString(dateLocale)} · AI Research Agent
                </div>
              </div>
              {highImpactCount > 0 && (
                <span className="ml-auto" style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', fontSize: 11, fontWeight: 700, borderRadius: 8, padding: '3px 10px' }}>
                  {highImpactCount} {lang === 'de' ? 'hohe Relevanz' : 'high impact'}
                </span>
              )}
            </div>
            <div style={{ fontSize: 14, color: 'rgba(60,60,67,0.80)', lineHeight: 1.7 }}>
              {currentReport.executiveSummary}
            </div>
          </GlassPanel>

          {/* Market Impact Analysis */}
          {currentReport.marketImpactAnalysis && (
            <GlassPanel style={{ padding: 24 }}>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={16} color="var(--accent)" />
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1c1c1e' }}>{t('news.marketImpact')}</div>
              </div>
              <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.75)', lineHeight: 1.7 }}>
                {currentReport.marketImpactAnalysis}
              </div>
            </GlassPanel>
          )}

          {/* Articles by category */}
          <div>
            <SectionHeader title={t('news.articles')} />
            <div className="space-y-3">
              {Object.entries(articlesByCategory).map(([category, articles]) => (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: CATEGORY_COLORS[category] || '#888', display: 'inline-block' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(60,60,67,0.55)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{category}</span>
                    <span className="badge-neutral" style={{ fontSize: 10 }}>{articles.length}</span>
                  </div>
                  <div className="space-y-2">
                    {articles.map(article => {
                      const impact = IMPACT_STYLES[article.impactRating];
                      return (
                        <div key={article.id} className="p-4 rounded-xl glass-hover"
                          style={{ border: '1px solid rgba(0,0,0,0.06)', background: 'rgba(255,255,255,0.5)' }}>
                          <div className="flex items-start justify-between gap-3">
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: '#1c1c1e', marginBottom: 4, lineHeight: 1.4 }}>
                                {article.title}
                              </div>
                              <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.65)', lineHeight: 1.5, marginBottom: 8 }}>
                                {article.summary}
                              </div>
                              <div className="flex items-center gap-3 flex-wrap">
                                <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>{article.sourceLabel}</span>
                                <span style={{
                                  fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                                  background: impact.bg, border: `1px solid ${impact.border}`, color: impact.color,
                                }}>
                                  {lang === 'de' ? impact.label_de : impact.label_en}
                                </span>
                                {article.sourceUrl && (
                                  <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer"
                                    style={{ fontSize: 11, color: '#007aff', display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}
                                    onClick={e => e.stopPropagation()}>
                                    {t('news.readMore')} <ExternalLink size={10} />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Empty state */
        <GlassPanel style={{ padding: 48, textAlign: 'center' }}>
          <Newspaper size={36} color="rgba(60,60,67,0.25)" />
          <div style={{ fontSize: 14, color: 'rgba(60,60,67,0.50)', marginTop: 16, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
            {t('news.noReport')}
          </div>
          <button
            onClick={() => handleGenerate(true)}
            disabled={generating}
            className="btn-accent px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 mx-auto mt-5"
            style={{ cursor: generating ? 'wait' : 'pointer' }}
          >
            {generating ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
            {generating ? t('news.generating') : t('news.generateReport')}
          </button>
        </GlassPanel>
      )}
    </div>
  );
}

