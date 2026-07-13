import React, { useState } from 'react';
import { X, Plus, Trash2, Copy } from 'lucide-react';

import { pdComputeAnnualRent, pdComputeTotalArea, pdComputeWALT } from '@/utils/propertyCashFlowModel';
import type { PropertyData, RentRollUnit, FloorLevel } from '@/models/types';
import { USAGE_TYPES, FLOORS, uid, fmt, Field, SelectField, Chip, SH } from '@/components/acquisition-wizard/shared';
import { useLanguage } from '@/i18n/LanguageContext';

export function makeEmptyUnit(idx: number): RentRollUnit {
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
export interface QuickAddState {
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

export function QuickAddModal({
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
  const de = useLanguage().lang === 'de';

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
          <div style={{ fontSize: 15, fontWeight: 700 }}>{de ? 'Schnellerfassung' : 'Quick Add'}</div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 4 }}><X size={14} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label={de ? 'Anzahl Einheiten' : 'Number of Units'} type="number" min={1} value={s.count || ''} onChange={e => set({ count: parseInt(e.target.value) || 0 })} />
          <Field label="Area per Unit (m²)" type="number" step="0.1" value={s.areaPerUnit || ''} onChange={e => set({ areaPerUnit: parseFloat(e.target.value) || 0 })} />
          <SelectField label="Usage Type" value={s.usageType} onChange={e => set({ usageType: e.target.value as RentRollUnit['usageType'] })}>
            {USAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </SelectField>
          <SelectField label="Floor" value={s.floor} onChange={e => set({ floor: e.target.value as FloorLevel })}>
            {FLOORS.map(f => <option key={f} value={f}>{f}</option>)}
          </SelectField>
          <Field label={de ? 'Mieter (optional)' : 'Tenant (optional)'} value={s.tenant} onChange={e => set({ tenant: e.target.value })} placeholder={de ? 'Leer = Leerstand' : 'Empty = vacant'} />
          <Field label="Lease Start" type="date" value={s.leaseStart} onChange={e => set({ leaseStart: e.target.value })} />
          <Field label={de ? 'Laufzeit (Monate)' : 'Term (Months)'} type="number" min={0} value={s.leaseDurationMonths || ''} onChange={e => set({ leaseDurationMonths: parseInt(e.target.value) || 0 })} />
          <SelectField label={de ? 'Anschluss' : 'Lease End'} value={s.leaseEndAction} onChange={e => set({ leaseEndAction: e.target.value as 'Neuvermietung' | 'Leerstand' })}>
            <option value="Neuvermietung">Neuvermietung</option>
            <option value="Leerstand">Leerstand</option>
          </SelectField>

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              {s.rentMode === 'perSqm'
                ? <Field label="Current Rent €/m²/mo" type="number" step="0.01" value={s.currentRentPerSqm || ''} onChange={e => set({ currentRentPerSqm: parseFloat(e.target.value) || 0 })} />
                : <Field label="Current Rent €/mo (total)" type="number" value={s.monthlyRent || ''} onChange={e => set({ monthlyRent: parseFloat(e.target.value) || 0 })} />}
            </div>
            <button onClick={() => set({ rentMode: s.rentMode === 'perSqm' ? 'monthly' : 'perSqm' })} className="btn-ghost" style={{ fontSize: 11, marginBottom: 2 }} title={de ? 'Eingabemodus wechseln' : 'Switch input mode'}>⟷</button>
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              {s.ervMode === 'perSqm'
                ? <Field label="ERV €/m²/mo" type="number" step="0.01" value={s.ervPerSqm || ''} onChange={e => set({ ervPerSqm: parseFloat(e.target.value) || 0 })} />
                : <Field label="ERV €/mo (total)" type="number" value={s.ervMonthly || ''} onChange={e => set({ ervMonthly: parseFloat(e.target.value) || 0 })} />}
            </div>
            <button onClick={() => set({ ervMode: s.ervMode === 'perSqm' ? 'monthly' : 'perSqm' })} className="btn-ghost" style={{ fontSize: 11, marginBottom: 2 }} title={de ? 'Eingabemodus wechseln' : 'Switch input mode'}>⟷</button>
          </div>

          <Field label={de ? 'Indexierung % der Inflation' : 'Indexation % of inflation'} type="number" step="1" value={s.indexationPercent || ''} onChange={e => set({ indexationPercent: parseFloat(e.target.value) || 0 })} />
          <Field label={de ? 'NK n.umlagef. €/Mo' : 'Non-rec. costs €/mo'} type="number" value={s.nonRecoverableOpex || ''} onChange={e => set({ nonRecoverableOpex: parseFloat(e.target.value) || 0 })} />
        </div>
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} className="btn-ghost" style={{ fontSize: 12 }}>{de ? 'Abbrechen' : 'Cancel'}</button>
          <button onClick={handleCreate} className="btn-primary" style={{ fontSize: 13 }} disabled={s.count < 1}>
            <Plus size={12} /> {de ? `${s.count || 0} Einheiten erzeugen` : `Create ${s.count || 0} units`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Single editable rent roll section (Ist or Ziel) ───────────────────────
export function RentRollSection({
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
  const de = useLanguage().lang === 'de';

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

  const headers = ['Unit', 'Floor', 'Area m²', 'Usage', 'Tenant', 'Lease Start', 'Term (Mo.)', 'Lease End', '€/m²', 'ERV €/m²', 'Monthly Rent', 'Indexation %', 'Non-rec. €/mo', ''];

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
                    {de ? 'Keine Positionen — über „+ Position hinzufügen" oder „Schnellerfassung" anlegen.' : 'No items — add via "+ Add item" or "Quick Add".'}
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
                  <td style={{ padding: '4px 6px' }}><input className="input-glass" value={u.tenant} onChange={e => updateUnit(u.id, { tenant: e.target.value })} style={{ width: 110, fontSize: 12 }} placeholder={de ? 'Leerstand' : 'Vacant'} /></td>
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
                      title={de ? 'Anteil der Inflation (aus Market) der auf die Miete angewendet wird' : 'Share of inflation (from Market) applied to the rent'}
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
          {de ? 'Schnellerfassung' : 'Quick Add'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <Chip label="Total Area" value={`${totalArea.toLocaleString('de-DE')} m²`} />
        <Chip label="Annual Rent" value={fmt(annualRent)} color="#007aff" />
        <Chip label="Ø €/m²/mo" value={`${avgRentPerSqm.toFixed(2)} €`} />
        <Chip label="WALT (Years)" value={walt.toFixed(1)} />
      </div>

      {delta && (
        <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(74,222,128,0.08)', fontSize: 13, color: '#1c1c1e' }}>
          <span style={{ fontWeight: 700 }}>{de ? 'Delta vs. Ist-Miete: ' : 'Delta vs. current rent: '}</span>
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

export function TabRentRoll({ pd, onChange }: { pd: PropertyData; onChange: (p: Partial<PropertyData>) => void }) {
  const de = useLanguage().lang === 'de';
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
        title="Current Rent (before development)"
        units={pd.unitsAsIs}
        setUnits={(us) => onChange({ unitsAsIs: us })}
        waltDate={waltDate}
        opexInflationPercent={pd.marketAssumptions.opexInflationPercent}
        defaultLeaseStart={pd.acquisitionDate || ''}
        addLabel={de ? 'Ist-Mieter hinzufügen' : 'Add current tenant'}
      />

      {isDev && (
        <>
          {pd.unitsTarget.length === 0 && pd.unitsAsIs.length > 0 && (
            <button onClick={copyAsIsToTarget} className="btn-ghost" style={{ fontSize: 12, marginBottom: 8 }}>
              <Copy size={12} /> {de ? 'Ist-Mieten als Startpunkt für Zielmiete übernehmen' : 'Use current rents as a starting point for target rent'}
            </button>
          )}
          <RentRollSection
            title="Target Rent (after development)"
            units={pd.unitsTarget}
            setUnits={(us) => onChange({ unitsTarget: us })}
            waltDate={waltDate}
            opexInflationPercent={pd.marketAssumptions.opexInflationPercent}
            delta={delta}
            defaultLeaseStart={pd.acquisitionDate || ''}
            addLabel={de ? 'Ziel-Mieter hinzufügen' : 'Add target tenant'}
          />
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 4: Opex
// ═══════════════════════════════════════════════════════════════════════════
