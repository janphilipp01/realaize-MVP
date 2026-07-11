import React, { useState, useRef, useMemo } from 'react';
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
import { bestSignal, discountTone } from '../utils/screening';
import { benchmarksToScreeningSeeds } from '../utils/marketIntelligence';
import { MarketIntelligencePanel } from './MarketIntelligence';
import { CURRENT_PERIOD } from '../data/marketIntelData';
import type { CandidateDeal, ProfileMatch } from '../models/types';
import { screenValueAdd, BUILD_COST_RATES, SCOPE_LABEL, DEFAULT_SCREEN_PROFILE, resolveExitYieldBuffer, EXIT_BUFFER_PRIME, type RenovationScope } from '../utils/valueAddScreening';
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
  const { t, lang } = useLanguage();
  const benchmarks = useStore(s => s.benchmarks);
  const refreshJobs = useStore(s => s.refreshJobs);
  const triggerRefresh = useStore(s => s.triggerQuarterlyRefresh);
  const dateLocale = lang === 'de' ? 'de-DE' : 'en-GB';

  const REVIEWER = 'J. Pleuker';
  const [refreshing, setRefreshing] = useState(false);
  const lastJob = refreshJobs[0];

  // Region label per city (for the tile subtitle), derived from the master list.
  const regionByCity = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of GERMAN_TOP_CITIES) m[c.city] = c.region;
    return m;
  }, []);

  const CLASS_LABEL: Record<string, string> = {
    residential: 'Residential', office: 'Office', retail: 'Retail',
    logistics: 'Logistics', mixed_use: 'Mixed Use',
  };
  const CLASS_COLOR: Record<string, string> = {
    residential: '96,165,250', office: '201,169,110', retail: '248,113,113',
    logistics: '74,222,128', mixed_use: '167,139,250',
  };

  // Primary hubs (first row) and their catchment submarkets (expandable below).
  // A region hub (isRegion) has no own data — it aggregates its member cities.
  const CITY_GROUPS: { city: string; submarkets: string[]; isRegion?: boolean }[] = [
    { city: 'Düsseldorf', submarkets: ['Neuss', 'Meerbusch', 'Ratingen', 'Erkrath', 'Hilden'] },
    { city: 'Köln', submarkets: ['Langenfeld', 'Leverkusen', 'Bonn'] },
    { city: 'Berlin', submarkets: [] },
    { city: 'Hamburg', submarkets: [] },
    { city: 'München', submarkets: [] },
    { city: 'Ruhrgebiet', isRegion: true, submarkets: ['Duisburg', 'Essen', 'Dortmund', 'Bochum', 'Oberhausen', 'Mülheim an der Ruhr', 'Gelsenkirchen'] },
  ];

  type CityStat = { city: string; classes: string[]; total: number; extracted: number; pending: number; avgConf: number };

  // Per-city summary derived from the benchmark master.
  const statByCity = useMemo(() => {
    const map = new Map<string, CityStat & { confSum: number }>();
    for (const b of benchmarks) {
      if (b.sourceType === 'portfolio_realised') continue;
      let e = map.get(b.city);
      if (!e) { e = { city: b.city, classes: [], total: 0, extracted: 0, pending: 0, confSum: 0, avgConf: 0 }; map.set(b.city, e); }
      e.total++;
      if (!e.classes.includes(b.assetClass)) e.classes.push(b.assetClass);
      if (b.sourceType === 'extracted_report') { e.extracted++; e.confSum += b.confidenceScore; }
      if (b.validationStatus === 'pending') e.pending++;
    }
    const out = new Map<string, CityStat>();
    for (const [k, e] of map) out.set(k, { city: e.city, classes: e.classes, total: e.total, extracted: e.extracted, pending: e.pending, avgConf: e.extracted ? e.confSum / e.extracted : 0 });
    return out;
  }, [benchmarks]);

  // Cities with data that aren't part of a hub group (e.g. Essen, Bochum).
  const groupedCities = new Set(CITY_GROUPS.flatMap(g => [g.city, ...g.submarkets]));
  const otherCities = Array.from(statByCity.keys())
    .filter(c => !groupedCities.has(c))
    .sort((a, b) => (statByCity.get(b)!.total - statByCity.get(a)!.total) || a.localeCompare(b));

  const parentOf = (city: string) => CITY_GROUPS.find(g => g.city === city || g.submarkets.includes(city))?.city ?? null;

  // Region hub summary = aggregate of its member cities.
  const aggregateStat = (members: string[]): CityStat | undefined => {
    const sts = members.map(m => statByCity.get(m)).filter((s): s is CityStat => !!s);
    if (sts.length === 0) return undefined;
    const classes: string[] = [];
    let total = 0, extracted = 0, pending = 0, confWeighted = 0;
    for (const s of sts) {
      total += s.total; extracted += s.extracted; pending += s.pending;
      confWeighted += s.avgConf * s.extracted;
      for (const c of s.classes) if (!classes.includes(c)) classes.push(c);
    }
    return { city: 'Ruhrgebiet', classes, total, extracted, pending, avgConf: extracted ? confWeighted / extracted : 0 };
  };
  const firstMember = (members: string[]) =>
    members.slice().sort((a, b) => (statByCity.get(b)?.extracted ?? 0) - (statByCity.get(a)?.extracted ?? 0))[0] ?? members[0];

  const [selectedCity, setSelectedCity] = useState<string>('Düsseldorf');
  // Which hub group is expanded to reveal its submarkets (accordion). Collapsed
  // by default — the per-tile button below drives expansion.
  const [expandedHub, setExpandedHub] = useState<string | null>(null);

  const handleRefresh = () => {
    setRefreshing(true);
    // Mirrors the Quarterly Refresh Job — manual override path.
    setTimeout(() => { triggerRefresh(REVIEWER); setRefreshing(false); }, 1100);
  };

  // A single white city tile (hub = first row, sub = catchment submarket).
  const renderTile = (city: string, variant: 'hub' | 'sub') => {
    const group = CITY_GROUPS.find(g => g.city === city);
    const isRegion = variant === 'hub' && !!group?.isRegion;
    const st = isRegion ? aggregateStat(group!.submarkets) : statByCity.get(city);
    // A hub is "active" when the selection is anywhere in its group.
    const active = variant === 'hub' && group
      ? (selectedCity === city || group.submarkets.includes(selectedCity))
      : selectedCity === city;
    const isExpanded = expandedHub === city;
    const onOpen = () => {
      // Selection only; expansion is driven by the button under the selected hub.
      if (variant === 'hub') {
        if (isRegion) {
          if (!group!.submarkets.includes(selectedCity)) setSelectedCity(firstMember(group!.submarkets));
        } else {
          setSelectedCity(city);
        }
        setExpandedHub(null); // collapse on hub select; button re-expands
      } else {
        setSelectedCity(city);
      }
    };
    return (
      <button
        key={city}
        onClick={onOpen}
        style={{
          textAlign: 'left', cursor: 'pointer', borderRadius: 14,
          padding: variant === 'hub' ? '12px 14px' : '10px 12px',
          height: variant === 'hub' ? 86 : 66,
          width: '100%',
          background: '#ffffff',
          border: active ? '1.5px solid #0a6cff' : '1px solid rgba(0,0,0,0.08)',
          boxShadow: active ? '0 0 0 3px rgba(0,122,255,0.10)' : '0 1px 2px rgba(0,0,0,0.04)',
          transition: 'border-color 0.12s, box-shadow 0.12s',
          overflow: 'hidden',
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: variant === 'hub' ? 15 : 13, fontWeight: 700, color: '#1c1c1e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{city}</div>
            {variant === 'hub' && <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>{isRegion ? `${group!.submarkets.length} ${lang === 'de' ? 'Städte' : 'cities'}` : (regionByCity[city] ?? '—')}</div>}
          </div>
          {st && st.pending > 0 && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 999, background: 'rgba(255,149,0,0.16)', color: '#c2750a', whiteSpace: 'nowrap' }}>
              {st.pending} {lang === 'de' ? 'offen' : 'pending'}
            </span>
          )}
        </div>
        {st ? (
          <div className="flex flex-nowrap gap-1 mt-2" style={{ overflow: 'hidden' }}>
            {st.classes.map(cl => (
              <span key={cl} className="badge-neutral" style={{ fontSize: 9, padding: '1px 6px', whiteSpace: 'nowrap', background: `rgba(${CLASS_COLOR[cl] ?? '120,120,128'},0.12)` }}>
                {CLASS_LABEL[cl] ?? cl}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.4)', marginTop: 8 }}>{lang === 'de' ? 'Keine Daten' : 'No data'}</div>
        )}
      </button>
    );
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>{t('market.title')}</h1>
          <p style={{ fontSize: 13, color: 'rgba(60,60,67,0.6)', marginTop: 6, maxWidth: 720 }}>
            {lang === 'de'
              ? 'Quelle-attribuierter, multi-broker-validierter Marktdaten-Layer. Stadt wählen für Benchmarks, Review, News, Cross-Validation, IC-Memo und Quellen.'
              : 'Source-attributed, multi-broker-validated market data layer. Select a city for benchmarks, review, news, cross-validation, IC memo and sources.'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(0,122,255,0.10)', color: '#0a6cff' }}>{CURRENT_PERIOD}</span>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn-accent px-4 py-2 rounded-xl text-sm flex items-center gap-2"
              style={{ opacity: refreshing ? 0.7 : 1, cursor: refreshing ? 'default' : 'pointer' }}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              {refreshing
                ? lang === 'de' ? 'Aktualisiere…' : 'Refreshing…'
                : lang === 'de' ? 'Quartals-Refresh starten' : 'Start Quarterly Refresh'}
            </button>
          </div>
          {lastJob && (
            <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.5)' }}>
              {lang === 'de' ? 'Letzter Lauf' : 'Last run'}:{' '}
              {new Date(lastJob.triggeredAt).toLocaleDateString(dateLocale)} ·{' '}
              {lastJob.trigger} · {lastJob.reportsFetched} reports
            </div>
          )}
        </div>
      </div>

      {/* ── Primary hubs (first row) — each with an expand button below ── */}
      <div className="grid gap-4 mb-4 items-start" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        {CITY_GROUPS.map(g => {
          const hasSubs = g.submarkets.length > 0;
          const activeHub = selectedCity === g.city || g.submarkets.includes(selectedCity);
          const isExpanded = expandedHub === g.city;
          return (
            <div key={g.city} className="flex flex-col" style={{ gap: 8 }}>
              {renderTile(g.city, 'hub')}
              {hasSubs && activeHub && (
                <button
                  onClick={() => setExpandedHub(isExpanded ? null : g.city)}
                  className="flex items-center justify-center gap-1.5"
                  style={{
                    padding: '7px 10px', borderRadius: 10, cursor: 'pointer',
                    border: `1px solid ${isExpanded ? 'rgba(0,122,255,0.35)' : 'rgba(0,0,0,0.08)'}`,
                    background: isExpanded ? 'rgba(0,122,255,0.10)' : '#ffffff',
                    color: isExpanded ? '#0a6cff' : 'rgba(60,60,67,0.7)',
                    fontSize: 11, fontWeight: 700,
                  }}
                >
                  {isExpanded
                    ? (lang === 'de' ? 'Einklappen' : 'Collapse')
                    : (g.isRegion
                        ? (lang === 'de' ? `${g.submarkets.length} Städte anzeigen` : `Show ${g.submarkets.length} cities`)
                        : (lang === 'de' ? `${g.submarkets.length} Sub-Märkte anzeigen` : `Show ${g.submarkets.length} submarkets`))}
                  <ChevronDown size={13} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Expanded hub · catchment submarkets / member cities ── */}
      {(() => {
        const g = CITY_GROUPS.find(x => x.city === expandedHub);
        if (!g || g.submarkets.length === 0) return null;
        const activeHub = selectedCity === g.city || g.submarkets.includes(selectedCity);
        if (!activeHub) return null;
        const label = g.isRegion ? (lang === 'de' ? 'Städte' : 'Cities') : (lang === 'de' ? 'Sub-Märkte' : 'Submarkets');
        return (
          <div className="mb-6" style={{ paddingLeft: 2 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(60,60,67,0.45)', marginBottom: 8 }}>
              {label} · {expandedHub}
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
              {g.submarkets.map(s => renderTile(s, 'sub'))}
            </div>
          </div>
        );
      })()}

      {/* ── Further markets (not part of a hub) ── */}
      {otherCities.length > 0 && (
        <div className="mb-8">
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(60,60,67,0.45)', marginBottom: 8 }}>
            {lang === 'de' ? 'Weitere Märkte' : 'Further markets'}
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {otherCities.map(c => renderTile(c, 'sub'))}
          </div>
        </div>
      )}

      {/* ── Selected city · Market Intelligence panel ── */}
      {(() => {
        const st = statByCity.get(selectedCity);
        const sub = regionByCity[selectedCity]
          ?? (parentOf(selectedCity) && parentOf(selectedCity) !== selectedCity
            ? (lang === 'de' ? `Sub-Markt · ${parentOf(selectedCity)}` : `Submarket · ${parentOf(selectedCity)}`)
            : '');
        return (
          <div className="animate-fade-in">
            <div className="flex items-end justify-between gap-4 mb-4 flex-wrap">
              <div className="flex items-baseline gap-3">
                <h2 style={{ fontSize: 20, fontWeight: 700 }}>{selectedCity}</h2>
                <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.45)' }}>{sub}</span>
              </div>
              {st && (
                <div className="flex items-center flex-wrap" style={{ gap: 20 }}>
                  <MiniStat label={lang === 'de' ? 'Reconciled' : 'Reconciled'} value={String(st.extracted)} sub={`${st.total} ${lang === 'de' ? 'gesamt' : 'total'}`} />
                  <MiniStat label={lang === 'de' ? 'Abdeckung' : 'Coverage'} value={String(st.classes.length)} sub={lang === 'de' ? 'Klassen' : 'classes'} />
                  <MiniStat label={lang === 'de' ? 'Review offen' : 'Pending'} value={String(st.pending)} sub={lang === 'de' ? 'Freigabe' : 'approval'} accent={st.pending > 0 ? '#c2750a' : undefined} />
                  <MiniStat label={lang === 'de' ? 'Ø Konfidenz' : 'Avg conf.'} value={st.avgConf > 0 ? st.avgConf.toFixed(2) : '—'} sub={lang === 'de' ? 'extrahiert' : 'extracted'} accent="#1f9d4d" />
                </div>
              )}
            </div>
            <MarketIntelligencePanel key={selectedCity} city={selectedCity} />
          </div>
        );
      })()}
    </div>
  );
}

// Compact stat shown inline next to the selected-city title on the Markt page.
function MiniStat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ textAlign: 'right', minWidth: 56 }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(60,60,67,0.45)' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.15, color: accent ?? '#1d1d1f', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: 'rgba(60,60,67,0.4)' }}>{sub}</div>}
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

const SIGNAL_COLORS = { green: '#34C759', amber: '#FF9500', red: '#FF3B30', gray: 'rgba(60,60,67,0.5)' } as const;

const CAND_STATUS_STYLES: Record<string, { bg: string; color: string; label_de: string; label_en: string }> = {
  new: { bg: 'rgba(0,122,255,0.10)', color: '#007aff', label_de: 'Neu', label_en: 'New' },
  matched: { bg: 'rgba(0,122,255,0.10)', color: '#007aff', label_de: 'Neu', label_en: 'New' },
  shortlisted: { bg: 'rgba(52,199,89,0.12)', color: '#34C759', label_de: 'Vorgemerkt', label_en: 'Shortlisted' },
  rejected: { bg: 'rgba(255,59,48,0.10)', color: '#FF3B30', label_de: 'Abgelehnt', label_en: 'Rejected' },
  promoted: { bg: 'rgba(88,86,214,0.12)', color: '#5856D6', label_de: 'Übernommen', label_en: 'Promoted' },
  unmatched: { bg: 'rgba(0,0,0,0.05)', color: 'rgba(60,60,67,0.5)', label_de: 'Kein Match', label_en: 'No match' },
  inactive: { bg: 'rgba(0,0,0,0.05)', color: 'rgba(60,60,67,0.4)', label_de: 'Inaktiv', label_en: 'Inactive' },
  pending_extraction: { bg: 'rgba(255,204,0,0.18)', color: '#8C7654', label_de: 'In Bearbeitung', label_en: 'Pending' },
};

const SOURCE_COLORS: Record<string, string> = {
  platform_immoscout: '#007aff',
  platform_immowelt: '#007aff',
  broker_crawl: '#5856D6',
  inbox: '#34C759',
  manual_upload: 'rgba(60,60,67,0.55)',
};

const REJECT_REASONS = ['price too high', 'wrong submarket', 'stock condition', 'broker quality', 'timing', 'regulatory', 'other'];

// Strongest match drives the card's headline numbers (green preferred, then amber).
function primaryMatch(c: CandidateDeal): ProfileMatch | undefined {
  return c.matches.find(m => m.signal === 'green') ?? c.matches.find(m => m.signal === 'amber') ?? c.matches[0];
}

export function DealRadarPage() {
  const {
    candidateDeals, acquisitionProfiles, lastScreeningAt,
    runScreening, ingestCandidatesFromListings, shortlistCandidate, rejectCandidate, promoteCandidate,
  } = useStore();
  const { lang } = useLanguage();
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusTab, setStatusTab] = useState<'all' | 'neu' | 'vorgemerkt' | 'abgelehnt' | 'uebernommen'>('all');
  const [activeProfiles, setActiveProfiles] = useState<string[]>(acquisitionProfiles.map(p => p.id));
  const [rejecting, setRejecting] = useState(false);
  const [vaScope, setVaScope] = useState<RenovationScope>('sanierung');
  // Market assumptions come live from Market Intelligence (Module 06).
  const benchmarks = useStore(s => s.benchmarks);
  const screenSeeds = useMemo(() => benchmarksToScreeningSeeds(benchmarks), [benchmarks]);

  const de = lang === 'de';

  // Candidates that have at least one match (or have been actioned) are "on the Radar".
  const onRadar = candidateDeals.filter(c =>
    c.listingActive && (c.matches.length > 0 || ['shortlisted', 'rejected', 'promoted'].includes(c.status)));

  const inStatusTab = (c: CandidateDeal) => {
    switch (statusTab) {
      case 'neu': return c.status === 'new' || c.status === 'matched';
      case 'vorgemerkt': return c.status === 'shortlisted';
      case 'abgelehnt': return c.status === 'rejected';
      case 'uebernommen': return c.status === 'promoted';
      default: return true;
    }
  };
  const inProfileFilter = (c: CandidateDeal) =>
    activeProfiles.length === acquisitionProfiles.length ||
    c.matches.some(m => activeProfiles.includes(m.profileId));

  const filtered = onRadar.filter(c => inStatusTab(c) && inProfileFilter(c));
  const selected = candidateDeals.find(c => c.id === selectedId) ?? null;

  const newCount = onRadar.filter(c => c.status === 'new' || c.status === 'matched').length;

  const tabCount = (key: typeof statusTab) => {
    const prev = statusTab;
    return onRadar.filter(c => {
      switch (key) {
        case 'neu': return c.status === 'new' || c.status === 'matched';
        case 'vorgemerkt': return c.status === 'shortlisted';
        case 'abgelehnt': return c.status === 'rejected';
        case 'uebernommen': return c.status === 'promoted';
        default: return true;
      }
    }).length;
    void prev;
  };
  const profileCount = (pid: string) => onRadar.filter(c => c.matches.some(m => m.profileId === pid)).length;

  const handleRunScreening = () => { runScreening(); };

  const handleLiveSearch = async () => {
    setSearching(true);
    setError(null);
    try {
      const profile = acquisitionProfiles[0];
      const result = await searchDealRadar({
        cities: profile.cities,
        usageTypes: ['Wohnen', 'Mixed Use'],
        priceMin: profile.priceMin,
        priceMax: profile.priceMax,
        minArea: profile.areaMin,
        maxArea: profile.areaMax,
      });
      if (result.success && result.listings.length > 0) {
        ingestCandidatesFromListings(result.listings);
      } else if (!result.success) {
        setError(result.error || (de ? 'Suche fehlgeschlagen' : 'Search failed'));
      } else {
        setError(de ? 'Keine neuen Angebote gefunden.' : 'No new listings found.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const fmtClock = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString(de ? 'de-DE' : 'en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  };
  const discPctLabel = (pct: number) => `${pct >= 0 ? '−' : '+'}${Math.abs(pct).toFixed(1)} %`;

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Deal Radar"
        subtitle={de ? 'AI-gestützte Suche nach Investmentangeboten · Düsseldorf + Speckgürtel' : 'AI-driven deal sourcing · Düsseldorf + commuter belt'}
        badge={newCount > 0 ? `${newCount} ${de ? 'neu' : 'new'}` : undefined}
        actions={
          <div className="flex gap-2 items-center">
            <span style={{ fontSize: 11, fontWeight: 700, padding: '6px 11px', borderRadius: 8, background: 'rgba(52,199,89,0.10)', color: '#34C759', whiteSpace: 'nowrap' }}>
              {de ? 'Gescreent: Mo & Do 07:00' : 'Screened: Mon & Thu 07:00'}
            </span>
            <button onClick={handleLiveSearch} disabled={searching}
              className="btn-glass px-4 py-2 rounded-xl text-sm flex items-center gap-2" style={{ cursor: searching ? 'wait' : 'pointer', opacity: searching ? 0.7 : 1 }}>
              {searching ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
              {de ? 'Live-Suche (AI)' : 'Live search (AI)'}
            </button>
            <button onClick={handleRunScreening} className="btn-accent px-4 py-2 rounded-xl text-sm flex items-center gap-2" style={{ cursor: 'pointer' }}>
              <Radar size={14} /> {de ? 'Screening starten' : 'Run screening'}
            </button>
          </div>
        }
      />

      {error && (
        <div className="mb-4 p-3 rounded-xl flex items-center gap-3" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
          <AlertTriangle size={14} color="#f87171" />
          <span style={{ fontSize: 13, color: '#f87171', flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={12} /></button>
        </div>
      )}

      {/* Status tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-3" style={{ background: 'rgba(0,0,0,0.03)', display: 'inline-flex' }}>
        {([
          { key: 'all', label: de ? 'Alle' : 'All' },
          { key: 'neu', label: de ? 'Neu' : 'New' },
          { key: 'vorgemerkt', label: de ? 'Vorgemerkt' : 'Shortlisted' },
          { key: 'abgelehnt', label: de ? 'Abgelehnt' : 'Rejected' },
          { key: 'uebernommen', label: de ? 'Übernommen' : 'Promoted' },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setStatusTab(tab.key)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: statusTab === tab.key ? 'white' : 'transparent', color: statusTab === tab.key ? '#1c1c1e' : 'rgba(60,60,67,0.55)', boxShadow: statusTab === tab.key ? '0 1px 3px rgba(0,0,0,0.06)' : 'none', border: '1px solid transparent', cursor: 'pointer' }}>
            {tab.label} <span style={{ fontSize: 10, opacity: 0.6 }}>{tabCount(tab.key)}</span>
          </button>
        ))}
      </div>

      {/* Profile filter chips */}
      <div className="flex gap-2 items-center mb-3 flex-wrap">
        <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(60,60,67,0.5)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{de ? 'Profil ·' : 'Profile ·'}</span>
        <button onClick={() => setActiveProfiles(acquisitionProfiles.map(p => p.id))}
          style={{ fontSize: 11, fontWeight: 700, padding: '4px 11px', borderRadius: 999, cursor: 'pointer',
            background: activeProfiles.length === acquisitionProfiles.length ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.6)',
            color: activeProfiles.length === acquisitionProfiles.length ? '#1c1c1e' : 'rgba(60,60,67,0.55)',
            border: '1px solid rgba(0,0,0,0.06)' }}>
          {de ? 'Alle Profile' : 'All profiles'}
        </button>
        {acquisitionProfiles.map(p => {
          const on = activeProfiles.includes(p.id);
          const isVA = p.screeningMode === 'discount_to_market';
          const col = isVA ? '#007aff' : '#34C759';
          return (
            <button key={p.id} onClick={() => setActiveProfiles(on ? activeProfiles.filter(x => x !== p.id) : [...activeProfiles, p.id])}
              style={{ fontSize: 11, fontWeight: 700, padding: '4px 11px', borderRadius: 999, cursor: 'pointer',
                background: on ? (isVA ? 'rgba(0,122,255,0.10)' : 'rgba(52,199,89,0.10)') : 'rgba(255,255,255,0.6)',
                color: on ? col : 'rgba(60,60,67,0.55)',
                border: `1px solid ${on ? (isVA ? 'rgba(0,122,255,0.2)' : 'rgba(52,199,89,0.2)') : 'rgba(0,0,0,0.06)'}` }}>
              {p.shortLabel} · {profileCount(p.id)}
            </button>
          );
        })}
      </div>

      {/* Cadence banner */}
      <div className="flex items-center gap-2.5 mb-6 p-3 rounded-xl" style={{ background: 'rgba(0,122,255,0.05)', border: '1px solid rgba(0,122,255,0.10)' }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: '#34C759' }} />
        <span style={{ fontSize: 12, color: '#1c1c1e' }}>
          <strong style={{ color: '#007aff' }}>{newCount} {de ? 'neue Deals' : 'new deals'}</strong>
          {de ? ` · letztes Screening ${fmtClock(lastScreeningAt)} · nächstes Screening Mo 07:00` : ` · last screening ${fmtClock(lastScreeningAt)} · next Mon 07:00`}
        </span>
      </div>

      <div className="flex gap-6">
        {/* Cards grid */}
        <div style={{ flex: selected ? '0 0 55%' : 1 }}>
          {filtered.length === 0 ? (
            <GlassPanel style={{ padding: 48, textAlign: 'center' }}>
              <Radar size={36} color="rgba(60,60,67,0.25)" />
              <div style={{ fontSize: 14, color: 'rgba(60,60,67,0.50)', marginTop: 16, maxWidth: 420, margin: '16px auto 0', lineHeight: 1.6 }}>
                {de ? 'Keine Kandidaten in dieser Ansicht. Starte ein Screening oder eine Live-Suche.' : 'No candidates in this view. Run screening or a live search.'}
              </div>
            </GlassPanel>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {filtered.map(c => {
                const pm = primaryMatch(c);
                const sig = bestSignal(c.matches);
                const sigCol = sig === 'green' ? SIGNAL_COLORS.green : sig === 'amber' ? SIGNAL_COLORS.amber : SIGNAL_COLORS.gray;
                const st = CAND_STATUS_STYLES[c.status] ?? CAND_STATUS_STYLES.new;
                const tone = pm ? discountTone(pm.discountPricePct) : 'gray';
                const toneCol = tone === 'green' ? SIGNAL_COLORS.green : tone === 'amber' ? SIGNAL_COLORS.amber : SIGNAL_COLORS.gray;
                return (
                  <div key={c.id} onClick={() => { setSelectedId(c.id === selectedId ? null : c.id); setRejecting(false); }}
                    className="glass-card glass-hover"
                    style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', border: c.id === selectedId ? '2px solid #007aff' : `1px solid ${sig === 'green' ? 'rgba(52,199,89,0.35)' : sig === 'amber' ? 'rgba(255,149,0,0.30)' : 'rgba(0,0,0,0.06)'}` }}>
                    <div style={{ padding: '16px 18px 12px' }}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1c1c1e', lineHeight: 1.35, flex: 1 }}>{c.title}</div>
                        <div className="flex flex-col items-end gap-1">
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>{de ? st.label_de : st.label_en}</span>
                          {c.matches.length > 0 && (
                            <div className="flex gap-1">
                              {c.matches.map(m => (
                                <span key={m.profileId} style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
                                  background: m.profileLabel === 'V-A' ? 'rgba(0,122,255,0.08)' : 'rgba(52,199,89,0.08)',
                                  color: m.profileLabel === 'V-A' ? '#007aff' : '#34C759' }}>{m.profileLabel}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)', marginBottom: 10 }}>{c.city}{c.address ? ` · ${c.address.split(',')[0]}` : ''}</div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                        <div><span style={{ fontSize: 10, color: 'rgba(60,60,67,0.40)', textTransform: 'uppercase' }}>Asking price</span><div style={{ fontSize: 15, fontWeight: 700, color: '#007aff' }}>{formatEUR(c.askingPrice, true)}</div></div>
                        <div><span style={{ fontSize: 10, color: 'rgba(60,60,67,0.40)', textTransform: 'uppercase' }}>{de ? 'Fläche' : 'Area'}</span><div style={{ fontSize: 14, fontWeight: 600, color: '#1c1c1e' }}>{c.areaSqm.toLocaleString()} m²</div></div>
                        <div>
                          <span style={{ fontSize: 10, color: 'rgba(60,60,67,0.40)', textTransform: 'uppercase' }}>€/m²</span>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#1c1c1e' }}>{pm ? formatEUR(pm.askingPricePerSqm) : '—'}</div>
                          {pm && <div style={{ fontSize: 11, fontWeight: 700, color: toneCol }}>{discPctLabel(pm.discountPricePct)} {de ? 'zu Markt' : 'to market'}</div>}
                        </div>
                        <div>
                          <span style={{ fontSize: 10, color: 'rgba(60,60,67,0.40)', textTransform: 'uppercase' }}>Faktor / Brutto</span>
                          <div style={{ fontSize: 14, fontWeight: 700, color: sigCol }}>{pm ? `${pm.impliedFactor.toFixed(1)}× · ${pm.impliedGrossYield.toFixed(2)} %` : '—'}</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: '8px 18px', borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="badge-neutral" style={{ fontSize: 10 }}>{c.assetClass === 'residential' ? 'Wohnen' : c.assetClass === 'mixed_use' ? 'Mixed Use' : c.assetClass}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: SOURCE_COLORS[c.sourceChannel] ?? 'rgba(60,60,67,0.5)' }}>{c.sourceLabel}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{ flex: '0 0 42%' }} className="animate-fade-in">
            <GlassPanel style={{ padding: 24, position: 'sticky', top: 24, maxHeight: 'calc(100vh - 48px)', overflowY: 'auto' }}>
              <div className="flex items-start justify-between gap-3 mb-1">
                <div style={{ fontSize: 17, fontWeight: 700, color: '#1c1c1e', lineHeight: 1.3 }}>{selected.title}</div>
                <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.55)', marginBottom: 16 }}>{selected.address}</div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-xl" style={{ background: 'rgba(0,122,255,0.05)' }}>
                  <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase' }}>Asking price</div>
                  <div style={{ fontSize: 19, fontWeight: 700, color: '#007aff' }}>{formatEUR(selected.askingPrice, true)}</div>
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                  <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase' }}>{de ? 'Fläche' : 'Area'}</div>
                  <div style={{ fontSize: 19, fontWeight: 700, color: '#1c1c1e' }}>{selected.areaSqm.toLocaleString()} m²</div>
                </div>
                {primaryMatch(selected) && (() => { const pm = primaryMatch(selected)!; return (
                  <>
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                      <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase' }}>€/m²</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#1c1c1e' }}>{formatEUR(pm.askingPricePerSqm)}</div>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(255,149,0,0.06)' }}>
                      <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase' }}>Brutto-Rendite</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#FF9500' }}>{pm.impliedGrossYield.toFixed(2)} %</div>
                    </div>
                  </>
                ); })()}
              </div>

              <div className="flex gap-2 mb-4 flex-wrap">
                <span className="badge-neutral">{selected.assetClass === 'residential' ? 'Wohnen' : selected.assetClass === 'mixed_use' ? 'Mixed Use' : selected.assetClass}</span>
                {selected.yearBuilt && <span className="badge-neutral">{de ? 'Bj.' : 'Built'} {selected.yearBuilt}</span>}
                {selected.numUnits && <span className="badge-neutral">{selected.numUnits} {de ? 'Einheiten' : 'units'}</span>}
              </div>

              {selected.description && (
                <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.70)', lineHeight: 1.65, marginBottom: 16 }}>{selected.description}</div>
              )}

              {/* Screening read-out per matched profile */}
              {selected.matches.map(m => {
                const sigCol = m.signal === 'green' ? SIGNAL_COLORS.green : SIGNAL_COLORS.amber;
                const isVA = m.screeningMode === 'discount_to_market';
                return (
                  <div key={m.profileId} className="mb-4 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(60,60,67,0.55)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Screening · {m.profileName}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: m.signal === 'green' ? 'rgba(52,199,89,0.15)' : 'rgba(255,149,0,0.15)', color: sigCol }}>● {m.signal === 'green' ? 'Green' : 'Amber'}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.2fr auto', gap: 10, alignItems: 'baseline', padding: '6px 0', borderBottom: '1px dashed rgba(0,0,0,0.10)' }}>
                      <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.6)' }}>Test A · €/m² vs. Benchmark</span>
                      <span style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>{formatEUR(m.askingPricePerSqm)} · vs {formatEUR(m.benchmarkPricePerSqm)}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: m.passA ? SIGNAL_COLORS.green : SIGNAL_COLORS.red }}>{discPctLabel(m.discountPricePct)} · {m.passA ? 'PASS' : 'FAIL'}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.2fr auto', gap: 10, alignItems: 'baseline', padding: '6px 0' }}>
                      <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.6)' }}>{isVA ? 'Test B · Implied Faktor' : 'Test B · Brutto-Rendite'}</span>
                      <span style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>{isVA ? `${m.impliedFactor.toFixed(2)}× · vs ${m.benchmarkFactor.toFixed(1)}×` : `${m.impliedGrossYield.toFixed(2)} % · vs ≥ 5,00 %`}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: m.passB ? SIGNAL_COLORS.green : SIGNAL_COLORS.red }}>{isVA ? discPctLabel(m.discountFactorPct) : ''} {m.passB ? 'PASS' : 'FAIL'}</span>
                    </div>
                  </div>
                );
              })}

              {/* AI assessment */}
              {selected.aiNotes && (
                <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(0,122,255,0.05)', border: '1px solid rgba(0,122,255,0.10)' }}>
                  <div className="flex items-center gap-2 mb-2"><Bot size={13} color="#007aff" /><span style={{ fontSize: 11, fontWeight: 700, color: '#007aff' }}>AI-Einschätzung</span></div>
                  <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.75)', lineHeight: 1.65 }}>{selected.aiNotes}</div>
                </div>
              )}

              {/* Market context */}
              {(() => {
                const b = screenSeeds.find(x => x.city === selected.city && x.submarket === selected.submarket && x.assetClass === selected.assetClass)
                  ?? screenSeeds.find(x => x.city === selected.city && !x.submarket && x.assetClass === selected.assetClass);
                if (!b) return null;
                return (
                  <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(52,199,89,0.04)', border: '1px solid rgba(52,199,89,0.10)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#34C759', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
                      Market Context · {selected.submarket ?? selected.city} · {b.asOf}
                    </div>
                    {[
                      [de ? '€/m² · transaction benchmark' : '€/m² · transaction benchmark', formatEUR(b.pricePerSqm)],
                      [de ? '€/m²/mo · Marktmiete' : '€/m²/mo · market rent', `${b.rentPerSqmMonth.toFixed(2).replace('.', ',')} €`],
                      ['Faktor median', `${b.factorMedian.toFixed(1).replace('.', ',')} ×`],
                      [de ? 'Mietwachstum p.a.' : 'Rent growth p.a.', `+ ${(b.rentGrowthPaPct ?? 0).toFixed(1).replace('.', ',')} %`],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px dashed rgba(0,0,0,0.10)' }}>
                        <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.6)' }}>{k}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'ui-monospace, monospace' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Value-Add Screening (20% margin residual) */}
              {(() => {
                const b = screenSeeds.find(x => x.city === selected.city && x.submarket === selected.submarket && x.assetClass === selected.assetClass)
                  ?? screenSeeds.find(x => x.city === selected.city && !x.submarket && x.assetClass === selected.assetClass);
                if (!b || selected.areaSqm <= 0 || selected.askingPrice <= 0) return null;
                // Market NIY derived from the transaction multiplier: NIY = (1 − non-recoverable) / factor.
                const marketNIY = ((1 - DEFAULT_SCREEN_PROFILE.nonRecoverablePct) / b.factorMedian) * 100;
                const exitBuffer = resolveExitYieldBuffer(selected.city, selected.submarket);
                const r = screenValueAdd({ area: selected.areaSqm, purchasePrice: selected.askingPrice, marketRent: b.rentPerSqmMonth, marketNIY, scope: vaScope, profile: { exitYieldBufferPct: exitBuffer } });
                const green = '#16a34a', red = '#dc2626';
                const rows: Array<[string, number, boolean]> = [
                  [de ? 'Potentieller Exit-Wert' : 'Potential exit value', r.exitValue, false],
                  [de ? '− Kaufpreis' : '− Purchase price', -selected.askingPrice, true],
                  [de ? '− Kaufnebenkosten (10%)' : '− Purchase costs (10%)', -r.knk, true],
                  [`− ${SCOPE_LABEL[vaScope][de ? 'de' : 'en']} (${BUILD_COST_RATES[vaScope]} €/m²)`, -r.buildCost, true],
                  [de ? '− Finanzierung (5%)' : '− Financing (5%)', -r.financing, true],
                  [de ? '− Contingency (10%)' : '− Contingency (10%)', -r.contingency, true],
                ];
                return (
                  <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.08)' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <Target size={13} color="#007aff" />
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#007aff', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Value-Add Screening · 20% Marge</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {(Object.keys(BUILD_COST_RATES) as RenovationScope[]).map(sc => (
                        <button key={sc} onClick={() => setVaScope(sc)}
                          style={{ fontSize: 11, fontWeight: 600, padding: '4px 9px', borderRadius: 7, cursor: 'pointer',
                            background: vaScope === sc ? 'rgba(0,122,255,0.12)' : 'rgba(0,0,0,0.04)',
                            color: vaScope === sc ? '#007aff' : 'rgba(60,60,67,0.6)',
                            border: `1px solid ${vaScope === sc ? 'rgba(0,122,255,0.3)' : 'rgba(0,0,0,0.06)'}` }}>
                          {SCOPE_LABEL[sc][de ? 'de' : 'en']} · {BUILD_COST_RATES[sc]}€
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.55)', marginBottom: 8 }}>
                      {de ? 'Basis' : 'Basis'}: {b.rentPerSqmMonth.toFixed(2).replace('.', ',')} €/m²/Mt · Faktor {b.factorMedian.toFixed(1).replace('.', ',')}× · Exit-NIY {r.exitNIY.toFixed(2).replace('.', ',')}% ({exitBuffer === EXIT_BUFFER_PRIME ? 'Prime +0,75%' : 'Rand +1,0%'}) · {selected.areaSqm.toLocaleString('de-DE')} m² · {selected.submarket ?? selected.city}
                    </div>
                    <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                      {rows.map(([label, val, dim], i) => (
                        <div key={i} className="flex items-center justify-between" style={{ padding: '5px 0', fontSize: 12, color: dim ? 'rgba(60,60,67,0.7)' : '#1c1c1e', fontWeight: dim ? 400 : 600 }}>
                          <span>{label}</span>
                          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatEUR(val, true)}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between" style={{ padding: '8px 0 4px', borderTop: '1px solid rgba(0,0,0,0.06)', fontSize: 13, fontWeight: 700, color: r.profit >= 0 ? green : red }}>
                        <span>= Profit ({r.marginPct.toFixed(1)}% {de ? 'Marge' : 'margin'})</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatEUR(r.profit, true)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 p-2.5 rounded-lg" style={{ background: r.pass ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.07)' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: r.pass ? green : red }}>
                        {r.pass ? `✓ ${de ? 'Trifft 20%-Hürde' : 'Clears 20% hurdle'} (+${formatEUR(r.surplus, true)})` : `✗ ${de ? 'Verfehlt 20%-Hürde' : 'Misses 20% hurdle'} (${formatEUR(r.surplus, true)})`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2" style={{ fontSize: 12 }}>
                      <span style={{ color: 'rgba(60,60,67,0.6)' }}>{de ? 'Max. Kaufpreis (20% Marge)' : 'Max bid (20% margin)'}</span>
                      <span style={{ fontWeight: 700, color: selected.askingPrice <= r.maxBid ? green : red, fontVariantNumeric: 'tabular-nums' }}>
                        {formatEUR(r.maxBid, true)}<span style={{ color: 'rgba(60,60,67,0.45)', fontWeight: 400 }}> {de ? 'vs. Angebot' : 'vs. asking'} {formatEUR(selected.askingPrice, true)}</span>
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Source */}
              <div className="flex items-center gap-2 mb-4">
                <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>{de ? 'Quelle' : 'Source'}: {selected.sourceLabel}</span>
                {selected.sourceRef.startsWith('http') && (
                  <a href={selected.sourceRef} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#007aff', display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}>
                    {de ? 'Zum Angebot' : 'View listing'} <ExternalLink size={10} />
                  </a>
                )}
              </div>

              {/* Actions */}
              {selected.status === 'promoted' ? (
                <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(88,86,214,0.08)', border: '1px solid rgba(88,86,214,0.2)' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#5856D6' }}>{de ? '✓ In Acquisition übernommen' : '✓ Promoted to Acquisition'}</span>
                </div>
              ) : selected.status === 'rejected' ? (
                <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(255,59,48,0.06)' }}>
                  <span style={{ fontSize: 13, color: '#FF3B30' }}>{de ? 'Abgelehnt' : 'Rejected'}{selected.rejectReason ? ` — ${selected.rejectReason}` : ''}</span>
                </div>
              ) : rejecting ? (
                <div className="p-3 rounded-xl" style={{ background: 'rgba(255,59,48,0.04)', border: '1px solid rgba(255,59,48,0.12)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.6)', marginBottom: 8 }}>{de ? 'Ablehnungsgrund wählen' : 'Choose reject reason'}</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {REJECT_REASONS.map(r => (
                      <button key={r} onClick={() => { rejectCandidate(selected.id, r); setRejecting(false); }}
                        style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: 'white', color: '#FF3B30', border: '1px solid rgba(255,59,48,0.25)', cursor: 'pointer' }}>{r}</button>
                    ))}
                    <button onClick={() => setRejecting(false)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, background: 'transparent', color: 'rgba(60,60,67,0.5)', border: '1px solid rgba(0,0,0,0.06)', cursor: 'pointer' }}>{de ? 'Abbrechen' : 'Cancel'}</button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-2" style={{ gridTemplateColumns: '1.4fr 1fr 1fr' }}>
                  <button onClick={() => promoteCandidate(selected.id)} className="btn-accent px-3 py-2.5 rounded-xl text-sm flex items-center gap-1.5 justify-center" style={{ cursor: 'pointer' }}>
                    <ArrowRight size={14} /> {de ? 'Übernehmen' : 'Promote'}
                  </button>
                  <button onClick={() => shortlistCandidate(selected.id)} className="btn-glass px-3 py-2.5 rounded-xl text-sm flex items-center gap-1.5 justify-center" style={{ cursor: 'pointer', color: '#34C759' }}>
                    <Target size={14} /> {de ? 'Vormerken' : 'Shortlist'}
                  </button>
                  <button onClick={() => setRejecting(true)} className="btn-glass px-3 py-2.5 rounded-xl text-sm flex items-center gap-1.5 justify-center" style={{ cursor: 'pointer', color: '#FF3B30' }}>
                    <ThumbsDown size={14} /> {de ? 'Ablehnen' : 'Reject'}
                  </button>
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
