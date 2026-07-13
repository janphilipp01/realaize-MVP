import React from 'react';

import { GlassPanel, SectionHeader } from '@/components/shared';
import { formatEUR } from '@/utils/kpiEngine';
import { computeDealCashFlow } from '@/utils/propertyCashFlowModel';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

import type { AcquisitionDeal } from '@/models/types';

export function CashFlowTab({ deal }: { deal: AcquisitionDeal }) {
        const uw = deal.underwritingAssumptions;
        const ma = uw.marketAssumptions || { rentGrowthRate: 2, exitCapRate: 5, holdingPeriodYears: 10, ervGrowthRate: 2, rentalGrowthRate: 2 };
        const dcf = computeDealCashFlow(uw, deal.financingAssumptions);
        const chartData = dcf.annualRows.map(r => ({
          year: `J${r.year}`,
          NOI: Math.round(r.noi / 1000),
          'Levered CF': Math.round(r.leveredCashFlow / 1000),
        }));
        const kpiLS: React.CSSProperties = { fontSize: 10, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em' };
        const kpiVS = (c?: string): React.CSSProperties => ({ fontSize: 18, fontWeight: 700, color: c || '#1c1c1e', fontFamily: 'ui-monospace, monospace' });
        return (
          <div className="space-y-6 animate-fade-in">
            {/* Assumptions summary */}
            <GlassPanel style={{ padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1c1c1e', marginBottom: 12 }}>Market Assumptions (DCF)</div>
              <div className="grid grid-cols-4 gap-6">
                {[
                  ['Holding Period', `${ma.holdingPeriodYears} yrs`],
                  ['Rent Growth p.a.', `${ma.rentalGrowthRate}%`],
                  ['Exit Cap Rate', `${ma.exitCapRate}%`],
                  ['ERV €/m²/mo', `${uw.ervPerSqm || '—'}`],
                ].map(([l, v]) => (
                  <div key={l}>
                    <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{l}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1c1c1e', fontFamily: 'ui-monospace, monospace' }}>{v}</div>
                  </div>
                ))}
              </div>
            </GlassPanel>

            {/* IRR KPIs */}
            <div className="grid grid-cols-4 gap-4">
              <GlassPanel style={{ padding: 18 }}>
                <div style={kpiLS}>Unlevered IRR</div>
                <div style={kpiVS(dcf.unleveredIRR > 8 ? '#4ade80' : dcf.unleveredIRR > 5 ? '#fbbf24' : '#f87171')}>{dcf.unleveredIRR.toFixed(2)}%</div>
              </GlassPanel>
              <GlassPanel style={{ padding: 18 }}>
                <div style={kpiLS}>Levered IRR</div>
                <div style={kpiVS(dcf.leveredIRR > 12 ? '#4ade80' : dcf.leveredIRR > 8 ? '#fbbf24' : '#f87171')}>{dcf.leveredIRR.toFixed(2)}%</div>
              </GlassPanel>
              <GlassPanel style={{ padding: 18 }}>
                <div style={kpiLS}>Equity Multiple</div>
                <div style={kpiVS(dcf.equityMultiple > 1.5 ? '#4ade80' : dcf.equityMultiple > 1.2 ? '#fbbf24' : '#f87171')}>{dcf.equityMultiple.toFixed(2)}x</div>
              </GlassPanel>
              <GlassPanel style={{ padding: 18 }}>
                <div style={kpiLS}>Exit Value (Year {dcf.holdingPeriodYears})</div>
                <div style={kpiVS('#007aff')}>{formatEUR(dcf.terminalValue, true)}</div>
                <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginTop: 2 }}>@ {dcf.exitCapRate}% Cap Rate</div>
              </GlassPanel>
            </div>

            {/* Chart */}
            <GlassPanel style={{ padding: 24 }}>
              <SectionHeader title="NOI & Levered Cash Flow (annual)" />
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: 'rgba(60,60,67,0.55)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'rgba(60,60,67,0.55)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}k`} />
                  <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(0,0,0,0.10)', borderRadius: 10, fontSize: 12 }} formatter={(v: number) => [`${v}k €`]} />
                  <Bar dataKey="NOI" fill="rgba(0,122,255,0.7)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Levered CF" fill="rgba(74,222,128,0.7)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </GlassPanel>

            {/* Annual table */}
            <GlassPanel style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1c1c1e' }}>Annual Cash Flow Table (Underwriting)</div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
                      {['Year', 'Gross Rent', 'EGI', 'NOI', '− Debt Svc', 'Levered CF', 'Cumulative'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 600, color: 'rgba(60,60,67,0.45)', textAlign: 'right', letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dcf.annualRows.map(row => (
                      <tr key={row.year} style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                        <td style={{ padding: '9px 14px', fontWeight: 700, color: '#1c1c1e', textAlign: 'right' }}>{row.year}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'ui-monospace, monospace', color: '#007aff', textAlign: 'right' }}>{formatEUR(row.grossRent, true)}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'ui-monospace, monospace', color: '#1c1c1e', textAlign: 'right' }}>{formatEUR(row.egi, true)}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'ui-monospace, monospace', fontWeight: 600, color: '#1c1c1e', textAlign: 'right' }}>{formatEUR(row.noi, true)}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'ui-monospace, monospace', color: '#fbbf24', textAlign: 'right' }}>−{formatEUR(row.annualDebtService, true)}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: row.leveredCashFlow >= 0 ? '#4ade80' : '#f87171', textAlign: 'right' }}>{row.leveredCashFlow >= 0 ? '+' : ''}{formatEUR(row.leveredCashFlow, true)}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'ui-monospace, monospace', color: row.cumulative >= 0 ? '#4ade80' : '#f87171', textAlign: 'right' }}>{formatEUR(row.cumulative, true)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '2px solid rgba(0,0,0,0.10)', background: 'rgba(0,122,255,0.03)' }}>
                      <td colSpan={3} style={{ padding: '12px 14px', fontSize: 12, fontWeight: 700, color: '#1c1c1e' }}>Exit Value (Year {dcf.holdingPeriodYears})</td>
                      <td colSpan={3} style={{ padding: '12px 14px', fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: '#007aff', fontSize: 14, textAlign: 'right' }}>{formatEUR(dcf.terminalValue, true)}</td>
                      <td style={{ padding: '12px 14px', fontSize: 10, color: 'rgba(60,60,67,0.45)', textAlign: 'right' }}>NOI / {dcf.exitCapRate}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </GlassPanel>
          </div>
        );
}
