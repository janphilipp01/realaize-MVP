import { useState, useMemo } from 'react';
import { Area } from 'recharts';
import { RefreshCw, Search, AlertTriangle, X, Bot, ExternalLink, Radar, Target, ThumbsDown, ArrowRight } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { PageHeader, GlassPanel } from '@/components/shared';
import { formatEUR } from '@/utils/kpiEngine';
import { useLanguage } from '@/i18n/LanguageContext';
import { searchDealRadar } from '@/services/dealRadarAgent';
import { bestSignal, discountTone } from '@/utils/screening';
import { benchmarksToScreeningSeeds } from '@/utils/marketIntelligence';
import type { CandidateDeal, ProfileMatch } from '@/models/types';
import { screenValueAdd, BUILD_COST_RATES, SCOPE_LABEL, DEFAULT_SCREEN_PROFILE, resolveExitYieldBuffer, EXIT_BUFFER_PRIME, type RenovationScope } from '@/utils/valueAddScreening';

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

