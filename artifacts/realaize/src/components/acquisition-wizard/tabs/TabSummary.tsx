import React, { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { GlassPanel, KPICard } from '@/components/shared';
import { formatPct } from '@/utils/kpiEngine';

import { pdComputeAnnualRent, pdComputeTotalCapitalRequirement, pdComputeTotalLoan, pdComputePropertyKPIs } from '@/utils/propertyCashFlowModel';
import type { PropertyData } from '@/models/types';
import { fmt, Chip, SH } from '@/components/acquisition-wizard/shared';
import { useLanguage } from '@/i18n/LanguageContext';

export function TabSummary({ pd }: { pd: PropertyData }) {
  const de = useLanguage().lang === 'de';
  const kpis = useMemo(() => {
    if (!pd.purchasePrice) return null;
    try { return pdComputePropertyKPIs(pd); } catch { return null; }
  }, [pd]);

  const totalCapReq = pdComputeTotalCapitalRequirement(pd);
  const totalLoan = pdComputeTotalLoan(pd.financingTranches);
  const equity = totalCapReq - totalLoan;
  const ltv = totalCapReq > 0 ? (totalLoan / totalCapReq) * 100 : 0;

  // Helpers for the assumption cards — keeps the layout uniform
  const StatRow = ({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) => (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '6px 0', borderBottom: '1px dashed rgba(0,0,0,0.06)',
      fontSize: 12,
    }}>
      <span style={{ color: 'rgba(60,60,67,0.55)' }}>{label}</span>
      <span style={{ fontWeight: strong ? 700 : 600, color: '#1c1c1e' }}>{value}</span>
    </div>
  );

  const AssumptionCard = ({ title: t, children }: { title: string; children: React.ReactNode }) => (
    <div style={{
      background: 'rgba(0,0,0,0.03)', borderRadius: 12, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: 'rgba(60,60,67,0.45)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
      }}>{t}</div>
      {children}
    </div>
  );

  return (
    <div>
      <SH>Investment Summary</SH>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24, alignItems: 'stretch' }}>
        <GlassPanel style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Property</div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1c1c1e' }}>{pd.name || '—'}</div>
            <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.55)' }}>
              {pd.address || '—'}{pd.address && (pd.zip || pd.city) ? ', ' : ''}{pd.zip} {pd.city}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              <span style={{ background: 'rgba(0,122,255,0.1)', color: '#007aff', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6 }}>{pd.dealType}</span>
              <span style={{ background: 'rgba(201,169,110,0.1)', color: '#c9a96e', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6 }}>{pd.usageType}</span>
              <span style={{ background: 'rgba(60,60,67,0.06)', color: 'rgba(60,60,67,0.65)', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6 }}>
                {de ? 'Haltedauer' : 'Hold'} {pd.holdingPeriodYears}{de ? 'J' : 'y'}
              </span>
            </div>
          </div>
        </GlassPanel>
        <GlassPanel style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Capital Structure</div>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Chip label="Purchase Price" value={fmt(pd.purchasePrice)} />
            <Chip label="Total Investment" value={fmt(totalCapReq)} color="#007aff" />
            <Chip label="Debt" value={fmt(totalLoan)} color="#f87171" />
            <Chip label="Equity" value={fmt(equity)} color="#4ade80" />
          </div>
        </GlassPanel>
      </div>

      <SH>Key Performance Indicators</SH>
      {kpis ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
          <KPICard label="NIY" value={formatPct(kpis.niyAtAcquisition)} trend={kpis.niyAtAcquisition >= 4 ? 'up' : 'down'} />
          <KPICard label="NOI current" value={fmt(kpis.noiIst)} />
          <KPICard label="GRI p.a." value={fmt(kpis.gri)} />
          <KPICard label="LTV" value={formatPct(ltv)} trend={ltv <= 65 ? 'up' : 'down'} />
          <KPICard label="DSCR" value={kpis.dscr > 900 ? '—' : kpis.dscr.toFixed(2) + 'x'} trend={kpis.dscr >= 1.25 ? 'up' : 'down'} />
          <KPICard label="IRR 10J" value={formatPct(kpis.irr10Year)} trend={kpis.irr10Year >= 8 ? 'up' : 'neutral'} />
          <KPICard label="Equity Multiple" value={kpis.equityMultiple10Year.toFixed(2) + 'x'} />
          <KPICard label="Payback (Years)" value={kpis.paybackPeriodYears.toString()} />
          {pd.dealType === 'Development' && (
            <>
              <KPICard label="Dev. Profit" value={fmt(kpis.developmentProfit)} trend={kpis.developmentProfit >= 0 ? 'up' : 'down'} />
              <KPICard label="Profit on Cost" value={formatPct(kpis.profitOnCost)} trend={kpis.profitOnCost >= 15 ? 'up' : 'down'} />
              <KPICard label="Net Dev. Yield" value={formatPct(kpis.netDevelopmentYield)} />
              <KPICard label="NOI target" value={fmt(kpis.noiZiel)} trend="up" />
            </>
          )}
        </div>
      ) : (
        <div style={{ padding: 32, textAlign: 'center', color: 'rgba(60,60,67,0.45)' }}>
          <AlertTriangle size={24} style={{ marginBottom: 8, opacity: 0.4 }} />
          <div>{de ? 'Kaufpreis und Rent Roll befüllen, um KPIs zu berechnen.' : 'Fill in purchase price and Rent Roll to calculate KPIs.'}</div>
        </div>
      )}

      <SH>Assumptions Summary</SH>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        <AssumptionCard title="Financing">
          <StatRow label="LTV" value={formatPct(ltv)} strong />
          <StatRow label="Tranches" value={pd.financingTranches.length || '—'} />
          {pd.financingTranches.map(t => (
            <StatRow
              key={t.id}
              label={t.name}
              value={`${fmt(t.loanAmount)} · ${t.interestRate}%`}
            />
          ))}
        </AssumptionCard>
        <AssumptionCard title="Market">
          <StatRow label={de ? 'Haltedauer' : 'Holding Period'} value={`${pd.holdingPeriodYears} ${de ? 'J' : 'y'}`} strong />
          <StatRow label="Opex Inflation" value={`${pd.marketAssumptions.opexInflationPercent}%`} />
          {pd.marketAssumptions.perUsageType.map(m => (
            <StatRow
              key={m.usageType}
              label={m.usageType}
              value={`ERV +${m.ervGrowthRatePercent}% · Exit ${m.exitCapRatePercent}%`}
            />
          ))}
        </AssumptionCard>
        <AssumptionCard title="Rent Roll">
          <StatRow label={de ? 'Einheiten Ist' : 'Units (current)'} value={pd.unitsAsIs.length} strong />
          <StatRow label="GRI current" value={fmt(pdComputeAnnualRent(pd.unitsAsIs))} />
          {pd.unitsTarget.length > 0 && (
            <>
              <StatRow label={de ? 'Einheiten Ziel' : 'Units (target)'} value={pd.unitsTarget.length} strong />
              <StatRow label="GRI target" value={fmt(pdComputeAnnualRent(pd.unitsTarget))} />
            </>
          )}
        </AssumptionCard>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN WIZARD
// ═══════════════════════════════════════════════════════════════════════════
