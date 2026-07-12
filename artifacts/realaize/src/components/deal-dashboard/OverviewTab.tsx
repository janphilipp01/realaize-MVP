import React from 'react';
import { Info } from 'lucide-react';

import { GlassPanel, SectionHeader } from '@/components/shared';
import { computeDealKPIs, formatEUR, formatPct, formatX } from '@/utils/kpiEngine';

import type { AcquisitionDeal } from '@/models/types';

export function OverviewTab({ deal, kpis, handleShowFormula }: { deal: AcquisitionDeal; kpis: ReturnType<typeof computeDealKPIs>; handleShowFormula: (key: string) => void }) {
  return (
        <div className="space-y-6 animate-fade-in">
          {/* KPI Strip */}
          <div className="grid grid-cols-5 gap-4">
            <div className="kpi-card" onClick={() => handleShowFormula('totalAcquisitionCost')}>
              <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Total Acq. Cost</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#007aff' }}>{formatEUR(kpis.totalAcquisitionCost, true)}</div>
              <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginTop: 4 }}>inkl. NK & Capex</div>
            </div>
            <div className="kpi-card" onClick={() => handleShowFormula('netInitialYield')}>
              <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Net Initial Yield</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: kpis.netInitialYield > 4.5 ? '#4ade80' : kpis.netInitialYield > 3 ? '#fbbf24' : '#f87171' }}>{formatPct(kpis.netInitialYield)}</div>
              <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginTop: 4 }}>auf Gesamtkosten</div>
            </div>
            <div className="kpi-card" onClick={() => handleShowFormula('kaufpreisfaktor')}>
              <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Kaufpreisfaktor</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: kpis.kaufpreisfaktor < 20 ? '#4ade80' : kpis.kaufpreisfaktor < 24 ? '#fbbf24' : '#f87171' }}>{formatX(kpis.kaufpreisfaktor)}</div>
              <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginTop: 4 }}>auf Bruttomiete</div>
            </div>
            <div className="kpi-card" onClick={() => handleShowFormula('dscr')}>
              <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>DSCR</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: kpis.dscr > 1.5 ? '#4ade80' : kpis.dscr > 1.2 ? '#fbbf24' : '#f87171' }}>{formatX(kpis.dscr)}</div>
              <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginTop: 4 }}>Deckungsgrad</div>
            </div>
            <div className="kpi-card" onClick={() => handleShowFormula('cashOnCashReturn')}>
              <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Cash-on-Cash</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: kpis.cashOnCashReturn > 4 ? '#4ade80' : kpis.cashOnCashReturn > 1 ? '#fbbf24' : '#f87171' }}>{formatPct(kpis.cashOnCashReturn)}</div>
              <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginTop: 4 }}>EK-Rendite lfd.</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Summary KPI table */}
            <GlassPanel style={{ padding: 24 }}>
              <SectionHeader title="KPI Übersicht" />
              <div className="space-y-2">
                {[
                  { l: 'Kaufpreis', v: formatEUR(deal.underwritingAssumptions.purchasePrice, true), k: '' },
                  { l: 'Kaufnebenkosten', v: formatEUR(kpis.closingCosts, true), k: '' },
                  { l: 'Maklergebühr', v: formatEUR(kpis.brokerFee, true), k: '' },
                  { l: 'Initialer CapEx', v: formatEUR(deal.underwritingAssumptions.initialCapex, true), k: '' },
                  { l: 'Total Acquisition Cost', v: formatEUR(kpis.totalAcquisitionCost, true), k: 'totalAcquisitionCost', bold: true },
                  { l: 'Eigenkapital', v: formatEUR(kpis.equityInvested, true), k: 'equityInvested' },
                  { l: 'Bruttoanfangsrendite', v: formatPct(kpis.bruttoanfangsrendite), k: 'bruttoanfangsrendite' },
                  { l: 'NOI', v: formatEUR(kpis.noi, true), k: 'noi' },
                  { l: 'LTV', v: formatPct(kpis.ltv, 1), k: 'ltv' },
                  { l: 'Interest Coverage', v: formatX(kpis.interestCoverageProxy), k: 'interestCoverageProxy' },
                ].map(row => (
                  <div key={row.l}
                    className="flex justify-between items-center py-2 px-3 rounded-lg"
                    style={{ background: 'rgba(0,0,0,0.02)', cursor: row.k ? 'pointer' : 'default' }}
                    onClick={() => row.k && handleShowFormula(row.k)}
                  >
                    <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.70)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {row.k && <Info size={11} color="var(--text-muted)" />}
                      {row.l}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: (row as any).bold ? 700 : 600, color: (row as any).bold ? 'var(--accent)' : 'var(--text-primary)', fontFamily: 'ui-monospace, monospace' }}>
                      {row.v}
                    </span>
                  </div>
                ))}
              </div>
            </GlassPanel>

            {/* Scenario Analysis */}
            <GlassPanel style={{ padding: 24 }}>
              <SectionHeader title="Szenario-Analyse" />
              <div className="space-y-4">
                {[
                  { label: 'Base Case', rentMod: 0, vacMod: 0, rateMod: 0, color: '#4ade80' },
                  { label: '+100bps Zinsen', rentMod: 0, vacMod: 0, rateMod: 1.0, color: '#fbbf24' },
                  { label: '-10% Miete', rentMod: -10, vacMod: 0, rateMod: 0, color: '#fbbf24' },
                  { label: '+5% Leerstand', rentMod: 0, vacMod: 5, rateMod: 0, color: '#f87171' },
                  { label: 'Stress (alle)', rentMod: -8, vacMod: 3, rateMod: 0.75, color: '#f87171' },
                ].map(scen => {
                  const uw = {
                    ...deal.underwritingAssumptions,
                    annualGrossRent: deal.underwritingAssumptions.annualGrossRent * (1 + scen.rentMod / 100),
                    vacancyRatePercent: deal.underwritingAssumptions.vacancyRatePercent + scen.vacMod,
                  };
                  const fin = { ...deal.financingAssumptions, interestRate: deal.financingAssumptions.interestRate + scen.rateMod };
                  const sk = computeDealKPIs(uw, fin);
                  return (
                    <div key={scen.label} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.06)' }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: scen.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: 13, color: 'rgba(60,60,67,0.70)' }}>{scen.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: scen.color, fontFamily: 'ui-monospace, monospace' }}>NIY {formatPct(sk.netInitialYield)}</div>
                      <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)', fontFamily: 'ui-monospace, monospace' }}>DSCR {formatX(sk.dscr)}</div>
                      <div style={{ fontSize: 12, color: sk.cashOnCashReturn > 0 ? '#4ade80' : '#f87171', fontFamily: 'ui-monospace, monospace' }}>CoC {formatPct(sk.cashOnCashReturn, 1)}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginTop: 12, fontStyle: 'italic' }}>
                * Szenario-KPIs deterministisch berechnet. Kein KI-Einfluss.
              </div>
            </GlassPanel>
          </div>
        </div>
  );
}
