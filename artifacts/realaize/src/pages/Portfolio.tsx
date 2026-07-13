import React from 'react';
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { TrendingUp, AlertTriangle, CheckCircle, ArrowRight, Zap, RefreshCw, Activity, Newspaper, BarChart3 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useListMarketLocations } from '@workspace/api-client-react';
import { PageHeader, KPICard, GlassPanel, StageBadge, StatusBadge, FreshnessBadge } from '@/components/shared';
import { formatEUR, formatPct, computeAssetNOI, computePortfolioNIY } from '@/utils/kpiEngine';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage, useDateLocale } from '@/i18n/LanguageContext';

export default function PortfolioPage() {
  const { assets, deals, sales, auditLog, newsReports, settings } = useStore();
  const { data: marketLocations = [] } = useListMarketLocations();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const dateLocale = useDateLocale();

  // Portfolio summary
  const totalValue = assets.reduce((s, a) => s + a.currentValue, 0);
  const totalRent = assets.reduce((s, a) => s + a.annualRent, 0);
  const totalDebt = assets.flatMap(a => a.debtInstruments).reduce((s, d) => s + d.outstandingAmount, 0);
  const avgOccupancy = assets.reduce((s, a) => s + a.occupancyRate, 0) / assets.length;
  const breaches = assets.flatMap(a => a.covenants).filter(c => c.status === 'Breach');
  const warnings = assets.flatMap(a => a.covenants).filter(c => c.status === 'Warning');

  // YTD disposal gain
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
  const ytdSales = sales.filter(s => s.status === 'Verkauft' && s.soldAt && s.soldAt >= yearStart);
  const ytdDisposalGain = ytdSales.reduce((sum, s) => sum + (s.disposalGain || 0), 0);

  // 10-year cash flow chart data for dashboard widget
  const baseYear = new Date().getFullYear();
  const NUM_YEARS_CF = 10;
  let cumFCF = 0;
  const chartData = Array.from({ length: NUM_YEARS_CF }, (_, yearIdx) => {
    const absoluteYear = baseYear + yearIdx;
    let grossRentalIncome = 0, operatingCosts = 0, acquisitions = 0, acquisitionCosts = 0, salesProceeds = 0, salesCosts = 0, loanReceived = 0, interestPayments = 0, loanRepayments = 0;
    for (const asset of assets) {
      const acqYear = new Date(asset.acquisitionDate).getFullYear();
      const saleObj = sales.find(s => s.sourceId === asset.id);
      const saleYear = saleObj
        ? (saleObj.soldAt ? new Date(saleObj.soldAt).getFullYear() : new Date(saleObj.createdAt).getFullYear() + 1)
        : acqYear + 10;
      const isActive = absoluteYear >= acqYear && absoluteYear < saleYear;
      const yearsHeld = absoluteYear - acqYear;
      const growthRate = (asset.operatingCosts.rentalGrowthRate ?? 2.0) / 100;
      const growthFactor = Math.pow(1 + growthRate, Math.max(0, yearsHeld));
      if (isActive) {
        const grossRent = asset.annualRent * growthFactor;
        const noiBreakdown = computeAssetNOI(asset);
        const opexRatio = asset.annualRent > 0 ? noiBreakdown.totalOperatingExpenses / asset.annualRent : 0;
        grossRentalIncome += grossRent;
        operatingCosts += grossRent * opexRatio;
      }
      if (absoluteYear === acqYear) {
        acquisitions += asset.purchasePrice;
        acquisitionCosts += asset.purchasePrice * (settings.defaultClosingCostPct + settings.defaultBrokerFeePct) / 100;
      }
      if (absoluteYear === saleYear && saleYear < baseYear + NUM_YEARS_CF) {
        const noiBreakdown = computeAssetNOI(asset);
        const noi0 = noiBreakdown.noi;
        const niy = asset.currentValue > 0 && noi0 > 0 ? noi0 / asset.currentValue : 0.04;
        const exitPrice = saleObj
          ? (saleObj.soldPrice ?? saleObj.askingPrice)
          : (niy > 0 ? noi0 * Math.pow(1 + growthRate, Math.max(0, yearsHeld)) / niy : asset.currentValue);
        salesProceeds += exitPrice;
        salesCosts += exitPrice * 0.02;
      }
      for (const debt of asset.debtInstruments) {
        const drawdownYear = new Date(debt.drawdownDate).getFullYear();
        const maturityYear = new Date(debt.maturityDate).getFullYear();
        if (absoluteYear === drawdownYear) loanReceived += debt.amount;
        if (absoluteYear >= drawdownYear && absoluteYear <= maturityYear && isActive) {
          const outstanding = debt.amount * Math.pow(1 - debt.amortizationRate / 100, absoluteYear - drawdownYear);
          interestPayments += outstanding * debt.interestRate / 100;
          loanRepayments += outstanding * debt.amortizationRate / 100;
        }
      }
    }
    const noi = grossRentalIncome - operatingCosts;
    const transactions = -acquisitions - acquisitionCosts + salesProceeds - salesCosts;
    const debtCashflow = loanReceived - interestPayments - loanRepayments;
    const freeCashflow = noi + transactions + debtCashflow;
    cumFCF += freeCashflow;
    return { year: `${absoluteYear}`, noi, transactions, debtCashflow, freeCashflow, cumulativeFreeCF: cumFCF };
  });

  // Asset value by type
  const byType = assets.reduce((acc, a) => {
    acc[a.usageType] = (acc[a.usageType] || 0) + a.currentValue;
    return acc;
  }, {} as Record<string, number>);
  const pieData = Object.entries(byType).map(([type, val]) => ({ name: type, value: val }));

  const COLORS: Record<string, string> = {
    'Büro': '#c9a96e', 'Wohnen': '#60a5fa', 'Logistik': '#4ade80',
    'Einzelhandel': '#f87171', 'Mixed Use': '#a78bfa',
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title={t('portfolio.title')}
        subtitle={t('portfolio.subtitle')}
        badge={`${assets.length} Assets`}
        actions={
          <button className="btn-glass px-4 py-2 rounded-xl text-sm flex items-center gap-2">
            <RefreshCw size={14} />
            {t('portfolio.refresh')}
          </button>
        }
      />

      {/* Alert Strip */}
      {(breaches.length > 0 || warnings.length > 0) && (
        <div className="mb-6 p-4 rounded-xl flex items-center gap-4 animate-slide-up"
          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
          <AlertTriangle size={18} color="#f87171" />
          <div style={{ flex: 1 }}>
            <span style={{ color: '#f87171', fontWeight: 600, fontSize: 14 }}>
              {breaches.length > 0 ? `${breaches.length} ${breaches.length !== 1 ? t('portfolio.covenantViolations_plural') : t('portfolio.covenantViolations')}` : ''}
              {warnings.length > 0 ? ` · ${warnings.length} ${warnings.length !== 1 ? t('portfolio.warnings_plural') : t('portfolio.warnings')}` : ''}
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13, marginLeft: 8 }}>
              {breaches.map(b => b.name).join(', ')}
            </span>
          </div>
          <Link to="/debt" style={{ color: '#007aff', fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            {t('portfolio.details')} <ArrowRight size={12} />
          </Link>
        </div>
      )}

      {/* Top KPI Strip — KPI labels always English */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <KPICard label="Portfolio Value" value={formatEUR(totalValue, true)} sub={t('portfolio.currentValuation')} status="neutral" onClick={() => navigate('/assets')} />
        <KPICard label="Annual Net Rent" value={formatEUR(totalRent, true)} sub={`${formatEUR(totalRent / 12, true)}/${t('portfolio.month')}`} status="good" onClick={() => navigate('/assets')} />
        <KPICard label="Total Debt" value={formatEUR(totalDebt, true)} sub={`${formatPct((totalDebt / totalValue) * 100, 1)} LTV`} status={totalDebt / totalValue > 0.65 ? 'warning' : 'neutral'} onClick={() => navigate('/debt')} />
        <KPICard label="Occupancy Rate" value={formatPct(avgOccupancy * 100, 1)} sub={`${assets.length} ${t('portfolio.objects')}`} status={avgOccupancy > 0.9 ? 'good' : avgOccupancy > 0.8 ? 'warning' : 'danger'} onClick={() => navigate('/assets')} />
        <KPICard label="Net Initial Yield" value={formatPct(computePortfolioNIY(assets))} sub={t('portfolio.avgPortfolio')} status="neutral" onClick={() => navigate('/assets')} />
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Cash Flow Chart — clickable → opens /cashflow */}
        <GlassPanel
          className="col-span-2"
          style={{ padding: 24, cursor: 'pointer', transition: 'box-shadow 0.2s ease' }}
          hover
          onClick={() => navigate('/cashflow')}
        >
          <div className="flex items-center justify-between mb-4">
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              10-Jahres Cash Flow
            </div>
            <div className="flex items-center gap-4">
              {[
                { color: '#007aff', label: 'NOI' },
                { color: '#ff9500', label: 'Transactions' },
                { color: '#f87171', label: 'Debt' },
                { color: '#c9a96e', label: 'Free CF' },
                { color: '#0A7629', label: 'Kum. Free CF', dot: true },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  {l.dot
                    ? <div style={{ width: 7, height: 7, borderRadius: '50%', background: l.color }} />
                    : <div style={{ width: 14, height: 2, borderRadius: 1, background: l.color }} />}
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{l.label}</span>
                </div>
              ))}
              <ArrowRight size={14} color="#007aff" style={{ marginLeft: 4 }} />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id="dbGradNOI" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#007aff" stopOpacity={0.30} />
                  <stop offset="100%" stopColor="#007aff" stopOpacity={0.03} />
                </linearGradient>
                <linearGradient id="dbGradTx" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff9500" stopOpacity={0.30} />
                  <stop offset="100%" stopColor="#ff9500" stopOpacity={0.03} />
                </linearGradient>
                <linearGradient id="dbGradDebt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f87171" stopOpacity={0.30} />
                  <stop offset="100%" stopColor="#f87171" stopOpacity={0.03} />
                </linearGradient>
                <linearGradient id="dbGradFCF" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c9a96e" stopOpacity={0.20} />
                  <stop offset="100%" stopColor="#c9a96e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: 'rgba(245,240,235,0.4)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'rgba(245,240,235,0.4)' }} axisLine={false} tickLine={false} tickFormatter={v => Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : `${(v / 1000).toFixed(0)}k`} />
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
              <Tooltip
                contentStyle={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(0,0,0,0.10)', borderRadius: 12, fontSize: 11, color: '#1c1c1e', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}
                formatter={(v: number, name: string) => {
                  const labels: Record<string, string> = { noi: 'NOI', transactions: 'Transactions', debtCashflow: 'Debt', freeCashflow: 'Free CF', cumulativeFreeCF: 'Kum. Free CF' };
                  const inK = Math.round(Math.abs(v) / 1000);
                  const fmt = inK.toLocaleString('de-DE');
                  return [v < 0 ? `(${fmt}k)` : `${fmt}k`, labels[name] || name];
                }}
              />
              <Area type="monotone" dataKey="noi" name="noi" stroke="#007aff" strokeWidth={1} fill="url(#dbGradNOI)" />
              <Area type="monotone" dataKey="transactions" name="transactions" stroke="#ff9500" strokeWidth={1} fill="url(#dbGradTx)" />
              <Area type="monotone" dataKey="debtCashflow" name="debtCashflow" stroke="#f87171" strokeWidth={1} fill="url(#dbGradDebt)" />
              <Area type="monotone" dataKey="freeCashflow" name="freeCashflow" stroke="#c9a96e" strokeWidth={2} fill="url(#dbGradFCF)" />
              <Line type="monotone" dataKey="cumulativeFreeCF" name="cumulativeFreeCF" stroke="#0A7629" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </GlassPanel>

        {/* Asset Allocation */}
        <GlassPanel style={{ padding: 24, cursor: 'pointer' }} hover onClick={() => navigate('/assets')}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 16 }}>
            {t('portfolio.assetAllocation')}
          </div>
          <div className="space-y-3">
            {pieData.map(({ name, value }) => {
              const pct = (value / totalValue) * 100;
              return (
                <div key={name}>
                  <div className="flex justify-between mb-1">
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[name] || '#888', display: 'inline-block' }} />
                      {name}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {formatPct(pct, 1)}
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: COLORS[name] || 'var(--accent)' }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{formatEUR(value, true)}</div>
                </div>
              );
            })}
          </div>
        </GlassPanel>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Assets Summary */}
        <GlassPanel style={{ padding: 24, cursor: 'pointer' }} hover onClick={() => navigate('/assets')}>
          <div className="flex items-center justify-between mb-4">
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {t('portfolio.inventory')}
            </div>
            <Link to="/assets" onClick={(e) => e.stopPropagation()} style={{ color: '#007aff', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
              {t('portfolio.all')} <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {assets.map(asset => (
              <Link key={asset.id} to={`/assets/${asset.id}`} onClick={(e) => e.stopPropagation()} style={{ textDecoration: 'none' }}>
                <div className="flex items-center justify-between p-3 rounded-xl glass-hover"
                  style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{asset.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{asset.city} · {asset.usageType}</div>
                  </div>
                  <div className="text-right">
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>{formatEUR(asset.currentValue, true)}</div>
                    <StatusBadge status={asset.occupancyRate > 0.9 ? 'OK' : 'Warning'} label={`${(asset.occupancyRate * 100).toFixed(0)}%`} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </GlassPanel>

        {/* Acquisition Pipeline */}
        <GlassPanel style={{ padding: 24, cursor: 'pointer' }} hover onClick={() => navigate('/acquisition')}>
          <div className="flex items-center justify-between mb-4">
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {t('portfolio.acquisitionPipeline')}
            </div>
            <Link to="/acquisition" onClick={(e) => e.stopPropagation()} style={{ color: '#007aff', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
              {t('portfolio.all')} <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {deals.map(deal => (
              <Link key={deal.id} to={`/acquisition/${deal.id}`} onClick={(e) => e.stopPropagation()} style={{ textDecoration: 'none' }}>
                <div className="flex items-center justify-between p-3 rounded-xl glass-hover"
                  style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{deal.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{deal.city} · {deal.usageType}</div>
                  </div>
                  <div className="text-right">
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{formatEUR(deal.askingPrice, true)}</div>
                    <StageBadge stage={deal.stage} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </GlassPanel>

        {/* Activity & Audit */}
        <GlassPanel style={{ padding: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 16 }}>
            {t('portfolio.recentActivities')}
          </div>
          <div className="space-y-4">
            {auditLog.slice(0, 5).map((entry, i) => (
              <div key={entry.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,122,255,0.10)', border: '1px solid rgba(0,122,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Activity size={12} color="#007aff" />
                  </div>
                  {i < 4 && <div style={{ width: 1, flex: 1, marginTop: 4, background: 'linear-gradient(to bottom, rgba(0,122,255,0.2), transparent)' }} />}
                </div>
                <div style={{ paddingBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{entry.action}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{entry.entityName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {new Date(entry.timestamp).toLocaleDateString(dateLocale)} · {entry.user}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>

      {/* News, Veräußerungsgewinn YTD & Market Intelligence */}
      <div className="grid grid-cols-3 gap-6 mt-6">
        {/* Latest News */}
        <GlassPanel style={{ padding: 24 }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Newspaper size={15} color="#007aff" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {lang === 'de' ? 'Aktuelle News' : 'Latest News'}
              </span>
            </div>
            <Link to="/news" style={{ color: '#007aff', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
              {t('portfolio.all')} <ArrowRight size={12} />
            </Link>
          </div>
          {newsReports.length > 0 ? (
            <div className="space-y-3">
              {newsReports[0].articles.filter(a => a.impactRating === 'high').slice(0, 3).map(article => (
                <div key={article.id} className="p-3 rounded-xl" style={{ border: '1px solid rgba(0,0,0,0.06)', background: 'rgba(255,255,255,0.5)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1c1c1e', lineHeight: 1.4, marginBottom: 4 }}>{article.title}</div>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)' }}>{article.sourceLabel}</span>
                    <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'rgba(248,113,113,0.10)', color: '#f87171' }}>High Impact</span>
                  </div>
                </div>
              ))}
              {newsReports[0].articles.filter(a => a.impactRating === 'high').length === 0 && (
                <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)', fontStyle: 'italic' }}>
                  {lang === 'de' ? 'Keine High-Impact News heute.' : 'No high-impact news today.'}
                </div>
              )}
              <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.35)', marginTop: 8 }}>
                Report: {new Date(newsReports[0].date + 'T12:00:00').toLocaleDateString(dateLocale)} · {newsReports[0].articles.length} {lang === 'de' ? 'Artikel' : 'articles'}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)' }}>
              {lang === 'de' ? 'Noch kein News-Report verfügbar.' : 'No news report available yet.'}
              <Link to="/news" style={{ color: '#007aff', marginLeft: 6, textDecoration: 'none' }}>{lang === 'de' ? 'Jetzt generieren →' : 'Generate now →'}</Link>
            </div>
          )}
        </GlassPanel>

        {/* Veräußerungsgewinn YTD */}
        <GlassPanel style={{ padding: 24 }}>
          <div className="flex items-center gap-2 mb-4">
            <Activity size={15} color="#1a7f37" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Veräußerungsgewinn YTD
            </span>
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, color: ytdDisposalGain >= 0 ? '#1a7f37' : '#cc1a14', fontFamily: 'ui-monospace, monospace', letterSpacing: '-0.03em', marginBottom: 4 }}>
            {ytdDisposalGain >= 0 ? '+' : ''}{formatEUR(ytdDisposalGain, true)}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.50)', marginBottom: 20 }}>
            {ytdSales.length} {lang === 'de' ? (ytdSales.length === 1 ? 'Verkauf' : 'Verkäufe') : (ytdSales.length === 1 ? 'sale' : 'sales')} · {new Date().getFullYear()}
          </div>
          {ytdSales.length > 0 ? (
            <div className="space-y-2">
              {ytdSales.slice(0, 4).map(s => (
                <Link key={s.id} to={`/sales/${s.id}`} style={{ textDecoration: 'none' }}>
                  <div className="flex items-center justify-between p-2.5 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.05)' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1c1c1e' }}>{s.name}</div>
                      <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)' }}>{s.city}</div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: (s.disposalGain || 0) >= 0 ? '#1a7f37' : '#cc1a14', fontFamily: 'ui-monospace, monospace' }}>
                      {(s.disposalGain || 0) >= 0 ? '+' : ''}{formatEUR(s.disposalGain || 0, true)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.40)', fontStyle: 'italic' }}>
              Noch keine Verkäufe in {new Date().getFullYear()} abgeschlossen.
              <Link to="/sales" style={{ color: '#007aff', marginLeft: 6, textDecoration: 'none' }}>Sales →</Link>
            </div>
          )}
        </GlassPanel>

        {/* Market Intelligence Status */}
        <GlassPanel style={{ padding: 24 }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 size={15} color="var(--accent)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Market Intelligence
              </span>
            </div>
            <Link to="/markt" style={{ color: '#007aff', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
              {t('portfolio.all')} <ArrowRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="text-center p-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1c1c1e' }}>{marketLocations.length}</div>
              <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)' }}>{lang === 'de' ? 'Standorte' : 'Locations'}</div>
            </div>
            <div className="text-center p-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1c1c1e' }}>{marketLocations.reduce((s, l) => s + l.benchmarks.length, 0)}</div>
              <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)' }}>Benchmarks</div>
            </div>
            <div className="text-center p-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1c1c1e' }}>{20 - marketLocations.length}</div>
              <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)' }}>{lang === 'de' ? 'Offen' : 'Missing'}</div>
            </div>
          </div>
          <div className="space-y-1.5">
            {marketLocations.slice(0, 4).map(loc => (
              <div key={loc.id} className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                <span style={{ fontSize: 12, color: 'rgba(60,60,67,0.70)' }}>{loc.city}</span>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>{loc.benchmarks.length} BM</span>
                  <FreshnessBadge date={loc.lastUpdated} />
                </div>
              </div>
            ))}
            {marketLocations.length > 4 && (
              <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.35)', textAlign: 'center', paddingTop: 4 }}>
                +{marketLocations.length - 4} {lang === 'de' ? 'weitere' : 'more'}
              </div>
            )}
          </div>
        </GlassPanel>
      </div>

      {/* Covenant Alerts */}
      {(breaches.length > 0 || warnings.length > 0) && (
        <div className="mt-6">
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 12 }}>
            {t('portfolio.covenantAlerts')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[...breaches, ...warnings].map(cov => (
              <div key={cov.id} className="p-4 rounded-xl flex items-center gap-4"
                style={{
                  background: cov.status === 'Breach' ? 'rgba(248,113,113,0.08)' : 'rgba(251,191,36,0.08)',
                  border: `1px solid ${cov.status === 'Breach' ? 'rgba(248,113,113,0.2)' : 'rgba(251,191,36,0.2)'}`,
                }}>
                <AlertTriangle size={18} color={cov.status === 'Breach' ? '#f87171' : '#fbbf24'} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: cov.status === 'Breach' ? '#f87171' : '#fbbf24' }}>
                    {cov.name} — <StatusBadge status={cov.status} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {t('portfolio.current')}: {cov.currentValue.toFixed(2)}{cov.type === 'LTV' ? '%' : 'x'} / {t('portfolio.threshold')}: {cov.threshold}{cov.type === 'LTV' ? '%' : 'x'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Summary panel */}
      <GlassPanel className="mt-6" style={{ padding: 24 }}>
        <div className="flex items-center gap-3 mb-4">
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(0,122,255,0.10)', border: '1px solid rgba(0,122,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={16} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('portfolio.aiSummary')}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('portfolio.deterministicOnly')}</div>
          </div>
          <span className="ml-auto badge-neutral" style={{ fontSize: 10 }}>{t('portfolio.simulated')}</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 rounded-xl" style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.15)' }}>
            <div className="flex items-center gap-2 mb-2"><CheckCircle size={14} color="#4ade80" /><span style={{ fontSize: 12, fontWeight: 600, color: '#4ade80' }}>{t('portfolio.strengths')}</span></div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {t('portfolio.strengthsText')}
            </div>
          </div>
          <div className="p-3 rounded-xl" style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.15)' }}>
            <div className="flex items-center gap-2 mb-2"><AlertTriangle size={14} color="#fbbf24" /><span style={{ fontSize: 12, fontWeight: 600, color: '#fbbf24' }}>{t('portfolio.actionNeeded')}</span></div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {t('portfolio.actionNeededText')}
            </div>
          </div>
          <div className="p-3 rounded-xl" style={{ background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.15)' }}>
            <div className="flex items-center gap-2 mb-2"><TrendingUp size={14} color="#60a5fa" /><span style={{ fontSize: 12, fontWeight: 600, color: '#60a5fa' }}>{t('portfolio.opportunities')}</span></div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {t('portfolio.opportunitiesText')}
            </div>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
