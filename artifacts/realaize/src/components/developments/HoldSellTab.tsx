import { BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { GlassPanel } from '@/components/shared';
import { formatEUR } from '@/utils/kpiEngine';
import { analyzeHoldSell } from '@/utils/irrCalculator';
import { useStore } from '@/store/useStore';
import { useLanguage } from '@/i18n/LanguageContext';
import type { DevelopmentProject } from '@/models/types';

interface Props {
  dev: DevelopmentProject;
  analysis: ReturnType<typeof analyzeHoldSell> | null;
  setShowHoldSellModal: (v: 'Hold' | 'Sell' | null) => void;
}

export function HoldSellTab({ dev, analysis, setShowHoldSellModal }: Props) {
  const { settings, updateDevelopment } = useStore();
  const de = useLanguage().lang === 'de';
  return (
        <div className="animate-fade-in">
          {analysis ? (
            <div className="space-y-5">
              {/* Recommendation banner */}
              <div className="p-5 rounded-2xl" style={{
                background: analysis.recommendation === 'Hold' ? 'rgba(52,199,89,0.08)' : analysis.recommendation === 'Sell' ? 'rgba(0,122,255,0.08)' : 'rgba(0,0,0,0.04)',
                border: `1px solid ${analysis.recommendation === 'Hold' ? 'rgba(52,199,89,0.20)' : analysis.recommendation === 'Sell' ? 'rgba(0,122,255,0.20)' : 'rgba(0,0,0,0.08)'}`,
              }}>
                <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.55)', marginBottom: 4 }}>{de ? 'EMPFEHLUNG' : 'RECOMMENDATION'}</div>
                <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.04em', color: analysis.recommendation === 'Hold' ? '#1a7f37' : analysis.recommendation === 'Sell' ? '#007aff' : '#1c1c1e', marginBottom: 8 }}>
                  {analysis.recommendation === 'Hold'
                    ? (de ? '📈 HOLD — Im Portfolio halten' : '📈 HOLD — Keep in portfolio')
                    : analysis.recommendation === 'Sell'
                      ? (de ? '💰 SELL — Verkauf empfohlen' : '💰 SELL — Sale recommended')
                      : (de ? '⚖️ Neutral — Strategische Entscheidung' : '⚖️ Neutral — Strategic decision')}
                </div>
                <div style={{ fontSize: 14, color: 'rgba(60,60,67,0.70)', lineHeight: 1.6 }}>{analysis.reasoning}</div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                {/* Hold */}
                <GlassPanel style={{ padding: 22 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1a7f37', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>📈 {de ? 'Hold-Szenario (10 Jahre)' : 'Hold Scenario (10 years)'}</div>
                  {[
                    { label: de ? '10-Jahres IRR' : '10-Year IRR', value: `${analysis.holdIRR.toFixed(1)}%`, highlight: true },
                    { label: 'Hurdle Rate', value: `${settings.hurrleRate}%` },
                    { label: de ? 'IRR über Hurdle' : 'IRR over Hurdle', value: `${(analysis.holdIRR - settings.hurrleRate).toFixed(1)}%`, color: analysis.holdIRR >= settings.hurrleRate ? '#1a7f37' : '#cc1a14' },
                    { label: de ? 'Gesamtinvestition' : 'Total Investment', value: formatEUR(analysis.totalCost) },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between py-2 px-3 rounded-xl mb-1" style={{ background: 'rgba(0,0,0,0.03)' }}>
                      <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.65)' }}>{row.label}</span>
                      <span style={{ fontSize: 13, fontWeight: row.highlight ? 700 : 600, color: row.color || (row.highlight ? '#1a7f37' : '#1c1c1e'), fontFamily: 'ui-monospace, monospace' }}>{row.value}</span>
                    </div>
                  ))}
                  {/* CF chart */}
                  <div className="mt-4">
                    <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{de ? 'Netto-Cashflow Prognose' : 'Net Cash Flow Forecast'}</div>
                    <ResponsiveContainer width="100%" height={120}>
                      <LineChart data={dev.underwritingCashFlows?.map(cf => ({ Year: `Y${cf.year}`, NCF: Math.round(cf.netCashFlow / 1000) })) || []}>
                        <XAxis dataKey="Year" tick={{ fontSize: 10, fill: 'rgba(60,60,67,0.45)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: 'rgba(60,60,67,0.45)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}k`} />
                        <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, fontSize: 11 }} />
                        <Line type="monotone" dataKey="NCF" stroke="#34c759" strokeWidth={2} dot={{ r: 3, fill: '#34c759' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <button onClick={() => setShowHoldSellModal('Hold')} className="btn-glass w-full mt-4 py-2 rounded-xl text-sm font-semibold" style={{ color: '#1a7f37', borderColor: 'rgba(52,199,89,0.3)', display: 'block', textAlign: 'center' }}>
                    {de ? '✓ In Bestand überführen (Hold)' : '✓ Transfer to Assets (Hold)'}
                  </button>
                </GlassPanel>

                {/* Sell */}
                <GlassPanel style={{ padding: 22 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#007aff', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>💰 {de ? 'Sell-Szenario' : 'Sell Scenario'}</div>
                  <div className="mb-3">
                    <label style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', display: 'block', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{de ? 'Proj. Verkaufspreis (editierbar)' : 'Proj. Sale Price (editable)'}</label>
                    <input
                      type="number"
                      className="input-glass"
                      value={dev.projectedSalePrice || ''}
                      onChange={e => updateDevelopment(dev.id, { projectedSalePrice: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  {[
                    { label: de ? 'Bruttogewinn' : 'Gross Profit', value: formatEUR((dev.projectedSalePrice || 0) - analysis.totalCost) },
                    { label: `${de ? 'Steuer' : 'Tax'} (${settings.taxRate}%)`, value: `− ${formatEUR(Math.max(0, ((dev.projectedSalePrice || 0) - analysis.totalCost)) * settings.taxRate / 100)}` },
                    { label: de ? 'Nettogewinn' : 'Net Profit', value: formatEUR(analysis.sellNetProfit), highlight: true },
                    { label: de ? 'ROI (nach Steuer)' : 'ROI (after tax)', value: `${analysis.sellROI.toFixed(1)}%`, color: analysis.sellROI > 15 ? '#1a7f37' : '#b25000' },
                    { label: 'Sell-IRR', value: `${analysis.sellIRR.toFixed(1)}%` },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between py-2 px-3 rounded-xl mb-1" style={{ background: 'rgba(0,0,0,0.03)' }}>
                      <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.65)' }}>{row.label}</span>
                      <span style={{ fontSize: 13, fontWeight: row.highlight ? 700 : 600, color: row.color || (row.highlight ? '#007aff' : '#1c1c1e'), fontFamily: 'ui-monospace, monospace' }}>{row.value}</span>
                    </div>
                  ))}
                  <button onClick={() => setShowHoldSellModal('Sell')} className="btn-accent w-full mt-4 py-2 rounded-xl text-sm font-semibold" style={{ display: 'block', textAlign: 'center' }}>
                    {de ? '→ In Sales überführen (Sell)' : '→ Transfer to Sales (Sell)'}
                  </button>
                </GlassPanel>
              </div>

              <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.35)', textAlign: 'center', fontStyle: 'italic' }}>
                {de
                  ? `* IRR-Berechnung deterministisch. Steuer: ${settings.taxRate}% pauschal (in Einstellungen anpassbar). Cashflows manuell editierbar.`
                  : `* IRR calculation is deterministic. Tax: ${settings.taxRate}% flat (adjustable in Settings). Cash flows are manually editable.`}
              </div>
            </div>
          ) : (
            <GlassPanel style={{ padding: 48, textAlign: 'center' }}>
              <BarChart3 size={32} color="rgba(60,60,67,0.30)" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(60,60,67,0.50)' }}>{de ? 'Hold/Sell-Analyse nicht verfügbar' : 'Hold/Sell analysis not available'}</div>
              <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.35)', marginTop: 4 }}>{de ? 'Bitte Cashflow-Prognose und Verkaufspreis hinterlegen.' : 'Please provide a cash flow forecast and sale price.'}</div>
            </GlassPanel>
          )}
        </div>
  );
}
