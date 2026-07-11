import React, { useState, useRef } from 'react';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Line, Area, ComposedChart, ReferenceLine, CartesianGrid } from 'recharts';
import { ChevronDown } from 'lucide-react';
import { useStore } from '../store/useStore';
import { PageHeader, GlassPanel, KPICard } from '../components/shared';
import { formatEUR, computeAssetNOI } from '../utils/kpiEngine';
import type { DebtInstrument } from '../models/types';

// ══════════════════════════════════════════════════════════
// CASHFLOW PAGE — 10-Year Portfolio Investment Model
// ══════════════════════════════════════════════════════════

interface CFYearData {
  year: number;
  absoluteYear: number;
  grossRentalIncome: number;
  operatingCosts: number;
  capex: number;
  noi: number;
  acquisitions: number;
  acquisitionCosts: number;
  salesProceeds: number;
  salesCosts: number;
  cashflowFromTransactions: number;
  loanReceived: number;
  interestPayments: number;
  otherLoanCosts: number;
  loanRepayments: number;
  debtCashflow: number;
  freeCashflow: number;
}

function getDebtOutstandingForYear(instrument: DebtInstrument, absoluteYear: number): number {
  const drawdownYear = new Date(instrument.drawdownDate).getFullYear();
  const maturityYear = new Date(instrument.maturityDate).getFullYear();
  if (absoluteYear < drawdownYear || absoluteYear > maturityYear) return 0;
  const yearsSince = absoluteYear - drawdownYear;
  return instrument.amount * Math.pow(1 - instrument.amortizationRate / 100, yearsSince);
}

function fmtMio(n: number): string {
  if (n === 0) return '—';
  const inK = Math.round(Math.abs(n) / 1000);
  const formatted = inK.toLocaleString('de-DE');
  return n < 0 ? `(${formatted})` : formatted;
}

export function CashFlowPage() {
  const { assets, developments, sales, settings } = useStore();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['noi', 'transactions', 'debt']));
  const [colWidths, setColWidths] = useState<Record<number, number>>({});
  const resizeRef = useRef<{ colIdx: number; startX: number; startWidth: number } | null>(null);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const startResize = (colIdx: number, defaultWidth: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = colWidths[colIdx] ?? defaultWidth;
    resizeRef.current = { colIdx, startX: e.clientX, startWidth };
    const onMouseMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = ev.clientX - resizeRef.current.startX;
      const newWidth = Math.max(50, resizeRef.current.startWidth + delta);
      setColWidths(prev => ({ ...prev, [resizeRef.current!.colIdx]: newWidth }));
    };
    const onMouseUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const NUM_YEARS = 10;

  // Base year: always current year
  const baseYear = new Date().getFullYear();

  // Build yearly data
  const yearlyData: CFYearData[] = Array.from({ length: NUM_YEARS }, (_, yearIdx) => {
    const absoluteYear = baseYear + yearIdx;
    const d: CFYearData = {
      year: yearIdx + 1, absoluteYear,
      grossRentalIncome: 0, operatingCosts: 0, capex: 0, noi: 0,
      acquisitions: 0, acquisitionCosts: 0, salesProceeds: 0, salesCosts: 0, cashflowFromTransactions: 0,
      loanReceived: 0, interestPayments: 0, otherLoanCosts: 0, loanRepayments: 0, debtCashflow: 0,
      freeCashflow: 0,
    };

    // ── Assets ──
    for (const asset of assets) {
      const acqYear = new Date(asset.acquisitionDate).getFullYear();
      const saleObj = sales.find(s => s.sourceId === asset.id);
      const saleYear = saleObj
        ? (saleObj.soldAt ? new Date(saleObj.soldAt).getFullYear() : new Date(saleObj.createdAt).getFullYear() + 1)
        : acqYear + 10;

      const isActive = absoluteYear >= acqYear && absoluteYear < saleYear;
      const yearsHeld = absoluteYear - acqYear;
      const growthRate = ((asset.operatingCosts as any).rentalGrowthRate ?? 2.0) / 100;
      const growthFactor = Math.pow(1 + growthRate, Math.max(0, yearsHeld));

      if (isActive) {
        const grossRent = asset.annualRent * growthFactor;
        const noiBreakdown = computeAssetNOI(asset);
        const opexRatio = asset.annualRent > 0 ? noiBreakdown.totalOperatingExpenses / asset.annualRent : 0;
        d.grossRentalIncome += grossRent;
        d.operatingCosts += grossRent * opexRatio;
      }

      // Acquisitions
      if (absoluteYear === acqYear) {
        d.acquisitions += asset.purchasePrice;
        d.acquisitionCosts += asset.purchasePrice * (settings.defaultClosingCostPct + settings.defaultBrokerFeePct) / 100;
      }

      // Sale proceeds
      if (absoluteYear === saleYear && saleYear < baseYear + NUM_YEARS) {
        const noiBreakdown = computeAssetNOI(asset);
        const noi0 = noiBreakdown.noi;
        const growthRate2 = ((asset.operatingCosts as any).rentalGrowthRate ?? 2.0) / 100;
        const noiAtSale = noi0 * Math.pow(1 + growthRate2, Math.max(0, yearsHeld));
        const niy = asset.currentValue > 0 && noi0 > 0 ? noi0 / asset.currentValue : 0.04;
        const exitPrice = saleObj
          ? (saleObj.soldPrice ?? saleObj.askingPrice)
          : (niy > 0 ? noiAtSale / niy : asset.currentValue * Math.pow(1 + growthRate2, Math.max(0, yearsHeld)));
        d.salesProceeds += exitPrice;
        d.salesCosts += exitPrice * 0.02;
      }

      // Debt
      for (const debt of asset.debtInstruments) {
        const drawdownYear = new Date(debt.drawdownDate).getFullYear();
        const maturityYear = new Date(debt.maturityDate).getFullYear();
        if (absoluteYear === drawdownYear) d.loanReceived += debt.amount;
        if (absoluteYear >= drawdownYear && absoluteYear <= maturityYear && isActive) {
          const outstanding = getDebtOutstandingForYear(debt, absoluteYear);
          d.interestPayments += outstanding * debt.interestRate / 100;
          d.loanRepayments += outstanding * debt.amortizationRate / 100;
        }
      }
    }

    // ── Developments ──
    for (const dev of developments) {
      const purchaseYear = new Date(dev.startDate).getFullYear();
      const completionYear = new Date(dev.plannedEndDate || dev.startDate).getFullYear();
      const constructionYears = Math.max(1, completionYear - purchaseYear);
      const saleObj = sales.find(s => s.sourceId === dev.id);
      const saleYear = saleObj
        ? (saleObj.soldAt ? new Date(saleObj.soldAt).getFullYear() : new Date(saleObj.createdAt).getFullYear() + 1)
        : completionYear + 10;

      // Acquisition
      if (absoluteYear === purchaseYear) {
        d.acquisitions += dev.purchasePrice;
        d.acquisitionCosts += dev.purchasePrice * (settings.defaultClosingCostPct + settings.defaultBrokerFeePct) / 100;
      }

      // Capex during construction
      if (absoluteYear >= purchaseYear && absoluteYear < completionYear) {
        d.capex += dev.totalBudget / constructionYears;
      }

      // Rental income post-completion
      if (absoluteYear >= completionYear && absoluteYear < saleYear) {
        const yearsAfterCompletion = absoluteYear - completionYear;
        const unitsRent = dev.units && dev.units.length > 0
          ? dev.units.reduce((s, u) => s + (u.monthlyRent || 0) * 12, 0)
          : (dev.projectedSalePrice ?? (dev.totalBudget + dev.purchasePrice)) * 0.05;
        const rent = unitsRent * Math.pow(1.02, yearsAfterCompletion);
        d.grossRentalIncome += rent;
        d.operatingCosts += rent * 0.20;
      }

      // Sale proceeds
      if (absoluteYear === saleYear && saleYear < baseYear + NUM_YEARS) {
        const salePrice = saleObj
          ? (saleObj.soldPrice ?? saleObj.askingPrice)
          : (dev.projectedSalePrice ?? (dev.totalBudget + dev.purchasePrice) * 1.2);
        d.salesProceeds += salePrice;
        d.salesCosts += salePrice * 0.02;
      }

      // Dev debt
      if (dev.debtAssumptions) {
        const loanAmt = (dev.totalBudget + dev.purchasePrice) * ((dev.debtAssumptions.ltcPct ?? dev.debtAssumptions.ltvPct ?? 60) / 100);
        if (absoluteYear === purchaseYear) d.loanReceived += loanAmt;
        if (absoluteYear >= purchaseYear && absoluteYear < saleYear) {
          d.interestPayments += loanAmt * dev.debtAssumptions.interestRatePct / 100;
          if (dev.debtAssumptions.loanType === 'Annuität' && dev.debtAssumptions.annuityTermYears) {
            d.loanRepayments += loanAmt / dev.debtAssumptions.annuityTermYears;
          }
        }
      }
    }

    // Subtotals
    d.noi = d.grossRentalIncome - d.operatingCosts - d.capex;
    d.cashflowFromTransactions = -d.acquisitions - d.acquisitionCosts + d.salesProceeds - d.salesCosts;
    d.debtCashflow = d.loanReceived - d.interestPayments - d.otherLoanCosts - d.loanRepayments;
    d.freeCashflow = d.noi + d.cashflowFromTransactions + d.debtCashflow;
    return d;
  });

  // Totals column
  const totals: CFYearData = yearlyData.reduce<CFYearData>((acc, y) => {
    const keys: (keyof CFYearData)[] = ['grossRentalIncome','operatingCosts','capex','noi','acquisitions','acquisitionCosts','salesProceeds','salesCosts','cashflowFromTransactions','loanReceived','interestPayments','otherLoanCosts','loanRepayments','debtCashflow','freeCashflow'];
    keys.forEach(k => { (acc as any)[k] += (y as any)[k]; });
    return acc;
  }, { year: 0, absoluteYear: 0, grossRentalIncome: 0, operatingCosts: 0, capex: 0, noi: 0, acquisitions: 0, acquisitionCosts: 0, salesProceeds: 0, salesCosts: 0, cashflowFromTransactions: 0, loanReceived: 0, interestPayments: 0, otherLoanCosts: 0, loanRepayments: 0, debtCashflow: 0, freeCashflow: 0 });

  const allData = [...yearlyData, { ...totals, year: 99, absoluteYear: 9999 }];
  const colHeaders = [...yearlyData.map(y => `${y.absoluteYear}`), 'Total'];

  // Area chart data — raw EUR values, YAxis formatter handles display scaling
  let cumulative = 0;
  const chartData = yearlyData.map(y => {
    cumulative += y.freeCashflow;
    return {
      year: `${y.absoluteYear}`,
      noi: y.noi,
      transactions: y.cashflowFromTransactions,
      debtCashflow: y.debtCashflow,
      freeCashflow: y.freeCashflow,
      cumulativeFreeCF: cumulative,
    };
  });

  // KPI summary
  const totalNOI = totals.noi;
  const totalFCF = totals.freeCashflow;
  const avgAnnualNOI = totalNOI / NUM_YEARS;
  const totalSalesProceeds = totals.salesProceeds;

  // Row renderer helper
  const rowStyle = (isSubtotal: boolean, isGrandTotal: boolean, value?: number) => ({
    background: isGrandTotal
      ? (value !== undefined && value >= 0 ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)')
      : isSubtotal ? 'rgba(201,169,110,0.08)' : 'transparent',
    borderTop: isSubtotal || isGrandTotal ? '1px solid rgba(201,169,110,0.25)' : 'none',
  });

  const cellColor = (val: number, positive: boolean) => {
    if (val === 0) return 'rgba(60,60,67,0.30)';
    return positive ? (val > 0 ? '#4ade80' : '#f87171') : (val < 0 ? '#f87171' : '#4ade80');
  };

  type CFRow = {
    key: keyof CFYearData;
    label: string;
    sign: '+' | '-' | '=' | '==';
    isSubtotal: boolean;
    isGrandTotal: boolean;
    section: string;
    positiveIsGood: boolean;
  };

  const sections: { key: string; label: string; color: string; rows: CFRow[] }[] = [
    {
      key: 'noi',
      label: 'Operating Cashflow',
      color: '#007aff',
      rows: [
        { key: 'grossRentalIncome', label: 'Gross Rental Income', sign: '+', isSubtotal: false, isGrandTotal: false, section: 'noi', positiveIsGood: true },
        { key: 'operatingCosts', label: 'Operating Costs (Bewirtschaftung)', sign: '-', isSubtotal: false, isGrandTotal: false, section: 'noi', positiveIsGood: false },
        { key: 'capex', label: 'Capex / Baukosten', sign: '-', isSubtotal: false, isGrandTotal: false, section: 'noi', positiveIsGood: false },
        { key: 'noi', label: 'Net Operating Income (NOI)', sign: '=', isSubtotal: true, isGrandTotal: false, section: 'noi', positiveIsGood: true },
      ],
    },
    {
      key: 'transactions',
      label: 'Transaction Cashflow',
      color: '#ff9500',
      rows: [
        { key: 'acquisitions', label: 'Ankauf (Kaufpreis)', sign: '-', isSubtotal: false, isGrandTotal: false, section: 'transactions', positiveIsGood: false },
        { key: 'acquisitionCosts', label: 'Erwerbsnebenkosten', sign: '-', isSubtotal: false, isGrandTotal: false, section: 'transactions', positiveIsGood: false },
        { key: 'salesProceeds', label: 'Verkaufserlös', sign: '+', isSubtotal: false, isGrandTotal: false, section: 'transactions', positiveIsGood: true },
        { key: 'salesCosts', label: 'Verkaufsnebenkosten', sign: '-', isSubtotal: false, isGrandTotal: false, section: 'transactions', positiveIsGood: false },
        { key: 'cashflowFromTransactions', label: 'Cashflow Transaktionen', sign: '=', isSubtotal: true, isGrandTotal: false, section: 'transactions', positiveIsGood: true },
      ],
    },
    {
      key: 'debt',
      label: 'Financing Cashflow',
      color: '#f87171',
      rows: [
        { key: 'loanReceived', label: 'Darlehensauszahlung', sign: '+', isSubtotal: false, isGrandTotal: false, section: 'debt', positiveIsGood: true },
        { key: 'interestPayments', label: 'Zinsen', sign: '-', isSubtotal: false, isGrandTotal: false, section: 'debt', positiveIsGood: false },
        { key: 'otherLoanCosts', label: 'Sonstige Darlehenskosten', sign: '-', isSubtotal: false, isGrandTotal: false, section: 'debt', positiveIsGood: false },
        { key: 'loanRepayments', label: 'Tilgung', sign: '-', isSubtotal: false, isGrandTotal: false, section: 'debt', positiveIsGood: false },
        { key: 'debtCashflow', label: 'Debt Cashflow', sign: '=', isSubtotal: true, isGrandTotal: false, section: 'debt', positiveIsGood: true },
      ],
    },
  ];

  const grandTotalRow: CFRow = { key: 'freeCashflow', label: 'Free Cashflow', sign: '==', isSubtotal: false, isGrandTotal: true, section: 'total', positiveIsGood: true };

  return (
    <div className="p-8 max-w-[1800px] mx-auto">
      <PageHeader
        title="10-Jahres Portfolio Cash Flow"
        subtitle={`Investitionsrechnung — Lestate Real GmbH · Basisjahr ${baseYear}`}
        badge={`${assets.length + developments.length} Objekte`}
      />

      {/* KPI Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KPICard label="NOI 10J Gesamt" value={formatEUR(totalNOI, true)} status={totalNOI > 0 ? 'good' : 'danger'} />
        <KPICard label="Ø NOI p.a." value={formatEUR(avgAnnualNOI, true)} status="neutral" />
        <KPICard label="Free Cashflow 10J" value={formatEUR(totalFCF, true)} status={totalFCF > 0 ? 'good' : 'warning'} />
        <KPICard label="Verkaufserlöse (gesamt)" value={formatEUR(totalSalesProceeds, true)} status="neutral" />
      </div>

      {/* Area Chart with Gradient Fills */}
      <GlassPanel style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(60,60,67,0.50)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
          Cashflow-Segmente pro Jahr (TEUR)
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <defs>
              <linearGradient id="gradNOI" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#007aff" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#007aff" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="gradTx" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff9500" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#ff9500" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="gradDebt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f87171" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#f87171" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="gradFCF" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c9a96e" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#c9a96e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'rgba(60,60,67,0.5)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'rgba(60,60,67,0.4)' }} axisLine={false} tickLine={false} tickFormatter={v => Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : `${(v / 1000).toFixed(0)}k`} />
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <ReferenceLine y={0} stroke="rgba(0,0,0,0.20)" strokeWidth={1} />
            <Tooltip
              content={({ active, payload, label }: any) => {
                if (!active || !payload?.length) return null;
                const colors: Record<string, string> = { noi: '#007aff', transactions: '#ff9500', debtCashflow: '#f87171', freeCashflow: '#c9a96e', cumulativeFreeCF: '#0A7629' };
                const names: Record<string, string> = { noi: 'NOI', transactions: 'Transactions', debtCashflow: 'Debt', freeCashflow: 'Free CF', cumulativeFreeCF: 'Kum. Free CF' };
                return (
                  <div style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '12px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', fontSize: 12, minWidth: 210 }}>
                    <div style={{ fontWeight: 700, color: '#111', marginBottom: 8 }}>{label}</div>
                    {payload.map((p: any) => (
                      <div key={p.dataKey} className="flex justify-between gap-6" style={{ marginBottom: 3 }}>
                        <span style={{ color: 'rgba(60,60,67,0.6)', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: colors[p.dataKey] || p.color }} />
                          {names[p.dataKey] || p.name}
                        </span>
                        <span style={{ fontWeight: 600, fontFamily: 'ui-monospace, monospace', color: p.value >= 0 ? '#1c1c1e' : '#f87171' }}>
                          {formatEUR(p.value, true)}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            <Area type="monotone" dataKey="noi" name="NOI" stroke="#007aff" strokeWidth={1} fill="url(#gradNOI)" />
            <Area type="monotone" dataKey="transactions" name="Transactions" stroke="#ff9500" strokeWidth={1} fill="url(#gradTx)" />
            <Area type="monotone" dataKey="debtCashflow" name="Debt" stroke="#f87171" strokeWidth={1} fill="url(#gradDebt)" />
            <Area type="monotone" dataKey="freeCashflow" name="Free CF" stroke="#c9a96e" strokeWidth={3} fill="url(#gradFCF)" />
            <Line type="monotone" dataKey="cumulativeFreeCF" name="Kum. Free CF" stroke="#0A7629" strokeWidth={3} dot={{ r: 4, fill: '#0A7629', strokeWidth: 2, stroke: '#fff' }} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex gap-5 mt-3" style={{ paddingLeft: 4 }}>
          {[
            { color: '#007aff', label: 'NOI', dot: false },
            { color: '#ff9500', label: 'Transactions', dot: false },
            { color: '#f87171', label: 'Debt', dot: false },
            { color: '#c9a96e', label: 'Free CF', dot: false },
            { color: '#0A7629', label: 'Kum. Free CF', dot: true },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              {l.dot
                ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, border: '2px solid #fff', boxShadow: `0 0 0 1px ${l.color}` }} />
                : <div style={{ width: 18, height: 2, borderRadius: 1, background: l.color }} />}
              <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.60)' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </GlassPanel>

      {/* 10-Year Table */}
      <GlassPanel style={{ overflow: 'auto', padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 1000 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid rgba(201,169,110,0.25)' }}>
              <th style={{ padding: '14px 16px', textAlign: 'left', position: 'sticky', left: 0, background: '#fff', zIndex: 2, width: colWidths[0] ?? 240, minWidth: 140, borderRight: '1px solid rgba(0,0,0,0.07)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#111', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Portfolio Cash Flow</div>
                <div style={{ fontSize: 10, fontWeight: 400, color: 'rgba(0,0,0,0.45)', marginTop: 2 }}>€ in tausend ('000)</div>
                <div onMouseDown={e => startResize(0, 240, e)} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 5, cursor: 'col-resize', zIndex: 10 }} />
              </th>
              {colHeaders.map((h, i) => (
                <th key={h} style={{
                  padding: '14px 12px', fontSize: 11, fontWeight: 700, position: 'relative',
                  color: i === colHeaders.length - 1 ? '#c9a96e' : '#111',
                  textAlign: 'right', letterSpacing: '0.03em',
                  width: colWidths[i + 2] ?? 100, minWidth: 60,
                  borderLeft: i === colHeaders.length - 1 ? '2px solid rgba(201,169,110,0.20)' : '1px solid rgba(0,0,0,0.05)',
                }}>
                  {i === colHeaders.length - 1 ? 'Total' : h}
                  {i < colHeaders.length - 1 && <div style={{ fontSize: 9, fontWeight: 400, color: 'rgba(0,0,0,0.35)', marginTop: 1 }}>Jahr {i + 1}</div>}
                  <div onMouseDown={e => startResize(i + 2, 100, e)} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 5, cursor: 'col-resize', zIndex: 10 }} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map(section => (
              <React.Fragment key={section.key}>
                {/* Section header with inline totals */}
                {(() => {
                  const subtotalRow = section.rows.find(r => r.isSubtotal);
                  const sectionBg: Record<string, string> = {
                    noi: 'rgba(0,122,255,0.15)',
                    transactions: 'rgba(201,169,110,0.15)',
                    debt: 'rgba(248,113,113,0.15)',
                  };
                  const bg = sectionBg[section.key] ?? 'rgba(0,0,0,0.04)';
                  return (
                    <tr onClick={() => toggleSection(section.key)} style={{ cursor: 'pointer', borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                      <td style={{ padding: '10px 16px', background: bg, position: 'sticky', left: 0, zIndex: 1, borderRight: '1px solid rgba(0,0,0,0.07)' }}>
                        <div className="flex items-center gap-2">
                          <ChevronDown size={13} style={{ color: section.color, transform: expandedSections.has(section.key) ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: section.color, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{section.label}</span>
                        </div>
                      </td>
                      {allData.map((y, i) => {
                        const val = subtotalRow ? (y as any)[subtotalRow.key] as number : 0;
                        const isTotal = i === allData.length - 1;
                        return (
                          <td key={i} style={{
                            padding: '10px 12px', textAlign: 'right', background: bg,
                            fontFamily: 'ui-monospace, monospace', fontSize: 12, fontWeight: 700,
                            color: val === 0 ? 'rgba(0,0,0,0.20)' : val < 0 ? '#f87171' : section.color,
                            borderLeft: isTotal ? '2px solid rgba(201,169,110,0.20)' : '1px solid rgba(0,0,0,0.05)',
                          }}>
                            {val === 0 ? '—' : fmtMio(val)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })()}

                {/* Section rows */}
                {section.rows.map(row => {
                  const isExpanded = expandedSections.has(section.key);
                  if (row.isSubtotal) return null;
                  if (!isExpanded) return null;

                  return (
                    <tr key={row.key} style={rowStyle(row.isSubtotal, false)}>
                      <td style={{
                        padding: row.isSubtotal ? '12px 16px' : '9px 16px 9px 28px',
                        fontSize: row.isSubtotal ? 13 : 12,
                        fontWeight: row.isSubtotal ? 700 : 400,
                        color: '#111',
                        position: 'sticky', left: 0,
                        background: row.isSubtotal ? 'rgba(201,169,110,0.08)' : '#fff',
                        zIndex: 1,
                        borderRight: '1px solid rgba(0,0,0,0.07)',
                      }}>
                        {row.label}
                      </td>
                      {allData.map((y, i) => {
                        const rawVal = (y as any)[row.key] as number;
                        const effectiveVal = row.sign === '-' && rawVal > 0 ? -rawVal : rawVal;
                        const isTotal = i === allData.length - 1;
                        const valueColor = rawVal === 0
                          ? 'rgba(0,0,0,0.25)'
                          : row.isSubtotal
                            ? cellColor(rawVal, row.positiveIsGood)
                            : (row.sign === '-' || rawVal < 0) ? '#f87171' : '#111';
                        return (
                          <td key={i} style={{
                            padding: row.isSubtotal ? '12px 12px' : '9px 12px',
                            textAlign: 'right',
                            fontFamily: 'ui-monospace, monospace',
                            fontSize: row.isSubtotal ? 13 : 12,
                            fontWeight: row.isSubtotal ? 700 : 400,
                            color: valueColor,
                            borderLeft: isTotal ? '2px solid rgba(201,169,110,0.20)' : '1px solid rgba(0,0,0,0.05)',
                          }}>
                            {rawVal === 0 ? '—' : fmtMio(effectiveVal)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}

            {/* Grand total: Free Cashflow */}
            <tr style={{ ...rowStyle(false, true, totals.freeCashflow), borderTop: '2px solid rgba(10,118,41,0.50)' }}>
              <td style={{ padding: '16px 16px', fontSize: 14, fontWeight: 800, color: '#4ade80', position: 'sticky', left: 0, background: totals.freeCashflow >= 0 ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)', zIndex: 1, borderRight: '1px solid rgba(0,0,0,0.07)' }}>
                Free Cashflow
              </td>
              {allData.map((y, i) => {
                const val = y.freeCashflow;
                const isTotal = i === allData.length - 1;
                return (
                  <td key={i} style={{
                    padding: '16px 12px', textAlign: 'right',
                    fontFamily: 'ui-monospace, monospace', fontSize: 14, fontWeight: 800,
                    color: val === 0 ? 'rgba(0,0,0,0.25)' : val > 0 ? '#4ade80' : '#f87171',
                    borderLeft: isTotal ? '2px solid rgba(201,169,110,0.20)' : '1px solid rgba(0,0,0,0.05)',
                  }}>
                    {val === 0 ? '—' : fmtMio(val)}
                  </td>
                );
              })}
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={colHeaders.length + 2} style={{ padding: '10px 16px', fontSize: 10, color: 'rgba(0,0,0,0.35)', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                Angaben in EUR Tausend ('000). Mietindexierung gemäß individualem Wachstumssatz pro Objekt. Verkäufe basierend auf NOI-Exit-Yield oder Angebotspreisen. Alle Werte sind Planwerte.
              </td>
            </tr>
          </tfoot>
        </table>
      </GlassPanel>
    </div>
  );
}

