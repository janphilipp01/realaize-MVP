import { BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { GlassPanel } from '@/components/shared';
import { formatEUR } from '@/utils/kpiEngine';
import { analyzeHoldSell } from '@/utils/irrCalculator';
import { useStore } from '@/store/useStore';
import type { DevelopmentProject } from '@/models/types';

interface Props {
  dev: DevelopmentProject;
  analysis: ReturnType<typeof analyzeHoldSell> | null;
  setShowHoldSellModal: (v: 'Hold' | 'Sell' | null) => void;
}

export function HoldSellTab({ dev, analysis, setShowHoldSellModal }: Props) {
  const { settings, updateDevelopment } = useStore();
  return (
        <div className="animate-fade-in">
          {analysis ? (
            <div className="space-y-5">
              {/* Recommendation banner */}
              <div className="p-5 rounded-2xl" style={{
                background: analysis.recommendation === 'Hold' ? 'rgba(52,199,89,0.08)' : analysis.recommendation === 'Sell' ? 'rgba(0,122,255,0.08)' : 'rgba(0,0,0,0.04)',
                border: `1px solid ${analysis.recommendation === 'Hold' ? 'rgba(52,199,89,0.20)' : analysis.recommendation === 'Sell' ? 'rgba(0,122,255,0.20)' : 'rgba(0,0,0,0.08)'}`,
              }}>
                <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.55)', marginBottom: 4 }}>EMPFEHLUNG</div>
                <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.04em', color: analysis.recommendation === 'Hold' ? '#1a7f37' : analysis.recommendation === 'Sell' ? '#007aff' : '#1c1c1e', marginBottom: 8 }}>
                  {analysis.recommendation === 'Hold' ? '📈 HOLD — Im Portfolio halten' : analysis.recommendation === 'Sell' ? '💰 SELL — Verkauf empfohlen' : '⚖️ Neutral — Strategische Entscheidung'}
                </div>
                <div style={{ fontSize: 14, color: 'rgba(60,60,67,0.70)', lineHeight: 1.6 }}>{analysis.reasoning}</div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                {/* Hold */}
                <GlassPanel style={{ padding: 22 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1a7f37', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>📈 Hold-Szenario (10 Jahre)</div>
                  {[
                    { label: '10-Jahres IRR', value: `${analysis.holdIRR.toFixed(1)}%`, highlight: true },
                    { label: 'Hurdle Rate', value: `${settings.hurrleRate}%` },
                    { label: 'IRR über Hurdle', value: `${(analysis.holdIRR - settings.hurrleRate).toFixed(1)}%`, color: analysis.holdIRR >= settings.hurrleRate ? '#1a7f37' : '#cc1a14' },
                    { label: 'Gesamtinvestition', value: formatEUR(analysis.totalCost) },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between py-2 px-3 rounded-xl mb-1" style={{ background: 'rgba(0,0,0,0.03)' }}>
                      <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.65)' }}>{row.label}</span>
                      <span style={{ fontSize: 13, fontWeight: row.highlight ? 700 : 600, color: row.color || (row.highlight ? '#1a7f37' : '#1c1c1e'), fontFamily: 'ui-monospace, monospace' }}>{row.value}</span>
                    </div>
                  ))}
                  {/* CF chart */}
                  <div className="mt-4">
                    <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Netto-Cashflow Prognose</div>
                    <ResponsiveContainer width="100%" height={120}>
                      <LineChart data={dev.underwritingCashFlows?.map(cf => ({ Jahr: `J${cf.year}`, NCF: Math.round(cf.netCashFlow / 1000) })) || []}>
                        <XAxis dataKey="Jahr" tick={{ fontSize: 10, fill: 'rgba(60,60,67,0.45)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: 'rgba(60,60,67,0.45)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}k`} />
                        <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, fontSize: 11 }} />
                        <Line type="monotone" dataKey="NCF" stroke="#34c759" strokeWidth={2} dot={{ r: 3, fill: '#34c759' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <button onClick={() => setShowHoldSellModal('Hold')} className="btn-glass w-full mt-4 py-2 rounded-xl text-sm font-semibold" style={{ color: '#1a7f37', borderColor: 'rgba(52,199,89,0.3)', display: 'block', textAlign: 'center' }}>
                    ✓ In Bestand überführen (Hold)
                  </button>
                </GlassPanel>

                {/* Sell */}
                <GlassPanel style={{ padding: 22 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#007aff', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>💰 Sell-Szenario</div>
                  <div className="mb-3">
                    <label style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', display: 'block', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Proj. Verkaufspreis (editierbar)</label>
                    <input
                      type="number"
                      className="input-glass"
                      value={dev.projectedSalePrice || ''}
                      onChange={e => updateDevelopment(dev.id, { projectedSalePrice: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  {[
                    { label: 'Bruttogewinn', value: formatEUR((dev.projectedSalePrice || 0) - analysis.totalCost) },
                    { label: `Steuer (${settings.taxRate}%)`, value: `− ${formatEUR(Math.max(0, ((dev.projectedSalePrice || 0) - analysis.totalCost)) * settings.taxRate / 100)}` },
                    { label: 'Nettogewinn', value: formatEUR(analysis.sellNetProfit), highlight: true },
                    { label: 'ROI (nach Steuer)', value: `${analysis.sellROI.toFixed(1)}%`, color: analysis.sellROI > 15 ? '#1a7f37' : '#b25000' },
                    { label: 'Sell-IRR', value: `${analysis.sellIRR.toFixed(1)}%` },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between py-2 px-3 rounded-xl mb-1" style={{ background: 'rgba(0,0,0,0.03)' }}>
                      <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.65)' }}>{row.label}</span>
                      <span style={{ fontSize: 13, fontWeight: row.highlight ? 700 : 600, color: row.color || (row.highlight ? '#007aff' : '#1c1c1e'), fontFamily: 'ui-monospace, monospace' }}>{row.value}</span>
                    </div>
                  ))}
                  <button onClick={() => setShowHoldSellModal('Sell')} className="btn-accent w-full mt-4 py-2 rounded-xl text-sm font-semibold" style={{ display: 'block', textAlign: 'center' }}>
                    → In Sales überführen (Sell)
                  </button>
                </GlassPanel>
              </div>

              <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.35)', textAlign: 'center', fontStyle: 'italic' }}>
                * IRR-Berechnung deterministisch. Steuer: {settings.taxRate}% pauschal (in Einstellungen anpassbar). Cashflows manuell editierbar.
              </div>
            </div>
          ) : (
            <GlassPanel style={{ padding: 48, textAlign: 'center' }}>
              <BarChart3 size={32} color="rgba(60,60,67,0.30)" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(60,60,67,0.50)' }}>Hold/Sell-Analyse nicht verfügbar</div>
              <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.35)', marginTop: 4 }}>Bitte Cashflow-Prognose und Verkaufspreis hinterlegen.</div>
            </GlassPanel>
          )}
        </div>
  );
}
