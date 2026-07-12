import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { PageHeader, GlassPanel, KPICard, StatusBadge, SectionHeader } from '@/components/shared';
import { formatEUR, computeAssetNOI, computeAssetLTV } from '@/utils/kpiEngine';
import { useLanguage } from '@/i18n/LanguageContext';

// ══════════════════════════════════════════════════════════
// DEBT PAGE
// ══════════════════════════════════════════════════════════
export function DebtPage() {
  const { assets } = useStore();
  const { t, lang } = useLanguage();
  const dateLocale = lang === 'de' ? 'de-DE' : 'en-GB';
  const allDebt = assets.flatMap(a => a.debtInstruments.map(d => ({ ...d, assetName: a.name, assetCity: a.city, assetId: a.id })));
  const totalDebt = allDebt.reduce((s, d) => s + d.outstandingAmount, 0);

  // Compute live covenant values per asset from actual KPI engine
  const liveCovenants = assets.flatMap(a => {
    const noi = computeAssetNOI(a);
    const ltv = computeAssetLTV(a);
    const annualInterest = a.debtInstruments.reduce((s, d) => s + d.outstandingAmount * (d.interestRate / 100), 0);
    const annualAmortization = a.debtInstruments.reduce((s, d) => s + d.outstandingAmount * (d.amortizationRate / 100), 0);
    const annualDebtService = annualInterest + annualAmortization;
    const dscr = annualDebtService > 0 ? noi.noi / annualDebtService : 999;

    return a.covenants.map(cov => {
      // Compute LIVE current value based on covenant type
      const liveValue = cov.type === 'LTV' ? ltv : cov.type === 'DSCR' ? dscr : cov.currentValue;
      // Determine LIVE status
      let liveStatus: 'OK' | 'Warning' | 'Breach' = 'OK';
      if (cov.type === 'LTV') {
        if (liveValue > cov.threshold) liveStatus = 'Breach';
        else if (liveValue > cov.threshold * 0.95) liveStatus = 'Warning';
      } else if (cov.type === 'DSCR') {
        if (liveValue < cov.threshold) liveStatus = 'Breach';
        else if (liveValue < cov.threshold * 1.05) liveStatus = 'Warning';
      }
      return { ...cov, assetName: a.name, currentValue: liveValue, status: liveStatus };
    });
  });

  const breaches = liveCovenants.filter(c => c.status === 'Breach');
  const warnings = liveCovenants.filter(c => c.status === 'Warning');

  const maturityData = allDebt.map(d => ({
    name: d.assetName,
    year: new Date(d.maturityDate).getFullYear(),
    amount: Math.round(d.outstandingAmount / 1_000_000),
    rate: d.interestRate,
  })).sort((a, b) => a.year - b.year);

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title={t('debt.title')}
        subtitle={t('debt.subtitle')}
        badge={`${allDebt.length} ${t('debt.instruments')}`}
      />

      {/* Alerts */}
      {(breaches.length > 0 || warnings.length > 0) && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          {breaches.map(c => (
            <div key={c.id} className="p-4 rounded-xl flex items-center gap-3"
              style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
              <AlertTriangle size={18} color="#f87171" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171' }}>{c.name} — Breach</div>
                <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)' }}>{c.assetName} · {t('debt.currentVal')}: {c.currentValue.toFixed(2)}{c.type === 'LTV' ? '%' : 'x'} / {t('portfolio.threshold')}: {c.threshold}{c.type === 'LTV' ? '%' : 'x'}</div>
              </div>
            </div>
          ))}
          {warnings.map(c => (
            <div key={c.id} className="p-4 rounded-xl flex items-center gap-3"
              style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
              <AlertTriangle size={18} color="#fbbf24" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>{c.name} — Warning</div>
                <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)' }}>{c.assetName} · {t('debt.currentVal')}: {c.currentValue.toFixed(2)}{c.type === 'LTV' ? '%' : 'x'} / {t('portfolio.threshold')}: {c.threshold}{c.type === 'LTV' ? '%' : 'x'}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KPICard label="Total Debt" value={formatEUR(totalDebt, true)} status="neutral" />
        <KPICard label="Covenant Breaches" value={`${breaches.length}`} status={breaches.length > 0 ? 'danger' : 'good'} sub={t('debt.violations')} />
        <KPICard label="Covenant Warnings" value={`${warnings.length}`} status={warnings.length > 0 ? 'warning' : 'good'} sub={t('portfolio.warnings_plural')} />
        <KPICard label="Avg. Interest Rate" value={`${(allDebt.reduce((s, d) => s + d.interestRate, 0) / allDebt.length).toFixed(2)}%`} status="neutral" />
      </div>

      {/* Maturity chart */}
      <GlassPanel style={{ padding: 24, marginBottom: 24 }}>
        <SectionHeader title={t('debt.maturityProfile')} />
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={maturityData}>
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'rgba(245,240,235,0.4)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'rgba(245,240,235,0.4)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}M`} />
            <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(0,0,0,0.10)', borderRadius: 10, fontSize: 12 }} formatter={(v: any) => [`${v} Mio. EUR`]} />
            <Bar dataKey="amount" fill="#007aff" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </GlassPanel>

      {/* Debt table */}
      <GlassPanel style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              {[t('debt.object'), t('debt.lender'), t('debt.type'), t('debt.outstanding'), t('debt.interestRate'), t('debt.amortization'), t('debt.maturity'), t('debt.status')].map(h => (
                <th key={h} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.45)', textAlign: 'left', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allDebt.map(d => {
              const monthsToMaturity = Math.floor((new Date(d.maturityDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30));
              return (
                <tr key={d.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1c1c1e' }}>{d.assetName}</div>
                    <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>{(d as any).assetCity}</div>
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: 'rgba(60,60,67,0.70)' }}>{d.lender}</td>
                  <td style={{ padding: '13px 16px' }}><span className="badge-neutral">{d.type}</span></td>
                  <td style={{ padding: '13px 16px', fontFamily: 'ui-monospace, monospace', fontSize: 13, color: '#007aff', fontWeight: 600 }}>{formatEUR(d.outstandingAmount, true)}</td>
                  <td style={{ padding: '13px 16px', fontFamily: 'ui-monospace, monospace', fontSize: 13, color: '#1c1c1e' }}>{d.interestRate.toFixed(2)}%</td>
                  <td style={{ padding: '13px 16px', fontFamily: 'ui-monospace, monospace', fontSize: 13, color: 'rgba(60,60,67,0.70)' }}>{d.amortizationRate}%</td>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ fontSize: 13, color: monthsToMaturity < 18 ? '#fbbf24' : 'var(--text-primary)', fontWeight: monthsToMaturity < 18 ? 600 : 400 }}>
                      {new Date(d.maturityDate).toLocaleDateString(dateLocale)}
                    </div>
                    {monthsToMaturity < 24 && <div style={{ fontSize: 11, color: '#fbbf24' }}>{monthsToMaturity} {t('debt.months')}</div>}
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <StatusBadge status={monthsToMaturity < 12 ? 'Breach' : monthsToMaturity < 24 ? 'Warning' : 'OK'} label={monthsToMaturity < 12 ? t('debt.critical') : monthsToMaturity < 24 ? t('debt.watch') : 'OK'} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </GlassPanel>

      {/* Covenants */}
      <div className="mt-6">
        <SectionHeader title={t('debt.covenantMatrix')} />
        <GlassPanel style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                {[t('debt.object'), t('debt.covenant'), t('debt.type'), t('portfolio.threshold'), t('debt.currentVal'), t('debt.status'), t('debt.testDate')].map(h => (
                  <th key={h} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.45)', textAlign: 'left', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {liveCovenants.map(cov => (
                <tr key={cov.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#1c1c1e' }}>{cov.assetName}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'rgba(60,60,67,0.70)' }}>{cov.name}</td>
                  <td style={{ padding: '12px 16px' }}><span className="badge-neutral">{cov.type}</span></td>
                  <td style={{ padding: '12px 16px', fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>{cov.threshold}{cov.type === 'LTV' ? '%' : 'x'}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 700, color: cov.status === 'OK' ? '#4ade80' : cov.status === 'Warning' ? '#fbbf24' : '#f87171' }}>
                    {cov.currentValue.toFixed(2)}{cov.type === 'LTV' ? '%' : 'x'}
                  </td>
                  <td style={{ padding: '12px 16px' }}><StatusBadge status={cov.status} /></td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'rgba(60,60,67,0.45)' }}>{new Date(cov.testDate).toLocaleDateString(dateLocale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassPanel>
      </div>
    </div>
  );
}

