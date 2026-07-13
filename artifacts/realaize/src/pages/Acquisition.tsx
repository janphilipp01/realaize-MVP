import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, AlertTriangle, FileText, Search } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { PageHeader, StageBadge, CompletenessRing } from '@/components/shared';
import { computeDealKPIs, formatEUR, formatPct, formatX } from '@/utils/kpiEngine';
import { useLanguage, useDateLocale } from '@/i18n/LanguageContext';
import { AcquisitionWizard } from '@/pages/AcquisitionWizard';
import type { AcquisitionDeal, UsageType, PropertyData } from '@/models/types';

const STAGE_ORDER = ['Screening', 'LOI', 'Due Diligence', 'Signing', 'Closing'];
const USAGE_TYPES: UsageType[] = ['Wohnen', 'Büro', 'Einzelhandel', 'Logistik', 'Mixed Use'];

// ── Deal Card ───────────────────────────────────────────
function DealCard({ deal }: { deal: AcquisitionDeal }) {
  const kpis = computeDealKPIs(deal.underwritingAssumptions, deal.financingAssumptions);
  const alerts = deal.aiRecommendations.filter(r => r.isAlert);
  const hasDeviation = alerts.some(a => (a.deviationPercent || 0) > 10);
  const { t } = useLanguage();
  const dateLocale = useDateLocale();
  return (
    <Link to={`/acquisition/${deal.id}`} style={{ textDecoration: 'none' }}>
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', border: hasDeviation ? '1px solid rgba(251,191,36,0.25)' : '1px solid rgba(255,255,255,0.10)' }}>
        <div style={{ padding: '18px 20px 14px', background: `linear-gradient(135deg, rgba(${deal.usageType === 'Büro' ? '201,169,110' : deal.usageType === 'Wohnen' ? '96,165,250' : deal.usageType === 'Logistik' ? '74,222,128' : '248,113,113'},0.08), transparent)`, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1c1c1e', margin: 0, lineHeight: 1.3 }}>{deal.name}</h3>
            <CompletenessRing score={deal.completenessScore} size={36} />
          </div>
          <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)' }}>{deal.address}, {deal.city}</div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <StageBadge stage={deal.stage} />
            <span className="badge-neutral">{deal.usageType}</span>
            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: deal.dealType === 'Development' ? 'rgba(167,139,250,0.12)' : 'rgba(201,169,110,0.12)', color: deal.dealType === 'Development' ? '#a78bfa' : '#c9a96e' }}>
              {deal.dealType}
            </span>
            {hasDeviation && <span className="badge-warning flex items-center gap-1"><AlertTriangle size={10} /> {t('acq.aiWarning')}</span>}
          </div>
        </div>
        <div style={{ padding: '14px 20px' }}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div><div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Asking Price</div><div style={{ fontSize: 16, fontWeight: 700, color: '#007aff' }}>{formatEUR(deal.askingPrice, true)}</div></div>
            <div><div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>NIY</div><div style={{ fontSize: 16, fontWeight: 700, color: kpis.netInitialYield > 4.5 ? '#4ade80' : kpis.netInitialYield > 3 ? '#fbbf24' : '#f87171' }}>{formatPct(kpis.netInitialYield)}</div></div>
            <div><div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Multiple</div><div style={{ fontSize: 14, fontWeight: 600, color: '#1c1c1e' }}>{formatX(kpis.kaufpreisfaktor)}</div></div>
            <div><div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>LTV</div><div style={{ fontSize: 14, fontWeight: 600, color: kpis.ltv < 65 ? '#4ade80' : '#fbbf24' }}>{formatPct(kpis.ltv, 1)}</div></div>
          </div>
        </div>
        <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1" style={{ color: 'rgba(60,60,67,0.45)', fontSize: 11 }}><FileText size={11} /> {deal.documents.length} Docs</div>
            {deal.broker && <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>{deal.broker}</div>}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>{new Date(deal.updatedAt).toLocaleDateString(dateLocale)}</div>
        </div>
      </div>
    </Link>
  );
}

// ── Main Acquisition Page ───────────────────────────────
export default function AcquisitionPage() {
  const { deals, addDeal } = useStore();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterStage, setFilterStage] = useState('Alle');
  const [filterType, setFilterType] = useState('Alle');
  const [showNewDeal, setShowNewDeal] = useState(false);

  const filtered = deals.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) || d.city.toLowerCase().includes(search.toLowerCase());
    const matchStage = filterStage === 'Alle' || d.stage === filterStage;
    const matchType = filterType === 'Alle' || d.usageType === filterType;
    return matchSearch && matchStage && matchType;
  });

  const totalVolume = deals.reduce((s, d) => s + d.askingPrice, 0);

  const handleCreateDeal = (pd: PropertyData) => {
    const now = new Date().toISOString();
    const dealId = `deal-${Date.now()}`;
    const annualRent = pd.unitsAsIs.reduce((s, u) => s + u.monthlyRent, 0) * 12;
    const deal: AcquisitionDeal = {
      id: dealId,
      name: pd.name || (lang === 'de' ? 'Neues Objekt' : 'New Object'),
      address: pd.address,
      city: pd.city,
      zip: pd.zip,
      usageType: pd.usageType,
      dealType: pd.dealType,
      stage: 'Screening',
      askingPrice: pd.purchasePrice,
      broker: pd.broker || undefined,
      vendorName: pd.vendor || undefined,
      totalArea: pd.unitsAsIs.reduce((s, u) => s + u.area, 0),
      underwritingAssumptions: {
        purchasePrice: pd.purchasePrice,
        closingCostPercent: pd.acquisitionCosts.filter(c => c.active && c.id === 'grest').reduce((s, c) => s + c.percent, 0),
        brokerFeePercent: pd.acquisitionCosts.filter(c => c.active && c.id === 'makler').reduce((s, c) => s + c.percent, 0),
        initialCapex: 0,
        annualGrossRent: annualRent,
        vacancyRatePercent: pd.operatingCosts.vacancyRatePercent,
        managementCostPercent: pd.operatingCosts.managementCostPercent,
        maintenanceReservePerSqm: pd.operatingCosts.maintenanceReservePerSqm,
        nonRecoverableOpex: 0,
        area: pd.unitsAsIs.reduce((s, u) => s + u.area, 0),
        rentPerSqm: pd.unitsAsIs.length > 0
          ? pd.unitsAsIs.reduce((s, u) => s + u.currentRentPerSqm * u.area, 0) / Math.max(1, pd.unitsAsIs.reduce((s, u) => s + u.area, 0))
          : 0,
        otherOperatingIncome: pd.operatingCosts.otherIncomePerYear,
        ervPerSqm: pd.unitsAsIs.length > 0
          ? pd.unitsAsIs.reduce((s, u) => s + u.ervPerSqm * u.area, 0) / Math.max(1, pd.unitsAsIs.reduce((s, u) => s + u.area, 0))
          : 0,
        projectedAnnualRent: pd.unitsTarget.reduce((s, u) => s + u.monthlyRent, 0) * 12 || annualRent,
        contingencyPercent: pd.contingencyPercent,
        marketAssumptions: {
          ervGrowthRate: pd.marketAssumptions.perUsageType[0]?.ervGrowthRatePercent ?? 2.0,
          exitCapRate: pd.marketAssumptions.perUsageType[0]?.exitCapRatePercent ?? 5.0,
          rentalGrowthRate: pd.marketAssumptions.perUsageType[0]?.ervGrowthRatePercent ?? 2.0,
          holdingPeriodYears: pd.holdingPeriodYears,
        },
      },
      financingAssumptions: {
        loanAmount: pd.financingTranches.reduce((s, t) => s + t.loanAmount, 0),
        interestRate: pd.financingTranches[0]?.interestRate ?? 4.0,
        amortizationRate: pd.financingTranches[0]?.amortizationRate ?? 2.0,
        loanTerm: pd.financingTranches[0]?.loanTerm ?? 10,
        lenderName: '',
        fixedRatePeriod: pd.financingTranches[0]?.fixedRatePeriod ?? 5,
      },
      documents: [],
      activityLog: [],
      aiRecommendations: [],
      completenessScore: pd.unitsAsIs.length > 0 ? 70 : 40,
      createdAt: now,
      updatedAt: now,
      propertyData: pd,
    };
    addDeal(deal);
    setShowNewDeal(false);
    navigate(`/acquisition/${deal.id}`);
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title={t('acq.title')}
        subtitle={`${deals.length} Deals · ${formatEUR(totalVolume, true)} ${t('acq.totalVolume')}`}
        actions={
          <button onClick={() => setShowNewDeal(true)} className="btn-accent px-4 py-2 rounded-xl text-sm flex items-center gap-2" style={{ cursor: 'pointer' }}>
            <Plus size={14} /> {t('acq.newDeal')}
          </button>
        }
      />
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative">
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(60,60,67,0.45)' }} />
          <input className="input-glass pl-8" placeholder={t('acq.searchDeal')} value={search} onChange={e => setSearch(e.target.value)} style={{ width: 220 }} />
        </div>
        <select className="input-glass" value={filterStage} onChange={e => setFilterStage(e.target.value)} style={{ width: 160 }}>
          <option>Alle</option>{STAGE_ORDER.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="input-glass" value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 160 }}>
          <option>Alle</option>{USAGE_TYPES.map(ut => <option key={ut}>{ut}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-6">
        {STAGE_ORDER.filter(stage => filtered.some(d => d.stage === stage)).map(stage => {
          const stagDeals = filtered.filter(d => d.stage === stage);
          return (
            <div key={stage}>
              <div className="flex items-center gap-2 mb-3">
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(60,60,67,0.45)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{stage}</div>
                <span className="badge-neutral">{stagDeals.length}</span>
                <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginLeft: 'auto' }}>{formatEUR(stagDeals.reduce((s, d) => s + d.askingPrice, 0), true)}</div>
              </div>
              <div className="space-y-4">{stagDeals.map(deal => <DealCard key={deal.id} deal={deal} />)}</div>
            </div>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <div className="text-center py-16">
          <div style={{ fontSize: 15, color: 'rgba(60,60,67,0.45)' }}>{t('acq.noDeals')}</div>
        </div>
      )}
      {showNewDeal && (
        <AcquisitionWizard
          onClose={() => setShowNewDeal(false)}
          onSave={handleCreateDeal}
          title={lang === 'de' ? 'Neues Deal erfassen' : 'Create New Deal'}
        />
      )}
    </div>
  );
}
