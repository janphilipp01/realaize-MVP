import React from 'react';
import { useStore } from '@/store/useStore';
import { PRIME_SUBMARKETS, submarketsForCity } from '@/utils/valueAddScreening';
import type { PropertyData, DealType } from '@/models/types';
import { DEV_TYPES, Field, SelectField, SH, UsageTypePicker, FloorTagPicker } from '@/components/acquisition-wizard/shared';

export function TabStammdaten({ pd, onChange }: { pd: PropertyData; onChange: (p: Partial<PropertyData>) => void }) {
  const isDev = pd.dealType === 'Development';
  const benchmarks = useStore(s => s.benchmarks);
  const submarketOptions = submarketsForCity(benchmarks, pd.city);
  const isPrime = pd.city === 'Düsseldorf' && !!pd.submarket && PRIME_SUBMARKETS.has(pd.submarket);
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <SH>Property Data</SH>
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
        <Field label="Property Name" value={pd.name} onChange={e => onChange({ name: e.target.value })} style={{ gridColumn: '1 / 3' }} />
        <div style={{ gridColumn: '1 / 3', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.55)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Main Usage Type
          </label>
          <UsageTypePicker
            value={pd.usageType}
            onChange={(usageType) => onChange({ usageType })}
          />
        </div>
        <Field label="Address" value={pd.address} onChange={e => onChange({ address: e.target.value })} style={{ gridColumn: '1 / 3' }} />
        <Field label="Postal Code" value={pd.zip} onChange={e => onChange({ zip: e.target.value })} />
        <Field label="City" value={pd.city} onChange={e => onChange({ city: e.target.value })} />
        <div style={{ gridColumn: '1 / 3', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Field
            label={`District / Submarket${pd.submarket ? (isPrime ? ' · Prime' : ' · Edge') : ''}`}
            value={pd.submarket || ''}
            onChange={e => onChange({ submarket: e.target.value })}
            placeholder="e.g. Flingern, Oberkassel"
            list="wizard-submarkets"
          />
          <datalist id="wizard-submarkets">
            {submarketOptions.map(o => <option key={o} value={o} />)}
          </datalist>
        </div>
        <div style={{ gridColumn: '1 / 3', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.55)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Floors
          </label>
          <FloorTagPicker
            value={pd.floors}
            onChange={(floors) => onChange({ floors })}
          />
        </div>
      </div>
      {isDev && (
        <>
          <SH>Development Type</SH>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <SelectField label="Development Type" value={pd.developmentType || 'Modernisierung'} onChange={e => onChange({ developmentType: e.target.value })}>
              {DEV_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </SelectField>
            <Field label="Project Start" type="date" value={pd.projectStart} onChange={e => onChange({ projectStart: e.target.value })} />
          </div>
        </>
      )}
      <SH>Parties</SH>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Vendor" value={pd.vendor} onChange={e => onChange({ vendor: e.target.value })} />
        <Field label="Broker" value={pd.broker} onChange={e => onChange({ broker: e.target.value })} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2: Acquisition Costs
// ═══════════════════════════════════════════════════════════════════════════
