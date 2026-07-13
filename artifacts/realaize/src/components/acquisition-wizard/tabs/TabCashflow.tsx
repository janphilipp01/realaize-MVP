import React, { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend, ReferenceLine } from 'recharts';
import { formatEUR } from '@/utils/kpiEngine';

import { pdComputePropertyCashFlowMonthly, pdAggregateToYears } from '@/utils/propertyCashFlowModel';
import type { PropertyData } from '@/models/types';
import { fmt, SH } from '@/components/acquisition-wizard/shared';
import { useLanguage } from '@/i18n/LanguageContext';

export function TabCashflow({ pd }: { pd: PropertyData }) {
  const de = useLanguage().lang === 'de';
  const years = useMemo(() => {
    if (!pd.purchasePrice) return [];
    try {
      const months = pdComputePropertyCashFlowMonthly(pd);
      return pdAggregateToYears(months);
    } catch { return []; }
  }, [pd]);

  const chartData = years.map(y => ({
    name: `J${y.yearIndex + 1}`,
    NOI: Math.round(y.noi),
    Transaction: Math.round(y.transactionsCashflow),
    Debt: Math.round(y.debtCashflow),
    'Cum. FCF': Math.round(y.cumulativeFreeCashflow),
  }));

  if (years.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'rgba(60,60,67,0.45)' }}>
        <BarChart3 size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
        <div>{de ? 'Bitte Kaufpreis und Rent Roll befüllen, um den Cashflow zu berechnen.' : 'Please fill in purchase price and rent roll to calculate the cash flow.'}</div>
      </div>
    );
  }

  return (
    <div>
      <SH>Annual Cash Flow Overview</SH>
      <div style={{ height: 260, marginBottom: 24 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => formatEUR(v)} labelStyle={{ fontWeight: 700 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="NOI" fill="#007aff" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Transaction" fill="#c9a96e" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Debt" fill="#f87171" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <SH>Cumulative Free Cash Flow</SH>
      <div style={{ height: 200, marginBottom: 24 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => formatEUR(v)} />
            <ReferenceLine y={0} stroke="rgba(0,0,0,0.2)" />
            <Line type="monotone" dataKey="Cum. FCF" stroke="#4ade80" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <SH>Cash Flow Table</SH>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
              {['Year', 'GRI', 'NOI', 'Capex', 'Transaction', 'Debt CF', 'Free CF', 'Cum. FCF'].map(h => (
                <th key={h} style={{ textAlign: 'right', padding: '6px 8px', fontSize: 10, fontWeight: 700, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map(y => (
              <tr key={y.yearIndex} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                <td style={{ textAlign: 'right', padding: '5px 8px', fontWeight: 600 }}>J{y.yearIndex + 1}</td>
                <td style={{ textAlign: 'right', padding: '5px 8px' }}>{fmt(y.grossRentalIncome)}</td>
                <td style={{ textAlign: 'right', padding: '5px 8px', color: '#007aff', fontWeight: 600 }}>{fmt(y.noi)}</td>
                <td style={{ textAlign: 'right', padding: '5px 8px', color: '#f87171' }}>{y.capexConstructionCosts > 0 ? fmt(-y.capexConstructionCosts) : '—'}</td>
                <td style={{ textAlign: 'right', padding: '5px 8px', color: '#c9a96e' }}>{fmt(y.transactionsCashflow)}</td>
                <td style={{ textAlign: 'right', padding: '5px 8px', color: '#f87171' }}>{fmt(y.debtCashflow)}</td>
                <td style={{ textAlign: 'right', padding: '5px 8px', fontWeight: 600, color: y.freeCashflow >= 0 ? '#4ade80' : '#f87171' }}>{fmt(y.freeCashflow)}</td>
                <td style={{ textAlign: 'right', padding: '5px 8px', fontWeight: 700, color: y.cumulativeFreeCashflow >= 0 ? '#4ade80' : '#f87171' }}>{fmt(y.cumulativeFreeCashflow)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 9: Summary / IC Sheet
// ═══════════════════════════════════════════════════════════════════════════
