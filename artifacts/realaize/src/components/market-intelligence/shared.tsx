import { Activity, AlertTriangle, BadgeCheck, Database, FileText, Newspaper, ShieldCheck, TrendingUp } from 'lucide-react';
import { formatBenchmarkValue } from '../../utils/marketIntelligence';
import type { AssetClass, BenchmarkKpi, BenchmarkRecord, ConfidenceTier, ImpactTier, ValidationStatus } from '../../models/types';

export const REVIEWER = 'J. Pleuker';

export const TIER_STYLE: Record<ConfidenceTier, { bg: string; color: string; label: string }> = {
  pipeline_validated: { bg: 'rgba(52,199,89,0.12)', color: '#1f9d4d', label: 'Pipeline validated' },
  ai_indicative: { bg: 'rgba(255,149,0,0.14)', color: '#c2750a', label: 'AI indicative' },
  manual_override: { bg: 'rgba(175,82,222,0.14)', color: '#8e3fc0', label: 'Manual override' },
};

export const STATUS_STYLE: Record<ValidationStatus, { bg: string; color: string; label: string }> = {
  auto_passed: { bg: 'rgba(52,199,89,0.12)', color: '#1f9d4d', label: 'Auto-passed' },
  manual_approved: { bg: 'rgba(0,122,255,0.12)', color: '#0a6cff', label: 'Approved' },
  pending: { bg: 'rgba(255,149,0,0.14)', color: '#c2750a', label: 'Pending' },
  rejected: { bg: 'rgba(255,59,48,0.12)', color: '#d92c20', label: 'Rejected' },
};

export const IMPACT_STYLE: Record<ImpactTier, { bg: string; color: string }> = {
  high: { bg: 'rgba(255,59,48,0.12)', color: '#d92c20' },
  medium: { bg: 'rgba(255,149,0,0.14)', color: '#c2750a' },
  low: { bg: 'rgba(60,60,67,0.10)', color: 'rgba(60,60,67,0.7)' },
};

export function Badge({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
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

export const TABS = [
  { key: 'benchmarks', label: 'Benchmarks', icon: Database },
  { key: 'review', label: 'Review Queue', icon: ShieldCheck },
  { key: 'news', label: 'News Layer', icon: Newspaper },
  { key: 'crossval', label: 'Cross-Validation', icon: Activity },
  { key: 'memo', label: 'IC Memo Block', icon: FileText },
  { key: 'history', label: 'Historie', icon: TrendingUp },
  { key: 'sources', label: 'Sources', icon: BadgeCheck },
] as const;

export type TabKey = (typeof TABS)[number]['key'];

// Per-city Market Intelligence body: the KPI tiles + all six tabs, scoped to a
// single city. Rendered inside the merged Markt page when a city tile is opened.
export const ASSET_ORDER: AssetClass[] = ['residential', 'office', 'retail', 'logistics', 'mixed_use'];
export const KPI_ORDER: BenchmarkKpi[] = ['prime_rent', 'erv', 'net_initial_yield', 'prime_yield', 'multiplier', 'vacancy'];
export const CLASS_RGB: Record<string, string> = {
  residential: '96,165,250', office: '201,169,110', retail: '248,113,113',
  logistics: '74,222,128', mixed_use: '167,139,250',
};

export function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(60,60,67,0.45)', margin: '0 0 10px' }}>
      {children}
    </div>
  );
}

// Segmented by usage (section) → city-wide KPI row (Block A) + submarket
// comparison table (Block B), with KPIs in a fixed order across both.
export function ProvenanceDrilldown({ b, lang }: { b: BenchmarkRecord; lang: string }) {
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
