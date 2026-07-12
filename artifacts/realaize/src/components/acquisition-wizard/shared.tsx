import React from 'react';
import { Lock, Building2, DollarSign, Users, Settings2, TrendingUp, HardHat, CreditCard, BarChart3, CheckCircle2 } from 'lucide-react';
import { formatEUR } from '@/utils/kpiEngine';
import type { PropertyData, FloorLevel } from '@/models/types';

// ── Constants ──────────────────────────────────────────────────────────────
export const USAGE_TYPES = ['Wohnen', 'Büro', 'Einzelhandel', 'Lager', 'Stellplatz', 'Sonstiges'] as const;
export const MAIN_USAGE = ['Wohnen', 'Büro', 'Einzelhandel', 'Logistik', 'Mixed Use'] as const;
export const FLOORS: FloorLevel[] = ['TG', 'KG', 'EG', '1.OG', '2.OG', '3.OG', '4.OG', '5.OG', '6.OG', 'DG'];
export const DEV_TYPES = ['Neubau', 'Kernsanierung', 'Modernisierung', 'Umbau', 'Aufstockung', 'Anbau'];
export const FINANCING_TYPES = ['Bankdarlehen', 'Mezzanine', 'Privates Darlehen', 'Gesellschafterdarlehen'] as const;
export const REPAYMENT_TYPES = ['Annuität', 'Endfällig'] as const;
export const COST_DISTRIBUTIONS = ['vorauszahlung', 'linear', '30-40-30', 'endfällig'] as const;

// Tab registry — each tab keyed by name. Order is built dynamically per dealType.
export type TabKey =
  | 'Stammdaten' | 'Acquisition' | 'Development' | 'Finanzierung'
  | 'Rent Roll'  | 'Opex'        | 'Market'      | 'Cashflow' | 'Summary';

export const TAB_ICONS: Record<TabKey, typeof Building2> = {
  'Stammdaten':   Building2,
  'Acquisition':  DollarSign,
  'Development':  HardHat,
  'Finanzierung': CreditCard,
  'Rent Roll':    Users,
  'Opex':         Settings2,
  'Market':       TrendingUp,
  'Cashflow':     BarChart3,
  'Summary':      CheckCircle2,
};

export const INVESTMENT_TABS: TabKey[] = ['Stammdaten', 'Acquisition', 'Finanzierung', 'Rent Roll', 'Opex', 'Market', 'Cashflow', 'Summary'];
export const DEVELOPMENT_TABS: TabKey[] = ['Stammdaten', 'Acquisition', 'Development', 'Finanzierung', 'Rent Roll', 'Opex', 'Market', 'Cashflow', 'Summary'];

export const uid = () => `id-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export function fmt(n: number) { return formatEUR(n, true); }
export function pct(n: number) { return `${n.toFixed(2)} %`; }

// ── Input helpers ──────────────────────────────────────────────────────────
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  locked?: boolean;
}
export function Field({ label, locked, ...props }: InputProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.55)', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
        {label}{locked && <Lock size={10} style={{ color: '#f59e0b' }} />}
      </label>
      <input className="input-glass" disabled={locked} {...props} style={{ opacity: locked ? 0.6 : 1, ...(props.style || {}) }} />
    </div>
  );
}
export interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  locked?: boolean;
}
export function SelectField({ label, locked, children, ...props }: SelectFieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.55)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}{locked && <Lock size={10} style={{ color: '#f59e0b', marginLeft: 4 }} />}
      </label>
      <select className="input-glass" disabled={locked} {...props}>{children}</select>
    </div>
  );
}

// ── KPI Chip ───────────────────────────────────────────────────────────────
export function Chip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: 'rgba(0,0,0,0.04)', borderRadius: 10, padding: '10px 14px', minWidth: 120 }}>
      <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || '#1c1c1e' }}>{value}</div>
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────
export function SH({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 700, color: '#1c1c1e', borderBottom: '1px solid rgba(0,0,0,0.08)', paddingBottom: 8, marginBottom: 16, marginTop: 24 }}>{children}</div>;
}

// ── Usage type single-select (button-style) ────────────────────────────────
export function UsageTypePicker({
  value,
  onChange,
}: {
  value: PropertyData['usageType'];
  onChange: (u: PropertyData['usageType']) => void;
}) {
  return (
    <div
      style={{
        display: 'flex', flexWrap: 'wrap', gap: 6,
        padding: '8px 10px',
        background: 'rgba(0,0,0,0.03)',
        border: '1px solid rgba(0,0,0,0.06)',
        borderRadius: 10,
        minHeight: 42,
      }}
    >
      {MAIN_USAGE.map(u => {
        const active = value === u;
        return (
          <button
            key={u}
            type="button"
            onClick={() => onChange(u)}
            style={{
              flex: '1 1 0',
              minWidth: 0,
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
              border: active ? '1px solid #007aff' : '1px solid rgba(0,0,0,0.08)',
              background: active ? 'linear-gradient(135deg, #007aff, #0051a8)' : 'rgba(255,255,255,0.7)',
              color: active ? '#fff' : 'rgba(60,60,67,0.65)',
              boxShadow: active ? '0 2px 8px rgba(0,122,255,0.2)' : 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {u}
          </button>
        );
      })}
    </div>
  );
}

// ── Floor multi-select (tag-style) ─────────────────────────────────────────
export function FloorTagPicker({
  value,
  onChange,
}: {
  value: FloorLevel[];
  onChange: (floors: FloorLevel[]) => void;
}) {
  const selected = new Set(value);
  const toggle = (f: FloorLevel) => {
    const next = new Set(selected);
    if (next.has(f)) next.delete(f);
    else next.add(f);
    // Preserve canonical FLOORS order in the output
    onChange(FLOORS.filter(x => next.has(x)));
  };
  return (
    <div
      style={{
        display: 'flex', flexWrap: 'wrap', gap: 6,
        padding: '8px 10px',
        background: 'rgba(0,0,0,0.03)',
        border: '1px solid rgba(0,0,0,0.06)',
        borderRadius: 10,
        minHeight: 42,
      }}
    >
      {FLOORS.map(f => {
        const active = selected.has(f);
        return (
          <button
            key={f}
            type="button"
            onClick={() => toggle(f)}
            style={{
              padding: '5px 11px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
              border: active ? '1px solid #007aff' : '1px solid rgba(0,0,0,0.08)',
              background: active ? 'linear-gradient(135deg, #007aff, #0051a8)' : 'rgba(255,255,255,0.7)',
              color: active ? '#fff' : 'rgba(60,60,67,0.65)',
              boxShadow: active ? '0 2px 8px rgba(0,122,255,0.2)' : 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {f}
          </button>
        );
      })}
      {value.length === 0 && (
        <span style={{ alignSelf: 'center', fontSize: 11, color: 'rgba(60,60,67,0.4)', fontStyle: 'italic', marginLeft: 4 }}>
          Keine Etagen ausgewählt
        </span>
      )}
    </div>
  );
}
