import React from 'react';

import { pdComputePropertyNOI } from '@/utils/propertyCashFlowModel';
import type { PropertyData } from '@/models/types';
import { fmt, pct, Field, Chip, SH } from '@/components/acquisition-wizard/shared';

export function TabOpex({ pd, onChange }: { pd: PropertyData; onChange: (p: Partial<PropertyData>) => void }) {
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
