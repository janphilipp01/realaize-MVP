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
      <SH>Operating Costs & Management</SH>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <Field label="Vacancy Rate %" type="number" step="0.1" value={oc.vacancyRatePercent} onChange={e => set({ vacancyRatePercent: parseFloat(e.target.value) || 0 })} />
        <Field label="Management Cost % (of GRI)" type="number" step="0.1" value={oc.managementCostPercent} onChange={e => set({ managementCostPercent: parseFloat(e.target.value) || 0 })} />
        <Field label="Maintenance Reserve €/m²/year" type="number" step="0.5" value={oc.maintenanceReservePerSqm} onChange={e => set({ maintenanceReservePerSqm: parseFloat(e.target.value) || 0 })} />
        <Field label="Insurance €/year" type="number" value={oc.insurancePerYear} onChange={e => set({ insurancePerYear: parseFloat(e.target.value) || 0 })} />
        <Field label="Property Tax €/year" type="number" value={oc.propertyTaxPerYear} onChange={e => set({ propertyTaxPerYear: parseFloat(e.target.value) || 0 })} />
        <Field label="Other Opex €/year" type="number" value={oc.otherOpexPerYear} onChange={e => set({ otherOpexPerYear: parseFloat(e.target.value) || 0 })} />
        <Field label="Other Income €/year" type="number" value={oc.otherIncomePerYear} onChange={e => set({ otherIncomePerYear: parseFloat(e.target.value) || 0 })} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Chip label="NOI current p.a." value={fmt(noiIst)} color="#007aff" />
        <Chip label="NOI target p.a." value={fmt(noiZiel)} color="#4ade80" />
        <Chip label="NIY" value={pd.purchasePrice > 0 ? pct(noiIst / pd.purchasePrice * 100) : '—'} color="#c9a96e" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 5: Market Assumptions
// ═══════════════════════════════════════════════════════════════════════════
