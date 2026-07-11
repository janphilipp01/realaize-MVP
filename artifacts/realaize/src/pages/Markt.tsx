import { useState, useMemo } from 'react';
import { RefreshCw, CheckCircle, ChevronDown } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useLanguage } from '../i18n/LanguageContext';
import { GERMAN_TOP_CITIES } from '../utils/marketResearchAgent';
import { MarketIntelligencePanel } from './MarketIntelligence';
import { CURRENT_PERIOD } from '../data/marketIntelData';

// ══════════════════════════════════════════════════════════
// MARKT PAGE
// ══════════════════════════════════════════════════════════
export function MarktPage() {
  const { t, lang } = useLanguage();
  const benchmarks = useStore(s => s.benchmarks);
  const refreshJobs = useStore(s => s.refreshJobs);
  const triggerRefresh = useStore(s => s.triggerQuarterlyRefresh);
  const refreshCity = useStore(s => s.refreshCityBenchmarks);
  const dateLocale = lang === 'de' ? 'de-DE' : 'en-GB';

  const REVIEWER = 'J. Pleuker';
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingCity, setRefreshingCity] = useState<string | null>(null);
  const [updatedCity, setUpdatedCity] = useState<string | null>(null);
  const lastJob = refreshJobs[0];

  // Live-update one city's benchmarks (spinner → brief "updated" confirmation).
  const handleCityRefresh = (cityName: string) => {
    setRefreshingCity(cityName);
    setUpdatedCity(null);
    setTimeout(() => {
      refreshCity(cityName);
      setRefreshingCity(null);
      setUpdatedCity(cityName);
      setTimeout(() => setUpdatedCity(prev => (prev === cityName ? null : prev)), 1800);
    }, 900);
  };

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
              <div className="flex items-center gap-3 flex-wrap">
                <h2 style={{ fontSize: 20, fontWeight: 700 }}>{selectedCity}</h2>
                <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.45)' }}>{sub}</span>
                <button
                  onClick={() => handleCityRefresh(selectedCity)}
                  disabled={refreshingCity === selectedCity}
                  className="flex items-center gap-1.5"
                  title={lang === 'de' ? 'Daten dieser Stadt live aktualisieren' : 'Live-update this city’s data'}
                  style={{
                    padding: '4px 10px', borderRadius: 8,
                    border: `1px solid ${updatedCity === selectedCity ? 'rgba(52,199,89,0.4)' : 'rgba(0,122,255,0.3)'}`,
                    background: updatedCity === selectedCity ? 'rgba(52,199,89,0.10)' : 'rgba(0,122,255,0.06)',
                    color: updatedCity === selectedCity ? '#1f9d4d' : '#0a6cff',
                    fontSize: 11, fontWeight: 700,
                    cursor: refreshingCity === selectedCity ? 'default' : 'pointer',
                    opacity: refreshingCity === selectedCity ? 0.75 : 1,
                  }}
                >
                  {refreshingCity === selectedCity
                    ? <><RefreshCw size={12} className="animate-spin" /> {lang === 'de' ? 'Aktualisiere…' : 'Updating…'}</>
                    : updatedCity === selectedCity
                      ? <><CheckCircle size={12} /> {lang === 'de' ? 'Aktualisiert' : 'Updated'}</>
                      : <><RefreshCw size={12} /> {lang === 'de' ? 'Live-Update' : 'Live update'}</>}
                </button>
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

