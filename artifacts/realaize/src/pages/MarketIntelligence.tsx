import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Database,
  FileText,
  Newspaper,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useStore } from '../store/useStore';
import { useLanguage } from '../i18n/LanguageContext';
import { CURRENT_PERIOD } from '../data/marketIntelData';
import {
  ASSET_CLASS_LABEL,
  benchmarkSeries,
  formatBenchmarkValue,
  KPI_LABEL,
  quarterOrdinal,
} from '../utils/marketIntelligence';
import type {
  AssetClass,
  BenchmarkKpi,
  BenchmarkRecord,
  ConfidenceTier,
  ImpactTier,
  ValidationStatus,
} from '../models/types';

const REVIEWER = 'J. Pleuker';

// ── Small style helpers ───────────────────────────────────────────────────────

const TIER_STYLE: Record<ConfidenceTier, { bg: string; color: string; label: string }> = {
  pipeline_validated: { bg: 'rgba(52,199,89,0.12)', color: '#1f9d4d', label: 'Pipeline validated' },
  ai_indicative: { bg: 'rgba(255,149,0,0.14)', color: '#c2750a', label: 'AI indicative' },
  manual_override: { bg: 'rgba(175,82,222,0.14)', color: '#8e3fc0', label: 'Manual override' },
};

const STATUS_STYLE: Record<ValidationStatus, { bg: string; color: string; label: string }> = {
  auto_passed: { bg: 'rgba(52,199,89,0.12)', color: '#1f9d4d', label: 'Auto-passed' },
  manual_approved: { bg: 'rgba(0,122,255,0.12)', color: '#0a6cff', label: 'Approved' },
  pending: { bg: 'rgba(255,149,0,0.14)', color: '#c2750a', label: 'Pending' },
  rejected: { bg: 'rgba(255,59,48,0.12)', color: '#d92c20', label: 'Rejected' },
};

const IMPACT_STYLE: Record<ImpactTier, { bg: string; color: string }> = {
  high: { bg: 'rgba(255,59,48,0.12)', color: '#d92c20' },
  medium: { bg: 'rgba(255,149,0,0.14)', color: '#c2750a' },
  low: { bg: 'rgba(60,60,67,0.10)', color: 'rgba(60,60,67,0.7)' },
};

function Badge({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 700,
        background: bg,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

const TABS = [
  { key: 'benchmarks', label: 'Benchmarks', icon: Database },
  { key: 'review', label: 'Review Queue', icon: ShieldCheck },
  { key: 'news', label: 'News Layer', icon: Newspaper },
  { key: 'crossval', label: 'Cross-Validation', icon: Activity },
  { key: 'memo', label: 'IC Memo Block', icon: FileText },
  { key: 'history', label: 'Historie', icon: TrendingUp },
  { key: 'sources', label: 'Sources', icon: BadgeCheck },
] as const;

type TabKey = (typeof TABS)[number]['key'];

// Per-city Market Intelligence body: the KPI tiles + all six tabs, scoped to a
// single city. Rendered inside the merged Markt page when a city tile is opened.
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
          const count = tb.key === 'review' ? pendingCount : undefined;
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
      {tab === 'news' && <NewsTab events={marketEvents} lang={lang} />}
      {tab === 'crossval' && <CrossValTab benchmarks={benchmarks} lang={lang} />}
      {tab === 'memo' && <MemoTab benchmarks={benchmarks} events={marketEvents} lang={lang} lockedCity={city} />}
      {tab === 'history' && <HistoryTab benchmarks={benchmarks} lang={lang} />}
      {tab === 'sources' && <SourcesTab reportSources={reportSources} refreshJobs={refreshJobs} lang={lang} />}
    </div>
  );
}

// ── Benchmarks tab ────────────────────────────────────────────────────────────

// Benchmark display order: usage class (section) → KPI (column).
const ASSET_ORDER: AssetClass[] = ['residential', 'office', 'retail', 'logistics', 'mixed_use'];
const KPI_ORDER: BenchmarkKpi[] = ['prime_rent', 'erv', 'net_initial_yield', 'prime_yield', 'multiplier', 'vacancy'];
const CLASS_RGB: Record<string, string> = {
  residential: '96,165,250', office: '201,169,110', retail: '248,113,113',
  logistics: '74,222,128', mixed_use: '167,139,250',
};

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(60,60,67,0.45)', margin: '0 0 10px' }}>
      {children}
    </div>
  );
}

// Segmented by usage (section) → city-wide KPI row (Block A) + submarket
// comparison table (Block B), with KPIs in a fixed order across both.
function BenchmarksTab({ benchmarks, lang, hideCityFilter }: { benchmarks: BenchmarkRecord[]; lang: string; hideCityFilter?: boolean }) {
  const [filterCity, setFilterCity] = useState('all');
  const [filterClass, setFilterClass] = useState<'all' | AssetClass>('all');
  const [openKpi, setOpenKpi] = useState<string | null>(null);   // benchmark id
  const [openSub, setOpenSub] = useState<string | null>(null);   // `${assetClass}|${submarket}`

  const cities = useMemo(() => Array.from(new Set(benchmarks.map(b => b.city))).sort(), [benchmarks]);

  const scoped = benchmarks
    .filter(b => b.sourceType !== 'portfolio_realised')
    .filter(b => hideCityFilter || filterCity === 'all' || b.city === filterCity);

  const classesPresent = ASSET_ORDER.filter(ac => scoped.some(b => b.assetClass === ac));
  const shownClasses = filterClass === 'all' ? classesPresent : classesPresent.filter(ac => ac === filterClass);
  const num = (n: number) => n.toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB');

  return (
    <div>
      <div className="flex gap-3 mb-4 flex-wrap">
        {!hideCityFilter && (
          <select className="input-glass" value={filterCity} onChange={e => setFilterCity(e.target.value)} style={{ width: 200 }}>
            <option value="all">{lang === 'de' ? 'Alle Märkte' : 'All markets'}</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <select className="input-glass" value={filterClass} onChange={e => setFilterClass(e.target.value as 'all' | AssetClass)} style={{ width: 180 }}>
          <option value="all">{lang === 'de' ? 'Alle Nutzungen' : 'All usage types'}</option>
          {classesPresent.map(c => (
            <option key={c} value={c}>{ASSET_CLASS_LABEL[c]}</option>
          ))}
        </select>
      </div>

      {shownClasses.length === 0 ? (
        <div className="glass-card" style={{ padding: 32, textAlign: 'center', color: 'rgba(60,60,67,0.5)', fontSize: 13 }}>
          {lang === 'de' ? 'Keine Benchmarks für diese Auswahl.' : 'No benchmarks for this selection.'}
        </div>
      ) : (
        <div className="space-y-5">
          {shownClasses.map(ac => {
            const recs = scoped.filter(b => b.assetClass === ac);
            const cityByKpi = new Map(recs.filter(b => !b.submarket).map(r => [r.kpi, r] as const));
            const kpiTiles = KPI_ORDER.map(k => cityByKpi.get(k)).filter((r): r is BenchmarkRecord => !!r);
            const openKpiRec = kpiTiles.find(k => k.id === openKpi) ?? null;
            const cityErvVal = (cityByKpi.get('erv') ?? cityByKpi.get('prime_rent'))?.value;

            const subRecs = recs.filter(b => b.submarket);
            const subNames = Array.from(new Set(subRecs.map(r => r.submarket!)));
            const subRows = subNames.map(name => {
              const rs = subRecs.filter(r => r.submarket === name);
              const erv = rs.find(r => r.kpi === 'erv') ?? rs.find(r => r.kpi === 'prime_rent');
              const mult = rs.find(r => r.kpi === 'multiplier');
              const price = erv && mult ? Math.round(erv.value * 12 * mult.value) : undefined;
              const vs = erv && cityErvVal ? ((erv.value - cityErvVal) / cityErvVal) * 100 : undefined;
              return { name, erv, mult, price, vs, records: rs };
            }).sort((a, b) => (b.erv?.value ?? 0) - (a.erv?.value ?? 0));

            return (
              <div key={ac} className="glass-card" style={{ padding: 18 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: `rgba(${CLASS_RGB[ac] ?? '120,120,128'},0.9)` }} />
                  {ASSET_CLASS_LABEL[ac]}
                </div>

                {/* Block A — Markt-Kennzahlen (gesamtstädtisch) */}
                <SubLabel>{lang === 'de' ? 'Markt-Kennzahlen (gesamtstädtisch)' : 'Market metrics (city-wide)'}</SubLabel>
                {kpiTiles.length > 0 ? (
                  <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14 }}>
                    {kpiTiles.map(b => {
                      const status = STATUS_STYLE[b.validationStatus];
                      const active = openKpi === b.id;
                      return (
                        <div
                          key={b.id}
                          onClick={() => setOpenKpi(active ? null : b.id)}
                          style={{ padding: '16px 20px', borderRadius: 12, cursor: 'pointer', background: active ? 'rgba(0,122,255,0.05)' : 'rgba(0,0,0,0.02)', border: active ? '1px solid rgba(0,122,255,0.3)' : '1px solid rgba(0,0,0,0.05)' }}
                        >
                          <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.55)', fontWeight: 600, whiteSpace: 'nowrap' }}>{KPI_LABEL[b.kpi]}</div>
                          <div style={{ fontSize: 22, fontWeight: 700, margin: '6px 0 8px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatBenchmarkValue(b.value, b.unit)}</div>
                          <div className="flex items-center justify-between" style={{ fontSize: 10, color: 'rgba(60,60,67,0.5)' }}>
                            <span>{b.sourceCount} {lang === 'de' ? 'Q.' : 'src'}{b.valueSpread ? ` · Δ${b.valueSpread}` : ''}</span>
                            <span style={{ width: 7, height: 7, borderRadius: 999, background: status.color }} title={status.label} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)' }}>{lang === 'de' ? 'Keine gesamtstädtischen Werte.' : 'No city-wide values.'}</div>
                )}
                {openKpiRec && (
                  <div style={{ marginTop: 10, border: '1px solid rgba(0,0,0,0.06)', borderRadius: 10, overflow: 'hidden' }}>
                    <ProvenanceDrilldown b={openKpiRec} lang={lang} />
                  </div>
                )}

                {/* Block B — Lagen / Stadtteile */}
                {subRows.length > 0 && (
                  <div style={{ marginTop: 18 }}>
                    <SubLabel>{lang === 'de' ? 'Lagen / Stadtteile' : 'Locations / submarkets'}</SubLabel>
                    <div style={{ border: '1px solid rgba(0,0,0,0.06)', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.9fr 1fr 1fr 24px', padding: '8px 12px', background: 'rgba(0,0,0,0.02)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(60,60,67,0.5)' }}>
                        <div>{lang === 'de' ? 'Lage' : 'Location'}</div>
                        <div style={{ textAlign: 'right' }}>ERV €/m²</div>
                        <div style={{ textAlign: 'right' }}>{lang === 'de' ? 'Faktor' : 'Factor'}</div>
                        <div style={{ textAlign: 'right' }}>~€/m²</div>
                        <div style={{ textAlign: 'right' }}>vs. {lang === 'de' ? 'Markt' : 'market'}</div>
                        <div />
                      </div>
                      {subRows.map(r => {
                        const key = `${ac}|${r.name}`;
                        const active = openSub === key;
                        const tone = r.vs === undefined ? 'rgba(60,60,67,0.5)' : r.vs >= 3 ? '#1f9d4d' : r.vs <= -3 ? '#d92c20' : 'rgba(60,60,67,0.6)';
                        const arrow = r.vs === undefined ? '' : r.vs >= 3 ? '▲' : r.vs <= -3 ? '▼' : '●';
                        return (
                          <div key={key} style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                            <div onClick={() => setOpenSub(active ? null : key)} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.9fr 1fr 1fr 24px', padding: '9px 12px', alignItems: 'center', cursor: 'pointer', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                              <div style={{ fontWeight: 600 }}>{r.name}</div>
                              <div style={{ textAlign: 'right' }}>{r.erv ? r.erv.value.toFixed(2) : '—'}</div>
                              <div style={{ textAlign: 'right' }}>{r.mult ? `${r.mult.value.toFixed(1)}×` : '—'}</div>
                              <div style={{ textAlign: 'right' }}>{r.price ? num(r.price) : '—'}</div>
                              <div style={{ textAlign: 'right', color: tone, fontWeight: 600 }}>{r.vs === undefined ? '—' : `${arrow} ${r.vs >= 0 ? '+' : ''}${r.vs.toFixed(0)} %`}</div>
                              <div style={{ color: 'rgba(60,60,67,0.4)', textAlign: 'right' }}>{active ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</div>
                            </div>
                            {active && (
                              <div style={{ background: 'rgba(0,0,0,0.015)' }}>
                                {r.records.map(rec => <ProvenanceDrilldown key={rec.id} b={rec} lang={lang} />)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProvenanceDrilldown({ b, lang }: { b: BenchmarkRecord; lang: string }) {
  return (
    <div style={{ padding: '4px 18px 18px 18px', background: 'rgba(0,0,0,0.015)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(60,60,67,0.5)', margin: '12px 0 8px' }}>
        {lang === 'de' ? 'Provenance · Einzelquellen' : 'Provenance · individual sources'} ({b.consolidationMethod})
      </div>
      {b.sources.length === 0 && (
        <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.55)' }}>
          {b.sourceType === 'ai_qualitative'
            ? lang === 'de' ? 'AI-qualitative Schätzung — keine Broker-Quellen.' : 'AI qualitative estimate — no broker sources.'
            : lang === 'de' ? 'Direkt erfasster Wert.' : 'Directly captured value.'}
        </div>
      )}
      {b.sources.map(s => (
        <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '110px 90px 1fr 70px', gap: 12, padding: '8px 10px', alignItems: 'baseline', background: s.isOutlier ? 'rgba(255,59,48,0.05)' : 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 8, marginBottom: 6, fontSize: 12 }}>
          <div style={{ fontWeight: 700 }}>
            {s.provider}
            {s.isOutlier && <span title="outlier" style={{ color: '#d92c20', marginLeft: 6 }}>⚠</span>}
          </div>
          <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatBenchmarkValue(s.value, s.unit)}</div>
          <div style={{ color: 'rgba(60,60,67,0.6)', fontStyle: 'italic' }}>
            „{s.originalText}"
            <span style={{ color: 'rgba(60,60,67,0.4)', fontStyle: 'normal' }}> · {s.documentTitle}{s.pageNo ? `, p.${s.pageNo}` : ''}</span>
          </div>
          <div style={{ textAlign: 'right', color: 'rgba(60,60,67,0.5)' }}>trust {s.trustScore.toFixed(2)}</div>
        </div>
      ))}
      {b.validationFlags && b.validationFlags.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {b.validationFlags.map((f, i) => (
            <Badge key={i} bg="rgba(255,149,0,0.12)" color="#c2750a"><AlertTriangle size={11} /> {f}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Review queue tab ──────────────────────────────────────────────────────────

function ReviewTab({ benchmarks, lang }: { benchmarks: BenchmarkRecord[]; lang: string }) {
  const approve = useStore(s => s.approveBenchmark);
  const reject = useStore(s => s.rejectBenchmark);
  const correct = useStore(s => s.correctBenchmark);
  const pending = benchmarks.filter(b => b.validationStatus === 'pending');

  if (pending.length === 0) {
    return (
      <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
        <Check size={28} color="#1f9d4d" style={{ margin: '0 auto 10px' }} />
        <div style={{ fontWeight: 600 }}>{lang === 'de' ? 'Keine offenen Reviews' : 'Review queue clear'}</div>
        <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.55)', marginTop: 4 }}>
          {lang === 'de' ? 'Alle Datenpunkte dieses Refresh sind freigegeben.' : 'All data points from this refresh are cleared.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p style={{ fontSize: 12, color: 'rgba(60,60,67,0.6)', marginBottom: 4 }}>
        {lang === 'de'
          ? 'Werte außerhalb der Plausibilitätsspanne, mit niedriger Konfidenz oder qualitativer Schätzung. SLA: Review innerhalb 5 Werktagen.'
          : 'Values out of plausibility range, low confidence, or qualitative estimates. SLA: review within 5 business days.'}
      </p>
      {pending.map(b => (
        <ReviewCard key={b.id} b={b} lang={lang} onApprove={() => approve(b.id, REVIEWER)} onReject={() => reject(b.id, REVIEWER)} onCorrect={v => correct(b.id, v, REVIEWER)} />
      ))}
    </div>
  );
}

function ReviewCard({ b, lang, onApprove, onReject, onCorrect }: { b: BenchmarkRecord; lang: string; onApprove: () => void; onReject: () => void; onCorrect: (v: number) => void }) {
  const [editVal, setEditVal] = useState(String(b.value));
  return (
    <div className="glass-card" style={{ padding: 18 }}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {b.city}{b.submarket ? ` · ${b.submarket}` : ''} — {ASSET_CLASS_LABEL[b.assetClass]} · {KPI_LABEL[b.kpi]}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.7)', marginTop: 4 }}>
            {lang === 'de' ? 'Reconciled' : 'Reconciled'}: <strong>{formatBenchmarkValue(b.value, b.unit)}</strong> · {b.consolidationMethod} · {b.sourceCount} {lang === 'de' ? 'Quellen' : 'sources'}
            {b.valueSpread !== undefined && b.valueSpread > 0 ? ` · spread Δ${b.valueSpread}` : ''}
          </div>
          {b.validationFlags && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {b.validationFlags.map((f, i) => (
                <Badge key={i} bg="rgba(255,149,0,0.12)" color="#c2750a"><AlertTriangle size={11} /> {f}</Badge>
              ))}
            </div>
          )}
        </div>
        <Badge bg={STATUS_STYLE.pending.bg} color={STATUS_STYLE.pending.color}>{STATUS_STYLE.pending.label}</Badge>
      </div>

      {/* Broker spread */}
      {b.sources.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {b.sources.map(s => (
            <div key={s.id} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8, background: s.isOutlier ? 'rgba(255,59,48,0.08)' : 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.05)' }}>
              <strong>{s.provider}</strong> {formatBenchmarkValue(s.value, s.unit)}{s.isOutlier ? ' ⚠' : ''}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-4 flex-wrap">
        <input className="input-glass" value={editVal} onChange={e => setEditVal(e.target.value)} style={{ width: 110 }} />
        <button className="btn-glass px-3 py-2 rounded-lg text-sm" style={{ cursor: 'pointer' }} onClick={() => { const v = parseFloat(editVal); if (!Number.isNaN(v)) onCorrect(v); }}>
          {lang === 'de' ? 'Korrigieren & Freigeben' : 'Correct & approve'}
        </button>
        <button className="btn-accent px-3 py-2 rounded-lg text-sm flex items-center gap-1.5" style={{ cursor: 'pointer' }} onClick={onApprove}>
          <Check size={14} /> {lang === 'de' ? 'Freigeben' : 'Approve'}
        </button>
        <button className="btn-glass px-3 py-2 rounded-lg text-sm flex items-center gap-1.5" style={{ cursor: 'pointer', color: '#d92c20' }} onClick={onReject}>
          <X size={14} /> {lang === 'de' ? 'Ablehnen' : 'Reject'}
        </button>
      </div>
    </div>
  );
}

// ── News tab ──────────────────────────────────────────────────────────────────

function NewsTab({ events, lang }: { events: ReturnType<typeof useStore.getState>['marketEvents']; lang: string }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: 'rgba(60,60,67,0.6)', marginBottom: 14 }}>
        {lang === 'de'
          ? 'Der News Intelligence Agent schreibt market_events parallel zur Pipeline. Verbindung zu Benchmarks ist rein deskriptiv (JOIN) — niemals eine numerische Anpassung.'
          : 'The News Intelligence Agent writes market_events in parallel to the pipeline. Link to benchmarks is descriptive only (JOIN) — never a numerical modification.'}
      </p>
      <div className="space-y-3">
        {events.map(e => {
          const im = IMPACT_STYLE[e.impactTier];
          return (
            <div key={e.id} className="glass-card" style={{ padding: 16 }}>
              <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 6 }}>
                <Badge bg={im.bg} color={im.color}>{e.impactTier.toUpperCase()} IMPACT</Badge>
                <Badge bg="rgba(0,0,0,0.06)" color="rgba(60,60,67,0.7)">{e.eventType}</Badge>
                {e.city && <Badge bg="rgba(0,122,255,0.10)" color="#0a6cff">{e.city}</Badge>}
                {e.assetClass && <Badge bg="rgba(0,0,0,0.06)" color="rgba(60,60,67,0.7)">{ASSET_CLASS_LABEL[e.assetClass]}</Badge>}
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>
                  {new Date(e.publishedAt).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB')}
                </span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{e.headline}</div>
              <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.7)', marginTop: 4 }}>{e.summary}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Cross-validation tab ──────────────────────────────────────────────────────

function CrossValTab({ benchmarks, lang }: { benchmarks: BenchmarkRecord[]; lang: string }) {
  const realised = benchmarks.find(b => b.sourceType === 'portfolio_realised');
  const broker = benchmarks.find(
    b => b.sourceType === 'extracted_report' && b.submarket === realised?.submarket && b.kpi === realised?.kpi && b.assetClass === realised?.assetClass,
  );

  if (!realised || !broker) {
    return <div className="glass-card" style={{ padding: 32, textAlign: 'center', color: 'rgba(60,60,67,0.55)' }}>No cross-validation pair available yet.</div>;
  }

  const delta = ((realised.value - broker.value) / broker.value) * 100;

  return (
    <div>
      <p style={{ fontSize: 12, color: 'rgba(60,60,67,0.6)', marginBottom: 16, maxWidth: 820 }}>
        {lang === 'de'
          ? 'Die Schicht, die aggregierte Drittdaten in proprietäres Marktverständnis verwandelt: extrahierte Broker-Werte vs. tatsächlich von Lestate realisierte Werte. Phase 3 — statistisch robust ab 10–15 Deals.'
          : 'The layer that turns aggregated third-party data into proprietary market understanding: extracted broker values vs. values actually realized by Lestate. Phase 3 — statistically robust after 10–15 deals.'}
      </p>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 60px 1fr', alignItems: 'center' }}>
        <div className="glass-card" style={{ padding: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#0a6cff', letterSpacing: '0.05em' }}>Extracted · broker</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#0a6cff', margin: '8px 0' }}>{formatBenchmarkValue(broker.value, broker.unit)}</div>
          <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.6)' }}>
            {KPI_LABEL[broker.kpi]} {broker.city}-{broker.submarket}, {ASSET_CLASS_LABEL[broker.assetClass]} · {broker.sourceCount} {lang === 'de' ? 'Quellen' : 'sources'}, {broker.periodQuarter}
          </div>
        </div>
        <div style={{ textAlign: 'center', fontWeight: 700, color: 'rgba(60,60,67,0.4)' }}>vs.</div>
        <div className="glass-card" style={{ padding: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#1f9d4d', letterSpacing: '0.05em' }}>Realized · Lestate</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#1f9d4d', margin: '8px 0' }}>{formatBenchmarkValue(realised.value, realised.unit)}</div>
          <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.6)' }}>{realised.reviewNote}</div>
        </div>
      </div>
      <div style={{ marginTop: 18, padding: '18px 22px', borderLeft: '3px solid #0a6cff', background: 'rgba(0,122,255,0.05)', borderRadius: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#0a6cff', letterSpacing: '0.05em' }}>
          Δ {delta >= 0 ? '+' : ''}{delta.toFixed(1)}% {lang === 'de' ? 'proprietäres Delta' : 'proprietary delta'}
        </div>
        <p style={{ fontSize: 13, marginTop: 6, color: 'rgba(60,60,67,0.8)' }}>
          {lang === 'de'
            ? `${realised.submarket}-Refurbishment-Objekte realisieren systematisch über der publizierten ERV. Der Effekt fließt als „Lestate Premium Factor" in Underwriting-Annahmen für vergleichbare Lagen.`
            : `${realised.submarket} refurbishment assets systematically realize above published ERV. The effect feeds underwriting assumptions for comparable locations as a “Lestate Premium Factor”.`}
        </p>
      </div>
    </div>
  );
}

// ── IC memo block tab ─────────────────────────────────────────────────────────

function MemoTab({ benchmarks, events, lang, lockedCity }: { benchmarks: BenchmarkRecord[]; events: ReturnType<typeof useStore.getState>['marketEvents']; lang: string; lockedCity?: string }) {
  const cities = useMemo(() => Array.from(new Set(benchmarks.map(b => b.city))).sort(), [benchmarks]);
  const [city, setCity] = useState(lockedCity ?? cities[0] ?? 'Düsseldorf');
  const [assetClass, setAssetClass] = useState<AssetClass>('residential');
  const [copied, setCopied] = useState(false);

  const memo = useMemo(() => buildMemoBlock(benchmarks, events, city, assetClass), [benchmarks, events, city, assetClass]);

  return (
    <div>
      <p style={{ fontSize: 12, color: 'rgba(60,60,67,0.6)', marginBottom: 14 }}>
        {lang === 'de'
          ? 'Auto-generierter Markt-Block pro Deal: Submarkt-Benchmarks, News-Kontext, mit Quellen und Datum. Spart 1–2 Stunden Recherche.'
          : 'Auto-generated market block per deal: submarket benchmarks, news context, with sources and dates. Saves 1–2 hours of research.'}
      </p>
      <div className="flex gap-3 mb-4 flex-wrap">
        {!lockedCity && (
          <select className="input-glass" value={city} onChange={e => setCity(e.target.value)} style={{ width: 200 }}>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <select className="input-glass" value={assetClass} onChange={e => setAssetClass(e.target.value as AssetClass)} style={{ width: 180 }}>
          {(['residential', 'office', 'retail', 'logistics'] as AssetClass[]).map(c => (
            <option key={c} value={c}>{ASSET_CLASS_LABEL[c]}</option>
          ))}
        </select>
        <button
          className="btn-glass px-3 py-2 rounded-lg text-sm flex items-center gap-1.5"
          style={{ cursor: 'pointer' }}
          onClick={() => { navigator.clipboard?.writeText(memo); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        >
          {copied ? <Check size={14} color="#1f9d4d" /> : <Copy size={14} />} {copied ? (lang === 'de' ? 'Kopiert' : 'Copied') : (lang === 'de' ? 'Kopieren' : 'Copy')}
        </button>
      </div>
      <div className="glass-card" style={{ padding: 22 }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
          <Sparkles size={15} color="#0a6cff" />
          <span style={{ fontWeight: 700 }}>IC Memo · Market Block</span>
        </div>
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.7, color: 'rgba(29,29,31,0.9)', margin: 0 }}>{memo}</pre>
      </div>
    </div>
  );
}

function buildMemoBlock(
  benchmarks: BenchmarkRecord[],
  events: ReturnType<typeof useStore.getState>['marketEvents'],
  city: string,
  assetClass: AssetClass,
): string {
  const rows = benchmarks.filter(
    b => b.city === city && b.assetClass === assetClass && b.sourceType !== 'portfolio_realised' && b.validationStatus !== 'rejected',
  );
  if (rows.length === 0) return `No validated benchmarks for ${city} · ${ASSET_CLASS_LABEL[assetClass]} yet.`;

  const period = rows[0].periodQuarter;
  const lines: string[] = [];
  lines.push(`MARKET CONTEXT — ${city.toUpperCase()} · ${ASSET_CLASS_LABEL[assetClass].toUpperCase()} (${period})`);
  lines.push('');
  for (const b of rows) {
    const where = b.submarket ? `${b.city}-${b.submarket}` : b.city;
    const prov = b.sourceCount > 1 ? `${b.sourceCount}-broker ${b.consolidationMethod}` : b.sourceProvider;
    const flag = b.confidenceTier === 'ai_indicative' ? ' [INDICATIVE — not IC-quotable]' : '';
    lines.push(`• ${KPI_LABEL[b.kpi]} (${where}): ${formatBenchmarkValue(b.value, b.unit)} — ${prov}, conf. ${b.confidenceScore.toFixed(2)}${flag}`);
  }
  const relevant = events.filter(e => !e.city || e.city === city).slice(0, 3);
  if (relevant.length) {
    lines.push('');
    lines.push('NEWS CONTEXT (descriptive):');
    for (const e of relevant) {
      lines.push(`• [${e.impactTier.toUpperCase()}] ${e.headline} (${new Date(e.publishedAt).toLocaleDateString('en-GB')})`);
    }
  }
  lines.push('');
  lines.push(`Source: realaize Market Intelligence Pipeline · multi-broker reconciled · ${period}. All figures source-attributed; drill-down available per value.`);
  return lines.join('\n');
}

// ── History tab ───────────────────────────────────────────────────────────────
// The master carries one reconciled value per KPI plus its prior quarter. We
// reconstruct a chronological quarterly series by extrapolating that recent
// QoQ delta backwards with damping (deterministic per city, so it never
// flickers). Two single-axis charts — rents (€/m²) and factor (×) — never a
// dual axis.

const HIST_COLOR = { prime: '#0a6cff', erv: '#1f9d4d', factor: '#c9a96e' };

function HistTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, padding: '8px 10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2" style={{ color: 'rgba(60,60,67,0.8)' }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: p.color, display: 'inline-block' }} />
          {p.name}: <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{unit === 'x' ? `${Number(p.value).toFixed(1)}×` : `${Number(p.value).toFixed(2)} €/m²`}</strong>
        </div>
      ))}
    </div>
  );
}

function HistoryTab({ benchmarks, lang }: { benchmarks: BenchmarkRecord[]; lang: string }) {
  const classes = useMemo(
    () => ASSET_ORDER.filter(ac => benchmarks.some(b => b.assetClass === ac && !b.submarket && (b.kpi === 'prime_rent' || b.kpi === 'erv' || b.kpi === 'multiplier'))),
    [benchmarks],
  );
  const [assetClass, setAssetClass] = useState<AssetClass>(classes.includes('residential') ? 'residential' : (classes[0] ?? 'residential'));
  const ac = classes.includes(assetClass) ? assetClass : (classes[0] ?? assetClass);

  const pick = (kpi: BenchmarkKpi) => benchmarks.find(b => b.assetClass === ac && b.kpi === kpi && !b.submarket);
  const primeRec = pick('prime_rent');
  const ervRec = pick('erv');
  const multRec = pick('multiplier');

  // Reads the persisted history (BenchmarkRecord.history) via benchmarkSeries;
  // falls back to the modeled reconstruction only where no real quarters exist.
  const data = useMemo(() => {
    const toMap = (rec?: BenchmarkRecord) => {
      if (!rec) return null;
      const m = new Map<string, number>();
      for (const p of benchmarkSeries(rec)) m.set(p.periodQuarter, p.value);
      return m;
    };
    const pS = toMap(primeRec), eS = toMap(ervRec), mS = toMap(multRec);
    const periods = Array.from(new Set<string>([
      ...(pS ? Array.from(pS.keys()) : []),
      ...(eS ? Array.from(eS.keys()) : []),
      ...(mS ? Array.from(mS.keys()) : []),
    ])).sort((a, b) => quarterOrdinal(a) - quarterOrdinal(b));
    return periods.map(q => ({ q, prime: pS?.get(q), erv: eS?.get(q), factor: mS?.get(q) }));
  }, [primeRec, ervRec, multRec]);

  const hasRent = !!primeRec || !!ervRec;
  const hasFactor = !!multRec;
  const de = lang === 'de';
  const primeName = de ? 'Spitzenmiete' : 'Prime rent';
  const ervName = de ? 'Ø-Miete / ERV' : 'Avg rent / ERV';
  const factorName = de ? 'Faktor' : 'Factor';

  // headline delta over the window
  const delta = (arr: (number | undefined)[]) => {
    const first = arr[0], last = arr[arr.length - 1];
    if (first === undefined || last === undefined || first === 0) return undefined;
    return ((last - first) / first) * 100;
  };
  const primeDelta = delta(data.map(d => d.prime));
  const ervDelta = delta(data.map(d => d.erv));
  const factorDelta = delta(data.map(d => d.factor));
  const deltaChip = (v: number | undefined) => v === undefined ? null : (
    <span style={{ fontSize: 11, fontWeight: 700, color: v >= 0 ? '#1f9d4d' : '#d92c20' }}>{v >= 0 ? '▲ +' : '▼ '}{v.toFixed(1)}%</span>
  );

  const axisTick = { fontSize: 11, fill: 'rgba(60,60,67,0.55)' };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p style={{ fontSize: 12, color: 'rgba(60,60,67,0.6)', margin: 0, maxWidth: 640 }}>
          {de
            ? `Chronologische Entwicklung der reconciled Benchmarks (${data.length} Quartale bis ${CURRENT_PERIOD}). Quelle: persistierte Zeitreihe je KPI.`
            : `Chronological development of the reconciled benchmarks (${data.length} quarters to ${CURRENT_PERIOD}). Source: persisted time series per KPI.`}
        </p>
        <select className="input-glass" value={ac} onChange={e => setAssetClass(e.target.value as AssetClass)} style={{ width: 180 }}>
          {classes.map(c => <option key={c} value={c}>{ASSET_CLASS_LABEL[c]}</option>)}
        </select>
      </div>

      {!hasRent && !hasFactor ? (
        <div className="glass-card" style={{ padding: 32, textAlign: 'center', color: 'rgba(60,60,67,0.5)', fontSize: 13 }}>
          {de ? 'Keine Zeitreihe für diese Auswahl.' : 'No time series for this selection.'}
        </div>
      ) : (
        <div className="space-y-4">
          {hasRent && (
            <div className="glass-card" style={{ padding: 18 }}>
              <div className="flex items-baseline justify-between gap-3" style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{de ? 'Mieten' : 'Rents'} <span style={{ fontWeight: 400, color: 'rgba(60,60,67,0.5)' }}>· €/m²/Monat</span></div>
                <div className="flex items-center gap-3">
                  {primeRec && <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.6)' }}>{primeName} {deltaChip(primeDelta)}</span>}
                  {ervRec && <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.6)' }}>{ervName} {deltaChip(ervDelta)}</span>}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={230}>
                <LineChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
                  <XAxis dataKey="q" tick={axisTick} tickLine={false} axisLine={{ stroke: 'rgba(0,0,0,0.1)' }} />
                  <YAxis tick={axisTick} tickLine={false} axisLine={false} width={48} domain={['auto', 'auto']} />
                  <Tooltip content={<HistTooltip unit="eur" />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} iconType="plainline" />
                  {primeRec && <Line name={primeName} type="monotone" dataKey="prime" stroke={HIST_COLOR.prime} strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} isAnimationActive={false} />}
                  {ervRec && <Line name={ervName} type="monotone" dataKey="erv" stroke={HIST_COLOR.erv} strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} isAnimationActive={false} />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {hasFactor && (
            <div className="glass-card" style={{ padding: 18 }}>
              <div className="flex items-baseline justify-between gap-3" style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{factorName} <span style={{ fontWeight: 400, color: 'rgba(60,60,67,0.5)' }}>· {de ? 'Vervielfältiger' : 'multiplier'} ×</span></div>
                <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.6)' }}>{de ? 'Veränderung' : 'change'} {deltaChip(factorDelta)}</span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
                  <XAxis dataKey="q" tick={axisTick} tickLine={false} axisLine={{ stroke: 'rgba(0,0,0,0.1)' }} />
                  <YAxis tick={axisTick} tickLine={false} axisLine={false} width={48} domain={['auto', 'auto']} allowDecimals={false} tickFormatter={(v: number) => `${v}×`} />
                  <Tooltip content={<HistTooltip unit="x" />} />
                  <Line name={factorName} type="monotone" dataKey="factor" stroke={HIST_COLOR.factor} strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.4)' }}>
            {de
              ? 'Zeitreihe wird auf dem Benchmark persistiert (Feld history[]). Werte vor dem aktuellen Quartal sind initial rekonstruiert; jeder Quartals-Refresh schreibt den dann aktuellen Wert fort.'
              : 'The series is persisted on the benchmark (history[] field). Quarters before the current one are seeded from a reconstruction; each quarterly refresh appends the then-current value.'}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sources tab ───────────────────────────────────────────────────────────────

function SourcesTab({ reportSources, refreshJobs, lang }: { reportSources: ReturnType<typeof useStore.getState>['reportSources']; refreshJobs: ReturnType<typeof useStore.getState>['refreshJobs']; lang: string }) {
  const byProvider = useMemo(() => {
    const m = new Map<string, typeof reportSources>();
    for (const r of reportSources) {
      const arr = m.get(r.provider) || [];
      arr.push(r);
      m.set(r.provider, arr);
    }
    return Array.from(m.entries());
  }, [reportSources]);

  return (
    <div className="grid gap-5" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{lang === 'de' ? 'report_sources Katalog' : 'report_sources catalog'}</h3>
        <div className="space-y-3">
          {byProvider.map(([provider, rows]) => (
            <div key={provider} className="glass-card" style={{ padding: 14 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                <span style={{ fontWeight: 700 }}>{provider}</span>
                <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.5)' }}>{rows.length} {lang === 'de' ? 'Konfigurationen' : 'configs'}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {rows.map(r => (
                  <Badge
                    key={r.id}
                    bg={r.status === 'broken' ? 'rgba(255,59,48,0.10)' : 'rgba(52,199,89,0.10)'}
                    color={r.status === 'broken' ? '#d92c20' : '#1f9d4d'}
                  >
                    {ASSET_CLASS_LABEL[r.assetClass]}{r.status === 'broken' ? ' · broken' : ''}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{lang === 'de' ? 'Refresh-Historie' : 'Refresh history'}</h3>
        <div className="space-y-3">
          {refreshJobs.map(j => (
            <div key={j.id} className="glass-card" style={{ padding: 14 }}>
              <div className="flex items-center justify-between">
                <span style={{ fontWeight: 700 }}>{j.periodQuarter}</span>
                <Badge bg={j.trigger === 'manual' ? 'rgba(88,86,214,0.12)' : 'rgba(0,122,255,0.10)'} color={j.trigger === 'manual' ? '#5856d6' : '#0a6cff'}>{j.trigger}</Badge>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.6)', marginTop: 6 }}>
                {new Date(j.triggeredAt).toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB')}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.7)', marginTop: 6 }}>
                {j.reportsFetched} reports · {j.dataPointsExtracted} {lang === 'de' ? 'Datenpunkte' : 'data points'} · {j.autoPassed} auto-passed · {j.pendingReview} pending
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
