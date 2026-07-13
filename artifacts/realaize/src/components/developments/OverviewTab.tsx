import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { GlassPanel, SectionHeader } from '@/components/shared';
import { formatEUR } from '@/utils/kpiEngine';
import { useLanguage } from '@/i18n/LanguageContext';
import type { DevelopmentProject } from '@/models/types';

interface Props {
  dev: DevelopmentProject;
  totalBudget: number;
  totalOffer: number;
  totalContract: number;
  totalActual: number;
  totalCost: number;
}

export function OverviewTab({ dev, totalBudget, totalOffer, totalContract, totalActual, totalCost }: Props) {
  const de = useLanguage().lang === 'de';
  return (
        <div className="grid grid-cols-2 gap-6 animate-fade-in">
          <GlassPanel style={{ padding: 24 }}>
            <SectionHeader title="Budget Overview" />
            <div className="space-y-3">
              {[
                { label: de ? 'Underwriting-Budget' : 'Underwriting Budget', value: totalBudget, color: '#1c1c1e' },
                { label: de ? 'Angebote gesamt' : 'Total Offers', value: totalOffer, color: totalOffer > totalBudget ? '#cc1a14' : '#1c1c1e' },
                { label: de ? 'Vergaben gesamt' : 'Total Contracts', value: totalContract, color: totalContract > totalBudget ? '#cc1a14' : '#1a7f37' },
                { label: de ? 'Zahlungen' : 'Payments', value: totalActual, color: '#1c1c1e' },
                { label: de ? 'Gesamtinvestition (inkl. Kauf)' : 'Total Investment (incl. purchase)', value: totalCost, color: '#007aff', bold: true },
              ].map(row => (
                <div key={row.label} className="flex justify-between py-2 px-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                  <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.65)' }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: row.bold ? 700 : 600, color: row.color, fontFamily: 'ui-monospace, monospace' }}>{formatEUR(row.value)}</span>
                </div>
              ))}
            </div>
          </GlassPanel>
          <GlassPanel style={{ padding: 24 }}>
            <SectionHeader title="Budget by Trade" />
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dev.gewerke.map(g => ({ name: g.category.split(' ')[0], Budget: Math.round(g.underwritingBudget / 1000), Contract: Math.round((g.contractAmount || 0) / 1000) }))}>
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'rgba(60,60,67,0.45)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'rgba(60,60,67,0.45)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}k`} />
                <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(0,0,0,0.10)', borderRadius: 10, fontSize: 11 }} />
                <Bar dataKey="Budget" fill="rgba(0,122,255,0.25)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Contract" fill="#007aff" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </GlassPanel>
        </div>
  );
}
