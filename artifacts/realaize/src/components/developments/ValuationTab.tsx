import { GlassPanel, SectionHeader } from '@/components/shared';
import { formatEUR } from '@/utils/kpiEngine';
import { useStore } from '@/store/useStore';
import type { DevelopmentProject, DevValuationAssumptions } from '@/models/types';
import { useState } from 'react';

export function ValuationTab({ dev, totalBudget }: { dev: DevelopmentProject; totalBudget: number }) {
  const { updateDevelopment } = useStore();
  const [valuationForm, setValuationForm] = useState<DevValuationAssumptions>(dev.valuationAssumptions || { opexPct: 15, exitYieldPct: 5.0, purchasingCostsPct: 10 });
        const units = dev.units || [];
        const grossRentMonthly = units.reduce((s, u) => s + u.monthlyRent, 0);
        const grossRentAnnual = grossRentMonthly * 12;
        const opexAmount = grossRentAnnual * (valuationForm.opexPct / 100);
        const noi = grossRentAnnual - opexAmount;
        const valuation = valuationForm.exitYieldPct > 0
          ? noi / ((valuationForm.exitYieldPct / 100) * (1 + valuationForm.purchasingCostsPct / 100))
          : 0;
        return (
          <div className="animate-fade-in">
            <div className="grid grid-cols-2 gap-6">
              {/* Inputs */}
              <GlassPanel style={{ padding: 24 }}>
                <SectionHeader title="Bewertungsannahmen" />
                <div className="space-y-4 mt-2">
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>OpEx (% der Bruttomiete)</label>
                    <div className="flex items-center gap-2">
                      <input type="number" className="input-glass flex-1" min={0} max={100} step={0.5}
                        value={valuationForm.opexPct}
                        onChange={e => setValuationForm(p => ({ ...p, opexPct: parseFloat(e.target.value) || 0 }))}
                      />
                      <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.55)' }}>%</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.40)', marginTop: 4 }}>Bewirtschaftungskosten, Instandhaltung, Verwaltung</div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Exit Yield (Nettoanfangsrendite)</label>
                    <div className="flex items-center gap-2">
                      <input type="number" className="input-glass flex-1" min={0.1} max={20} step={0.05}
                        value={valuationForm.exitYieldPct}
                        onChange={e => setValuationForm(p => ({ ...p, exitYieldPct: parseFloat(e.target.value) || 0 }))}
                      />
                      <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.55)' }}>%</span>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Erwerbsnebenkosten (Käufer)</label>
                    <div className="flex items-center gap-2">
                      <input type="number" className="input-glass flex-1" min={0} max={20} step={0.5}
                        value={valuationForm.purchasingCostsPct}
                        onChange={e => setValuationForm(p => ({ ...p, purchasingCostsPct: parseFloat(e.target.value) || 0 }))}
                      />
                      <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.55)' }}>%</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.40)', marginTop: 4 }}>GrESt, Notar, Makler</div>
                  </div>
                  <button
                    onClick={() => {
                      updateDevelopment(dev.id, { valuationAssumptions: valuationForm, projectedSalePrice: valuation > 0 ? valuation : dev.projectedSalePrice });
                    }}
                    className="btn-accent px-5 py-2 rounded-xl text-sm w-full"
                  >
                    Annahmen speichern &amp; Proj. Verkaufspreis setzen
                  </button>
                  {units.length === 0 && (
                    <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.20)', fontSize: 12, color: 'rgba(60,60,67,0.65)' }}>
                      Noch keine Einheiten im Rent Roll erfasst — Mieteinnahmen = 0.
                    </div>
                  )}
                </div>
              </GlassPanel>

              {/* Valuation waterfall */}
              <GlassPanel style={{ padding: 24 }}>
                <SectionHeader title="Bewertung bei Fertigstellung" />
                <div className="space-y-2 mt-2">
                  {[
                    { label: 'Bruttomiete p.a. (aus Rent Roll)', value: formatEUR(grossRentAnnual), color: '#1a7f37' },
                    { label: `− OpEx (${valuationForm.opexPct}% der Bruttomiete)`, value: `− ${formatEUR(opexAmount)}`, color: '#cc1a14' },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between py-2 px-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                      <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.65)' }}>{row.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: row.color, fontFamily: 'ui-monospace, monospace' }}>{row.value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-3 px-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.05)', borderTop: '2px solid rgba(0,0,0,0.08)' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1c1c1e' }}>= NOI p.a.</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1c1c1e', fontFamily: 'ui-monospace, monospace' }}>{formatEUR(noi)}</span>
                  </div>

                  {/* Formula display */}
                  <div style={{ padding: '14px', borderRadius: 12, background: 'rgba(0,122,255,0.05)', border: '1px solid rgba(0,122,255,0.12)', marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Bewertungsformel</div>
                    <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.70)', lineHeight: 1.8, fontFamily: 'ui-monospace, monospace' }}>
                      NOI ÷ (Exit Yield × (1 + Erwerb%))<br />
                      <span style={{ color: '#007aff' }}>
                        {formatEUR(noi)} ÷ ({valuationForm.exitYieldPct}% × (1 + {valuationForm.purchasingCostsPct}%))
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between py-3 px-3 rounded-xl" style={{ background: 'rgba(0,122,255,0.08)', border: '1px solid rgba(0,122,255,0.20)', marginTop: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#1c1c1e' }}>= Valuation bei Fertigstellung</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#007aff', fontFamily: 'ui-monospace, monospace' }}>{valuation > 0 ? formatEUR(valuation) : '—'}</span>
                  </div>
                  <div className="flex justify-between py-3 px-3 rounded-xl" style={{ background: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.20)' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#1c1c1e' }}>= Proj. Verkaufspreis</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#1a7f37', fontFamily: 'ui-monospace, monospace' }}>{valuation > 0 ? formatEUR(valuation) : '—'}</span>
                  </div>

                  {valuation > 0 && (() => {
                    const totalInvestment = dev.purchasePrice + totalBudget;
                    const profit = valuation - totalInvestment;
                    const profitPct = totalInvestment > 0 ? (profit / totalInvestment) * 100 : 0;
                    return (
                      <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)', paddingTop: 10, marginTop: 4 }}>
                        <div className="flex justify-between py-2 px-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                          <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.65)' }}>Gesamtinvestition</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#1c1c1e', fontFamily: 'ui-monospace, monospace' }}>{formatEUR(totalInvestment)}</span>
                        </div>
                        <div className="flex justify-between py-2 px-3 rounded-xl mt-1" style={{ background: 'rgba(0,0,0,0.03)' }}>
                          <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.65)' }}>Development Profit</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: profit >= 0 ? '#1a7f37' : '#cc1a14', fontFamily: 'ui-monospace, monospace' }}>
                            {profit >= 0 ? '+' : ''}{formatEUR(profit)} ({profitPct.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </GlassPanel>
            </div>
          </div>
        );
}
