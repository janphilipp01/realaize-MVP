import React from 'react';
import { Plus } from 'lucide-react';

import { pdComputeTotalAcquisitionCosts } from '@/utils/propertyCashFlowModel';
import type { PropertyData, AcquisitionCostItem } from '@/models/types';
import { uid, fmt, pct, Field, Chip, SH } from '@/components/acquisition-wizard/shared';

export function TabAcquisition({ pd, onChange }: { pd: PropertyData; onChange: (p: Partial<PropertyData>) => void }) {
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
