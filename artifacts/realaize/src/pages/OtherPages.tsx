import React, { useState, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, ComposedChart, ReferenceLine, CartesianGrid
} from 'recharts';
import {
  RefreshCw, Upload, Plus, Filter, Search, AlertTriangle, X,
  CheckCircle, Clock, Bot, Zap, FileText, Download, Settings as SettingsIcon,
  Shield, Info, TrendingUp, Activity, Database, ChevronDown, BarChart3,
  Newspaper, ChevronLeft, ChevronRight, ExternalLink, Radar, Target, ThumbsDown, ArrowRight
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { PageHeader, GlassPanel, KPICard, StatusBadge, SectionHeader, FreshnessBadge, EmptyState } from '../components/shared';
import { formatEUR, formatPct, computeAssetNOI, computeAssetMonthlyCashFlow, computeAssetLTV } from '../utils/kpiEngine';
import { exportNewsReportPDF, exportNewsExcel, exportMarketIntelligenceExcel } from '../utils/exportUtils';
import { useLanguage } from '../i18n/LanguageContext';
import { researchCityMarketData, GERMAN_TOP_CITIES } from '../utils/marketResearchAgent';
import { generateDailyIntelligenceReport } from '../utils/newsAgent';
import { searchDealRadar } from '../utils/dealRadarAgent';
import { useQueryClient } from '@tanstack/react-query';
import {
  aiChat,
  useListMarketLocations,
  useCreateMarketLocation,
  useUpdateMarketLocation,
  useRefreshMarketBenchmarks,
  getListMarketLocationsQueryKey,
} from '@workspace/api-client-react';
import type { DebtInstrument } from '../models/types';

// ══════════════════════════════════════════════════════════
// MARKT PAGE
// ══════════════════════════════════════════════════════════
export function MarktPage() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: getListMarketLocationsQueryKey() });
  const { data: marketLocations = [] } = useListMarketLocations();
  const createMarketLocation = useCreateMarketLocation({ mutation: { onSuccess: invalidate } });
  const updateMarketLocationMut = useUpdateMarketLocation({ mutation: { onSuccess: invalidate } });
  const refreshBenchmarks = useRefreshMarketBenchmarks({ mutation: { onSuccess: invalidate } });
  const { t, lang } = useLanguage();
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [filterCity, setFilterCity] = useState('Alle');
  const [filterType, setFilterType] = useState('Alle');
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [researchingCity, setResearchingCity] = useState<string | null>(null);
  const [researchStatus, setResearchStatus] = useState<string>('');
  const [researchError, setResearchError] = useState<string | null>(null);
  const [showAddCity, setShowAddCity] = useState(false);

  const location = marketLocations.find(l => l.id === selectedLocation);
  const dateLocale = lang === 'de' ? 'de-DE' : 'en-GB';

  // Cities available to add (not yet in store)
  const existingCityIds = new Set(marketLocations.map(l => l.id));
  const availableCities = GERMAN_TOP_CITIES.filter(c => !existingCityIds.has(c.id));

  const handleRefresh = (locId: string) => {
    setRefreshing(locId);
    updateMarketLocationMut.mutate(
      { id: locId, data: { lastUpdated: new Date().toISOString().split('T')[0] } },
      { onSettled: () => setRefreshing(null) },
    );
  };

  // AI Research Agent: fetch real market data for a city
  const handleResearch = async (cityId: string, cityName: string) => {
    setResearchingCity(cityId);
    setResearchStatus(lang === 'de' ? `Recherchiere Marktdaten für ${cityName}...` : `Researching market data for ${cityName}...`);
    setResearchError(null);

    try {
      // Ensure city exists on the server
      if (!existingCityIds.has(cityId)) {
        const cityInfo = GERMAN_TOP_CITIES.find(c => c.id === cityId);
        if (cityInfo) {
          await createMarketLocation.mutateAsync({
            data: {
              id: cityInfo.id, city: cityInfo.city, submarket: cityInfo.submarket,
              region: cityInfo.region,
              lastUpdated: new Date().toISOString().split('T')[0],
            },
          });
        }
      }

      const result = await researchCityMarketData(cityId, cityName);

      if (result.success && result.benchmarks.length > 0) {
        await refreshBenchmarks.mutateAsync({
          id: cityId,
          data: { benchmarks: result.benchmarks, updateEntry: result.updateEntry },
        });
        setResearchStatus(lang === 'de'
          ? `✅ ${result.benchmarks.length} Benchmarks für ${cityName} aktualisiert`
          : `✅ ${result.benchmarks.length} benchmarks updated for ${cityName}`);
        setSelectedLocation(cityId);
      } else {
        setResearchError(result.error || (lang === 'de' ? 'Keine Daten erhalten' : 'No data received'));
        setResearchStatus('');
      }
    } catch (err: any) {
      setResearchError(err.message || 'Research failed');
      setResearchStatus('');
    } finally {
      setResearchingCity(null);
      setShowAddCity(false);
    }
  };

  const USAGE_COLORS: Record<string, string> = {
    'Büro': '#c9a96e', 'Wohnen': '#60a5fa', 'Logistik': '#4ade80',
    'Einzelhandel': '#f87171', 'Mixed Use': '#a78bfa',
  };

  const allTypes = ['Alle', 'Wohnen', 'Büro', 'Einzelhandel', 'Logistik', 'Mixed Use'];
  const allCities = ['Alle', ...Array.from(new Set(marketLocations.map(l => l.city)))];

  const filteredLocations = marketLocations.filter(l => {
    const matchCity = filterCity === 'Alle' || l.city === filterCity;
    const matchType = filterType === 'Alle' || l.benchmarks.some(b => b.usageType === filterType);
    return matchCity && matchType;
  });

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title={t('market.title')}
        subtitle={t('market.subtitle')}
        badge={`${marketLocations.length} ${t('market.locations')}`}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddCity(!showAddCity)}
              className="btn-glass px-4 py-2 rounded-xl text-sm flex items-center gap-2"
              style={{ cursor: 'pointer' }}
            >
              <Plus size={14} /> {lang === 'de' ? 'Stadt hinzufügen' : 'Add City'}
            </button>
            <button onClick={() => exportMarketIntelligenceExcel(marketLocations)}
              className="btn-glass px-4 py-2 rounded-xl text-sm flex items-center gap-2" style={{ cursor: 'pointer' }}>
              <Download size={14} /> Excel Export
            </button>
            <button className="btn-glass px-4 py-2 rounded-xl text-sm flex items-center gap-2">
              <Upload size={14} /> {t('market.csvImport')}
            </button>
          </div>
        }
      />

      {/* AI Research Status Banner */}
      {(researchStatus || researchError) && (
        <div className="mb-4 p-3 rounded-xl flex items-center gap-3" style={{
          background: researchError ? 'rgba(248,113,113,0.08)' : 'rgba(0,122,255,0.06)',
          border: `1px solid ${researchError ? 'rgba(248,113,113,0.2)' : 'rgba(0,122,255,0.15)'}`,
        }}>
          {researchingCity ? (
            <RefreshCw size={14} className="animate-spin" color="#007aff" />
          ) : researchError ? (
            <AlertTriangle size={14} color="#f87171" />
          ) : (
            <CheckCircle size={14} color="#4ade80" />
          )}
          <span style={{ fontSize: 13, color: researchError ? '#f87171' : '#1c1c1e', flex: 1 }}>
            {researchError || researchStatus}
          </span>
          {!researchingCity && (
            <button onClick={() => { setResearchStatus(''); setResearchError(null); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
              <X size={12} color="rgba(60,60,67,0.45)" />
            </button>
          )}
        </div>
      )}

      {/* Add City Panel */}
      {showAddCity && availableCities.length > 0 && (
        <GlassPanel style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1c1c1e', marginBottom: 12 }}>
            {lang === 'de' ? 'Stadt hinzufügen — AI Market Research' : 'Add City — AI Market Research'}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.55)', marginBottom: 12 }}>
            {lang === 'de'
              ? 'Wähle eine Stadt. Der AI Research Agent recherchiert aktuelle Mieten, Kaufpreise und Multiplikatoren für alle Nutzungsarten.'
              : 'Select a city. The AI Research Agent will fetch current rents, purchase prices and multipliers for all usage types.'}
          </div>
          <div className="flex flex-wrap gap-2">
            {availableCities.map(city => (
              <button
                key={city.id}
                onClick={() => handleResearch(city.id, city.city)}
                disabled={!!researchingCity}
                className="px-3 py-1.5 rounded-lg text-sm transition-all"
                style={{
                  background: researchingCity === city.id ? 'rgba(0,122,255,0.12)' : 'rgba(0,0,0,0.04)',
                  border: '1px solid rgba(0,0,0,0.08)',
                  color: '#1c1c1e', cursor: researchingCity ? 'wait' : 'pointer',
                  fontSize: 12, fontWeight: 500,
                  opacity: researchingCity && researchingCity !== city.id ? 0.5 : 1,
                }}
              >
                {researchingCity === city.id && <RefreshCw size={10} className="animate-spin inline mr-1.5" />}
                {city.city}
              </button>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <select className="input-glass" value={filterCity} onChange={e => setFilterCity(e.target.value)} style={{ width: 160 }}>
          {allCities.map(c => <option key={c}>{c}</option>)}
        </select>
        <select className="input-glass" value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 180 }}>
          {allTypes.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Location list */}
        <div className="col-span-1 space-y-3">
          {filteredLocations.map(loc => (
            <div
              key={loc.id}
              onClick={() => setSelectedLocation(loc.id === selectedLocation ? null : loc.id)}
              className="glass-card cursor-pointer"
              style={{
                padding: 18,
                border: selectedLocation === loc.id ? '1px solid rgba(201,169,110,0.35)' : '1px solid rgba(255,255,255,0.10)',
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1c1c1e' }}>{loc.city}</div>
                  <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)' }}>{loc.submarket}</div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {loc.benchmarks.map(b => (
                      <span key={b.id} className="badge-neutral" style={{ fontSize: 10, background: `rgba(${b.usageType === 'Büro' ? '201,169,110' : b.usageType === 'Wohnen' ? '96,165,250' : b.usageType === 'Logistik' ? '74,222,128' : '248,113,113'},0.12)` }}>
                        {b.usageType}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <FreshnessBadge date={loc.lastUpdated} />
                  <button
                    onClick={e => { e.stopPropagation(); handleResearch(loc.id, loc.city); }}
                    disabled={!!researchingCity}
                    className="btn-glass p-1.5 rounded-lg flex items-center gap-1"
                    style={{ fontSize: 10, cursor: researchingCity ? 'wait' : 'pointer' }}
                    title={lang === 'de' ? 'AI Research Agent starten' : 'Run AI Research Agent'}
                  >
                    {researchingCity === loc.id ? (
                      <RefreshCw size={11} className="animate-spin" />
                    ) : (
                      <>
                        <Bot size={11} />
                        <span style={{ fontSize: 9 }}>AI</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Location detail */}
        <div className="col-span-2">
          {location ? (
            <div className="space-y-4 animate-fade-in">
              <GlassPanel style={{ padding: 24 }}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, fontFamily: '-apple-system, system-ui, sans-serif' }}>{location.city}</h2>
                    <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.45)' }}>{location.submarket} · {location.region}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)' }}>{t('market.updated')}: {new Date(location.lastUpdated).toLocaleDateString(dateLocale)}</div>
                </div>
              </GlassPanel>

              {(filterType === 'Alle' ? location.benchmarks : location.benchmarks.filter(b => b.usageType === filterType)).map(bm => (
                <GlassPanel key={bm.id} style={{ padding: 24 }}>
                  <div className="flex items-center justify-between mb-4">
                    <div style={{ fontSize: 14, fontWeight: 700, color: USAGE_COLORS[bm.usageType] || 'var(--accent)' }}>{bm.usageType}</div>
                    <div className="flex items-center gap-2">
                      <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>{t('market.confidence')}:</div>
                      <div style={{ width: 80, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${bm.confidenceScore}%`, background: bm.confidenceScore > 75 ? '#4ade80' : '#fbbf24', borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 11, color: bm.confidenceScore > 75 ? '#4ade80' : '#fbbf24', fontWeight: 600 }}>{bm.confidenceScore}%</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    {[
                      { label: t('market.rent'), unit: '€/m²/Mon', min: bm.rentMin, max: bm.rentMax, med: bm.rentMedian },
                      { label: t('market.purchasePrice'), unit: '€/m²', min: bm.purchasePriceMin, max: bm.purchasePriceMax, med: bm.purchasePriceMedian },
                      { label: t('market.factor'), unit: 'x', min: bm.multiplierMin, max: bm.multiplierMax, med: bm.multiplierMedian },
                    ].map(metric => (
                      <div key={metric.label} className="p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                        <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>{metric.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#1c1c1e' }}>
                          {metric.med.toFixed(metric.unit === 'x' ? 1 : 0)} {metric.unit}
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginTop: 4 }}>
                          Range: {metric.min}–{metric.max} {metric.unit}
                        </div>
                        <ResponsiveContainer width="100%" height={30}>
                          <LineChart data={[{ v: metric.min }, { v: metric.med }, { v: metric.max }]}>
                            <Line type="monotone" dataKey="v" stroke={USAGE_COLORS[bm.usageType] || '#c9a96e'} strokeWidth={1.5} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-4" style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 12 }}>
                    <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>{t('market.source')}: <strong style={{ color: 'rgba(60,60,67,0.70)' }}>{bm.sourceLabel}</strong></div>
                    <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>{t('market.asOf')}: {new Date(bm.lastUpdated).toLocaleDateString(dateLocale)}</div>
                    {bm.vacancyRatePercent && <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>{t('market.vacancy')}: {bm.vacancyRatePercent}%</div>}
                    {bm.notes && <div style={{ fontSize: 11, color: '#fbbf24', fontStyle: 'italic', flex: 1 }}>{bm.notes}</div>}
                  </div>
                </GlassPanel>
              ))}

              {/* Update log */}
              <GlassPanel style={{ padding: 24 }}>
                <SectionHeader title={t('market.updateLog')} />
                <div className="space-y-2">
                  {location.updateLog.map(entry => (
                    <div key={entry.id} className="flex items-center gap-3 py-2 px-3 rounded-lg" style={{ background: 'rgba(0,0,0,0.02)' }}>
                      <Clock size={12} color="var(--text-muted)" />
                      <div style={{ flex: 1, fontSize: 12, color: 'rgba(60,60,67,0.70)' }}>{entry.changes}</div>
                      <span className="badge-neutral" style={{ fontSize: 10 }}>{entry.sourceLabel}</span>
                      <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>{new Date(entry.timestamp).toLocaleDateString(dateLocale)}</span>
                      <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>{entry.updatedBy}</span>
                    </div>
                  ))}
                </div>
              </GlassPanel>
            </div>
          ) : (
            <GlassPanel style={{ padding: 48, textAlign: 'center' }}>
              <BarChart3 size={32} color="var(--text-muted)" />
              <div style={{ color: 'rgba(60,60,67,0.45)', marginTop: 12 }}>{t('market.selectLocation')}</div>
            </GlassPanel>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// DEBT PAGE
// ══════════════════════════════════════════════════════════
export function DebtPage() {
  const { assets } = useStore();
  const { t, lang } = useLanguage();
  const dateLocale = lang === 'de' ? 'de-DE' : 'en-GB';
  const allDebt = assets.flatMap(a => a.debtInstruments.map(d => ({ ...d, assetName: a.name, assetCity: a.city, assetId: a.id })));
  const totalDebt = allDebt.reduce((s, d) => s + d.outstandingAmount, 0);

  // Compute live covenant values per asset from actual KPI engine
  const liveCovenants = assets.flatMap(a => {
    const noi = computeAssetNOI(a);
    const ltv = computeAssetLTV(a);
    const totalAssetDebt = a.debtInstruments.reduce((s, d) => s + d.outstandingAmount, 0);
    const annualInterest = a.debtInstruments.reduce((s, d) => s + d.outstandingAmount * (d.interestRate / 100), 0);
    const annualAmortization = a.debtInstruments.reduce((s, d) => s + d.outstandingAmount * (d.amortizationRate / 100), 0);
    const annualDebtService = annualInterest + annualAmortization;
    const dscr = annualDebtService > 0 ? noi.noi / annualDebtService : 999;

    return a.covenants.map(cov => {
      // Compute LIVE current value based on covenant type
      const liveValue = cov.type === 'LTV' ? ltv : cov.type === 'DSCR' ? dscr : cov.currentValue;
      // Determine LIVE status
      let liveStatus: 'OK' | 'Warning' | 'Breach' = 'OK';
      if (cov.type === 'LTV') {
        if (liveValue > cov.threshold) liveStatus = 'Breach';
        else if (liveValue > cov.threshold * 0.95) liveStatus = 'Warning';
      } else if (cov.type === 'DSCR') {
        if (liveValue < cov.threshold) liveStatus = 'Breach';
        else if (liveValue < cov.threshold * 1.05) liveStatus = 'Warning';
      }
      return { ...cov, assetName: a.name, currentValue: liveValue, status: liveStatus };
    });
  });

  const breaches = liveCovenants.filter(c => c.status === 'Breach');
  const warnings = liveCovenants.filter(c => c.status === 'Warning');

  const maturityData = allDebt.map(d => ({
    name: d.assetName,
    year: new Date(d.maturityDate).getFullYear(),
    amount: Math.round(d.outstandingAmount / 1_000_000),
    rate: d.interestRate,
  })).sort((a, b) => a.year - b.year);

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title={t('debt.title')}
        subtitle={t('debt.subtitle')}
        badge={`${allDebt.length} ${t('debt.instruments')}`}
      />

      {/* Alerts */}
      {(breaches.length > 0 || warnings.length > 0) && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          {breaches.map(c => (
            <div key={c.id} className="p-4 rounded-xl flex items-center gap-3"
              style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
              <AlertTriangle size={18} color="#f87171" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171' }}>{c.name} — Breach</div>
                <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)' }}>{c.assetName} · {t('debt.currentVal')}: {c.currentValue.toFixed(2)}{c.type === 'LTV' ? '%' : 'x'} / {t('portfolio.threshold')}: {c.threshold}{c.type === 'LTV' ? '%' : 'x'}</div>
              </div>
            </div>
          ))}
          {warnings.map(c => (
            <div key={c.id} className="p-4 rounded-xl flex items-center gap-3"
              style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
              <AlertTriangle size={18} color="#fbbf24" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>{c.name} — Warning</div>
                <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)' }}>{c.assetName} · {t('debt.currentVal')}: {c.currentValue.toFixed(2)}{c.type === 'LTV' ? '%' : 'x'} / {t('portfolio.threshold')}: {c.threshold}{c.type === 'LTV' ? '%' : 'x'}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KPICard label="Total Debt" value={formatEUR(totalDebt, true)} status="neutral" />
        <KPICard label="Covenant Breaches" value={`${breaches.length}`} status={breaches.length > 0 ? 'danger' : 'good'} sub={t('debt.violations')} />
        <KPICard label="Covenant Warnings" value={`${warnings.length}`} status={warnings.length > 0 ? 'warning' : 'good'} sub={t('portfolio.warnings_plural')} />
        <KPICard label="Avg. Interest Rate" value={`${(allDebt.reduce((s, d) => s + d.interestRate, 0) / allDebt.length).toFixed(2)}%`} status="neutral" />
      </div>

      {/* Maturity chart */}
      <GlassPanel style={{ padding: 24, marginBottom: 24 }}>
        <SectionHeader title={t('debt.maturityProfile')} />
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={maturityData}>
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'rgba(245,240,235,0.4)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'rgba(245,240,235,0.4)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}M`} />
            <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(0,0,0,0.10)', borderRadius: 10, fontSize: 12 }} formatter={(v: any) => [`${v} Mio. EUR`]} />
            <Bar dataKey="amount" fill="#007aff" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </GlassPanel>

      {/* Debt table */}
      <GlassPanel style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              {[t('debt.object'), t('debt.lender'), t('debt.type'), t('debt.outstanding'), t('debt.interestRate'), t('debt.amortization'), t('debt.maturity'), t('debt.status')].map(h => (
                <th key={h} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.45)', textAlign: 'left', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allDebt.map(d => {
              const monthsToMaturity = Math.floor((new Date(d.maturityDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30));
              return (
                <tr key={d.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1c1c1e' }}>{d.assetName}</div>
                    <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>{(d as any).assetCity}</div>
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: 'rgba(60,60,67,0.70)' }}>{d.lender}</td>
                  <td style={{ padding: '13px 16px' }}><span className="badge-neutral">{d.type}</span></td>
                  <td style={{ padding: '13px 16px', fontFamily: 'ui-monospace, monospace', fontSize: 13, color: '#007aff', fontWeight: 600 }}>{formatEUR(d.outstandingAmount, true)}</td>
                  <td style={{ padding: '13px 16px', fontFamily: 'ui-monospace, monospace', fontSize: 13, color: '#1c1c1e' }}>{d.interestRate.toFixed(2)}%</td>
                  <td style={{ padding: '13px 16px', fontFamily: 'ui-monospace, monospace', fontSize: 13, color: 'rgba(60,60,67,0.70)' }}>{d.amortizationRate}%</td>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ fontSize: 13, color: monthsToMaturity < 18 ? '#fbbf24' : 'var(--text-primary)', fontWeight: monthsToMaturity < 18 ? 600 : 400 }}>
                      {new Date(d.maturityDate).toLocaleDateString(dateLocale)}
                    </div>
                    {monthsToMaturity < 24 && <div style={{ fontSize: 11, color: '#fbbf24' }}>{monthsToMaturity} {t('debt.months')}</div>}
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <StatusBadge status={monthsToMaturity < 12 ? 'Breach' : monthsToMaturity < 24 ? 'Warning' : 'OK'} label={monthsToMaturity < 12 ? t('debt.critical') : monthsToMaturity < 24 ? t('debt.watch') : 'OK'} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </GlassPanel>

      {/* Covenants */}
      <div className="mt-6">
        <SectionHeader title={t('debt.covenantMatrix')} />
        <GlassPanel style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                {[t('debt.object'), t('debt.covenant'), t('debt.type'), t('portfolio.threshold'), t('debt.currentVal'), t('debt.status'), t('debt.testDate')].map(h => (
                  <th key={h} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.45)', textAlign: 'left', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {liveCovenants.map(cov => (
                <tr key={cov.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#1c1c1e' }}>{cov.assetName}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'rgba(60,60,67,0.70)' }}>{cov.name}</td>
                  <td style={{ padding: '12px 16px' }}><span className="badge-neutral">{cov.type}</span></td>
                  <td style={{ padding: '12px 16px', fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>{cov.threshold}{cov.type === 'LTV' ? '%' : 'x'}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 700, color: cov.status === 'OK' ? '#4ade80' : cov.status === 'Warning' ? '#fbbf24' : '#f87171' }}>
                    {cov.currentValue.toFixed(2)}{cov.type === 'LTV' ? '%' : 'x'}
                  </td>
                  <td style={{ padding: '12px 16px' }}><StatusBadge status={cov.status} /></td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'rgba(60,60,67,0.45)' }}>{new Date(cov.testDate).toLocaleDateString(dateLocale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassPanel>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// CASHFLOW PAGE — 10-Year Portfolio Investment Model
// ══════════════════════════════════════════════════════════

interface CFYearData {
  year: number;
  absoluteYear: number;
  grossRentalIncome: number;
  operatingCosts: number;
  capex: number;
  noi: number;
  acquisitions: number;
  acquisitionCosts: number;
  salesProceeds: number;
  salesCosts: number;
  cashflowFromTransactions: number;
  loanReceived: number;
  interestPayments: number;
  otherLoanCosts: number;
  loanRepayments: number;
  debtCashflow: number;
  freeCashflow: number;
}

function getDebtOutstandingForYear(instrument: DebtInstrument, absoluteYear: number): number {
  const drawdownYear = new Date(instrument.drawdownDate).getFullYear();
  const maturityYear = new Date(instrument.maturityDate).getFullYear();
  if (absoluteYear < drawdownYear || absoluteYear > maturityYear) return 0;
  const yearsSince = absoluteYear - drawdownYear;
  return instrument.amount * Math.pow(1 - instrument.amortizationRate / 100, yearsSince);
}

function fmtMio(n: number): string {
  if (n === 0) return '—';
  const inK = Math.round(Math.abs(n) / 1000);
  const formatted = inK.toLocaleString('de-DE');
  return n < 0 ? `(${formatted})` : formatted;
}

export function CashFlowPage() {
  const { assets, developments, sales, settings } = useStore();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['noi', 'transactions', 'debt']));
  const [colWidths, setColWidths] = useState<Record<number, number>>({});
  const resizeRef = useRef<{ colIdx: number; startX: number; startWidth: number } | null>(null);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const startResize = (colIdx: number, defaultWidth: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = colWidths[colIdx] ?? defaultWidth;
    resizeRef.current = { colIdx, startX: e.clientX, startWidth };
    const onMouseMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = ev.clientX - resizeRef.current.startX;
      const newWidth = Math.max(50, resizeRef.current.startWidth + delta);
      setColWidths(prev => ({ ...prev, [resizeRef.current!.colIdx]: newWidth }));
    };
    const onMouseUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const NUM_YEARS = 10;

  // Base year: always current year
  const baseYear = new Date().getFullYear();

  // Build yearly data
  const yearlyData: CFYearData[] = Array.from({ length: NUM_YEARS }, (_, yearIdx) => {
    const absoluteYear = baseYear + yearIdx;
    const d: CFYearData = {
      year: yearIdx + 1, absoluteYear,
      grossRentalIncome: 0, operatingCosts: 0, capex: 0, noi: 0,
      acquisitions: 0, acquisitionCosts: 0, salesProceeds: 0, salesCosts: 0, cashflowFromTransactions: 0,
      loanReceived: 0, interestPayments: 0, otherLoanCosts: 0, loanRepayments: 0, debtCashflow: 0,
      freeCashflow: 0,
    };

    // ── Assets ──
    for (const asset of assets) {
      const acqYear = new Date(asset.acquisitionDate).getFullYear();
      const saleObj = sales.find(s => s.sourceId === asset.id);
      const saleYear = saleObj
        ? (saleObj.soldAt ? new Date(saleObj.soldAt).getFullYear() : new Date(saleObj.createdAt).getFullYear() + 1)
        : acqYear + 10;

      const isActive = absoluteYear >= acqYear && absoluteYear < saleYear;
      const yearsHeld = absoluteYear - acqYear;
      const growthRate = ((asset.operatingCosts as any).rentalGrowthRate ?? 2.0) / 100;
      const growthFactor = Math.pow(1 + growthRate, Math.max(0, yearsHeld));

      if (isActive) {
        const grossRent = asset.annualRent * growthFactor;
        const noiBreakdown = computeAssetNOI(asset);
        const opexRatio = asset.annualRent > 0 ? noiBreakdown.totalOperatingExpenses / asset.annualRent : 0;
        d.grossRentalIncome += grossRent;
        d.operatingCosts += grossRent * opexRatio;
      }

      // Acquisitions
      if (absoluteYear === acqYear) {
        d.acquisitions += asset.purchasePrice;
        d.acquisitionCosts += asset.purchasePrice * (settings.defaultClosingCostPct + settings.defaultBrokerFeePct) / 100;
      }

      // Sale proceeds
      if (absoluteYear === saleYear && saleYear < baseYear + NUM_YEARS) {
        const noiBreakdown = computeAssetNOI(asset);
        const noi0 = noiBreakdown.noi;
        const growthRate2 = ((asset.operatingCosts as any).rentalGrowthRate ?? 2.0) / 100;
        const noiAtSale = noi0 * Math.pow(1 + growthRate2, Math.max(0, yearsHeld));
        const niy = asset.currentValue > 0 && noi0 > 0 ? noi0 / asset.currentValue : 0.04;
        const exitPrice = saleObj
          ? (saleObj.soldPrice ?? saleObj.askingPrice)
          : (niy > 0 ? noiAtSale / niy : asset.currentValue * Math.pow(1 + growthRate2, Math.max(0, yearsHeld)));
        d.salesProceeds += exitPrice;
        d.salesCosts += exitPrice * 0.02;
      }

      // Debt
      for (const debt of asset.debtInstruments) {
        const drawdownYear = new Date(debt.drawdownDate).getFullYear();
        const maturityYear = new Date(debt.maturityDate).getFullYear();
        if (absoluteYear === drawdownYear) d.loanReceived += debt.amount;
        if (absoluteYear >= drawdownYear && absoluteYear <= maturityYear && isActive) {
          const outstanding = getDebtOutstandingForYear(debt, absoluteYear);
          d.interestPayments += outstanding * debt.interestRate / 100;
          d.loanRepayments += outstanding * debt.amortizationRate / 100;
        }
      }
    }

    // ── Developments ──
    for (const dev of developments) {
      const purchaseYear = new Date(dev.startDate).getFullYear();
      const completionYear = new Date(dev.plannedEndDate || dev.startDate).getFullYear();
      const constructionYears = Math.max(1, completionYear - purchaseYear);
      const saleObj = sales.find(s => s.sourceId === dev.id);
      const saleYear = saleObj
        ? (saleObj.soldAt ? new Date(saleObj.soldAt).getFullYear() : new Date(saleObj.createdAt).getFullYear() + 1)
        : completionYear + 10;

      // Acquisition
      if (absoluteYear === purchaseYear) {
        d.acquisitions += dev.purchasePrice;
        d.acquisitionCosts += dev.purchasePrice * (settings.defaultClosingCostPct + settings.defaultBrokerFeePct) / 100;
      }

      // Capex during construction
      if (absoluteYear >= purchaseYear && absoluteYear < completionYear) {
        d.capex += dev.totalBudget / constructionYears;
      }

      // Rental income post-completion
      if (absoluteYear >= completionYear && absoluteYear < saleYear) {
        const yearsAfterCompletion = absoluteYear - completionYear;
        const unitsRent = dev.units && dev.units.length > 0
          ? dev.units.reduce((s, u) => s + (u.monthlyRent || 0) * 12, 0)
          : (dev.projectedSalePrice ?? (dev.totalBudget + dev.purchasePrice)) * 0.05;
        const rent = unitsRent * Math.pow(1.02, yearsAfterCompletion);
        d.grossRentalIncome += rent;
        d.operatingCosts += rent * 0.20;
      }

      // Sale proceeds
      if (absoluteYear === saleYear && saleYear < baseYear + NUM_YEARS) {
        const salePrice = saleObj
          ? (saleObj.soldPrice ?? saleObj.askingPrice)
          : (dev.projectedSalePrice ?? (dev.totalBudget + dev.purchasePrice) * 1.2);
        d.salesProceeds += salePrice;
        d.salesCosts += salePrice * 0.02;
      }

      // Dev debt
      if (dev.debtAssumptions) {
        const loanAmt = (dev.totalBudget + dev.purchasePrice) * ((dev.debtAssumptions.ltcPct ?? dev.debtAssumptions.ltvPct ?? 60) / 100);
        if (absoluteYear === purchaseYear) d.loanReceived += loanAmt;
        if (absoluteYear >= purchaseYear && absoluteYear < saleYear) {
          d.interestPayments += loanAmt * dev.debtAssumptions.interestRatePct / 100;
          if (dev.debtAssumptions.loanType === 'Annuität' && dev.debtAssumptions.annuityTermYears) {
            d.loanRepayments += loanAmt / dev.debtAssumptions.annuityTermYears;
          }
        }
      }
    }

    // Subtotals
    d.noi = d.grossRentalIncome - d.operatingCosts - d.capex;
    d.cashflowFromTransactions = -d.acquisitions - d.acquisitionCosts + d.salesProceeds - d.salesCosts;
    d.debtCashflow = d.loanReceived - d.interestPayments - d.otherLoanCosts - d.loanRepayments;
    d.freeCashflow = d.noi + d.cashflowFromTransactions + d.debtCashflow;
    return d;
  });

  // Totals column
  const totals: CFYearData = yearlyData.reduce<CFYearData>((acc, y) => {
    const keys: (keyof CFYearData)[] = ['grossRentalIncome','operatingCosts','capex','noi','acquisitions','acquisitionCosts','salesProceeds','salesCosts','cashflowFromTransactions','loanReceived','interestPayments','otherLoanCosts','loanRepayments','debtCashflow','freeCashflow'];
    keys.forEach(k => { (acc as any)[k] += (y as any)[k]; });
    return acc;
  }, { year: 0, absoluteYear: 0, grossRentalIncome: 0, operatingCosts: 0, capex: 0, noi: 0, acquisitions: 0, acquisitionCosts: 0, salesProceeds: 0, salesCosts: 0, cashflowFromTransactions: 0, loanReceived: 0, interestPayments: 0, otherLoanCosts: 0, loanRepayments: 0, debtCashflow: 0, freeCashflow: 0 });

  const allData = [...yearlyData, { ...totals, year: 99, absoluteYear: 9999 }];
  const colHeaders = [...yearlyData.map(y => `${y.absoluteYear}`), 'Total'];

  // Area chart data — raw EUR values, YAxis formatter handles display scaling
  let cumulative = 0;
  const chartData = yearlyData.map(y => {
    cumulative += y.freeCashflow;
    return {
      year: `${y.absoluteYear}`,
      noi: y.noi,
      transactions: y.cashflowFromTransactions,
      debtCashflow: y.debtCashflow,
      freeCashflow: y.freeCashflow,
      cumulativeFreeCF: cumulative,
    };
  });

  // KPI summary
  const totalNOI = totals.noi;
  const totalFCF = totals.freeCashflow;
  const avgAnnualNOI = totalNOI / NUM_YEARS;
  const totalSalesProceeds = totals.salesProceeds;

  // Row renderer helper
  const rowStyle = (isSubtotal: boolean, isGrandTotal: boolean, value?: number) => ({
    background: isGrandTotal
      ? (value !== undefined && value >= 0 ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)')
      : isSubtotal ? 'rgba(201,169,110,0.08)' : 'transparent',
    borderTop: isSubtotal || isGrandTotal ? '1px solid rgba(201,169,110,0.25)' : 'none',
  });

  const cellColor = (val: number, positive: boolean) => {
    if (val === 0) return 'rgba(60,60,67,0.30)';
    return positive ? (val > 0 ? '#4ade80' : '#f87171') : (val < 0 ? '#f87171' : '#4ade80');
  };

  type CFRow = {
    key: keyof CFYearData;
    label: string;
    sign: '+' | '-' | '=' | '==';
    isSubtotal: boolean;
    isGrandTotal: boolean;
    section: string;
    positiveIsGood: boolean;
  };

  const sections: { key: string; label: string; color: string; rows: CFRow[] }[] = [
    {
      key: 'noi',
      label: 'Operating Cashflow',
      color: '#007aff',
      rows: [
        { key: 'grossRentalIncome', label: 'Gross Rental Income', sign: '+', isSubtotal: false, isGrandTotal: false, section: 'noi', positiveIsGood: true },
        { key: 'operatingCosts', label: 'Operating Costs (Bewirtschaftung)', sign: '-', isSubtotal: false, isGrandTotal: false, section: 'noi', positiveIsGood: false },
        { key: 'capex', label: 'Capex / Baukosten', sign: '-', isSubtotal: false, isGrandTotal: false, section: 'noi', positiveIsGood: false },
        { key: 'noi', label: 'Net Operating Income (NOI)', sign: '=', isSubtotal: true, isGrandTotal: false, section: 'noi', positiveIsGood: true },
      ],
    },
    {
      key: 'transactions',
      label: 'Transaction Cashflow',
      color: '#ff9500',
      rows: [
        { key: 'acquisitions', label: 'Ankauf (Kaufpreis)', sign: '-', isSubtotal: false, isGrandTotal: false, section: 'transactions', positiveIsGood: false },
        { key: 'acquisitionCosts', label: 'Erwerbsnebenkosten', sign: '-', isSubtotal: false, isGrandTotal: false, section: 'transactions', positiveIsGood: false },
        { key: 'salesProceeds', label: 'Verkaufserlös', sign: '+', isSubtotal: false, isGrandTotal: false, section: 'transactions', positiveIsGood: true },
        { key: 'salesCosts', label: 'Verkaufsnebenkosten', sign: '-', isSubtotal: false, isGrandTotal: false, section: 'transactions', positiveIsGood: false },
        { key: 'cashflowFromTransactions', label: 'Cashflow Transaktionen', sign: '=', isSubtotal: true, isGrandTotal: false, section: 'transactions', positiveIsGood: true },
      ],
    },
    {
      key: 'debt',
      label: 'Financing Cashflow',
      color: '#f87171',
      rows: [
        { key: 'loanReceived', label: 'Darlehensauszahlung', sign: '+', isSubtotal: false, isGrandTotal: false, section: 'debt', positiveIsGood: true },
        { key: 'interestPayments', label: 'Zinsen', sign: '-', isSubtotal: false, isGrandTotal: false, section: 'debt', positiveIsGood: false },
        { key: 'otherLoanCosts', label: 'Sonstige Darlehenskosten', sign: '-', isSubtotal: false, isGrandTotal: false, section: 'debt', positiveIsGood: false },
        { key: 'loanRepayments', label: 'Tilgung', sign: '-', isSubtotal: false, isGrandTotal: false, section: 'debt', positiveIsGood: false },
        { key: 'debtCashflow', label: 'Debt Cashflow', sign: '=', isSubtotal: true, isGrandTotal: false, section: 'debt', positiveIsGood: true },
      ],
    },
  ];

  const grandTotalRow: CFRow = { key: 'freeCashflow', label: 'Free Cashflow', sign: '==', isSubtotal: false, isGrandTotal: true, section: 'total', positiveIsGood: true };

  return (
    <div className="p-8 max-w-[1800px] mx-auto">
      <PageHeader
        title="10-Jahres Portfolio Cash Flow"
        subtitle={`Investitionsrechnung — Lestate Real GmbH · Basisjahr ${baseYear}`}
        badge={`${assets.length + developments.length} Objekte`}
      />

      {/* KPI Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KPICard label="NOI 10J Gesamt" value={formatEUR(totalNOI, true)} status={totalNOI > 0 ? 'good' : 'danger'} />
        <KPICard label="Ø NOI p.a." value={formatEUR(avgAnnualNOI, true)} status="neutral" />
        <KPICard label="Free Cashflow 10J" value={formatEUR(totalFCF, true)} status={totalFCF > 0 ? 'good' : 'warning'} />
        <KPICard label="Verkaufserlöse (gesamt)" value={formatEUR(totalSalesProceeds, true)} status="neutral" />
      </div>

      {/* Area Chart with Gradient Fills */}
      <GlassPanel style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(60,60,67,0.50)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
          Cashflow-Segmente pro Jahr (TEUR)
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <defs>
              <linearGradient id="gradNOI" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#007aff" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#007aff" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="gradTx" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff9500" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#ff9500" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="gradDebt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f87171" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#f87171" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="gradFCF" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c9a96e" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#c9a96e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'rgba(60,60,67,0.5)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'rgba(60,60,67,0.4)' }} axisLine={false} tickLine={false} tickFormatter={v => Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : `${(v / 1000).toFixed(0)}k`} />
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <ReferenceLine y={0} stroke="rgba(0,0,0,0.20)" strokeWidth={1} />
            <Tooltip
              content={({ active, payload, label }: any) => {
                if (!active || !payload?.length) return null;
                const colors: Record<string, string> = { noi: '#007aff', transactions: '#ff9500', debtCashflow: '#f87171', freeCashflow: '#c9a96e', cumulativeFreeCF: '#0A7629' };
                const names: Record<string, string> = { noi: 'NOI', transactions: 'Transactions', debtCashflow: 'Debt', freeCashflow: 'Free CF', cumulativeFreeCF: 'Kum. Free CF' };
                return (
                  <div style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '12px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', fontSize: 12, minWidth: 210 }}>
                    <div style={{ fontWeight: 700, color: '#111', marginBottom: 8 }}>{label}</div>
                    {payload.map((p: any) => (
                      <div key={p.dataKey} className="flex justify-between gap-6" style={{ marginBottom: 3 }}>
                        <span style={{ color: 'rgba(60,60,67,0.6)', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: colors[p.dataKey] || p.color }} />
                          {names[p.dataKey] || p.name}
                        </span>
                        <span style={{ fontWeight: 600, fontFamily: 'ui-monospace, monospace', color: p.value >= 0 ? '#1c1c1e' : '#f87171' }}>
                          {formatEUR(p.value, true)}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            <Area type="monotone" dataKey="noi" name="NOI" stroke="#007aff" strokeWidth={1} fill="url(#gradNOI)" />
            <Area type="monotone" dataKey="transactions" name="Transactions" stroke="#ff9500" strokeWidth={1} fill="url(#gradTx)" />
            <Area type="monotone" dataKey="debtCashflow" name="Debt" stroke="#f87171" strokeWidth={1} fill="url(#gradDebt)" />
            <Area type="monotone" dataKey="freeCashflow" name="Free CF" stroke="#c9a96e" strokeWidth={3} fill="url(#gradFCF)" />
            <Line type="monotone" dataKey="cumulativeFreeCF" name="Kum. Free CF" stroke="#0A7629" strokeWidth={3} dot={{ r: 4, fill: '#0A7629', strokeWidth: 2, stroke: '#fff' }} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex gap-5 mt-3" style={{ paddingLeft: 4 }}>
          {[
            { color: '#007aff', label: 'NOI', dot: false },
            { color: '#ff9500', label: 'Transactions', dot: false },
            { color: '#f87171', label: 'Debt', dot: false },
            { color: '#c9a96e', label: 'Free CF', dot: false },
            { color: '#0A7629', label: 'Kum. Free CF', dot: true },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              {l.dot
                ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, border: '2px solid #fff', boxShadow: `0 0 0 1px ${l.color}` }} />
                : <div style={{ width: 18, height: 2, borderRadius: 1, background: l.color }} />}
              <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.60)' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </GlassPanel>

      {/* 10-Year Table */}
      <GlassPanel style={{ overflow: 'auto', padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 1000 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid rgba(201,169,110,0.25)' }}>
              <th style={{ padding: '14px 16px', textAlign: 'left', position: 'sticky', left: 0, background: '#fff', zIndex: 2, width: colWidths[0] ?? 240, minWidth: 140, borderRight: '1px solid rgba(0,0,0,0.07)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#111', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Portfolio Cash Flow</div>
                <div style={{ fontSize: 10, fontWeight: 400, color: 'rgba(0,0,0,0.45)', marginTop: 2 }}>€ in tausend ('000)</div>
                <div onMouseDown={e => startResize(0, 240, e)} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 5, cursor: 'col-resize', zIndex: 10 }} />
              </th>
              {colHeaders.map((h, i) => (
                <th key={h} style={{
                  padding: '14px 12px', fontSize: 11, fontWeight: 700, position: 'relative',
                  color: i === colHeaders.length - 1 ? '#c9a96e' : '#111',
                  textAlign: 'right', letterSpacing: '0.03em',
                  width: colWidths[i + 2] ?? 100, minWidth: 60,
                  borderLeft: i === colHeaders.length - 1 ? '2px solid rgba(201,169,110,0.20)' : '1px solid rgba(0,0,0,0.05)',
                }}>
                  {i === colHeaders.length - 1 ? 'Total' : h}
                  {i < colHeaders.length - 1 && <div style={{ fontSize: 9, fontWeight: 400, color: 'rgba(0,0,0,0.35)', marginTop: 1 }}>Jahr {i + 1}</div>}
                  <div onMouseDown={e => startResize(i + 2, 100, e)} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 5, cursor: 'col-resize', zIndex: 10 }} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map(section => (
              <React.Fragment key={section.key}>
                {/* Section header with inline totals */}
                {(() => {
                  const subtotalRow = section.rows.find(r => r.isSubtotal);
                  const sectionBg: Record<string, string> = {
                    noi: 'rgba(0,122,255,0.15)',
                    transactions: 'rgba(201,169,110,0.15)',
                    debt: 'rgba(248,113,113,0.15)',
                  };
                  const bg = sectionBg[section.key] ?? 'rgba(0,0,0,0.04)';
                  return (
                    <tr onClick={() => toggleSection(section.key)} style={{ cursor: 'pointer', borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                      <td style={{ padding: '10px 16px', background: bg, position: 'sticky', left: 0, zIndex: 1, borderRight: '1px solid rgba(0,0,0,0.07)' }}>
                        <div className="flex items-center gap-2">
                          <ChevronDown size={13} style={{ color: section.color, transform: expandedSections.has(section.key) ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: section.color, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{section.label}</span>
                        </div>
                      </td>
                      {allData.map((y, i) => {
                        const val = subtotalRow ? (y as any)[subtotalRow.key] as number : 0;
                        const isTotal = i === allData.length - 1;
                        return (
                          <td key={i} style={{
                            padding: '10px 12px', textAlign: 'right', background: bg,
                            fontFamily: 'ui-monospace, monospace', fontSize: 12, fontWeight: 700,
                            color: val === 0 ? 'rgba(0,0,0,0.20)' : val < 0 ? '#f87171' : section.color,
                            borderLeft: isTotal ? '2px solid rgba(201,169,110,0.20)' : '1px solid rgba(0,0,0,0.05)',
                          }}>
                            {val === 0 ? '—' : fmtMio(val)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })()}

                {/* Section rows */}
                {section.rows.map(row => {
                  const isExpanded = expandedSections.has(section.key);
                  if (row.isSubtotal) return null;
                  if (!isExpanded) return null;

                  return (
                    <tr key={row.key} style={rowStyle(row.isSubtotal, false)}>
                      <td style={{
                        padding: row.isSubtotal ? '12px 16px' : '9px 16px 9px 28px',
                        fontSize: row.isSubtotal ? 13 : 12,
                        fontWeight: row.isSubtotal ? 700 : 400,
                        color: '#111',
                        position: 'sticky', left: 0,
                        background: row.isSubtotal ? 'rgba(201,169,110,0.08)' : '#fff',
                        zIndex: 1,
                        borderRight: '1px solid rgba(0,0,0,0.07)',
                      }}>
                        {row.label}
                      </td>
                      {allData.map((y, i) => {
                        const rawVal = (y as any)[row.key] as number;
                        const effectiveVal = row.sign === '-' && rawVal > 0 ? -rawVal : rawVal;
                        const isTotal = i === allData.length - 1;
                        const valueColor = rawVal === 0
                          ? 'rgba(0,0,0,0.25)'
                          : row.isSubtotal
                            ? cellColor(rawVal, row.positiveIsGood)
                            : (row.sign === '-' || rawVal < 0) ? '#f87171' : '#111';
                        return (
                          <td key={i} style={{
                            padding: row.isSubtotal ? '12px 12px' : '9px 12px',
                            textAlign: 'right',
                            fontFamily: 'ui-monospace, monospace',
                            fontSize: row.isSubtotal ? 13 : 12,
                            fontWeight: row.isSubtotal ? 700 : 400,
                            color: valueColor,
                            borderLeft: isTotal ? '2px solid rgba(201,169,110,0.20)' : '1px solid rgba(0,0,0,0.05)',
                          }}>
                            {rawVal === 0 ? '—' : fmtMio(effectiveVal)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}

            {/* Grand total: Free Cashflow */}
            <tr style={{ ...rowStyle(false, true, totals.freeCashflow), borderTop: '2px solid rgba(10,118,41,0.50)' }}>
              <td style={{ padding: '16px 16px', fontSize: 14, fontWeight: 800, color: '#4ade80', position: 'sticky', left: 0, background: totals.freeCashflow >= 0 ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)', zIndex: 1, borderRight: '1px solid rgba(0,0,0,0.07)' }}>
                Free Cashflow
              </td>
              {allData.map((y, i) => {
                const val = y.freeCashflow;
                const isTotal = i === allData.length - 1;
                return (
                  <td key={i} style={{
                    padding: '16px 12px', textAlign: 'right',
                    fontFamily: 'ui-monospace, monospace', fontSize: 14, fontWeight: 800,
                    color: val === 0 ? 'rgba(0,0,0,0.25)' : val > 0 ? '#4ade80' : '#f87171',
                    borderLeft: isTotal ? '2px solid rgba(201,169,110,0.20)' : '1px solid rgba(0,0,0,0.05)',
                  }}>
                    {val === 0 ? '—' : fmtMio(val)}
                  </td>
                );
              })}
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={colHeaders.length + 2} style={{ padding: '10px 16px', fontSize: 10, color: 'rgba(0,0,0,0.35)', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                Angaben in EUR Tausend ('000). Mietindexierung gemäß individualem Wachstumssatz pro Objekt. Verkäufe basierend auf NOI-Exit-Yield oder Angebotspreisen. Alle Werte sind Planwerte.
              </td>
            </tr>
          </tfoot>
        </table>
      </GlassPanel>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// DOCUMENTS PAGE
// ══════════════════════════════════════════════════════════
export function DocumentsPage() {
  const { assets, deals } = useStore();
  const { t, lang } = useLanguage();
  const dateLocale = lang === 'de' ? 'de-DE' : 'en-GB';
  const [filterCat, setFilterCat] = useState('Alle');
  const [search, setSearch] = useState('');

  const allDocs = [
    ...assets.flatMap(a => a.documents.map(d => ({ ...d, linkedName: a.name }))),
    ...deals.flatMap(d => d.documents.map(doc => ({ ...doc, linkedName: d.name }))),
  ];

  const categories = ['Alle', ...Array.from(new Set(allDocs.map(d => d.category)))];
  const filtered = allDocs.filter(d => {
    const matchCat = filterCat === 'Alle' || d.category === filterCat;
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title={t('documents.title')}
        subtitle={`${allDocs.length} ${t('documents.title')} · Assets & Deals`}
        actions={
          <button className="btn-glass px-4 py-2 rounded-xl text-sm flex items-center gap-2">
            <Upload size={14} /> {t('documents.upload')}
          </button>
        }
      />
      <div className="flex gap-3 mb-6">
        <div className="relative">
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(60,60,67,0.45)' }} />
          <input className="input-glass pl-8" placeholder={t('documents.search')} value={search} onChange={e => setSearch(e.target.value)} style={{ width: 240 }} />
        </div>
        <select className="input-glass" value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ width: 200 }}>
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      <GlassPanel style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              {[t('documents.filename'), t('documents.category'), t('documents.linkedTo'), t('documents.tags'), t('documents.size'), t('documents.uploaded'), t('documents.by')].map(h => (
                <th key={h} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.45)', textAlign: 'left', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(doc => (
              <tr key={doc.id} className="table-glass" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                <td style={{ padding: '13px 16px' }}>
                  <div className="flex items-center gap-2">
                    <FileText size={14} color="#007aff" />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1c1c1e' }}>{doc.name}</span>
                  </div>
                </td>
                <td style={{ padding: '13px 16px' }}><span className="badge-neutral">{doc.category}</span></td>
                <td style={{ padding: '13px 16px', fontSize: 13, color: 'rgba(60,60,67,0.70)' }}>{(doc as any).linkedName}</td>
                <td style={{ padding: '13px 16px' }}>
                  <div className="flex gap-1 flex-wrap">{doc.tags.map(t => <span key={t} className="badge-neutral" style={{ fontSize: 10 }}>{t}</span>)}</div>
                </td>
                <td style={{ padding: '13px 16px', fontSize: 12, color: 'rgba(60,60,67,0.45)', fontFamily: 'ui-monospace, monospace' }}>{doc.fileSize}</td>
                <td style={{ padding: '13px 16px', fontSize: 12, color: 'rgba(60,60,67,0.45)' }}>{new Date(doc.uploadDate).toLocaleDateString(dateLocale)}</td>
                <td style={{ padding: '13px 16px', fontSize: 12, color: 'rgba(60,60,67,0.45)' }}>{doc.uploadedBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12" style={{ color: 'rgba(60,60,67,0.45)' }}>{t('documents.noResults')}</div>
        )}
      </GlassPanel>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// AI COPILOT PAGE
// ══════════════════════════════════════════════════════════
export function AICopilotPage() {
  const { t, lang } = useLanguage();
  const { assets, deals, developments, sales, settings } = useStore();
  const { data: marketLocations = [] } = useListMarketLocations();
  const dateLocale = lang === 'de' ? 'de-DE' : 'en-GB';
  const [messages, setMessages] = useState<{ role: string; text: string; timestamp?: string }[]>([
    { role: 'assistant', text: t('ai.welcome'), timestamp: new Date().toISOString() },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Build portfolio context summary for Claude
  const buildContext = () => {
    const totalValue = assets.reduce((s, a) => s + a.currentValue, 0);
    const totalDebt = assets.flatMap(a => a.debtInstruments).reduce((s, d) => s + d.outstandingAmount, 0);
    const assetSummaries = assets.map(a => {
      const noi = computeAssetNOI(a);
      const ltv = computeAssetLTV(a);
      return `- ${a.name} (${a.city}, ${a.usageType}): Value ${(a.currentValue/1e6).toFixed(1)}M, NOI ${(noi.noi/1e3).toFixed(0)}k, LTV ${ltv.toFixed(1)}%, Occupancy ${(a.occupancyRate*100).toFixed(0)}%`;
    }).join('\n');
    const dealSummaries = deals.map(d => `- ${d.name} (${d.city}, ${d.dealType}): ${d.stage}, Asking ${(d.askingPrice/1e6).toFixed(1)}M`).join('\n');
    const marketSummary = marketLocations.slice(0, 5).map(l => `- ${l.city}: ${l.benchmarks.length} benchmarks, last updated ${l.lastUpdated}`).join('\n');

    return `PORTFOLIO CONTEXT (Lestate Real GmbH):
Assets (${assets.length}): Total value €${(totalValue/1e6).toFixed(1)}M, Total debt €${(totalDebt/1e6).toFixed(1)}M
${assetSummaries}

Acquisition Pipeline (${deals.length} deals):
${dealSummaries}

Developments: ${developments.length} projects
Sales: ${sales.length} objects

Market Intelligence: ${marketLocations.length} locations tracked
${marketSummary}

Settings: Hurdle Rate ${settings.hurrleRate}%, Tax Rate ${settings.taxRate}%, Exit Multiplier ${settings.defaultExitMultiplier}x, Min DSCR ${settings.minDSCR}x, Max LTV ${settings.maxLTV}%`;
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', text: input, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const conversationHistory = messages.slice(-10).map(m => ({
        role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: m.text,
      }));

      const result = await aiChat({
        maxTokens: 1500,
        system: `You are an AI investment analyst copilot for Lestate Real GmbH, a German private real estate investment firm. You have access to the following live portfolio data:

${buildContext()}

Answer questions about the portfolio, provide analysis, and make recommendations. Always be specific — reference actual asset names, numbers, and KPIs. Respond in ${lang === 'de' ? 'German' : 'English'}. Keep responses concise (3-8 sentences). All KPI terms stay in English regardless of language.

Important: Your recommendations are advisory only. All KPIs are calculated deterministically by the KPI engine. You support the human decision-maker but never replace them.`,
        messages: [...conversationHistory, { role: 'user', content: input }],
      });

      const aiText = result.text || 'No response received.';

      setMessages(prev => [...prev, { role: 'assistant', text: aiText, timestamp: new Date().toISOString() }]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: lang === 'de'
          ? `⚠️ API-Verbindung fehlgeschlagen (${err.message}).`
          : `⚠️ API connection failed (${err.message}).`,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const SUGGESTIONS = [t('ai.suggestion1'), t('ai.suggestion2'), t('ai.suggestion3'), t('ai.suggestion4')];

  return (
    <div className="p-8 max-w-[1000px] mx-auto">
      <PageHeader title={t('ai.title')} subtitle={t('ai.subtitle')} badge="Live" />

      <div className="p-3 rounded-xl mb-6 flex items-center gap-3"
        style={{ background: 'rgba(0,122,255,0.05)', border: '1px solid rgba(0,122,255,0.12)' }}>
        <Shield size={16} color="#007aff" />
        <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.70)' }}>
          <strong style={{ color: '#007aff' }}>{t('ai.governanceNote')}</strong> {t('ai.governanceText')}
        </div>
      </div>

      {/* Chat */}
      <GlassPanel style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ height: 460, overflowY: 'auto', padding: 24 }}>
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: msg.role === 'assistant' ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {msg.role === 'assistant' ? <Bot size={14} color="#007aff" /> : <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.70)' }}>MW</span>}
                </div>
                <div style={{
                  maxWidth: '75%',
                  background: msg.role === 'assistant' ? 'rgba(255,255,255,0.05)' : 'rgba(201,169,110,0.1)',
                  border: `1px solid ${msg.role === 'assistant' ? 'rgba(255,255,255,0.08)' : 'rgba(201,169,110,0.2)'}`,
                  borderRadius: msg.role === 'assistant' ? '4px 18px 18px 18px' : '18px 4px 18px 18px',
                  padding: '12px 16px', fontSize: 13, color: 'rgba(60,60,67,0.70)', lineHeight: 1.6,
                }}>
                  {msg.text}
                  {msg.role === 'assistant' && msg.timestamp && (
                    <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', marginTop: 6 }}>
                      Claude Sonnet · {new Date(msg.timestamp).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(201,169,110,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RefreshCw size={14} color="#007aff" className="animate-spin" />
                </div>
                <div style={{ padding: '12px 16px', fontSize: 13, color: 'rgba(60,60,67,0.45)', fontStyle: 'italic' }}>
                  {lang === 'de' ? 'Analysiere Portfolio-Daten...' : 'Analyzing portfolio data...'}
                </div>
              </div>
            )}
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', padding: '16px 24px' }}>
          <div className="flex gap-2 mb-3 flex-wrap">
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => setInput(s)}
                className="badge-neutral cursor-pointer"
                style={{ cursor: 'pointer', fontSize: 12, padding: '4px 10px', background: 'rgba(0,0,0,0.04)' }}>
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <input className="input-glass flex-1" placeholder={t('ai.placeholder')} value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()} />
            <button onClick={handleSend} disabled={loading} className="btn-accent px-5 py-2 rounded-xl text-sm" style={{ opacity: loading ? 0.6 : 1 }}>{t('ai.send')}</button>
          </div>
        </div>
      </GlassPanel>

      {/* Audit trail */}
      <GlassPanel style={{ padding: 20 }}>
        <SectionHeader title={t('ai.auditTitle')} />
        <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)', fontStyle: 'italic' }}>
          {t('ai.auditText')}
        </div>
      </GlassPanel>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// DEAL RADAR PAGE
// ══════════════════════════════════════════════════════════

const STATUS_STYLES: Record<string, { bg: string; border: string; color: string; label_de: string; label_en: string }> = {
  new: { bg: 'rgba(0,122,255,0.08)', border: 'rgba(0,122,255,0.2)', color: '#007aff', label_de: 'Neu', label_en: 'New' },
  reviewed: { bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)', color: '#fbbf24', label_de: 'Gesichtet', label_en: 'Reviewed' },
  shortlisted: { bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.2)', color: '#4ade80', label_de: 'Vorgemerkt', label_en: 'Shortlisted' },
  dismissed: { bg: 'rgba(248,113,113,0.06)', border: 'rgba(248,113,113,0.15)', color: '#f87171', label_de: 'Abgelehnt', label_en: 'Dismissed' },
  converted: { bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)', color: '#a78bfa', label_de: 'Übernommen', label_en: 'Converted' },
};

export function DealRadarPage() {
  const { dealRadarListings, dealRadarCriteria, addRadarListings, updateRadarListing, dismissRadarListing, convertToAcquisition, updateRadarCriteria } = useStore();
  const { t, lang } = useLanguage();
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [showCriteria, setShowCriteria] = useState(false);

  const allCities = ['Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt am Main', 'Stuttgart', 'Düsseldorf', 'Leipzig', 'Dortmund', 'Essen', 'Bremen', 'Dresden', 'Hannover', 'Nürnberg', 'Duisburg', 'Bochum', 'Wuppertal', 'Bielefeld', 'Bonn', 'Münster'];
  const allUsageTypes: Array<'Wohnen' | 'Büro' | 'Einzelhandel' | 'Logistik' | 'Mixed Use'> = ['Wohnen', 'Büro', 'Einzelhandel', 'Logistik', 'Mixed Use'];

  const filtered = dealRadarListings.filter(l => filterStatus === 'all' || l.status === filterStatus);
  const selectedListing = dealRadarListings.find(l => l.id === selectedId);

  const handleSearch = async () => {
    setSearching(true);
    setError(null);
    try {
      const result = await searchDealRadar(dealRadarCriteria);
      if (result.success && result.listings.length > 0) {
        addRadarListings(result.listings);
      } else if (!result.success) {
        setError(result.error || 'Search failed');
      } else {
        setError(lang === 'de' ? 'Keine Angebote gefunden. Versuche breitere Suchkriterien.' : 'No listings found. Try broader criteria.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 5, letterSpacing: '0.04em', textTransform: 'uppercase' };

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title={t('radar.title')}
        subtitle={t('radar.subtitle')}
        badge={dealRadarListings.filter(l => l.status === 'new').length > 0 ? `${dealRadarListings.filter(l => l.status === 'new').length} ${lang === 'de' ? 'neu' : 'new'}` : undefined}
        actions={
          <div className="flex gap-2">
            <button onClick={() => setShowCriteria(!showCriteria)} className="btn-glass px-4 py-2 rounded-xl text-sm flex items-center gap-2" style={{ cursor: 'pointer' }}>
              <Filter size={14} /> {t('radar.criteria')}
            </button>
            <button onClick={handleSearch} disabled={searching}
              className="btn-accent px-4 py-2 rounded-xl text-sm flex items-center gap-2"
              style={{ cursor: searching ? 'wait' : 'pointer', opacity: searching ? 0.7 : 1 }}>
              {searching ? <RefreshCw size={14} className="animate-spin" /> : <Radar size={14} />}
              {searching ? t('radar.searching') : t('radar.search')}
            </button>
          </div>
        }
      />

      {/* Search Criteria Panel */}
      {showCriteria && (
        <GlassPanel style={{ padding: 20, marginBottom: 16 }} className="animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1c1c1e' }}>{t('radar.criteria')}</span>
            <button onClick={() => setShowCriteria(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={14} /></button>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label style={labelStyle}>{lang === 'de' ? 'Städte' : 'Cities'}</label>
              <div className="flex flex-wrap gap-1.5">
                {allCities.map(city => (
                  <button key={city} onClick={() => {
                    const has = dealRadarCriteria.cities.includes(city);
                    updateRadarCriteria({ cities: has ? dealRadarCriteria.cities.filter(c => c !== city) : [...dealRadarCriteria.cities, city] });
                  }} style={{
                    fontSize: 11, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                    background: dealRadarCriteria.cities.includes(city) ? 'rgba(0,122,255,0.12)' : 'rgba(0,0,0,0.04)',
                    color: dealRadarCriteria.cities.includes(city) ? '#007aff' : 'rgba(60,60,67,0.55)',
                    border: `1px solid ${dealRadarCriteria.cities.includes(city) ? 'rgba(0,122,255,0.25)' : 'rgba(0,0,0,0.06)'}`,
                  }}>{city}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={labelStyle}>{lang === 'de' ? 'Nutzungsarten' : 'Usage Types'}</label>
              <div className="flex flex-wrap gap-1.5">
                {allUsageTypes.map(ut => (
                  <button key={ut} onClick={() => {
                    const has = dealRadarCriteria.usageTypes.includes(ut);
                    updateRadarCriteria({ usageTypes: has ? dealRadarCriteria.usageTypes.filter(u => u !== ut) : [...dealRadarCriteria.usageTypes, ut] });
                  }} style={{
                    fontSize: 11, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                    background: dealRadarCriteria.usageTypes.includes(ut) ? 'rgba(201,169,110,0.15)' : 'rgba(0,0,0,0.04)',
                    color: dealRadarCriteria.usageTypes.includes(ut) ? 'var(--accent)' : 'rgba(60,60,67,0.55)',
                    border: `1px solid ${dealRadarCriteria.usageTypes.includes(ut) ? 'rgba(201,169,110,0.3)' : 'rgba(0,0,0,0.06)'}`,
                  }}>{ut}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div><label style={labelStyle}>Min. Preis (€)</label><input type="number" className="input-glass" style={{ width: '100%' }} value={dealRadarCriteria.priceMin} onChange={e => updateRadarCriteria({ priceMin: parseInt(e.target.value) || 0 })} /></div>
            <div><label style={labelStyle}>Max. Preis (€)</label><input type="number" className="input-glass" style={{ width: '100%' }} value={dealRadarCriteria.priceMax} onChange={e => updateRadarCriteria({ priceMax: parseInt(e.target.value) || 0 })} /></div>
            <div><label style={labelStyle}>Min. Fläche (m²)</label><input type="number" className="input-glass" style={{ width: '100%' }} value={dealRadarCriteria.minArea} onChange={e => updateRadarCriteria({ minArea: parseInt(e.target.value) || 0 })} /></div>
            <div><label style={labelStyle}>Max. Fläche (m²)</label><input type="number" className="input-glass" style={{ width: '100%' }} value={dealRadarCriteria.maxArea} onChange={e => updateRadarCriteria({ maxArea: parseInt(e.target.value) || 0 })} /></div>
          </div>
        </GlassPanel>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-xl flex items-center gap-3" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
          <AlertTriangle size={14} color="#f87171" />
          <span style={{ fontSize: 13, color: '#f87171', flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={12} /></button>
        </div>
      )}

      {/* Filter tabs */}
      {dealRadarListings.length > 0 && (
        <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ background: 'rgba(0,0,0,0.03)', display: 'inline-flex' }}>
          {[{ key: 'all', label: lang === 'de' ? 'Alle' : 'All', count: dealRadarListings.length },
            { key: 'new', label: lang === 'de' ? 'Neu' : 'New', count: dealRadarListings.filter(l => l.status === 'new').length },
            { key: 'shortlisted', label: lang === 'de' ? 'Vorgemerkt' : 'Shortlisted', count: dealRadarListings.filter(l => l.status === 'shortlisted').length },
            { key: 'dismissed', label: lang === 'de' ? 'Abgelehnt' : 'Dismissed', count: dealRadarListings.filter(l => l.status === 'dismissed').length },
            { key: 'converted', label: lang === 'de' ? 'Übernommen' : 'Converted', count: dealRadarListings.filter(l => l.status === 'converted').length },
          ].map(tab => (
            <button key={tab.key} onClick={() => setFilterStatus(tab.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: filterStatus === tab.key ? 'rgba(0,122,255,0.12)' : 'transparent', color: filterStatus === tab.key ? '#007aff' : 'rgba(60,60,67,0.55)', border: '1px solid transparent', cursor: 'pointer' }}>
              {tab.label} {tab.count > 0 && <span style={{ fontSize: 10, opacity: 0.7 }}>({tab.count})</span>}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-6">
        {/* Listings grid */}
        <div style={{ flex: selectedListing ? '0 0 55%' : 1 }}>
          {filtered.length === 0 ? (
            <GlassPanel style={{ padding: 48, textAlign: 'center' }}>
              <Radar size={36} color="rgba(60,60,67,0.25)" />
              <div style={{ fontSize: 14, color: 'rgba(60,60,67,0.50)', marginTop: 16, maxWidth: 400, margin: '16px auto 0', lineHeight: 1.6 }}>{t('radar.noResults')}</div>
              <button onClick={handleSearch} disabled={searching} className="btn-accent px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 mx-auto mt-5" style={{ cursor: searching ? 'wait' : 'pointer' }}>
                {searching ? <RefreshCw size={14} className="animate-spin" /> : <Radar size={14} />}
                {searching ? t('radar.searching') : t('radar.search')}
              </button>
            </GlassPanel>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {filtered.map(listing => {
                const st = STATUS_STYLES[listing.status];
                return (
                  <div key={listing.id} onClick={() => setSelectedId(listing.id === selectedId ? null : listing.id)}
                    className="glass-card glass-hover"
                    style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', border: listing.id === selectedId ? '2px solid #007aff' : '1px solid rgba(0,0,0,0.06)' }}>
                    <div style={{ padding: '16px 18px 12px' }}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1c1c1e', lineHeight: 1.3, flex: 1 }}>{listing.title}</div>
                        <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: st.bg, color: st.color, border: `1px solid ${st.border}`, whiteSpace: 'nowrap' }}>
                          {lang === 'de' ? st.label_de : st.label_en}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)', marginBottom: 8 }}>{listing.city}{listing.address ? ` · ${listing.address}` : ''}</div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <div><span style={{ fontSize: 10, color: 'rgba(60,60,67,0.40)', textTransform: 'uppercase' }}>Asking Price</span><div style={{ fontSize: 15, fontWeight: 700, color: '#007aff' }}>{formatEUR(listing.askingPrice, true)}</div></div>
                        <div><span style={{ fontSize: 10, color: 'rgba(60,60,67,0.40)', textTransform: 'uppercase' }}>{lang === 'de' ? 'Fläche' : 'Area'}</span><div style={{ fontSize: 14, fontWeight: 600, color: '#1c1c1e' }}>{listing.totalArea.toLocaleString()} m²</div></div>
                        <div><span style={{ fontSize: 10, color: 'rgba(60,60,67,0.40)', textTransform: 'uppercase' }}>€/m²</span><div style={{ fontSize: 13, fontWeight: 600, color: '#1c1c1e' }}>{formatEUR(listing.pricePerSqm)}</div></div>
                        {listing.estimatedYield ? (
                          <div><span style={{ fontSize: 10, color: 'rgba(60,60,67,0.40)', textTransform: 'uppercase' }}>Est. Yield</span><div style={{ fontSize: 13, fontWeight: 600, color: listing.estimatedYield > 4.5 ? '#4ade80' : '#fbbf24' }}>{listing.estimatedYield.toFixed(1)}%</div></div>
                        ) : null}
                      </div>
                    </div>
                    <div style={{ padding: '8px 18px', borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="badge-neutral" style={{ fontSize: 10 }}>{listing.usageType}</span>
                      <span style={{ fontSize: 10, color: 'rgba(60,60,67,0.40)' }}>{listing.sourceLabel}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedListing && (
          <div style={{ flex: '0 0 42%' }} className="animate-fade-in">
            <GlassPanel style={{ padding: 24, position: 'sticky', top: 24 }}>
              <div className="flex items-center justify-between mb-4">
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1c1c1e', lineHeight: 1.3 }}>{selectedListing.title}</div>
                <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
              </div>

              <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.55)', marginBottom: 16 }}>{selectedListing.address}{selectedListing.address && ', '}{selectedListing.city} {selectedListing.zip}</div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-3 rounded-xl" style={{ background: 'rgba(0,122,255,0.05)' }}>
                  <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase' }}>Asking Price</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#007aff' }}>{formatEUR(selectedListing.askingPrice, true)}</div>
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                  <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase' }}>{lang === 'de' ? 'Fläche' : 'Area'}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#1c1c1e' }}>{selectedListing.totalArea.toLocaleString()} m²</div>
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                  <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase' }}>€/m²</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1c1c1e' }}>{formatEUR(selectedListing.pricePerSqm)}</div>
                </div>
                {selectedListing.estimatedYield ? (
                  <div className="p-3 rounded-xl" style={{ background: selectedListing.estimatedYield > 4.5 ? 'rgba(74,222,128,0.08)' : 'rgba(251,191,36,0.08)' }}>
                    <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase' }}>Est. NIY</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: selectedListing.estimatedYield > 4.5 ? '#4ade80' : '#fbbf24' }}>{selectedListing.estimatedYield.toFixed(1)}%</div>
                  </div>
                ) : null}
              </div>

              <div className="flex gap-2 mb-4">
                <span className="badge-neutral">{selectedListing.usageType}</span>
                {selectedListing.yearBuilt && <span className="badge-neutral">{lang === 'de' ? 'Bj.' : 'Built'} {selectedListing.yearBuilt}</span>}
                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: STATUS_STYLES[selectedListing.status].bg, color: STATUS_STYLES[selectedListing.status].color }}>{lang === 'de' ? STATUS_STYLES[selectedListing.status].label_de : STATUS_STYLES[selectedListing.status].label_en}</span>
              </div>

              {/* Description */}
              <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.70)', lineHeight: 1.6, marginBottom: 16 }}>{selectedListing.description}</div>

              {/* AI Assessment */}
              {selectedListing.aiNotes && (
                <div className="p-3 rounded-xl mb-4" style={{ background: 'rgba(0,122,255,0.05)', border: '1px solid rgba(0,122,255,0.12)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Bot size={13} color="#007aff" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#007aff' }}>{t('radar.aiAssessment')}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.70)', lineHeight: 1.5 }}>{selectedListing.aiNotes}</div>
                </div>
              )}

              {/* Source */}
              <div className="flex items-center gap-2 mb-6">
                <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>{t('radar.source')}: {selectedListing.sourceLabel}</span>
                {selectedListing.sourceUrl && (
                  <a href={selectedListing.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#007aff', display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}>
                    {lang === 'de' ? 'Zum Angebot' : 'View Listing'} <ExternalLink size={10} />
                  </a>
                )}
              </div>

              {/* Action buttons */}
              {selectedListing.status !== 'converted' && selectedListing.status !== 'dismissed' && (
                <div className="flex gap-3">
                  <button onClick={() => convertToAcquisition(selectedListing.id)}
                    className="btn-accent px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 flex-1 justify-center" style={{ cursor: 'pointer' }}>
                    <ArrowRight size={14} /> {t('radar.convert')}
                  </button>
                  <button onClick={() => updateRadarListing(selectedListing.id, { status: 'shortlisted', reviewedAt: new Date().toISOString() })}
                    className="btn-glass px-4 py-2.5 rounded-xl text-sm flex items-center gap-2" style={{ cursor: 'pointer', color: '#4ade80' }}>
                    <Target size={14} /> {t('radar.shortlist')}
                  </button>
                  <button onClick={() => dismissRadarListing(selectedListing.id)}
                    className="btn-glass px-4 py-2.5 rounded-xl text-sm flex items-center gap-2" style={{ cursor: 'pointer', color: '#f87171' }}>
                    <ThumbsDown size={14} /> {t('radar.dismiss')}
                  </button>
                </div>
              )}
              {selectedListing.status === 'converted' && (
                <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#a78bfa' }}>{lang === 'de' ? '✓ In Acquisition Pipeline übernommen' : '✓ Added to Acquisition Pipeline'}</span>
                </div>
              )}
              {selectedListing.status === 'dismissed' && (
                <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(248,113,113,0.06)' }}>
                  <span style={{ fontSize: 13, color: '#f87171' }}>{lang === 'de' ? 'Abgelehnt' : 'Dismissed'}{selectedListing.reviewNote ? ` — ${selectedListing.reviewNote}` : ''}</span>
                </div>
              )}
            </GlassPanel>
          </div>
        )}
      </div>
    </div>
  );
}

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
  const dateLocale = lang === 'de' ? 'de-DE' : 'en-GB';
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
    } catch (err: any) {
      setError(err.message);
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

// ══════════════════════════════════════════════════════════
// SETTINGS PAGE
// ══════════════════════════════════════════════════════════
export function SettingsPage() {
  const { resetToMockData, settings, updateSettings } = useStore();
  const { t, lang } = useLanguage();

  return (
    <div className="p-8 max-w-[900px] mx-auto">
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <div className="space-y-6">

        {/* ── Hold/Sell & IRR ── */}
        <GlassPanel style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1c1c1e', marginBottom: 4 }}>{t('settings.holdSell')}</div>
          <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.45)', marginBottom: 20 }}>
            {t('settings.holdSellDesc')}
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {t('settings.hurdleRate')}
              </label>
              <input
                type="number"
                className="input-glass"
                value={settings.hurrleRate}
                min={1} max={50} step={0.5}
                onChange={e => updateSettings({ hurrleRate: parseFloat(e.target.value) || 15 })}
              />
              <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.40)', marginTop: 4 }}>
                {settings.hurrleRate}%
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {t('settings.taxRate')}
              </label>
              <input
                type="number"
                className="input-glass"
                value={settings.taxRate}
                min={0} max={50} step={1}
                onChange={e => updateSettings({ taxRate: parseFloat(e.target.value) || 25 })}
              />
              <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.40)', marginTop: 4 }}>
                {settings.taxRate}%
              </div>
            </div>
          </div>
        </GlassPanel>

        {/* ── Advisor Language ── */}
        <GlassPanel style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1c1c1e', marginBottom: 4 }}>{t('settings.constructionAdvisor')}</div>
          <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.45)', marginBottom: 16 }}>{t('settings.advisorDesc')}</div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{t('settings.language')}</label>
            <select className="input-glass" style={{ width: 200 }} value={settings.advisorLanguage} onChange={e => updateSettings({ advisorLanguage: e.target.value as 'de' | 'en' })}>
              <option value="de">Deutsch</option>
              <option value="en">English</option>
            </select>
          </div>
        </GlassPanel>

        {/* ── KPI Thresholds ── */}
        <GlassPanel style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1c1c1e', marginBottom: 4 }}>{t('settings.kpiThresholds')}</div>
          <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.45)', marginBottom: 20 }}>{t('settings.kpiThresholdsDesc')}</div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Min. DSCR', key: 'minDSCR', unit: 'x', step: 0.05 },
              { label: 'Max. LTV', key: 'maxLTV', unit: '%', step: 1 },
              { label: 'Target NIY', key: 'targetNIY', unit: '%', step: 0.1 },
              { label: 'Exit Multiplier', key: 'defaultExitMultiplier', unit: 'x', step: 0.5 },
            ].map(field => (
              <div key={field.key}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {field.label} ({field.unit})
                </label>
                <input
                  type="number"
                  className="input-glass"
                  value={(settings as any)[field.key]}
                  step={field.step}
                  onChange={e => updateSettings({ [field.key]: parseFloat(e.target.value) || 0 } as any)}
                />
                <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.40)', marginTop: 3 }}>
                  {(settings as any)[field.key]}{field.unit}
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>

        {/* ── Marktannahmen ── */}
        <GlassPanel style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1c1c1e', marginBottom: 4 }}>
            {lang === 'de' ? 'Marktannahmen & DCF-Parameter' : 'Market Assumptions & DCF Parameters'}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.45)', marginBottom: 20 }}>
            {lang === 'de'
              ? 'Standardwerte für Exit-Cap-Rates und Mietwachstum nach Nutzungsart. Werden beim Anlegen neuer Deals und beim Überführen in den Bestand verwendet.'
              : 'Default values for exit cap rates and rent growth by usage type. Used when creating new deals and transferring to portfolio.'}
          </div>
          <div style={{ marginBottom: 20 }}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {lang === 'de' ? 'Standard-Haltedauer (Jahre)' : 'Default Holding Period (yrs)'}
                </label>
                <input type="number" className="input-glass" value={settings.defaultHoldingPeriod ?? 10} min={1} max={30} step={1}
                  onChange={e => updateSettings({ defaultHoldingPeriod: parseInt(e.target.value) || 10 } as any)} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {lang === 'de' ? 'Standard-Baukostenpuffer (%)' : 'Default Contingency (%)'}
                </label>
                <input type="number" className="input-glass" value={settings.defaultContingencyPercent ?? 10} min={0} max={50} step={1}
                  onChange={e => updateSettings({ defaultContingencyPercent: parseFloat(e.target.value) || 10 } as any)} />
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(60,60,67,0.50)', marginBottom: 12, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {lang === 'de' ? 'Exit-Cap-Rate nach Nutzungsart (%)' : 'Exit Cap Rate by Usage Type (%)'}
          </div>
          <div className="grid grid-cols-5 gap-3 mb-6">
            {['Wohnen', 'Büro', 'Einzelhandel', 'Logistik', 'Mixed Use'].map(ut => (
              <div key={ut}>
                <label style={{ fontSize: 10, fontWeight: 600, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 4 }}>{ut}</label>
                <input type="number" step="0.1" className="input-glass"
                  value={(settings.defaultExitCapRates ?? {})[ut] ?? 5.0}
                  onChange={e => updateSettings({ defaultExitCapRates: { ...(settings.defaultExitCapRates ?? {}), [ut]: parseFloat(e.target.value) || 5 } } as any)} />
                <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.40)', marginTop: 2 }}>
                  = {(100 / ((settings.defaultExitCapRates ?? {})[ut] || 5)).toFixed(1)}x
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(60,60,67,0.50)', marginBottom: 12, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {lang === 'de' ? 'ERV-Wachstum nach Nutzungsart (% p.a.)' : 'ERV Growth Rate by Usage Type (% p.a.)'}
          </div>
          <div className="grid grid-cols-5 gap-3">
            {['Wohnen', 'Büro', 'Einzelhandel', 'Logistik', 'Mixed Use'].map(ut => (
              <div key={ut}>
                <label style={{ fontSize: 10, fontWeight: 600, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 4 }}>{ut}</label>
                <input type="number" step="0.1" className="input-glass"
                  value={(settings.defaultErvGrowthRates ?? {})[ut] ?? 2.0}
                  onChange={e => updateSettings({ defaultErvGrowthRates: { ...(settings.defaultErvGrowthRates ?? {}), [ut]: parseFloat(e.target.value) || 2 } } as any)} />
              </div>
            ))}
          </div>
        </GlassPanel>

        {/* ── Default Operating Costs ── */}
        <GlassPanel style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1c1c1e', marginBottom: 4 }}>{lang === 'de' ? 'Standard-Betriebskosten' : 'Default Operating Costs'}</div>
          <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.45)', marginBottom: 20 }}>{lang === 'de' ? 'Voreinstellungen für neue Assets und Deals. Können pro Objekt überschrieben werden.' : 'Defaults for new assets and deals. Can be overridden per object.'}</div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Vacancy Rate', key: 'defaultVacancyRate', unit: '%', step: 0.5 },
              { label: 'Management Cost', key: 'defaultMgmtCostPct', unit: '%', step: 0.5 },
              { label: 'Maintenance Reserve', key: 'defaultMaintenancePerSqm', unit: '€/m²', step: 1 },
              { label: 'Closing Costs', key: 'defaultClosingCostPct', unit: '%', step: 0.5 },
              { label: 'Broker Fee', key: 'defaultBrokerFeePct', unit: '%', step: 0.5 },
            ].map(field => (
              <div key={field.key}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {field.label} ({field.unit})
                </label>
                <input type="number" className="input-glass" value={(settings as any)[field.key]} step={field.step}
                  onChange={e => updateSettings({ [field.key]: parseFloat(e.target.value) || 0 } as any)} />
              </div>
            ))}
          </div>
        </GlassPanel>

        {/* ── Market Defaults (neue Felder) ── */}
        <GlassPanel style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1c1c1e', marginBottom: 4 }}>
            {t('settings.marketDefaults')}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.45)', marginBottom: 20 }}>
            {t('settings.marketDefaultsDesc')}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {t('settings.defaultOpexInflation')}
              </label>
              <div className="flex items-center gap-2">
                <input type="number" className="input-glass" step={0.1} min={0} max={10}
                  value={(settings as any).defaultOpexInflation ?? 2.0}
                  onChange={e => updateSettings({ defaultOpexInflation: parseFloat(e.target.value) || 2 } as any)} />
                <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.50)' }}>{(settings as any).defaultOpexInflation ?? 2.0}%</span>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {t('settings.defaultCapexInflation')}
              </label>
              <div className="flex items-center gap-2">
                <input type="number" className="input-glass" step={0.1} min={0} max={10}
                  value={(settings as any).defaultCapexInflation ?? 3.0}
                  onChange={e => updateSettings({ defaultCapexInflation: parseFloat(e.target.value) || 3 } as any)} />
                <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.50)' }}>{(settings as any).defaultCapexInflation ?? 3.0}%</span>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {t('settings.defaultSalesCostPct')}
              </label>
              <div className="flex items-center gap-2">
                <input type="number" className="input-glass" step={0.1} min={0} max={10}
                  value={(settings as any).defaultSalesCostPercent ?? 1.5}
                  onChange={e => updateSettings({ defaultSalesCostPercent: parseFloat(e.target.value) || 1.5 } as any)} />
                <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.50)' }}>{(settings as any).defaultSalesCostPercent ?? 1.5}%</span>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {t('settings.defaultAcquisitionCosts')}
              </label>
              <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.55)', paddingTop: 6 }}>
                {lang === 'de'
                  ? 'Grunderwerbsteuer, Notar, Grundbuch — per Deal anpassbar im Acquisition Wizard.'
                  : 'Land transfer tax, notary, land register — adjustable per deal in the Acquisition Wizard.'}
              </div>
            </div>
          </div>
        </GlassPanel>

        {/* ── Static info panels ── */}
        {[
          { title: 'Covenant Settings', desc: lang === 'de' ? 'Schwellenwerte für automatische Warnungen und Breach-Alerts.' : 'Thresholds for automatic warnings and breach alerts.', items: ['Warning buffer: 5%', 'Check frequency: Quarterly', 'Notification: Portfolio Manager'] },
          { title: 'Export Templates', desc: lang === 'de' ? 'Investment Memo, Lender Package und Excel-Exporte.' : 'Investment Memo, Lender Package and Excel exports.', items: ['PDF: Investment Memo v2.1', 'Excel: Lender Package', 'PDF: Deal Summary A4', 'PDF: Gantt Export'] },
          { title: 'AI Governance', desc: lang === 'de' ? 'Regeln für KI-Nutzung und Empfehlungs-Freigabe.' : 'Rules for AI usage and recommendation approval.', items: [lang === 'de' ? 'Menschliche Freigabe: Pflicht' : 'Human approval: Required', 'Max. deviation without alert: 5%', 'Audit trail: Active', lang === 'de' ? 'KI als Source of Truth: Verboten' : 'AI as Source of Truth: Prohibited'] },
          { title: 'Data Freshness', desc: lang === 'de' ? 'Maximales Alter von Markt-Benchmarks und Bewertungen.' : 'Maximum age of market benchmarks and valuations.', items: [lang === 'de' ? 'Marktdaten: max. 90 Tage' : 'Market data: max. 90 days', lang === 'de' ? 'Bewertungen: max. 12 Monate' : 'Valuations: max. 12 months', lang === 'de' ? 'CF-Forecast: Quartalsmäßig' : 'CF Forecast: Quarterly'] },
        ].map(section => (
          <GlassPanel key={section.title} style={{ padding: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1c1c1e', marginBottom: 4 }}>{section.title}</div>
            <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.45)', marginBottom: 16 }}>{section.desc}</div>
            <div className="grid grid-cols-2 gap-2">
              {section.items.map(item => (
                <div key={item} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.03)' }}>
                  <CheckCircle size={12} color="#34c759" />
                  <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.70)' }}>{item}</span>
                </div>
              ))}
            </div>
          </GlassPanel>
        ))}

        {/* ── Reset ── */}
        <GlassPanel style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#cc1a14', marginBottom: 4 }}>{t('settings.resetTitle')}</div>
          <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.45)', marginBottom: 16 }}>
            {t('settings.resetDesc')}
          </div>
          <button
            onClick={resetToMockData}
            style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.18)', borderRadius: 12, cursor: 'pointer', padding: '8px 16px', fontSize: 13, fontWeight: 600, color: '#cc1a14' }}
          >
            {t('settings.resetButton')}
          </button>
        </GlassPanel>
      </div>
    </div>
  );
}
