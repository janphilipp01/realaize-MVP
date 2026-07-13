import React, { useState } from 'react';
import { formatEUR } from '@/utils/kpiEngine';
import { useStore } from '@/store/useStore';
import { screenValueAdd, lookupMarketAssumptions, resolveExitYieldBuffer, EXIT_BUFFER_PRIME, BUILD_COST_RATES, SCOPE_LABEL, type RenovationScope } from '@/utils/valueAddScreening';
import { pdComputeTotalArea } from '@/utils/propertyCashFlowModel';
import type { PropertyData, MarketAssumptionPerUsage } from '@/models/types';
import { DEFAULT_ERV_GROWTH, DEFAULT_EXIT_CAP } from '@/models/types';
import { Field, SH } from '@/components/acquisition-wizard/shared';
import { useLanguage } from '@/i18n/LanguageContext';

export function TabMarket({ pd, onChange }: { pd: PropertyData; onChange: (p: Partial<PropertyData>) => void }) {
  const de = useLanguage().lang === 'de';
  const ma = pd.marketAssumptions;
  const setMA = (patch: Partial<typeof ma>) => onChange({ marketAssumptions: { ...ma, ...patch } });
  const benchmarks = useStore(s => s.benchmarks);
  const targetNIY = useStore(s => s.settings.targetNIY);
  const [scope, setScope] = useState<RenovationScope>('sanierung');

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
      <SH>Market Assumptions by Usage Type</SH>
      {usageTypes.length === 0 && (
        <div style={{ color: 'rgba(60,60,67,0.45)', fontSize: 13, marginBottom: 16 }}>{de ? 'Bitte zuerst Einheiten im Rent Roll eintragen.' : 'Please add units in the Rent Roll first.'}</div>
      )}
      {usageTypes.map(ut => {
        const row = ma.perUsageType.find(m => m.usageType === ut);
        if (!row) { ensureUsageType(ut); return null; }
        return (
          <div key={ut} style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1c1c1e', marginBottom: 12 }}>{ut}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <Field label="ERV Growth % p.a." type="number" step="0.1" value={row.ervGrowthRatePercent} onChange={e => updateRow(ut, { ervGrowthRatePercent: parseFloat(e.target.value) || 0 })} />
              <Field label="Exit Cap Rate %" type="number" step="0.1" value={row.exitCapRatePercent} onChange={e => {
                const cap = parseFloat(e.target.value) || 5;
                updateRow(ut, { exitCapRatePercent: cap, exitMultiplier: cap > 0 ? parseFloat((100 / cap).toFixed(1)) : 0 });
              }} />
              <Field label="Exit Multiplier x" type="number" step="0.1" value={row.exitMultiplier} onChange={e => {
                const mult = parseFloat(e.target.value) || 1;
                updateRow(ut, { exitMultiplier: mult, exitCapRatePercent: mult > 0 ? parseFloat((100 / mult).toFixed(2)) : 0 });
              }} />
            </div>
          </div>
        );
      })}

      <SH>General Inflation Assumptions</SH>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Field label="Opex Inflation % p.a." type="number" step="0.1" value={ma.opexInflationPercent} onChange={e => setMA({ opexInflationPercent: parseFloat(e.target.value) || 0 })} />
        <Field label="Capex Inflation % p.a." type="number" step="0.1" value={ma.capexInflationPercent} onChange={e => setMA({ capexInflationPercent: parseFloat(e.target.value) || 0 })} />
        <Field label="Sales Cost %" type="number" step="0.1" value={ma.salesCostPercent} onChange={e => setMA({ salesCostPercent: parseFloat(e.target.value) || 0 })} />
      </div>
      <div style={{ marginTop: 16 }}>
        <Field label="Holding Period (Years)" type="number" value={pd.holdingPeriodYears} onChange={e => onChange({ holdingPeriodYears: parseInt(e.target.value) || 10 })} />
      </div>

      {/* ── Value-Add Screening (Profil-Annahmen) ── */}
      {(() => {
        const area = pdComputeTotalArea(pd.unitsTarget.length > 0 ? pd.unitsTarget : pd.unitsAsIs);
        const m = lookupMarketAssumptions(benchmarks, pd.city, pd.usageType, pd.submarket);
        const exitBuffer = resolveExitYieldBuffer(pd.city, pd.submarket);
        const marketNIY = m.marketNIY ?? targetNIY;
        const niyIsFallback = m.marketNIY === undefined;
        return (
          <div style={{ marginTop: 24 }}>
            <SH>Value-Add Screening (Profile: 20% margin)</SH>
            {(!m.marketRent || area <= 0 || pd.purchasePrice <= 0) ? (
              <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.5)', padding: '8px 0' }}>
                {!m.marketRent
                  ? (de
                      ? `Keine Marktmiete für ${pd.city || '—'} (${pd.usageType}) im Market-Intelligence-Modul.`
                      : `No market rent for ${pd.city || '—'} (${pd.usageType}) in the Market Intelligence module.`)
                  : (de
                      ? 'Kaufpreis (Tab Acquisition) und Rent Roll (Fläche) erforderlich.'
                      : 'Purchase price (Acquisition tab) and Rent Roll (area) required.')}
              </div>
            ) : (() => {
              const r = screenValueAdd({ area, purchasePrice: pd.purchasePrice, marketRent: m.marketRent, marketNIY, scope, profile: { exitYieldBufferPct: exitBuffer } });
              const green = '#16a34a', red = '#dc2626';
              const rows: Array<[string, number, boolean]> = [
                [de ? 'Potentieller Exit-Wert' : 'Potential exit value', r.exitValue, false],
                [de ? '− Kaufpreis' : '− Purchase price', -pd.purchasePrice, true],
                [de ? '− Kaufnebenkosten (10%)' : '− Acquisition costs (10%)', -r.knk, true],
                [`− ${SCOPE_LABEL[scope][de ? 'de' : 'en']} (${BUILD_COST_RATES[scope]} €/m²)`, -r.buildCost, true],
                [de ? '− Finanzierung (5%)' : '− Financing (5%)', -r.financing, true],
                ['− Contingency (10%)', -r.contingency, true],
              ];
              return (
                <div className="p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.08)' }}>
                  <div className="flex flex-wrap gap-1.5" style={{ marginBottom: 12 }}>
                    {(Object.keys(BUILD_COST_RATES) as RenovationScope[]).map(sc => (
                      <button key={sc} onClick={() => setScope(sc)}
                        style={{ fontSize: 11, fontWeight: 600, padding: '4px 9px', borderRadius: 7, cursor: 'pointer',
                          background: scope === sc ? 'rgba(0,122,255,0.12)' : 'rgba(0,0,0,0.04)',
                          color: scope === sc ? '#007aff' : 'rgba(60,60,67,0.6)',
                          border: `1px solid ${scope === sc ? 'rgba(0,122,255,0.3)' : 'rgba(0,0,0,0.06)'}` }}>
                        {SCOPE_LABEL[sc][de ? 'de' : 'en']} · {BUILD_COST_RATES[sc]}€
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.55)', marginBottom: 10 }}>
                    {de ? 'Marktannahmen' : 'Market assumptions'}: {m.marketRent.toFixed(2)} €/m²/{de ? 'Mt.' : 'mo.'}{m.rentSource ? ` (${m.rentSource})` : ''} · {de ? 'Markt-NIY' : 'Market NIY'} {marketNIY.toFixed(2)}%{niyIsFallback ? (de ? ' (Profil-Default)' : ' (profile default)') : (m.yieldSource ? ` (${m.yieldSource})` : '')} → Exit NIY {r.exitNIY.toFixed(2)}% ({exitBuffer === EXIT_BUFFER_PRIME ? (de ? 'Prime +0,75%' : 'Prime +0.75%') : (de ? 'Rand +1,0%' : 'Edge +1.0%')}) · {area.toLocaleString('de-DE')} m²
                  </div>
                  <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                    {rows.map(([label, val, dim], i) => (
                      <div key={i} className="flex items-center justify-between" style={{ padding: '5px 0', fontSize: 12, color: dim ? 'rgba(60,60,67,0.7)' : '#1c1c1e', fontWeight: dim ? 400 : 600 }}>
                        <span>{label}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatEUR(val)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between" style={{ padding: '8px 0 4px', borderTop: '1px solid rgba(0,0,0,0.06)', fontSize: 13, fontWeight: 700, color: r.profit >= 0 ? green : red }}>
                      <span>= Profit ({r.marginPct.toFixed(1)}% {de ? 'Marge' : 'margin'})</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatEUR(r.profit)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 p-2.5 rounded-lg" style={{ background: r.pass ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.07)' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: r.pass ? green : red }}>
                      {r.pass
                        ? (de ? `✓ Trifft 20%-Hürde (+${formatEUR(r.surplus)})` : `✓ Meets 20% hurdle (+${formatEUR(r.surplus)})`)
                        : (de ? `✗ Verfehlt 20%-Hürde (${formatEUR(r.surplus)})` : `✗ Misses 20% hurdle (${formatEUR(r.surplus)})`)}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: pd.purchasePrice <= r.maxBid ? green : red }}>
                      {de ? 'Max. Kaufpreis' : 'Max bid'} {formatEUR(r.maxBid)}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.4)', marginTop: 8 }}>
                    {de
                      ? `Schnell-Screening mit Profil-Pauschalen (Bau ${BUILD_COST_RATES[scope]} €/m², KNK 10%, Fin. 5%, Contingency 10%). Für die echte Kalkulation zählt das Underwriting (Gewerke/Cashflow).`
                      : `Quick screening with profile flat rates (construction ${BUILD_COST_RATES[scope]} €/m², acq. costs 10%, financing 5%, contingency 10%). The underwriting (trades/cash flow) is authoritative for the real calculation.`}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 6: Development / Gewerke
// ═══════════════════════════════════════════════════════════════════════════
