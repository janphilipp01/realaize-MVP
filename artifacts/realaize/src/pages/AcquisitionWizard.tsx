import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  X, ChevronLeft, ChevronRight, Plus, Trash2, Lock, Copy,
  Building2, DollarSign, Users, Settings2, TrendingUp, HardHat,
  CreditCard, BarChart3, CheckCircle2, AlertTriangle
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, ReferenceLine
} from 'recharts';
import { GlassPanel, KPICard } from '../components/shared';
import { formatEUR, formatPct } from '../utils/kpiEngine';
import {
  pdComputeTotalAcquisitionCosts, pdComputeAnnualRent, pdComputeTotalArea,
  pdComputeWeightedERV, pdComputeWALT, pdComputeTotalDevBudget,
  pdComputeTotalCapitalRequirement, pdComputeTotalLoan, pdComputeEquity,
  pdComputePropertyNOI, pdComputePropertyCashFlowMonthly, pdAggregateToYears,
  pdComputePropertyKPIs,
} from '../utils/propertyCashFlowModel';
import type {
  PropertyData, RentRollUnit, AcquisitionCostItem, GewerkePosition,
  FinancingTranche, MarketAssumptionPerUsage, FloorLevel, DealType
} from '../models/types';
import {
  createDefaultPropertyData, DEFAULT_ACQUISITION_COSTS,
  DEFAULT_ERV_GROWTH, DEFAULT_EXIT_CAP, DEFAULT_GEWERKE_CATEGORIES
} from '../models/types';

// ── Constants ──────────────────────────────────────────────────────────────
const USAGE_TYPES = ['Wohnen', 'Büro', 'Einzelhandel', 'Lager', 'Stellplatz', 'Sonstiges'] as const;
const MAIN_USAGE = ['Wohnen', 'Büro', 'Einzelhandel', 'Logistik', 'Mixed Use'] as const;
const FLOORS: FloorLevel[] = ['TG', 'KG', 'EG', '1.OG', '2.OG', '3.OG', '4.OG', '5.OG', '6.OG', 'DG'];
const DEV_TYPES = ['Neubau', 'Kernsanierung', 'Modernisierung', 'Umbau', 'Aufstockung', 'Anbau'];
const FINANCING_TYPES = ['Bankdarlehen', 'Mezzanine', 'Privates Darlehen', 'Gesellschafterdarlehen'] as const;
const REPAYMENT_TYPES = ['Annuität', 'Endfällig'] as const;
const COST_DISTRIBUTIONS = ['vorauszahlung', 'linear', '30-40-30', 'endfällig'] as const;

// Tab registry — each tab keyed by name. Order is built dynamically per dealType.
type TabKey =
  | 'Stammdaten' | 'Acquisition' | 'Development' | 'Finanzierung'
  | 'Rent Roll'  | 'Opex'        | 'Market'      | 'Cashflow' | 'Summary';

const TAB_ICONS: Record<TabKey, typeof Building2> = {
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

const INVESTMENT_TABS: TabKey[] = ['Stammdaten', 'Acquisition', 'Finanzierung', 'Rent Roll', 'Opex', 'Market', 'Cashflow', 'Summary'];
const DEVELOPMENT_TABS: TabKey[] = ['Stammdaten', 'Acquisition', 'Development', 'Finanzierung', 'Rent Roll', 'Opex', 'Market', 'Cashflow', 'Summary'];

const uid = () => `id-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function fmt(n: number) { return formatEUR(n, true); }
function pct(n: number) { return `${n.toFixed(2)} %`; }

// ── Input helpers ──────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  locked?: boolean;
}
function Field({ label, locked, ...props }: InputProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.55)', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
        {label}{locked && <Lock size={10} style={{ color: '#f59e0b' }} />}
      </label>
      <input className="input-glass" disabled={locked} {...props} style={{ opacity: locked ? 0.6 : 1, ...(props.style || {}) }} />
    </div>
  );
}
interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  locked?: boolean;
}
function SelectField({ label, locked, children, ...props }: SelectFieldProps) {
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
function Chip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: 'rgba(0,0,0,0.04)', borderRadius: 10, padding: '10px 14px', minWidth: 120 }}>
      <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || '#1c1c1e' }}>{value}</div>
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────
function SH({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 700, color: '#1c1c1e', borderBottom: '1px solid rgba(0,0,0,0.08)', paddingBottom: 8, marginBottom: 16, marginTop: 24 }}>{children}</div>;
}

// ── Usage type single-select (button-style) ────────────────────────────────
function UsageTypePicker({
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
function FloorTagPicker({
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

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1: Stammdaten
// ═══════════════════════════════════════════════════════════════════════════
function TabStammdaten({ pd, onChange }: { pd: PropertyData; onChange: (p: Partial<PropertyData>) => void }) {
  const isDev = pd.dealType === 'Development';
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <SH>Objektdaten</SH>
      <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
        {(['Investment', 'Development'] as DealType[]).map(dt => {
          const active = pd.dealType === dt;
          return (
            <button
              key={dt}
              type="button"
              onClick={() => onChange({ dealType: dt })}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 10,
                border: active ? '1px solid #007aff' : '1px solid rgba(0,0,0,0.08)',
                background: active ? 'linear-gradient(135deg, #007aff, #0051a8)' : 'rgba(0,0,0,0.03)',
                color: active ? '#fff' : 'rgba(60,60,67,0.65)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s',
                boxShadow: active ? '0 4px 14px rgba(0,122,255,0.25)' : 'none',
              }}
            >
              {dt}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Objektname" value={pd.name} onChange={e => onChange({ name: e.target.value })} style={{ gridColumn: '1 / 3' }} />
        <div style={{ gridColumn: '1 / 3', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.55)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Hauptnutzungsart
          </label>
          <UsageTypePicker
            value={pd.usageType}
            onChange={(usageType) => onChange({ usageType })}
          />
        </div>
        <Field label="Adresse" value={pd.address} onChange={e => onChange({ address: e.target.value })} style={{ gridColumn: '1 / 3' }} />
        <Field label="PLZ" value={pd.zip} onChange={e => onChange({ zip: e.target.value })} />
        <Field label="Stadt" value={pd.city} onChange={e => onChange({ city: e.target.value })} />
        <div style={{ gridColumn: '1 / 3', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.55)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Etagen
          </label>
          <FloorTagPicker
            value={pd.floors}
            onChange={(floors) => onChange({ floors })}
          />
        </div>
      </div>
      {isDev && (
        <>
          <SH>Entwicklungstyp</SH>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <SelectField label="Entwicklungstyp" value={pd.developmentType || 'Modernisierung'} onChange={e => onChange({ developmentType: e.target.value })}>
              {DEV_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </SelectField>
            <Field label="Projektstart" type="date" value={pd.projectStart} onChange={e => onChange({ projectStart: e.target.value })} />
          </div>
        </>
      )}
      <SH>Parteien</SH>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Verkäufer" value={pd.vendor} onChange={e => onChange({ vendor: e.target.value })} />
        <Field label="Makler" value={pd.broker} onChange={e => onChange({ broker: e.target.value })} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2: Acquisition Costs
// ═══════════════════════════════════════════════════════════════════════════
function TabAcquisition({ pd, onChange }: { pd: PropertyData; onChange: (p: Partial<PropertyData>) => void }) {
  const totalAcqCosts = pdComputeTotalAcquisitionCosts(pd.purchasePrice, pd.acquisitionCosts);
  const totalAll = pd.purchasePrice + totalAcqCosts;
  const totalPct = pd.acquisitionCosts.filter(c => c.active).reduce((s, c) => s + c.percent, 0);

  const updateCostItem = (id: string, patch: Partial<AcquisitionCostItem>) => {
    onChange({ acquisitionCosts: pd.acquisitionCosts.map(c => c.id === id ? { ...c, ...patch } : c) });
  };

  return (
    <div>
      <SH>Kaufpreis & Erwerbsnebenkosten</SH>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <Field label="Kaufpreis (€)" type="number" value={pd.purchasePrice || ''} onChange={e => onChange({ purchasePrice: parseFloat(e.target.value) || 0 })} />
        <Field label="Signing-Datum" type="date" value={pd.acquisitionDate} onChange={e => onChange({ acquisitionDate: e.target.value })} />
      </div>

      <div style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8, marginBottom: 8, fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          <span>Position</span><span style={{ textAlign: 'right' }}>%</span><span style={{ textAlign: 'right' }}>Betrag</span><span>Aktiv</span>
        </div>
        {pd.acquisitionCosts.map(c => (
          <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <input className="input-glass" value={c.name} onChange={e => updateCostItem(c.id, { name: e.target.value })} style={{ fontSize: 13 }} />
            <input className="input-glass" type="number" step="0.1" value={c.percent} onChange={e => updateCostItem(c.id, { percent: parseFloat(e.target.value) || 0 })} style={{ width: 72, textAlign: 'right' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#007aff', minWidth: 90, textAlign: 'right' }}>{fmt(pd.purchasePrice * c.percent / 100)}</span>
            <input type="checkbox" checked={c.active} onChange={e => updateCostItem(c.id, { active: e.target.checked })} style={{ width: 16, height: 16 }} />
          </div>
        ))}
        <button
          className="btn-ghost"
          style={{
            fontSize: 12, marginTop: 6, whiteSpace: 'nowrap',
            display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
            border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '6px 12px',
          }}
          onClick={() => onChange({ acquisitionCosts: [...pd.acquisitionCosts, { id: uid(), name: 'Sonstiges', percent: 0, active: true }] })}
        >
          <Plus size={12} /> Position hinzufügen
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Chip label="ENK gesamt %" value={pct(totalPct)} color="#c9a96e" />
        <Chip label="ENK gesamt €" value={fmt(totalAcqCosts)} color="#c9a96e" />
        <Chip label="Gesamtinvestition" value={fmt(totalAll)} color="#007aff" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3: Rent Roll
// ═══════════════════════════════════════════════════════════════════════════
// ── Default factory for a new RentRollUnit ────────────────────────────────
function makeEmptyUnit(idx: number): RentRollUnit {
  return {
    id: uid(),
    unitNumber: `E-${idx + 1}`,
    floor: 'EG',
    area: 0,
    usageType: 'Wohnen',
    tenant: '',
    leaseStart: '',
    leaseDurationMonths: 60,
    leaseEndAction: 'Neuvermietung',
    currentRentPerSqm: 0,
    ervPerSqm: 0,
    monthlyRent: 0,
    indexationPercent: 100,
    nonRecoverableOpex: 0,
  };
}

// ── Schnellerfassung Modal — bulk-create N identical units ────────────────
interface QuickAddState {
  count: number;
  areaPerUnit: number;
  usageType: RentRollUnit['usageType'];
  floor: FloorLevel;
  tenant: string;
  leaseStart: string;
  leaseDurationMonths: number;
  leaseEndAction: 'Neuvermietung' | 'Leerstand';
  rentMode: 'perSqm' | 'monthly';
  currentRentPerSqm: number;
  monthlyRent: number;
  ervMode: 'perSqm' | 'monthly';
  ervPerSqm: number;
  ervMonthly: number;
  indexationPercent: number;
  nonRecoverableOpex: number;
}

function QuickAddModal({
  open,
  onClose,
  onCreate,
  startIndex,
  defaultLeaseStart,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (units: RentRollUnit[]) => void;
  startIndex: number;
  defaultLeaseStart: string;
}) {
  const [s, setS] = useState<QuickAddState>({
    count: 1,
    areaPerUnit: 0,
    usageType: 'Wohnen',
    floor: 'EG',
    tenant: '',
    leaseStart: defaultLeaseStart,
    leaseDurationMonths: 60,
    leaseEndAction: 'Neuvermietung',
    rentMode: 'perSqm',
    currentRentPerSqm: 0,
    monthlyRent: 0,
    ervMode: 'perSqm',
    ervPerSqm: 0,
    ervMonthly: 0,
    indexationPercent: 100,
    nonRecoverableOpex: 0,
  });
  const set = (patch: Partial<QuickAddState>) => setS(p => ({ ...p, ...patch }));

  if (!open) return null;

  const rentPerSqm = s.rentMode === 'perSqm'
    ? s.currentRentPerSqm
    : (s.areaPerUnit > 0 ? s.monthlyRent / s.areaPerUnit : 0);
  const monthlyRent = s.rentMode === 'monthly'
    ? s.monthlyRent
    : s.currentRentPerSqm * s.areaPerUnit;
  const ervPerSqm = s.ervMode === 'perSqm'
    ? s.ervPerSqm
    : (s.areaPerUnit > 0 ? s.ervMonthly / s.areaPerUnit : 0);

  const handleCreate = () => {
    const newUnits: RentRollUnit[] = Array.from({ length: Math.max(0, Math.floor(s.count)) }, (_, i) => ({
      id: uid(),
      unitNumber: `E-${startIndex + i + 1}`,
      floor: s.floor,
      area: s.areaPerUnit,
      usageType: s.usageType,
      tenant: s.tenant,
      leaseStart: s.leaseStart,
      leaseDurationMonths: s.leaseDurationMonths,
      leaseEndAction: s.leaseEndAction,
      currentRentPerSqm: rentPerSqm,
      ervPerSqm,
      monthlyRent,
      indexationPercent: s.indexationPercent,
      nonRecoverableOpex: s.nonRecoverableOpex,
    }));
    onCreate(newUnits);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 14, padding: 24, width: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.18)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Schnellerfassung</div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 4 }}><X size={14} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Anzahl Einheiten" type="number" min={1} value={s.count || ''} onChange={e => set({ count: parseInt(e.target.value) || 0 })} />
          <Field label="Fläche pro Einheit (m²)" type="number" step="0.1" value={s.areaPerUnit || ''} onChange={e => set({ areaPerUnit: parseFloat(e.target.value) || 0 })} />
          <SelectField label="Nutzungsart" value={s.usageType} onChange={e => set({ usageType: e.target.value as RentRollUnit['usageType'] })}>
            {USAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </SelectField>
          <SelectField label="Etage" value={s.floor} onChange={e => set({ floor: e.target.value as FloorLevel })}>
            {FLOORS.map(f => <option key={f} value={f}>{f}</option>)}
          </SelectField>
          <Field label="Mieter (optional)" value={s.tenant} onChange={e => set({ tenant: e.target.value })} placeholder="Leer = Leerstand" />
          <Field label="Mietstart" type="date" value={s.leaseStart} onChange={e => set({ leaseStart: e.target.value })} />
          <Field label="Laufzeit (Monate)" type="number" min={0} value={s.leaseDurationMonths || ''} onChange={e => set({ leaseDurationMonths: parseInt(e.target.value) || 0 })} />
          <SelectField label="Anschluss" value={s.leaseEndAction} onChange={e => set({ leaseEndAction: e.target.value as 'Neuvermietung' | 'Leerstand' })}>
            <option value="Neuvermietung">Neuvermietung</option>
            <option value="Leerstand">Leerstand</option>
          </SelectField>

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              {s.rentMode === 'perSqm'
                ? <Field label="Ist-Miete €/m²/Mo" type="number" step="0.01" value={s.currentRentPerSqm || ''} onChange={e => set({ currentRentPerSqm: parseFloat(e.target.value) || 0 })} />
                : <Field label="Ist-Miete €/Mo (gesamt)" type="number" value={s.monthlyRent || ''} onChange={e => set({ monthlyRent: parseFloat(e.target.value) || 0 })} />}
            </div>
            <button onClick={() => set({ rentMode: s.rentMode === 'perSqm' ? 'monthly' : 'perSqm' })} className="btn-ghost" style={{ fontSize: 11, marginBottom: 2 }} title="Eingabemodus wechseln">⟷</button>
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              {s.ervMode === 'perSqm'
                ? <Field label="ERV €/m²/Mo" type="number" step="0.01" value={s.ervPerSqm || ''} onChange={e => set({ ervPerSqm: parseFloat(e.target.value) || 0 })} />
                : <Field label="ERV €/Mo (gesamt)" type="number" value={s.ervMonthly || ''} onChange={e => set({ ervMonthly: parseFloat(e.target.value) || 0 })} />}
            </div>
            <button onClick={() => set({ ervMode: s.ervMode === 'perSqm' ? 'monthly' : 'perSqm' })} className="btn-ghost" style={{ fontSize: 11, marginBottom: 2 }} title="Eingabemodus wechseln">⟷</button>
          </div>

          <Field label="Indexierung % der Inflation" type="number" step="1" value={s.indexationPercent || ''} onChange={e => set({ indexationPercent: parseFloat(e.target.value) || 0 })} />
          <Field label="NK n.umlagef. €/Mo" type="number" value={s.nonRecoverableOpex || ''} onChange={e => set({ nonRecoverableOpex: parseFloat(e.target.value) || 0 })} />
        </div>
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} className="btn-ghost" style={{ fontSize: 12 }}>Abbrechen</button>
          <button onClick={handleCreate} className="btn-primary" style={{ fontSize: 13 }} disabled={s.count < 1}>
            <Plus size={12} /> {s.count || 0} Einheiten erzeugen
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Single editable rent roll section (Ist or Ziel) ───────────────────────
function RentRollSection({
  title,
  units,
  setUnits,
  waltDate,
  opexInflationPercent,
  delta,
  defaultLeaseStart,
  addLabel,
}: {
  title: string;
  units: RentRollUnit[];
  setUnits: (us: RentRollUnit[]) => void;
  waltDate: string;
  opexInflationPercent: number;
  delta?: { absolute: number; percent: number } | null;
  defaultLeaseStart: string;
  addLabel: string;
}) {
  const [quickOpen, setQuickOpen] = useState(false);

  const updateUnit = (id: string, patch: Partial<RentRollUnit>) => {
    setUnits(units.map(u => {
      if (u.id !== id) return u;
      const updated = { ...u, ...patch };
      if ('currentRentPerSqm' in patch || 'area' in patch) {
        updated.monthlyRent = updated.area * updated.currentRentPerSqm;
      }
      if ('monthlyRent' in patch && updated.area > 0) {
        updated.currentRentPerSqm = updated.monthlyRent / updated.area;
      }
      return updated;
    }));
  };

  const addUnit = () => setUnits([...units, makeEmptyUnit(units.length)]);

  const totalArea = pdComputeTotalArea(units);
  const annualRent = pdComputeAnnualRent(units);
  const avgRentPerSqm = totalArea > 0 ? (annualRent / 12) / totalArea : 0;
  const walt = pdComputeWALT(units, waltDate);

  const headers = ['Einheit', 'Etage', 'Fläche m²', 'Nutzung', 'Mieter', 'Mietstart', 'Laufzeit (Mon.)', 'Anschluss', '€/m²', 'ERV €/m²', 'Mon. Miete', 'Indexierung %', 'NK n.u. €/Mon', ''];

  return (
    <div style={{ marginBottom: 24 }}>
      <SH>{title}</SH>

      {/* Scroll container — only the table scrolls; buttons stay outside */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
              <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                {headers.map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 10, fontWeight: 700, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {units.length === 0 && (
                <tr>
                  <td colSpan={headers.length} style={{ padding: '24px 8px', textAlign: 'center', fontSize: 12, color: 'rgba(60,60,67,0.45)' }}>
                    Keine Positionen — über „+ Position hinzufügen" oder „Schnellerfassung" anlegen.
                  </td>
                </tr>
              )}
              {units.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                  <td style={{ padding: '4px 6px' }}><input className="input-glass" value={u.unitNumber} onChange={e => updateUnit(u.id, { unitNumber: e.target.value })} style={{ width: 64, fontSize: 12 }} /></td>
                  <td style={{ padding: '4px 6px' }}>
                    <select className="input-glass" value={u.floor} onChange={e => updateUnit(u.id, { floor: e.target.value as FloorLevel })} style={{ width: 64, fontSize: 12 }}>
                      {FLOORS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '4px 6px' }}><input className="input-glass" type="number" value={u.area || ''} onChange={e => updateUnit(u.id, { area: parseFloat(e.target.value) || 0 })} style={{ width: 72, fontSize: 12 }} /></td>
                  <td style={{ padding: '4px 6px' }}>
                    <select className="input-glass" value={u.usageType} onChange={e => updateUnit(u.id, { usageType: e.target.value as RentRollUnit['usageType'] })} style={{ width: 110, fontSize: 12 }}>
                      {USAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '4px 6px' }}><input className="input-glass" value={u.tenant} onChange={e => updateUnit(u.id, { tenant: e.target.value })} style={{ width: 110, fontSize: 12 }} placeholder="Leerstand" /></td>
                  <td style={{ padding: '4px 6px' }}><input className="input-glass" type="date" value={u.leaseStart || ''} onChange={e => updateUnit(u.id, { leaseStart: e.target.value })} style={{ width: 130, fontSize: 12 }} /></td>
                  <td style={{ padding: '4px 6px' }}><input className="input-glass" type="number" min={0} value={u.leaseDurationMonths || ''} onChange={e => updateUnit(u.id, { leaseDurationMonths: parseInt(e.target.value) || 0 })} style={{ width: 72, fontSize: 12 }} /></td>
                  <td style={{ padding: '4px 6px' }}>
                    <select className="input-glass" value={u.leaseEndAction} onChange={e => updateUnit(u.id, { leaseEndAction: e.target.value as 'Neuvermietung' | 'Leerstand' })} style={{ width: 130, fontSize: 12 }}>
                      <option value="Neuvermietung">Neuvermietung</option>
                      <option value="Leerstand">Leerstand</option>
                    </select>
                  </td>
                  <td style={{ padding: '4px 6px' }}><input className="input-glass" type="number" step="0.01" value={u.currentRentPerSqm || ''} onChange={e => updateUnit(u.id, { currentRentPerSqm: parseFloat(e.target.value) || 0 })} style={{ width: 72, fontSize: 12 }} /></td>
                  <td style={{ padding: '4px 6px' }}><input className="input-glass" type="number" step="0.01" value={u.ervPerSqm || ''} onChange={e => updateUnit(u.id, { ervPerSqm: parseFloat(e.target.value) || 0 })} style={{ width: 72, fontSize: 12 }} /></td>
                  <td style={{ padding: '4px 6px' }}><input className="input-glass" type="number" value={u.monthlyRent || ''} onChange={e => updateUnit(u.id, { monthlyRent: parseFloat(e.target.value) || 0 })} style={{ width: 90, fontSize: 12 }} /></td>
                  <td style={{ padding: '4px 6px' }}>
                    <input
                      className="input-glass"
                      type="number"
                      step="1"
                      title="Anteil der Inflation (aus Market) der auf die Miete angewendet wird"
                      value={u.indexationPercent ?? ''}
                      onChange={e => updateUnit(u.id, { indexationPercent: parseFloat(e.target.value) || 0 })}
                      style={{ width: 72, fontSize: 12 }}
                    />
                  </td>
                  <td style={{ padding: '4px 6px' }}><input className="input-glass" type="number" value={u.nonRecoverableOpex || ''} onChange={e => updateUnit(u.id, { nonRecoverableOpex: parseFloat(e.target.value) || 0 })} style={{ width: 90, fontSize: 12 }} /></td>
                  <td style={{ padding: '4px 6px' }}><button onClick={() => setUnits(units.filter(x => x.id !== u.id))} className="btn-ghost" style={{ padding: '4px', color: '#f87171' }}><Trash2 size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Buttons OUTSIDE the scroll container — single-line, section-specific labels */}
      <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 8, marginTop: 12, marginBottom: 16 }}>
        <button
          onClick={addUnit}
          className="btn-ghost"
          style={{
            fontSize: 12, whiteSpace: 'nowrap',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '6px 12px',
          }}
        >
          <Plus size={12} /> {addLabel}
        </button>
        <button
          onClick={() => setQuickOpen(true)}
          className="btn-ghost"
          style={{
            fontSize: 12, whiteSpace: 'nowrap',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '6px 12px',
          }}
        >
          Schnellerfassung
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <Chip label="Gesamtfläche" value={`${totalArea.toLocaleString('de-DE')} m²`} />
        <Chip label="Jahresmiete" value={fmt(annualRent)} color="#007aff" />
        <Chip label="Ø €/m²/Mo" value={`${avgRentPerSqm.toFixed(2)} €`} />
        <Chip label="WALT (Jahre)" value={walt.toFixed(1)} />
      </div>

      {delta && (
        <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(74,222,128,0.08)', fontSize: 13, color: '#1c1c1e' }}>
          <span style={{ fontWeight: 700 }}>Delta vs. Ist-Miete: </span>
          <span style={{ color: delta.absolute >= 0 ? '#16a34a' : '#dc2626' }}>
            {delta.absolute >= 0 ? '+' : ''}{fmt(delta.absolute)} ({delta.percent >= 0 ? '+' : ''}{delta.percent.toFixed(1)}%)
          </span>
        </div>
      )}

      {/* The Schnellerfassung modal hangs off this section so each section has its own */}
      <QuickAddModal
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        startIndex={units.length}
        defaultLeaseStart={defaultLeaseStart}
        onCreate={(newUnits) => setUnits([...units, ...newUnits])}
      />
      {/* Suppress unused-warning for opexInflationPercent — reserved for future per-section preview */}
      {opexInflationPercent < 0 && null}
    </div>
  );
}

function TabRentRoll({ pd, onChange }: { pd: PropertyData; onChange: (p: Partial<PropertyData>) => void }) {
  const isDev = pd.dealType === 'Development';
  const waltDate = pd.acquisitionDate || new Date().toISOString().split('T')[0];

  const istAnnual = pdComputeAnnualRent(pd.unitsAsIs);
  const zielAnnual = pdComputeAnnualRent(pd.unitsTarget);
  const delta = pd.unitsTarget.length > 0
    ? {
        absolute: zielAnnual - istAnnual,
        percent: istAnnual > 0 ? ((zielAnnual - istAnnual) / istAnnual) * 100 : 0,
      }
    : null;

  const copyAsIsToTarget = () => {
    const copied = pd.unitsAsIs.map(u => ({ ...u, id: uid(), sourceUnitId: u.id }));
    onChange({ unitsTarget: copied });
  };

  return (
    <div>
      <RentRollSection
        title="Ist-Miete (vor Development)"
        units={pd.unitsAsIs}
        setUnits={(us) => onChange({ unitsAsIs: us })}
        waltDate={waltDate}
        opexInflationPercent={pd.marketAssumptions.opexInflationPercent}
        defaultLeaseStart={pd.acquisitionDate || ''}
        addLabel="Ist-Mieter hinzufügen"
      />

      {isDev && (
        <>
          {pd.unitsTarget.length === 0 && pd.unitsAsIs.length > 0 && (
            <button onClick={copyAsIsToTarget} className="btn-ghost" style={{ fontSize: 12, marginBottom: 8 }}>
              <Copy size={12} /> Ist-Mieten als Startpunkt für Zielmiete übernehmen
            </button>
          )}
          <RentRollSection
            title="Zielmiete (nach Development)"
            units={pd.unitsTarget}
            setUnits={(us) => onChange({ unitsTarget: us })}
            waltDate={waltDate}
            opexInflationPercent={pd.marketAssumptions.opexInflationPercent}
            delta={delta}
            defaultLeaseStart={pd.acquisitionDate || ''}
            addLabel="Ziel-Mieter hinzufügen"
          />
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 4: Opex
// ═══════════════════════════════════════════════════════════════════════════
function TabOpex({ pd, onChange }: { pd: PropertyData; onChange: (p: Partial<PropertyData>) => void }) {
  const oc = pd.operatingCosts;
  const set = (patch: Partial<typeof oc>) => onChange({ operatingCosts: { ...oc, ...patch } });
  const noiIst = pdComputePropertyNOI(pd, false);
  const noiZiel = pd.unitsTarget.length > 0 ? pdComputePropertyNOI(pd, true) : noiIst;

  return (
    <div>
      <SH>Betriebskosten & Bewirtschaftung</SH>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <Field label="Leerstandsrate %" type="number" step="0.1" value={oc.vacancyRatePercent} onChange={e => set({ vacancyRatePercent: parseFloat(e.target.value) || 0 })} />
        <Field label="Verwaltungskosten % (von GRI)" type="number" step="0.1" value={oc.managementCostPercent} onChange={e => set({ managementCostPercent: parseFloat(e.target.value) || 0 })} />
        <Field label="Instandhaltungsreserve €/m²/Jahr" type="number" step="0.5" value={oc.maintenanceReservePerSqm} onChange={e => set({ maintenanceReservePerSqm: parseFloat(e.target.value) || 0 })} />
        <Field label="Versicherung €/Jahr" type="number" value={oc.insurancePerYear} onChange={e => set({ insurancePerYear: parseFloat(e.target.value) || 0 })} />
        <Field label="Grundsteuer €/Jahr" type="number" value={oc.propertyTaxPerYear} onChange={e => set({ propertyTaxPerYear: parseFloat(e.target.value) || 0 })} />
        <Field label="Sonstiger Aufwand €/Jahr" type="number" value={oc.otherOpexPerYear} onChange={e => set({ otherOpexPerYear: parseFloat(e.target.value) || 0 })} />
        <Field label="Sonstige Erträge €/Jahr" type="number" value={oc.otherIncomePerYear} onChange={e => set({ otherIncomePerYear: parseFloat(e.target.value) || 0 })} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Chip label="NOI Ist p.a." value={fmt(noiIst)} color="#007aff" />
        <Chip label="NOI Ziel p.a." value={fmt(noiZiel)} color="#4ade80" />
        <Chip label="NIY" value={pd.purchasePrice > 0 ? pct(noiIst / pd.purchasePrice * 100) : '—'} color="#c9a96e" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 5: Market Assumptions
// ═══════════════════════════════════════════════════════════════════════════
function TabMarket({ pd, onChange }: { pd: PropertyData; onChange: (p: Partial<PropertyData>) => void }) {
  const ma = pd.marketAssumptions;
  const setMA = (patch: Partial<typeof ma>) => onChange({ marketAssumptions: { ...ma, ...patch } });

  const usageTypes = Array.from(new Set([
    ...pd.unitsAsIs.map(u => u.usageType),
    ...pd.unitsTarget.map(u => u.usageType),
  ])).filter(Boolean);

  const ensureUsageType = (ut: string) => {
    if (!ma.perUsageType.find(m => m.usageType === ut)) {
      setMA({
        perUsageType: [...ma.perUsageType, {
          usageType: ut, ervFromRentRoll: 0,
          ervGrowthRatePercent: DEFAULT_ERV_GROWTH[ut] ?? 2.0,
          exitCapRatePercent: DEFAULT_EXIT_CAP[ut] ?? 5.0,
          exitMultiplier: 1 / ((DEFAULT_EXIT_CAP[ut] ?? 5.0) / 100),
        }]
      });
    }
  };

  const updateRow = (ut: string, patch: Partial<MarketAssumptionPerUsage>) => {
    setMA({
      perUsageType: ma.perUsageType.map(m => m.usageType === ut ? { ...m, ...patch } : m)
    });
  };

  return (
    <div>
      <SH>Marktannahmen je Nutzungsart</SH>
      {usageTypes.length === 0 && (
        <div style={{ color: 'rgba(60,60,67,0.45)', fontSize: 13, marginBottom: 16 }}>Bitte zuerst Einheiten im Rent Roll eintragen.</div>
      )}
      {usageTypes.map(ut => {
        const row = ma.perUsageType.find(m => m.usageType === ut);
        if (!row) { ensureUsageType(ut); return null; }
        return (
          <div key={ut} style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1c1c1e', marginBottom: 12 }}>{ut}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <Field label="ERV-Wachstum % p.a." type="number" step="0.1" value={row.ervGrowthRatePercent} onChange={e => updateRow(ut, { ervGrowthRatePercent: parseFloat(e.target.value) || 0 })} />
              <Field label="Exit Cap Rate %" type="number" step="0.1" value={row.exitCapRatePercent} onChange={e => {
                const cap = parseFloat(e.target.value) || 5;
                updateRow(ut, { exitCapRatePercent: cap, exitMultiplier: cap > 0 ? parseFloat((100 / cap).toFixed(1)) : 0 });
              }} />
              <Field label="Exit-Multiplikator x" type="number" step="0.1" value={row.exitMultiplier} onChange={e => {
                const mult = parseFloat(e.target.value) || 1;
                updateRow(ut, { exitMultiplier: mult, exitCapRatePercent: mult > 0 ? parseFloat((100 / mult).toFixed(2)) : 0 });
              }} />
            </div>
          </div>
        );
      })}

      <SH>Allgemeine Inflationsannahmen</SH>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Field label="Opex-Inflation % p.a." type="number" step="0.1" value={ma.opexInflationPercent} onChange={e => setMA({ opexInflationPercent: parseFloat(e.target.value) || 0 })} />
        <Field label="Capex-Inflation % p.a." type="number" step="0.1" value={ma.capexInflationPercent} onChange={e => setMA({ capexInflationPercent: parseFloat(e.target.value) || 0 })} />
        <Field label="Verkaufskosten %" type="number" step="0.1" value={ma.salesCostPercent} onChange={e => setMA({ salesCostPercent: parseFloat(e.target.value) || 0 })} />
      </div>
      <div style={{ marginTop: 16 }}>
        <Field label="Haltedauer (Jahre)" type="number" value={pd.holdingPeriodYears} onChange={e => onChange({ holdingPeriodYears: parseInt(e.target.value) || 10 })} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 6: Development / Gewerke
// ═══════════════════════════════════════════════════════════════════════════
function TabDevelopment({ pd, onChange }: { pd: PropertyData; onChange: (p: Partial<PropertyData>) => void }) {
  const totalArea = pdComputeTotalArea(pd.unitsTarget.length > 0 ? pd.unitsTarget : pd.unitsAsIs);
  const rawBudget = pd.gewerke.reduce((s, g) => s + g.budgetTotal, 0);
  const totalBudget = pdComputeTotalDevBudget(pd.gewerke, pd.contingencyPercent);

  const addGewerk = () => {
    onChange({
      gewerke: [...pd.gewerke, {
        id: uid(), category: 'Rohbau', description: '',
        budgetInputMode: 'pauschal', budgetAmount: 0, budgetTotal: 0, costPerSqm: 0,
        startWeek: 1, durationWeeks: 8, endWeek: 9,
        costDistribution: 'linear', status: 'Geplant',
      }]
    });
  };

  const updateGw = (id: string, patch: Partial<GewerkePosition>) => {
    onChange({
      gewerke: pd.gewerke.map(g => {
        if (g.id !== id) return g;
        const updated = { ...g, ...patch };
        if ('budgetAmount' in patch || 'budgetInputMode' in patch) {
          updated.budgetTotal = updated.budgetInputMode === 'per_sqm'
            ? updated.budgetAmount * totalArea
            : updated.budgetAmount;
          updated.costPerSqm = totalArea > 0 ? updated.budgetTotal / totalArea : 0;
        }
        if ('startWeek' in patch || 'durationWeeks' in patch) {
          updated.endWeek = updated.startWeek + updated.durationWeeks - 1;
        }
        return updated;
      })
    });
  };

  const maxWeek = pd.gewerke.length > 0 ? Math.max(...pd.gewerke.map(g => g.startWeek + g.durationWeeks - 1)) : 0;
  const ganttWidth = Math.max(maxWeek, 1);

  return (
    <div>
      <SH>Projektparameter</SH>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
        <Field label="Projektstart" type="date" value={pd.projectStart} onChange={e => onChange({ projectStart: e.target.value })} />
        <Field label="Contingency %" type="number" step="0.5" value={pd.contingencyPercent} onChange={e => onChange({ contingencyPercent: parseFloat(e.target.value) || 0 })} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'flex-end' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Gesamtbudget inkl. Contingency</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#007aff' }}>{fmt(totalBudget)}</div>
        </div>
      </div>

      <SH>Gewerke</SH>
      <div style={{ overflowX: 'auto', marginBottom: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
              {['Gewerk', 'Beschreibung', 'Modus', 'Budget', 'Start KW', 'Dauer KW', 'Gesamt €', 'Verteilung', 'Status', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 10, fontWeight: 700, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pd.gewerke.map(g => (
              <tr key={g.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                <td style={{ padding: '4px 6px' }}>
                  <select className="input-glass" value={g.category} onChange={e => updateGw(g.id, { category: e.target.value })} style={{ width: 130, fontSize: 12 }}>
                    {DEFAULT_GEWERKE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td style={{ padding: '4px 6px' }}><input className="input-glass" value={g.description} onChange={e => updateGw(g.id, { description: e.target.value })} style={{ width: 120, fontSize: 12 }} /></td>
                <td style={{ padding: '4px 6px' }}>
                  <select className="input-glass" value={g.budgetInputMode} onChange={e => updateGw(g.id, { budgetInputMode: e.target.value as any })} style={{ width: 80, fontSize: 12 }}>
                    <option value="pauschal">Pausch.</option>
                    <option value="per_sqm">€/m²</option>
                  </select>
                </td>
                <td style={{ padding: '4px 6px' }}><input className="input-glass" type="number" value={g.budgetAmount || ''} onChange={e => updateGw(g.id, { budgetAmount: parseFloat(e.target.value) || 0 })} style={{ width: 90, fontSize: 12 }} /></td>
                <td style={{ padding: '4px 6px' }}><input className="input-glass" type="number" value={g.startWeek} onChange={e => updateGw(g.id, { startWeek: parseInt(e.target.value) || 1 })} style={{ width: 56, fontSize: 12 }} /></td>
                <td style={{ padding: '4px 6px' }}><input className="input-glass" type="number" value={g.durationWeeks} onChange={e => updateGw(g.id, { durationWeeks: parseInt(e.target.value) || 1 })} style={{ width: 56, fontSize: 12 }} /></td>
                <td style={{ padding: '4px 6px', fontWeight: 600, color: '#007aff', whiteSpace: 'nowrap' }}>{fmt(g.budgetTotal)}</td>
                <td style={{ padding: '4px 6px' }}>
                  <select className="input-glass" value={g.costDistribution} onChange={e => updateGw(g.id, { costDistribution: e.target.value as any })} style={{ width: 90, fontSize: 12 }}>
                    {COST_DISTRIBUTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </td>
                <td style={{ padding: '4px 6px' }}>
                  <select className="input-glass" value={g.status} onChange={e => updateGw(g.id, { status: e.target.value as any })} style={{ width: 100, fontSize: 12 }}>
                    {['Geplant', 'Beauftragt', 'Laufend', 'Abgeschlossen'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td style={{ padding: '4px 6px' }}><button onClick={() => onChange({ gewerke: pd.gewerke.filter(x => x.id !== g.id) })} className="btn-ghost" style={{ padding: '4px', color: '#f87171' }}><Trash2 size={13} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={addGewerk}
        className="btn-ghost"
        style={{
          fontSize: 12, marginBottom: 24, whiteSpace: 'nowrap',
          display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
          border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '6px 12px',
        }}
      >
        <Plus size={12} /> Gewerk hinzufügen
      </button>

      {pd.gewerke.length > 0 && (
        <>
          <SH>Bauablauf (Gantt)</SH>
          <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
            <div style={{ minWidth: ganttWidth * 14 + 160, fontFamily: 'monospace' }}>
              {pd.gewerke.map((g, i) => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 4, height: 22 }}>
                  <div style={{ width: 160, fontSize: 11, color: 'rgba(60,60,67,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{g.category}</div>
                  <div style={{ flex: 1, position: 'relative', height: 18 }}>
                    <div style={{
                      position: 'absolute',
                      left: `${((g.startWeek - 1) / ganttWidth) * 100}%`,
                      width: `${(g.durationWeeks / ganttWidth) * 100}%`,
                      height: '100%',
                      background: 'rgba(0,122,255,0.25)',
                      border: '1px solid rgba(0,122,255,0.5)',
                      borderRadius: 4,
                      display: 'flex', alignItems: 'center', paddingLeft: 4,
                    }}>
                      <span style={{ fontSize: 10, color: '#007aff', whiteSpace: 'nowrap' }}>{fmt(g.budgetTotal)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16 }}>
            <Chip label="Budget netto" value={fmt(rawBudget)} />
            <Chip label="Contingency" value={fmt(totalBudget - rawBudget)} color="#f59e0b" />
            <Chip label="Budget gesamt" value={fmt(totalBudget)} color="#007aff" />
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 7: Finanzierung
// ═══════════════════════════════════════════════════════════════════════════
function TabFinanzierung({ pd, onChange }: { pd: PropertyData; onChange: (p: Partial<PropertyData>) => void }) {
  const totalCapReq = pdComputeTotalCapitalRequirement(pd);
  const totalLoan = pdComputeTotalLoan(pd.financingTranches);
  const equity = pdComputeEquity(pd);
  const ltv = totalCapReq > 0 ? (totalLoan / totalCapReq) * 100 : 0;

  const addTranche = () => {
    onChange({
      financingTranches: [...pd.financingTranches, {
        id: uid(), name: `Tranche ${pd.financingTranches.length + 1}`,
        financingType: 'Bankdarlehen', loanAmount: 0, interestRate: 4.0,
        fixedRatePeriod: 5, loanTerm: 10, repaymentType: 'Annuität',
        amortizationRate: 2.0, disbursementDate: pd.acquisitionDate,
      }]
    });
  };

  const updateTranche = (id: string, patch: Partial<FinancingTranche>) => {
    onChange({ financingTranches: pd.financingTranches.map(t => t.id === id ? { ...t, ...patch } : t) });
  };

  return (
    <div>
      <SH>Finanzierungstranchen</SH>
      {pd.financingTranches.map(t => (
        <div key={t.id} style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <input className="input-glass" value={t.name} onChange={e => updateTranche(t.id, { name: e.target.value })} style={{ fontWeight: 700, fontSize: 14, width: 200 }} />
            <button onClick={() => onChange({ financingTranches: pd.financingTranches.filter(x => x.id !== t.id) })} className="btn-ghost" style={{ color: '#f87171', padding: '4px 8px' }}><Trash2 size={14} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <SelectField label="Finanzierungsart" value={t.financingType} onChange={e => updateTranche(t.id, { financingType: e.target.value as any })}>
              {FINANCING_TYPES.map(ft => <option key={ft} value={ft}>{ft}</option>)}
            </SelectField>
            <Field label="Darlehensbetrag €" type="number" value={t.loanAmount || ''} onChange={e => updateTranche(t.id, { loanAmount: parseFloat(e.target.value) || 0 })} />
            <Field label="Zinssatz % p.a." type="number" step="0.1" value={t.interestRate} onChange={e => updateTranche(t.id, { interestRate: parseFloat(e.target.value) || 0 })} />
            <Field label="Zinsbindung (Jahre)" type="number" value={t.fixedRatePeriod} onChange={e => updateTranche(t.id, { fixedRatePeriod: parseInt(e.target.value) || 0 })} />
            <Field label="Laufzeit (Jahre)" type="number" value={t.loanTerm} onChange={e => updateTranche(t.id, { loanTerm: parseInt(e.target.value) || 0 })} />
            <SelectField label="Tilgungsart" value={t.repaymentType} onChange={e => updateTranche(t.id, { repaymentType: e.target.value as any })}>
              {REPAYMENT_TYPES.map(rt => <option key={rt} value={rt}>{rt}</option>)}
            </SelectField>
            <Field label="Auszahlungsdatum" type="date" value={t.disbursementDate || ''} onChange={e => updateTranche(t.id, { disbursementDate: e.target.value })} />
          </div>
        </div>
      ))}
      <button
        onClick={addTranche}
        className="btn-ghost"
        style={{
          fontSize: 12, marginBottom: 20, whiteSpace: 'nowrap',
          display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
          border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '6px 12px',
        }}
      >
        <Plus size={12} /> Tranche hinzufügen
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <Chip label="Gesamtinvestition" value={fmt(totalCapReq)} />
        <Chip label="Fremdkapital" value={fmt(totalLoan)} color="#f87171" />
        <Chip label="Eigenkapital" value={fmt(equity)} color="#4ade80" />
        <Chip label="LTV" value={pct(ltv)} color={ltv > 70 ? '#f87171' : ltv > 60 ? '#fbbf24' : '#4ade80'} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 8: Cashflow
// ═══════════════════════════════════════════════════════════════════════════
function TabCashflow({ pd }: { pd: PropertyData }) {
  const years = useMemo(() => {
    if (!pd.purchasePrice) return [];
    try {
      const months = pdComputePropertyCashFlowMonthly(pd);
      return pdAggregateToYears(months);
    } catch { return []; }
  }, [pd]);

  const chartData = years.map(y => ({
    name: `J${y.yearIndex + 1}`,
    NOI: Math.round(y.noi),
    Transaktion: Math.round(y.transactionsCashflow),
    Debt: Math.round(y.debtCashflow),
    'Kum. FCF': Math.round(y.cumulativeFreeCashflow),
  }));

  if (years.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'rgba(60,60,67,0.45)' }}>
        <BarChart3 size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
        <div>Bitte Kaufpreis und Rent Roll befüllen, um den Cashflow zu berechnen.</div>
      </div>
    );
  }

  return (
    <div>
      <SH>Jahres-Cashflow-Übersicht</SH>
      <div style={{ height: 260, marginBottom: 24 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => formatEUR(v)} labelStyle={{ fontWeight: 700 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="NOI" fill="#007aff" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Transaktion" fill="#c9a96e" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Debt" fill="#f87171" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <SH>Kumulativer Free Cashflow</SH>
      <div style={{ height: 200, marginBottom: 24 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => formatEUR(v)} />
            <ReferenceLine y={0} stroke="rgba(0,0,0,0.2)" />
            <Line type="monotone" dataKey="Kum. FCF" stroke="#4ade80" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <SH>Cashflow-Tabelle</SH>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
              {['Jahr', 'GRI', 'NOI', 'Capex', 'Transaktion', 'Debt CF', 'Free CF', 'Kum. FCF'].map(h => (
                <th key={h} style={{ textAlign: 'right', padding: '6px 8px', fontSize: 10, fontWeight: 700, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map(y => (
              <tr key={y.yearIndex} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                <td style={{ textAlign: 'right', padding: '5px 8px', fontWeight: 600 }}>J{y.yearIndex + 1}</td>
                <td style={{ textAlign: 'right', padding: '5px 8px' }}>{fmt(y.grossRentalIncome)}</td>
                <td style={{ textAlign: 'right', padding: '5px 8px', color: '#007aff', fontWeight: 600 }}>{fmt(y.noi)}</td>
                <td style={{ textAlign: 'right', padding: '5px 8px', color: '#f87171' }}>{y.capexConstructionCosts > 0 ? fmt(-y.capexConstructionCosts) : '—'}</td>
                <td style={{ textAlign: 'right', padding: '5px 8px', color: '#c9a96e' }}>{fmt(y.transactionsCashflow)}</td>
                <td style={{ textAlign: 'right', padding: '5px 8px', color: '#f87171' }}>{fmt(y.debtCashflow)}</td>
                <td style={{ textAlign: 'right', padding: '5px 8px', fontWeight: 600, color: y.freeCashflow >= 0 ? '#4ade80' : '#f87171' }}>{fmt(y.freeCashflow)}</td>
                <td style={{ textAlign: 'right', padding: '5px 8px', fontWeight: 700, color: y.cumulativeFreeCashflow >= 0 ? '#4ade80' : '#f87171' }}>{fmt(y.cumulativeFreeCashflow)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 9: Summary / IC Sheet
// ═══════════════════════════════════════════════════════════════════════════
function TabSummary({ pd }: { pd: PropertyData }) {
  const kpis = useMemo(() => {
    if (!pd.purchasePrice) return null;
    try { return pdComputePropertyKPIs(pd); } catch { return null; }
  }, [pd]);

  const totalCapReq = pdComputeTotalCapitalRequirement(pd);
  const totalLoan = pdComputeTotalLoan(pd.financingTranches);
  const equity = totalCapReq - totalLoan;
  const ltv = totalCapReq > 0 ? (totalLoan / totalCapReq) * 100 : 0;

  // Helpers for the assumption cards — keeps the layout uniform
  const StatRow = ({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) => (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '6px 0', borderBottom: '1px dashed rgba(0,0,0,0.06)',
      fontSize: 12,
    }}>
      <span style={{ color: 'rgba(60,60,67,0.55)' }}>{label}</span>
      <span style={{ fontWeight: strong ? 700 : 600, color: '#1c1c1e' }}>{value}</span>
    </div>
  );

  const AssumptionCard = ({ title: t, children }: { title: string; children: React.ReactNode }) => (
    <div style={{
      background: 'rgba(0,0,0,0.03)', borderRadius: 12, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: 'rgba(60,60,67,0.45)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
      }}>{t}</div>
      {children}
    </div>
  );

  return (
    <div>
      <SH>Investment Summary</SH>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24, alignItems: 'stretch' }}>
        <GlassPanel style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Objekt</div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1c1c1e' }}>{pd.name || '—'}</div>
            <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.55)' }}>
              {pd.address || '—'}{pd.address && (pd.zip || pd.city) ? ', ' : ''}{pd.zip} {pd.city}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              <span style={{ background: 'rgba(0,122,255,0.1)', color: '#007aff', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6 }}>{pd.dealType}</span>
              <span style={{ background: 'rgba(201,169,110,0.1)', color: '#c9a96e', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6 }}>{pd.usageType}</span>
              <span style={{ background: 'rgba(60,60,67,0.06)', color: 'rgba(60,60,67,0.65)', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6 }}>
                Haltedauer {pd.holdingPeriodYears}J
              </span>
            </div>
          </div>
        </GlassPanel>
        <GlassPanel style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Kapitalstruktur</div>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Chip label="Kaufpreis" value={fmt(pd.purchasePrice)} />
            <Chip label="Gesamtinvestition" value={fmt(totalCapReq)} color="#007aff" />
            <Chip label="Fremdkapital" value={fmt(totalLoan)} color="#f87171" />
            <Chip label="Eigenkapital" value={fmt(equity)} color="#4ade80" />
          </div>
        </GlassPanel>
      </div>

      <SH>Key Performance Indicators</SH>
      {kpis ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
          <KPICard label="NIY" value={formatPct(kpis.niyAtAcquisition)} trend={kpis.niyAtAcquisition >= 4 ? 'up' : 'down'} />
          <KPICard label="NOI Ist" value={fmt(kpis.noiIst)} />
          <KPICard label="GRI p.a." value={fmt(kpis.gri)} />
          <KPICard label="LTV" value={formatPct(ltv)} trend={ltv <= 65 ? 'up' : 'down'} />
          <KPICard label="DSCR" value={kpis.dscr > 900 ? '—' : kpis.dscr.toFixed(2) + 'x'} trend={kpis.dscr >= 1.25 ? 'up' : 'down'} />
          <KPICard label="IRR 10J" value={formatPct(kpis.irr10Year)} trend={kpis.irr10Year >= 8 ? 'up' : 'neutral'} />
          <KPICard label="Equity Multiple" value={kpis.equityMultiple10Year.toFixed(2) + 'x'} />
          <KPICard label="Payback (Jahre)" value={kpis.paybackPeriodYears.toString()} />
          {pd.dealType === 'Development' && (
            <>
              <KPICard label="Dev. Profit" value={fmt(kpis.developmentProfit)} trend={kpis.developmentProfit >= 0 ? 'up' : 'down'} />
              <KPICard label="Profit on Cost" value={formatPct(kpis.profitOnCost)} trend={kpis.profitOnCost >= 15 ? 'up' : 'down'} />
              <KPICard label="Net Dev. Yield" value={formatPct(kpis.netDevelopmentYield)} />
              <KPICard label="NOI Ziel" value={fmt(kpis.noiZiel)} trend="up" />
            </>
          )}
        </div>
      ) : (
        <div style={{ padding: 32, textAlign: 'center', color: 'rgba(60,60,67,0.45)' }}>
          <AlertTriangle size={24} style={{ marginBottom: 8, opacity: 0.4 }} />
          <div>Kaufpreis und Rent Roll befüllen, um KPIs zu berechnen.</div>
        </div>
      )}

      <SH>Annahmen-Zusammenfassung</SH>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        <AssumptionCard title="Finanzierung">
          <StatRow label="LTV" value={formatPct(ltv)} strong />
          <StatRow label="Tranchen" value={pd.financingTranches.length || '—'} />
          {pd.financingTranches.map(t => (
            <StatRow
              key={t.id}
              label={t.name}
              value={`${fmt(t.loanAmount)} · ${t.interestRate}%`}
            />
          ))}
        </AssumptionCard>
        <AssumptionCard title="Markt">
          <StatRow label="Haltedauer" value={`${pd.holdingPeriodYears} J`} strong />
          <StatRow label="Opex-Inflation" value={`${pd.marketAssumptions.opexInflationPercent}%`} />
          {pd.marketAssumptions.perUsageType.map(m => (
            <StatRow
              key={m.usageType}
              label={m.usageType}
              value={`ERV +${m.ervGrowthRatePercent}% · Exit ${m.exitCapRatePercent}%`}
            />
          ))}
        </AssumptionCard>
        <AssumptionCard title="Rent Roll">
          <StatRow label="Einheiten Ist" value={pd.unitsAsIs.length} strong />
          <StatRow label="GRI Ist" value={fmt(pdComputeAnnualRent(pd.unitsAsIs))} />
          {pd.unitsTarget.length > 0 && (
            <>
              <StatRow label="Einheiten Ziel" value={pd.unitsTarget.length} strong />
              <StatRow label="GRI Ziel" value={fmt(pdComputeAnnualRent(pd.unitsTarget))} />
            </>
          )}
        </AssumptionCard>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN WIZARD
// ═══════════════════════════════════════════════════════════════════════════
interface AcquisitionWizardProps {
  initialData?: Partial<PropertyData>;
  onSave: (pd: PropertyData) => void;
  onClose: () => void;
  title?: string;
}

export function AcquisitionWizard({ initialData, onSave, onClose, title }: AcquisitionWizardProps) {
  const [pd, setPd] = useState<PropertyData>(() => createDefaultPropertyData(initialData));
  const [activeTab, setActiveTab] = useState(0);

  const isDev = pd.dealType === 'Development';
  const visibleTabs: TabKey[] = isDev ? DEVELOPMENT_TABS : INVESTMENT_TABS;

  // Clamp activeTab when switching deal types (e.g. Dev → Investment shrinks the list)
  useEffect(() => {
    if (activeTab >= visibleTabs.length) setActiveTab(visibleTabs.length - 1);
  }, [visibleTabs.length, activeTab]);

  const updatePd = useCallback((patch: Partial<PropertyData>) => {
    setPd(prev => ({ ...prev, ...patch }));
  }, []);

  const handleSave = () => onSave(pd);

  const renderTab = (key: TabKey) => {
    switch (key) {
      case 'Stammdaten':   return <TabStammdaten pd={pd} onChange={updatePd} />;
      case 'Acquisition':  return <TabAcquisition pd={pd} onChange={updatePd} />;
      case 'Development':  return <TabDevelopment pd={pd} onChange={updatePd} />;
      case 'Finanzierung': return <TabFinanzierung pd={pd} onChange={updatePd} />;
      case 'Rent Roll':    return <TabRentRoll pd={pd} onChange={updatePd} />;
      case 'Opex':         return <TabOpex pd={pd} onChange={updatePd} />;
      case 'Market':       return <TabMarket pd={pd} onChange={updatePd} />;
      case 'Cashflow':     return <TabCashflow pd={pd} />;
      case 'Summary':      return <TabSummary pd={pd} />;
      default:             return null;
    }
  };
  const tabContent = () => renderTab(visibleTabs[activeTab]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'stretch', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        width: '100%', maxWidth: 1080, background: 'rgba(255,255,255,0.97)',
        borderRadius: 20, boxShadow: '0 32px 80px rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid rgba(0,0,0,0.08)',
          background: 'rgba(255,255,255,0.98)',
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1c1c1e' }}>{title || 'Neues Deal erfassen'}</div>
            <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)', marginTop: 2 }}>
              {pd.name || 'Objektname eingeben'} · {pd.city || 'Stadt'}
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '6px', borderRadius: 8, color: 'rgba(60,60,67,0.55)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 2,
          padding: '10px 16px', borderBottom: '1px solid rgba(0,0,0,0.08)',
          overflowX: 'auto', background: 'rgba(248,248,248,0.8)',
        }}>
          {visibleTabs.map((label, i) => {
            const Icon = TAB_ICONS[label];
            const isActive = activeTab === i;
            return (
              <button
                key={label}
                onClick={() => setActiveTab(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: isActive ? 700 : 500, whiteSpace: 'nowrap',
                  background: isActive ? '#007aff' : 'transparent',
                  color: isActive ? '#fff' : 'rgba(60,60,67,0.55)',
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={13} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {tabContent()}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 24px', borderTop: '1px solid rgba(0,0,0,0.08)',
          background: 'rgba(248,248,248,0.9)',
        }}>
          <button
            onClick={() => setActiveTab(t => Math.max(0, t - 1))}
            disabled={activeTab === 0}
            className="btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: activeTab === 0 ? 0.35 : 1 }}
          >
            <ChevronLeft size={16} /> Zurück
          </button>
          <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)' }}>
            {activeTab + 1} / {visibleTabs.length}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={handleSave}
              className="btn-ghost"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontWeight: 600, color: '#4ade80', whiteSpace: 'nowrap',
              }}
            >
              <CheckCircle2 size={14} /> Speichern
            </button>
            {activeTab < visibleTabs.length - 1 ? (
              <button
                onClick={() => setActiveTab(t => Math.min(visibleTabs.length - 1, t + 1))}
                className="btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
              >
                Weiter <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleSave}
                className="btn-primary"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                  background: 'linear-gradient(135deg, #007aff, #0051a8)',
                }}
              >
                <CheckCircle2 size={14} /> Deal anlegen
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AcquisitionWizard;
