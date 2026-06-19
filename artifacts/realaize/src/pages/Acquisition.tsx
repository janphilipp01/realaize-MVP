import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, AlertTriangle, FileText, Search, X, ChevronRight, ChevronLeft,
  Zap, CheckCircle, Building2, HardHat, Trash2, TrendingUp, BarChart3
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useStore } from '../store/useStore';
import { PageHeader, StageBadge, CompletenessRing, GlassPanel, KPICard, Modal } from '../components/shared';
import { computeDealKPIs, formatEUR, formatPct, formatX } from '../utils/kpiEngine';
import { computeDealCashFlow } from '../utils/propertyCashFlowModel';
import { useLanguage } from '../i18n/LanguageContext';
import { AcquisitionWizard } from './AcquisitionWizard';
import type {
  AcquisitionDeal, DealType, UsageType, UnderwritingAssumptions, FinancingAssumptions,
  GeverkCategory, Unit, PropertyData
} from '../models/types';
import { createDefaultPropertyData } from '../models/types';

const STAGE_ORDER = ['Screening', 'LOI', 'Due Diligence', 'Signing', 'Closing'];
const USAGE_TYPES: UsageType[] = ['Wohnen', 'Büro', 'Einzelhandel', 'Logistik', 'Mixed Use'];
const DEV_TYPES = ['Neubau', 'Kernsanierung', 'Modernisierung', 'Umbau', 'Aufstockung', 'Anbau'] as const;
const FLOORS = ['UG', 'EG', '1.OG', '2.OG', '3.OG', '4.OG', '5.OG', 'DG'];
const USAGE_COLORS: Record<string, string> = {
  'Büro': '#c9a96e', 'Wohnen': '#60a5fa', 'Logistik': '#4ade80',
  'Einzelhandel': '#f87171', 'Mixed Use': '#a78bfa',
};
const GEWERK_CATEGORIES: GeverkCategory[] = [
  'Rohbau', 'Dach & Abdichtung', 'Fassade & Außenanlagen', 'Fenster & Türen',
  'TGA – Heizung', 'TGA – Sanitär', 'TGA – Elektro', 'TGA – Lüftung',
  'Aufzug', 'Innenausbau', 'Außenanlagen & Tiefbau',
  'Planung & Architektur', 'Genehmigungen & Gebühren',
  'Abbruch & Entsorgung', 'Reserve / Unvorhergesehenes', 'Sonstiges',
];
const GEWERK_COLORS: Record<string, string> = {
  'Rohbau': '#007aff', 'Dach & Abdichtung': '#5ac8fa', 'Fassade & Außenanlagen': '#34c759',
  'Fenster & Türen': '#30d158', 'TGA – Heizung': '#ff9f0a', 'TGA – Sanitär': '#ff9f0a',
  'TGA – Elektro': '#ffd60a', 'TGA – Lüftung': '#ffe066', 'Aufzug': '#bf5af2',
  'Innenausbau': '#a78bfa', 'Außenanlagen & Tiefbau': '#4ade80',
  'Planung & Architektur': '#f97316', 'Genehmigungen & Gebühren': '#f87171',
  'Abbruch & Entsorgung': '#94a3b8', 'Reserve / Unvorhergesehenes': '#64748b', 'Sonstiges': '#94a3b8',
};

// ── Local wizard types ─────────────────────────────────
interface WizardUnit {
  id: string;
  unitNumber: string;
  floor: string;
  area: number;
  usageType: UsageType;
  status: 'Vermietet' | 'Leerstand' | 'Eigennutzung';
  tenant: string;
  rentPerSqm: number;
  ervPerSqm: number;
  leaseEnd: string;
}

interface WizardGewerk {
  id: string;
  category: GeverkCategory;
  description: string;
  budget: number;
  startMonth: number;
  endMonth: number;
}

// ── Deal Card ───────────────────────────────────────────
function DealCard({ deal }: { deal: AcquisitionDeal }) {
  const kpis = computeDealKPIs(deal.underwritingAssumptions, deal.financingAssumptions);
  const alerts = deal.aiRecommendations.filter(r => r.isAlert);
  const hasDeviation = alerts.some(a => (a.deviationPercent || 0) > 10);
  const { t, lang } = useLanguage();
  const dateLocale = lang === 'de' ? 'de-DE' : 'en-GB';
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

// ── Defaults ────────────────────────────────────────────
const defaultMarketAssumptions = {
  ervGrowthRate: 2.0, exitCapRate: 5.0, rentalGrowthRate: 2.0, holdingPeriodYears: 10,
};
const defaultUW: UnderwritingAssumptions = {
  purchasePrice: 0, closingCostPercent: 6.5, brokerFeePercent: 1.5, initialCapex: 0,
  annualGrossRent: 0, vacancyRatePercent: 5, managementCostPercent: 3,
  maintenanceReservePerSqm: 10, nonRecoverableOpex: 0, area: 0, rentPerSqm: 0, otherOperatingIncome: 0,
  ervPerSqm: 0, projectedAnnualRent: 0, contingencyPercent: 10,
  marketAssumptions: { ...defaultMarketAssumptions },
};
const defaultFin: FinancingAssumptions = {
  loanAmount: 0, interestRate: 4.0, amortizationRate: 2.0, loanTerm: 10, lenderName: '', fixedRatePeriod: 5,
};
const newWizardUnit = (): WizardUnit => ({
  id: `wu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  unitNumber: '', floor: 'EG', area: 0, usageType: 'Wohnen',
  status: 'Leerstand', tenant: '', rentPerSqm: 0, ervPerSqm: 0, leaseEnd: '',
});
const newWizardGewerk = (cat: GeverkCategory = 'Sonstiges'): WizardGewerk => ({
  id: `wg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  category: cat, description: '', budget: 0, startMonth: 1, endMonth: 6,
});

// ── New Deal Wizard ─────────────────────────────────────
interface NewDealFormData {
  dealType: DealType;
  name: string; address: string; city: string; zip: string;
  usageType: UsageType; broker: string; vendorName: string; totalArea: number;
  uw: UnderwritingAssumptions; fin: FinancingAssumptions;
  developmentType: typeof DEV_TYPES[number];
  estimatedDevDuration: number;
}

function NewDealWizard({ onClose, onSave }: { onClose: () => void; onSave: (deal: AcquisitionDeal) => void }) {
  const { t, lang } = useLanguage();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<NewDealFormData>({
    dealType: 'Investment',
    name: '', address: '', city: '', zip: '', usageType: 'Wohnen',
    broker: '', vendorName: '', totalArea: 0,
    uw: { ...defaultUW }, fin: { ...defaultFin },
    developmentType: 'Modernisierung', estimatedDevDuration: 24,
  });
  const [units, setUnits] = useState<WizardUnit[]>([]);
  const [gewerke, setGewerke] = useState<WizardGewerk[]>([]);
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [qeCount, setQeCount] = useState(10);
  const [qeArea, setQeArea] = useState(50);
  const [qeUsage, setQeUsage] = useState<UsageType>('Wohnen');
  const [qeStatus, setQeStatus] = useState<WizardUnit['status']>('Leerstand');
  const [qeRent, setQeRent] = useState(12);
  const [qeERV, setQeERV] = useState(14);

  const isDev = form.dealType === 'Development';
  const updateForm = (patch: Partial<NewDealFormData>) => setForm(f => ({ ...f, ...patch }));
  const updateUW = (patch: Partial<UnderwritingAssumptions>) => setForm(f => ({ ...f, uw: { ...f.uw, ...patch } }));
  const updateFin = (patch: Partial<FinancingAssumptions>) => setForm(f => ({ ...f, fin: { ...f.fin, ...patch } }));
  const updateMA = (patch: Partial<typeof defaultMarketAssumptions>) =>
    setForm(f => ({ ...f, uw: { ...f.uw, marketAssumptions: { ...f.uw.marketAssumptions!, ...patch } } }));

  // ── Sync UW from Rent Roll ──
  const syncUWFromUnits = (u: WizardUnit[]) => {
    const totalArea = u.reduce((s, r) => s + (r.area || 0), 0);
    const totalMonthlyRent = u.reduce((s, r) => s + (r.area || 0) * (r.rentPerSqm || 0), 0);
    const totalMonthlyERV = u.reduce((s, r) => s + (r.area || 0) * (r.ervPerSqm || 0), 0);
    const avgRentPerSqm = totalArea > 0 ? totalMonthlyRent / totalArea : 0;
    const avgERV = totalArea > 0 ? totalMonthlyERV / totalArea : 0;
    updateUW({
      area: totalArea,
      rentPerSqm: avgRentPerSqm,
      annualGrossRent: Math.round(totalMonthlyRent * 12),
      ervPerSqm: parseFloat(avgERV.toFixed(2)),
      projectedAnnualRent: Math.round(totalMonthlyERV * 12),
    });
  };

  const setUnitsAndSync = (u: WizardUnit[]) => {
    setUnits(u);
    syncUWFromUnits(u);
  };

  const updateUnit = (id: string, patch: Partial<WizardUnit>) => {
    const updated = units.map(u => u.id === id ? { ...u, ...patch } : u);
    setUnitsAndSync(updated);
  };
  const addUnit = () => setUnitsAndSync([...units, newWizardUnit()]);
  const removeUnit = (id: string) => setUnitsAndSync(units.filter(u => u.id !== id));

  const syncLoan = (pp: number) => {
    updateUW({ purchasePrice: pp });
    if (form.fin.loanAmount === 0 || form.fin.loanAmount === form.uw.purchasePrice * 0.65) {
      updateFin({ loanAmount: Math.round(pp * 0.65) });
    }
  };

  // Gewerk total (for sync to estimatedDevBudget equiv)
  const gewerkTotal = gewerke.reduce((s, g) => s + (g.budget || 0), 0);
  const contingencyPct = form.uw.contingencyPercent || 10;
  const gewerkWithContingency = gewerkTotal * (1 + contingencyPct / 100);

  // ── Rent Roll summaries ──
  const rrTotalArea = units.reduce((s, u) => s + (u.area || 0), 0);
  const rrTotalMonthlyRent = units.reduce((s, u) => s + (u.area || 0) * (u.rentPerSqm || 0), 0);
  const rrTotalMonthlyERV = units.reduce((s, u) => s + (u.area || 0) * (u.ervPerSqm || 0), 0);
  const rrLetArea = units.filter(u => u.status === 'Vermietet').reduce((s, u) => s + (u.area || 0), 0);
  const rrOccupancy = rrTotalArea > 0 ? (rrLetArea / rrTotalArea) * 100 : 0;
  const rrAvgRent = rrTotalArea > 0 ? rrTotalMonthlyRent / rrTotalArea : 0;
  const rrAvgERV = rrTotalArea > 0 ? rrTotalMonthlyERV / rrTotalArea : 0;

  // ── Step indices ──
  const rrStep = 1;
  const devStep = isDev ? 2 : -1;
  const uwStep = isDev ? 3 : 2;
  const mktStep = isDev ? 4 : 3;
  const finStep = isDev ? 5 : 4;
  const cfStep = isDev ? 6 : 5;
  const maxStep = isDev ? 7 : 6;

  const stepTitles = isDev
    ? ['Stammdaten', 'Rent Roll', 'Gewerke', 'Underwriting', 'Marktannahmen', 'Finanzierung', 'Cash Flow & IRR', 'Zusammenfassung']
    : ['Stammdaten', 'Rent Roll', 'Underwriting', 'Marktannahmen', 'Finanzierung', 'Cash Flow & IRR', 'Zusammenfassung'];

  const canProceed = () => {
    if (step === 0) return !!(form.name.trim() && form.city.trim());
    if (step === devStep) return true;
    if (step === uwStep) return form.uw.purchasePrice > 0;
    if (step === finStep) return form.fin.loanAmount > 0;
    return true;
  };

  const previewKPIs = computeDealKPIs(form.uw, form.fin);

  const filledFields = [
    form.name, form.city, form.uw.purchasePrice,
    units.length > 0 ? 1 : 0,
    form.fin.loanAmount,
    form.uw.marketAssumptions?.exitCapRate,
  ].filter(Boolean).length;
  const completeness = Math.round((filledFields / 6) * 100);

  const handleQuickEntry = () => {
    const newUnits: WizardUnit[] = [];
    for (let i = 0; i < qeCount; i++) {
      const floor = FLOORS[Math.min(Math.floor(i / 4), FLOORS.length - 1)];
      newUnits.push({
        id: `wu-${Date.now()}-${i}`,
        unitNumber: `${floor.replace('.', '')}-${String(i + 1).padStart(2, '0')}`,
        floor,
        area: qeArea,
        usageType: qeUsage,
        status: qeStatus,
        tenant: '',
        rentPerSqm: qeRent,
        ervPerSqm: qeERV,
        leaseEnd: '',
      });
    }
    const all = [...units, ...newUnits];
    setUnitsAndSync(all);
    setShowQuickEntry(false);
  };

  const loadDefaultGewerke = () => {
    const base = gewerkTotal > 0 ? gewerkTotal : 1_000_000;
    const defaults: Array<[GeverkCategory, number, number, number]> = [
      ['Rohbau', 0.30, 1, 8],
      ['Fassade & Außenanlagen', 0.10, 4, 12],
      ['Dach & Abdichtung', 0.05, 3, 7],
      ['TGA – Heizung', 0.06, 6, 14],
      ['TGA – Sanitär', 0.05, 6, 14],
      ['TGA – Elektro', 0.04, 8, 16],
      ['Innenausbau', 0.15, 10, 20],
      ['Außenanlagen & Tiefbau', 0.05, 18, 22],
      ['Planung & Architektur', 0.08, 1, form.estimatedDevDuration || 24],
      ['Genehmigungen & Gebühren', 0.02, 1, 3],
      ['Sonstiges', 0.10, 1, form.estimatedDevDuration || 24],
    ];
    const newGW = defaults.map(([cat, pct, s, e]) => ({
      id: `wg-${Date.now()}-${cat}`,
      category: cat as GeverkCategory,
      description: '',
      budget: Math.round(base * pct),
      startMonth: s,
      endMonth: e,
    }));
    setGewerke(newGW);
  };

  const handleSave = () => {
    const now = new Date().toISOString();
    const assetId = `deal-${Date.now()}`;
    const dealUnits: Unit[] = units.map(u => ({
      id: u.id,
      assetId,
      unitNumber: u.unitNumber || `Einheit-${u.id.slice(-4)}`,
      floor: parseInt(FLOORS.indexOf(u.floor).toString()) - 1,
      area: u.area,
      usageType: u.usageType,
      tenant: u.tenant || undefined,
      rentPerSqm: u.rentPerSqm,
      monthlyRent: u.area * u.rentPerSqm,
      leaseEnd: u.leaseEnd || undefined,
      leaseType: u.status,
    }));
    const dealGewerke = gewerke.map(g => ({
      id: g.id,
      category: g.category,
      description: g.description,
      underwritingBudget: g.budget,
    }));
    const deal: AcquisitionDeal = {
      id: assetId, name: form.name, address: form.address, city: form.city, zip: form.zip,
      usageType: form.usageType, dealType: form.dealType, stage: 'Screening',
      askingPrice: form.uw.purchasePrice,
      underwritingAssumptions: form.uw,
      financingAssumptions: form.fin,
      documents: [], activityLog: [], aiRecommendations: [],
      completenessScore: completeness, createdAt: now, updatedAt: now,
      broker: form.broker || undefined, vendorName: form.vendorName || undefined,
      totalArea: rrTotalArea || form.totalArea || form.uw.area,
      units: dealUnits.length > 0 ? dealUnits : undefined,
      ...(isDev ? {
        developmentType: form.developmentType,
        estimatedDevBudget: gewerkWithContingency || undefined,
        estimatedDevDuration: form.estimatedDevDuration,
        gewerke: dealGewerke.length > 0 ? dealGewerke : undefined,
      } : {}),
    };
    onSave(deal);
  };

  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 5, letterSpacing: '0.04em', textTransform: 'uppercase' };
  const inputStyle: React.CSSProperties = { width: '100%' };
  const thS: React.CSSProperties = { padding: '7px 10px', fontSize: 10, fontWeight: 600, color: 'rgba(60,60,67,0.45)', textAlign: 'left', whiteSpace: 'nowrap', letterSpacing: '0.04em', textTransform: 'uppercase', background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid rgba(0,0,0,0.06)' };
  const tdS: React.CSSProperties = { padding: '4px 5px', borderBottom: '1px solid rgba(0,0,0,0.04)', verticalAlign: 'middle' };
  const miniInput: React.CSSProperties = { width: '100%', padding: '4px 6px', fontSize: 12, background: 'transparent', border: '1px solid transparent', borderRadius: 6, outline: 'none', color: '#1c1c1e' };

  return (
    <>
      <Modal
        title={`${t('acq.newDeal')} — ${stepTitles[step]}`}
        onClose={onClose}
        width={step === rrStep || step === devStep ? 920 : 680}
        actions={
          <div className="flex gap-3 w-full">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} className="btn-glass px-4 py-2 rounded-xl text-sm flex items-center gap-2" style={{ cursor: 'pointer' }}>
                <ChevronLeft size={14} /> Zurück
              </button>
            )}
            <div style={{ flex: 1 }} />
            {step < maxStep ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canProceed()}
                className="btn-accent px-5 py-2 rounded-xl text-sm flex items-center gap-2"
                style={{ cursor: canProceed() ? 'pointer' : 'not-allowed', opacity: canProceed() ? 1 : 0.5 }}
              >
                Weiter <ChevronRight size={14} />
              </button>
            ) : (
              <button onClick={handleSave} className="btn-accent px-5 py-2 rounded-xl text-sm flex items-center gap-2" style={{ cursor: 'pointer' }}>
                <CheckCircle size={14} /> Deal anlegen
              </button>
            )}
          </div>
        }
      >
        {/* Step indicator */}
        <div className="flex gap-1 mb-6" style={{ overflowX: 'auto' }}>
          {stepTitles.map((title, i) => (
            <div key={i} className="flex items-center gap-1" style={{ flex: '0 0 auto' }}>
              <div
                style={{ width: 20, height: 20, borderRadius: '50%', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', background: i <= step ? '#007aff' : 'rgba(0,0,0,0.06)', color: i <= step ? '#fff' : 'rgba(60,60,67,0.45)', flexShrink: 0 }}
              >{i + 1}</div>
              <span style={{ fontSize: 9, color: i <= step ? '#1c1c1e' : 'rgba(60,60,67,0.35)', fontWeight: i === step ? 700 : 400, whiteSpace: 'nowrap' }}>{title}</span>
              {i < stepTitles.length - 1 && <div style={{ width: 16, height: 1, background: 'rgba(0,0,0,0.10)', marginLeft: 4, marginRight: 4 }} />}
            </div>
          ))}
        </div>

        {/* ══ STEP 0: Stammdaten ══ */}
        {step === 0 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label style={labelStyle}>Deal Type *</label>
              <div className="grid grid-cols-2 gap-3">
                {(['Investment', 'Development'] as DealType[]).map(dt => (
                  <button key={dt} onClick={() => updateForm({ dealType: dt })}
                    className="p-4 rounded-xl text-left transition-all"
                    style={{ background: form.dealType === dt ? (dt === 'Investment' ? 'rgba(201,169,110,0.10)' : 'rgba(167,139,250,0.10)') : 'rgba(0,0,0,0.03)', border: `2px solid ${form.dealType === dt ? (dt === 'Investment' ? 'rgba(201,169,110,0.4)' : 'rgba(167,139,250,0.4)') : 'rgba(0,0,0,0.06)'}`, cursor: 'pointer' }}>
                    <div className="flex items-center gap-2 mb-1">
                      {dt === 'Investment' ? <Building2 size={16} color="#c9a96e" /> : <HardHat size={16} color="#a78bfa" />}
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#1c1c1e' }}>{dt === 'Investment' ? 'Investment Asset' : 'Development Asset'}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.55)', lineHeight: 1.5 }}>
                      {dt === 'Investment' ? 'Bestandsobjekt mit laufender Vermietung' : 'Objekt mit Bau-/Sanierungsbedarf'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Projektname *</label>
                <input className="input-glass" style={inputStyle} value={form.name} onChange={e => updateForm({ name: e.target.value })} placeholder="z.B. Prenzlauer Berg Wohnanlage" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Adresse</label>
                <input className="input-glass" style={inputStyle} value={form.address} onChange={e => updateForm({ address: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Stadt *</label>
                <input className="input-glass" style={inputStyle} value={form.city} onChange={e => updateForm({ city: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>PLZ</label>
                <input className="input-glass" style={inputStyle} value={form.zip} onChange={e => updateForm({ zip: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Nutzungsart</label>
                <select className="input-glass" style={inputStyle} value={form.usageType} onChange={e => updateForm({ usageType: e.target.value as UsageType })}>
                  {USAGE_TYPES.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Gesamtfläche (m²)</label>
                <input type="number" className="input-glass" style={inputStyle} value={form.totalArea || ''} onChange={e => updateForm({ totalArea: parseFloat(e.target.value) || 0 })} />
              </div>
              {isDev && (
                <>
                  <div>
                    <label style={labelStyle}>Entwicklungsart</label>
                    <select className="input-glass" style={inputStyle} value={form.developmentType} onChange={e => updateForm({ developmentType: e.target.value as any })}>
                      {DEV_TYPES.map(dt => <option key={dt}>{dt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Baudauer (Monate)</label>
                    <input type="number" className="input-glass" style={inputStyle} value={form.estimatedDevDuration} onChange={e => updateForm({ estimatedDevDuration: parseInt(e.target.value) || 24 })} />
                  </div>
                </>
              )}
              <div><label style={labelStyle}>Broker</label><input className="input-glass" style={inputStyle} value={form.broker} onChange={e => updateForm({ broker: e.target.value })} /></div>
              <div><label style={labelStyle}>Verkäufer</label><input className="input-glass" style={inputStyle} value={form.vendorName} onChange={e => updateForm({ vendorName: e.target.value })} /></div>
            </div>
          </div>
        )}

        {/* ══ STEP 1: Rent Roll ══ */}
        {step === rrStep && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="flex items-center justify-between">
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1c1c1e' }}>
                Mietspiegel — {units.length} Einheiten · {rrTotalArea.toLocaleString('de-DE')} m²
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowQuickEntry(true)} className="btn-glass px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5" style={{ cursor: 'pointer' }}>
                  <Zap size={11} /> Schnell-Erfassung
                </button>
                <button onClick={addUnit} className="btn-accent px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5" style={{ cursor: 'pointer' }}>
                  <Plus size={11} /> Einheit
                </button>
              </div>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 340, overflowY: 'auto', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                  <tr>
                    {['Einheit', 'Etage', 'Fläche m²', 'Nutzung', 'Status', 'Mieter', 'Ist €/m²', 'ERV €/m²', 'Mon. Miete', 'Mietende', ''].map(h => (
                      <th key={h} style={thS}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {units.length === 0 && (
                    <tr>
                      <td colSpan={11} style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: 'rgba(60,60,67,0.35)' }}>
                        Keine Einheiten — "Einheit hinzufügen" oder "Schnell-Erfassung" nutzen
                      </td>
                    </tr>
                  )}
                  {units.map(u => (
                    <tr key={u.id} style={{ background: u.status === 'Leerstand' ? 'rgba(248,113,113,0.04)' : 'transparent' }}>
                      <td style={tdS}><input style={miniInput} value={u.unitNumber} onChange={e => updateUnit(u.id, { unitNumber: e.target.value })} placeholder="EG-01" /></td>
                      <td style={tdS}>
                        <select style={{ ...miniInput, width: 60 }} value={u.floor} onChange={e => updateUnit(u.id, { floor: e.target.value })}>
                          {FLOORS.map(f => <option key={f}>{f}</option>)}
                        </select>
                      </td>
                      <td style={tdS}><input type="number" style={{ ...miniInput, width: 64 }} value={u.area || ''} onChange={e => updateUnit(u.id, { area: parseFloat(e.target.value) || 0 })} /></td>
                      <td style={tdS}>
                        <select style={{ ...miniInput, width: 90 }} value={u.usageType} onChange={e => updateUnit(u.id, { usageType: e.target.value as UsageType })}>
                          {USAGE_TYPES.map(ut => <option key={ut}>{ut}</option>)}
                        </select>
                      </td>
                      <td style={tdS}>
                        <select style={{ ...miniInput, width: 84, color: u.status === 'Leerstand' ? '#f87171' : u.status === 'Vermietet' ? '#4ade80' : '#1c1c1e' }} value={u.status} onChange={e => updateUnit(u.id, { status: e.target.value as WizardUnit['status'] })}>
                          {['Vermietet', 'Leerstand', 'Eigennutzung'].map(s => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={tdS}><input style={{ ...miniInput, width: 80 }} value={u.tenant} onChange={e => updateUnit(u.id, { tenant: e.target.value })} placeholder="—" /></td>
                      <td style={tdS}><input type="number" step="0.5" style={{ ...miniInput, width: 60, color: '#007aff' }} value={u.rentPerSqm || ''} onChange={e => updateUnit(u.id, { rentPerSqm: parseFloat(e.target.value) || 0 })} /></td>
                      <td style={tdS}><input type="number" step="0.5" style={{ ...miniInput, width: 60, color: '#4ade80' }} value={u.ervPerSqm || ''} onChange={e => updateUnit(u.id, { ervPerSqm: parseFloat(e.target.value) || 0 })} /></td>
                      <td style={{ ...tdS, fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#1c1c1e', textAlign: 'right', paddingRight: 10 }}>
                        {((u.area || 0) * (u.rentPerSqm || 0)).toLocaleString('de-DE', { maximumFractionDigits: 0 })} €
                      </td>
                      <td style={tdS}><input type="date" style={{ ...miniInput, width: 96 }} value={u.leaseEnd} onChange={e => updateUnit(u.id, { leaseEnd: e.target.value })} /></td>
                      <td style={tdS}>
                        <button onClick={() => removeUnit(u.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: 'rgba(60,60,67,0.35)' }}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {units.length > 0 && (
                  <tfoot>
                    <tr style={{ background: 'rgba(0,122,255,0.04)', borderTop: '2px solid rgba(0,0,0,0.08)' }}>
                      <td style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#1c1c1e' }} colSpan={2}>Gesamt</td>
                      <td style={{ padding: '8px 10px', fontSize: 12, fontWeight: 700, fontFamily: 'ui-monospace, monospace', color: '#007aff' }}>{rrTotalArea.toLocaleString('de-DE')} m²</td>
                      <td colSpan={3} style={{ padding: '8px 10px', fontSize: 11, color: 'rgba(60,60,67,0.55)' }}>{units.filter(u => u.status === 'Vermietet').length}/{units.length} vermietet · {rrOccupancy.toFixed(1)}%</td>
                      <td style={{ padding: '8px 10px', fontSize: 12, fontWeight: 700, fontFamily: 'ui-monospace, monospace', color: '#007aff' }}>Ø {rrAvgRent.toFixed(2)} €/m²</td>
                      <td style={{ padding: '8px 10px', fontSize: 12, fontWeight: 700, fontFamily: 'ui-monospace, monospace', color: '#4ade80' }}>Ø {rrAvgERV.toFixed(2)} €/m²</td>
                      <td style={{ padding: '8px 10px', fontSize: 12, fontWeight: 700, fontFamily: 'ui-monospace, monospace', color: '#1c1c1e', textAlign: 'right' }}>
                        {rrTotalMonthlyRent.toLocaleString('de-DE', { maximumFractionDigits: 0 })} € / Mo
                      </td>
                      <td colSpan={2} style={{ padding: '8px 10px', fontSize: 11, color: 'rgba(60,60,67,0.55)' }}>
                        = {(rrTotalMonthlyRent * 12 / 1000).toFixed(0)}k € / Jahr
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            {units.length > 0 && (
              <div className="grid grid-cols-4 gap-3">
                {[
                  ['Ist-Jahresmiete', formatEUR(rrTotalMonthlyRent * 12, true), '#007aff'],
                  ['ERV-Jahresmiete', formatEUR(rrTotalMonthlyERV * 12, true), '#4ade80'],
                  ['Mietpotenzial', formatEUR((rrTotalMonthlyERV - rrTotalMonthlyRent) * 12, true), '#fbbf24'],
                  ['Vermietungsquote', `${rrOccupancy.toFixed(1)}%`, rrOccupancy > 90 ? '#4ade80' : rrOccupancy > 70 ? '#fbbf24' : '#f87171'],
                ].map(([l, v, c]) => (
                  <div key={l as string} style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{l}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: c as string, fontFamily: 'ui-monospace, monospace' }}>{v}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ STEP 2 (Dev): Gewerke-Budget ══ */}
        {isDev && step === devStep && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="flex items-center justify-between">
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1c1c1e' }}>
                Gewerke-Budget — {gewerke.length} Positionen
              </div>
              <div className="flex gap-2">
                <button onClick={loadDefaultGewerke} className="btn-glass px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5" style={{ cursor: 'pointer' }}>
                  <BarChart3 size={11} /> Standard-Gewerke laden
                </button>
                <button onClick={() => setGewerke(g => [...g, newWizardGewerk()])} className="btn-accent px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5" style={{ cursor: 'pointer' }}>
                  <Plus size={11} /> Gewerk
                </button>
              </div>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 300, overflowY: 'auto', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                  <tr>
                    {['Gewerk', 'Beschreibung', 'Budget (€)', '€/m²', 'Monat Start', 'Monat Ende', ''].map(h => (
                      <th key={h} style={thS}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gewerke.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: 'rgba(60,60,67,0.35)' }}>Keine Positionen — "Standard-Gewerke laden" oder manuell hinzufügen</td></tr>
                  )}
                  {gewerke.map(g => (
                    <tr key={g.id}>
                      <td style={tdS}>
                        <select style={{ ...miniInput, width: 150 }} value={g.category} onChange={e => setGewerke(gw => gw.map(x => x.id === g.id ? { ...x, category: e.target.value as GeverkCategory } : x))}>
                          {GEWERK_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </td>
                      <td style={tdS}><input style={{ ...miniInput, width: 120 }} value={g.description} onChange={e => setGewerke(gw => gw.map(x => x.id === g.id ? { ...x, description: e.target.value } : x))} placeholder="Beschreibung" /></td>
                      <td style={tdS}><input type="number" style={{ ...miniInput, width: 90, color: '#007aff' }} value={g.budget || ''} onChange={e => setGewerke(gw => gw.map(x => x.id === g.id ? { ...x, budget: parseFloat(e.target.value) || 0 } : x))} /></td>
                      <td style={{ ...tdS, fontSize: 11, fontFamily: 'ui-monospace, monospace', color: 'rgba(60,60,67,0.55)', textAlign: 'right' }}>
                        {rrTotalArea > 0 ? `${(g.budget / rrTotalArea).toFixed(0)} €` : '—'}
                      </td>
                      <td style={tdS}><input type="number" style={{ ...miniInput, width: 52 }} value={g.startMonth} min={1} onChange={e => setGewerke(gw => gw.map(x => x.id === g.id ? { ...x, startMonth: parseInt(e.target.value) || 1 } : x))} /></td>
                      <td style={tdS}><input type="number" style={{ ...miniInput, width: 52 }} value={g.endMonth} min={1} onChange={e => setGewerke(gw => gw.map(x => x.id === g.id ? { ...x, endMonth: parseInt(e.target.value) || 1 } : x))} /></td>
                      <td style={tdS}><button onClick={() => setGewerke(gw => gw.filter(x => x.id !== g.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: 'rgba(60,60,67,0.35)' }}><Trash2 size={13} /></button></td>
                    </tr>
                  ))}
                </tbody>
                {gewerke.length > 0 && (
                  <tfoot>
                    <tr style={{ background: 'rgba(0,0,0,0.02)', borderTop: '2px solid rgba(0,0,0,0.08)' }}>
                      <td colSpan={2} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#1c1c1e' }}>Gesamt Gewerke</td>
                      <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 700, fontFamily: 'ui-monospace, monospace', color: '#007aff' }}>{formatEUR(gewerkTotal, true)}</td>
                      <td style={{ padding: '8px 10px', fontSize: 11, fontFamily: 'ui-monospace, monospace', color: 'rgba(60,60,67,0.55)' }}>{rrTotalArea > 0 ? `${(gewerkTotal / rrTotalArea).toFixed(0)} €/m²` : '—'}</td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            {gewerke.length > 0 && (
              <>
                {/* Contingency + Total */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label style={labelStyle}>Baukostenpuffer / Contingency (%)</label>
                    <input type="number" className="input-glass" style={inputStyle} value={form.uw.contingencyPercent ?? 10} step={1} onChange={e => updateUW({ contingencyPercent: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', marginBottom: 3 }}>Contingency</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#fbbf24', fontFamily: 'ui-monospace, monospace' }}>{formatEUR(gewerkTotal * (contingencyPct / 100), true)}</div>
                  </div>
                  <div style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(0,122,255,0.04)', border: '1px solid rgba(0,122,255,0.12)' }}>
                    <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', marginBottom: 3 }}>Total inkl. Contingency</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#007aff', fontFamily: 'ui-monospace, monospace' }}>{formatEUR(gewerkWithContingency, true)}</div>
                  </div>
                </div>
                {/* Mini Gantt */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Bauzeitplan</div>
                  <div style={{ background: 'rgba(0,0,0,0.02)', borderRadius: 10, padding: '12px 14px', overflow: 'hidden' }}>
                    {(() => {
                      const maxM = Math.max(...gewerke.map(g => g.endMonth), 1);
                      return gewerke.map(g => (
                        <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                          <div style={{ width: 130, fontSize: 10, color: 'rgba(60,60,67,0.55)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.category}</div>
                          <div style={{ flex: 1, position: 'relative', height: 14, background: 'rgba(0,0,0,0.04)', borderRadius: 4 }}>
                            <div style={{
                              position: 'absolute', top: 0, height: '100%', borderRadius: 4,
                              left: `${((g.startMonth - 1) / maxM) * 100}%`,
                              width: `${Math.max(((g.endMonth - g.startMonth + 1) / maxM) * 100, 2)}%`,
                              background: GEWERK_COLORS[g.category] || '#94a3b8',
                              opacity: 0.75,
                            }} />
                          </div>
                          <div style={{ width: 60, fontSize: 10, color: 'rgba(60,60,67,0.45)', textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>{formatEUR(g.budget, true)}</div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ STEP uwStep: Underwriting ══ */}
        {step === uwStep && (
          <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={labelStyle}>Purchase Price (€) *</label>
                <input type="number" className="input-glass" style={inputStyle} value={form.uw.purchasePrice || ''} onChange={e => syncLoan(parseFloat(e.target.value) || 0)} />
              </div>
              {!isDev && (
                <div>
                  <label style={labelStyle}>Initial Capex (€)</label>
                  <input type="number" className="input-glass" style={inputStyle} value={form.uw.initialCapex || ''} onChange={e => updateUW({ initialCapex: parseFloat(e.target.value) || 0 })} />
                </div>
              )}
              <div>
                <label style={labelStyle}>Closing Costs (%)</label>
                <input type="number" step="0.1" className="input-glass" style={inputStyle} value={form.uw.closingCostPercent} onChange={e => updateUW({ closingCostPercent: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label style={labelStyle}>Broker Fee (%)</label>
                <input type="number" step="0.1" className="input-glass" style={inputStyle} value={form.uw.brokerFeePercent} onChange={e => updateUW({ brokerFeePercent: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(60,60,67,0.50)', marginBottom: 10 }}>
                Mietannahmen {units.length > 0 ? <span style={{ color: '#34c759' }}>↑ aus Rent Roll übernommen</span> : '(manuell eingeben)'}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label style={labelStyle}>Fläche (m²)</label>
                  <input type="number" className="input-glass" style={inputStyle} value={form.uw.area || ''} onChange={e => updateUW({ area: parseFloat(e.target.value) || 0 })} />
                  {units.length > 0 && <div style={{ fontSize: 10, color: '#34c759', marginTop: 2 }}>= {rrTotalArea.toLocaleString('de-DE')} m² aus {units.length} Einheiten</div>}
                </div>
                <div>
                  <label style={labelStyle}>Ist-Miete €/m²/Mon</label>
                  <input type="number" step="0.5" className="input-glass" style={inputStyle} value={form.uw.rentPerSqm || ''} onChange={e => updateUW({ rentPerSqm: parseFloat(e.target.value) || 0, annualGrossRent: Math.round((form.uw.area || 0) * (parseFloat(e.target.value) || 0) * 12) })} />
                </div>
                <div>
                  <label style={labelStyle}>Annual Gross Rent (€)</label>
                  <input type="number" className="input-glass" style={{ ...inputStyle, fontWeight: 600, color: '#007aff' }} value={form.uw.annualGrossRent || ''} onChange={e => updateUW({ annualGrossRent: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label style={labelStyle}>Vacancy (%)</label>
                  <input type="number" step="0.5" className="input-glass" style={inputStyle} value={form.uw.vacancyRatePercent} onChange={e => updateUW({ vacancyRatePercent: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label style={labelStyle}>Management (%)</label>
                  <input type="number" step="0.5" className="input-glass" style={inputStyle} value={form.uw.managementCostPercent} onChange={e => updateUW({ managementCostPercent: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label style={labelStyle}>Maintenance (€/m²/J)</label>
                  <input type="number" className="input-glass" style={inputStyle} value={form.uw.maintenanceReservePerSqm} onChange={e => updateUW({ maintenanceReservePerSqm: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label style={labelStyle}>Non-Rec. Opex (€/J)</label>
                  <input type="number" className="input-glass" style={inputStyle} value={form.uw.nonRecoverableOpex || ''} onChange={e => updateUW({ nonRecoverableOpex: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label style={labelStyle}>Other Income (€/J)</label>
                  <input type="number" className="input-glass" style={inputStyle} value={form.uw.otherOperatingIncome || ''} onChange={e => updateUW({ otherOperatingIncome: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
            </div>

            {/* Live NOI Preview */}
            {form.uw.purchasePrice > 0 && form.uw.annualGrossRent > 0 && (() => {
              const grossRent = form.uw.annualGrossRent;
              const vacancyLoss = grossRent * (form.uw.vacancyRatePercent / 100);
              const egi = grossRent - vacancyLoss + (form.uw.otherOperatingIncome || 0);
              const mgmt = grossRent * (form.uw.managementCostPercent / 100);
              const maint = form.uw.maintenanceReservePerSqm * (form.uw.area || 0);
              const noi = egi - mgmt - maint - (form.uw.nonRecoverableOpex || 0);
              const noiyield = form.uw.purchasePrice > 0 ? (noi / form.uw.purchasePrice) * 100 : 0;
              const projRent = form.uw.projectedAnnualRent || 0;
              const projVac = projRent * (form.uw.vacancyRatePercent / 100);
              const projEgi = projRent - projVac + (form.uw.otherOperatingIncome || 0);
              const projMgmt = projRent * (form.uw.managementCostPercent / 100);
              const projNOI = projEgi - projMgmt - maint - (form.uw.nonRecoverableOpex || 0);
              return (
                <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Live NOI-Vorschau</div>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Ist NOI */}
                    <div style={{ background: 'rgba(0,0,0,0.02)', borderRadius: 10, padding: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#007aff', marginBottom: 8 }}>IST (aktuelle Mieten)</div>
                      {[
                        ['Gross Rent', grossRent, '#1c1c1e'],
                        ['− Vacancy', -vacancyLoss, '#f87171'],
                        ['+ Other Income', form.uw.otherOperatingIncome || 0, '#4ade80'],
                        ['= EGI', egi, '#1c1c1e'],
                        ['− Management', -mgmt, '#fbbf24'],
                        ['− Maintenance', -maint, '#fbbf24'],
                        ['− Non-Rec. Opex', -(form.uw.nonRecoverableOpex || 0), '#fbbf24'],
                        ['= NOI', noi, '#007aff'],
                      ].map(([lbl, val, clr]) => (
                        <div key={lbl as string} className="flex justify-between py-0.5" style={{ borderBottom: lbl === '= EGI' || lbl === '= NOI' ? '1px solid rgba(0,0,0,0.08)' : 'none' }}>
                          <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.60)' }}>{lbl}</span>
                          <span style={{ fontSize: 11, fontWeight: lbl?.toString().startsWith('=') ? 700 : 500, color: clr as string, fontFamily: 'ui-monospace, monospace' }}>{formatEUR(val as number)}</span>
                        </div>
                      ))}
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#007aff', marginTop: 6 }}>NIY: {noiyield.toFixed(2)}%</div>
                    </div>
                    {/* Projected NOI */}
                    {projRent > 0 && (
                      <div style={{ background: 'rgba(74,222,128,0.04)', borderRadius: 10, padding: 12, border: '1px solid rgba(74,222,128,0.15)' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', marginBottom: 8 }}>PROJECTED (ERV)</div>
                        {[
                          ['Projected Rent', projRent, '#1c1c1e'],
                          ['− Vacancy', -projVac, '#f87171'],
                          ['= EGI', projEgi, '#1c1c1e'],
                          ['− Opex', -(projMgmt + maint + (form.uw.nonRecoverableOpex || 0)), '#fbbf24'],
                          ['= Projected NOI', projNOI, '#4ade80'],
                        ].map(([lbl, val, clr]) => (
                          <div key={lbl as string} className="flex justify-between py-0.5">
                            <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.60)' }}>{lbl}</span>
                            <span style={{ fontSize: 11, fontWeight: lbl?.toString().startsWith('=') ? 700 : 500, color: clr as string, fontFamily: 'ui-monospace, monospace' }}>{formatEUR(val as number)}</span>
                          </div>
                        ))}
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#4ade80', marginTop: 6 }}>Proj. NIY: {((projNOI / form.uw.purchasePrice) * 100).toFixed(2)}%</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ══ STEP mktStep: Marktannahmen ══ */}
        {step === mktStep && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-3 rounded-xl flex items-center gap-3" style={{ background: 'rgba(0,122,255,0.05)', border: '1px solid rgba(0,122,255,0.12)' }}>
              <TrendingUp size={15} color="#007aff" />
              <span style={{ fontSize: 12, color: 'rgba(60,60,67,0.70)' }}>
                Marktannahmen bilden die Basis für die DCF-Analyse und den Exit-Wert.
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={labelStyle}>ERV €/m²/Mon</label>
                <input type="number" step="0.5" className="input-glass" style={inputStyle}
                  value={form.uw.ervPerSqm || ''}
                  onChange={e => {
                    const erv = parseFloat(e.target.value) || 0;
                    updateUW({ ervPerSqm: erv, projectedAnnualRent: Math.round((form.uw.area || 0) * erv * 12) });
                  }} />
                {form.uw.area > 0 && (form.uw.ervPerSqm || 0) > 0 && <div style={{ fontSize: 11, color: '#34c759', marginTop: 3 }}>= {formatEUR(form.uw.area * (form.uw.ervPerSqm || 0) * 12)} p.a.</div>}
              </div>
              <div>
                <label style={labelStyle}>Haltedauer (Jahre)</label>
                <input type="number" className="input-glass" style={inputStyle}
                  value={form.uw.marketAssumptions!.holdingPeriodYears}
                  onChange={e => updateMA({ holdingPeriodYears: parseInt(e.target.value) || 10 })} />
              </div>
              <div>
                <label style={labelStyle}>Mietwachstum p.a. (%)</label>
                <input type="number" step="0.1" className="input-glass" style={inputStyle}
                  value={form.uw.marketAssumptions!.rentalGrowthRate}
                  onChange={e => updateMA({ rentalGrowthRate: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label style={labelStyle}>ERV-Wachstum p.a. (%)</label>
                <input type="number" step="0.1" className="input-glass" style={inputStyle}
                  value={form.uw.marketAssumptions!.ervGrowthRate}
                  onChange={e => updateMA({ ervGrowthRate: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label style={labelStyle}>Exit-Cap-Rate (%)</label>
                <input type="number" step="0.1" className="input-glass" style={inputStyle}
                  value={form.uw.marketAssumptions!.exitCapRate}
                  onChange={e => updateMA({ exitCapRate: parseFloat(e.target.value) || 0 })} />
                {(form.uw.marketAssumptions!.exitCapRate || 0) > 0 && (
                  <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginTop: 3 }}>
                    Exit-Multiple: {(100 / form.uw.marketAssumptions!.exitCapRate).toFixed(1)}x NOI
                  </div>
                )}
              </div>
              {isDev && (
                <div>
                  <label style={labelStyle}>Baukostenpuffer (%)</label>
                  <input type="number" step="1" className="input-glass" style={inputStyle}
                    value={form.uw.contingencyPercent ?? 10}
                    onChange={e => updateUW({ contingencyPercent: parseFloat(e.target.value) || 0 })} />
                </div>
              )}
              {isDev && (
                <div>
                  <label style={labelStyle}>Baustart</label>
                  <input type="date" className="input-glass" style={inputStyle}
                    value={form.uw.startDate || ''}
                    onChange={e => updateUW({ startDate: e.target.value })} />
                </div>
              )}
              {isDev && (
                <div>
                  <label style={labelStyle}>Fertigstellung (geplant)</label>
                  <input type="date" className="input-glass" style={inputStyle}
                    value={form.uw.plannedEndDate || ''}
                    onChange={e => updateUW({ plannedEndDate: e.target.value })} />
                </div>
              )}
            </div>
            {/* Exit-Wert Preview */}
            {form.uw.purchasePrice > 0 && (form.uw.marketAssumptions?.exitCapRate || 0) > 0 && form.uw.annualGrossRent > 0 && (() => {
              const grossRent = form.uw.annualGrossRent;
              const vacLoss = grossRent * (form.uw.vacancyRatePercent / 100);
              const egi = grossRent - vacLoss + (form.uw.otherOperatingIncome || 0);
              const mgmt = grossRent * (form.uw.managementCostPercent / 100);
              const maint = form.uw.maintenanceReservePerSqm * (form.uw.area || 0);
              const noi = egi - mgmt - maint - (form.uw.nonRecoverableOpex || 0);
              const ma = form.uw.marketAssumptions!;
              const growth = Math.pow(1 + (ma.rentalGrowthRate || 0) / 100, ma.holdingPeriodYears || 10);
              const exitNOI = noi * growth;
              const exitVal = exitNOI / ((ma.exitCapRate || 5) / 100);
              return (
                <div className="p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(60,60,67,0.45)', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Exit-Wert (Schätzung)</div>
                  <div className="grid grid-cols-3 gap-4">
                    <div><div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase' }}>NOI Jahr 1</div><div style={{ fontSize: 14, fontWeight: 700, color: '#1c1c1e' }}>{formatEUR(noi, true)}</div></div>
                    <div><div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase' }}>NOI Exit (J. {ma.holdingPeriodYears})</div><div style={{ fontSize: 14, fontWeight: 700, color: '#1c1c1e' }}>{formatEUR(exitNOI, true)}</div></div>
                    <div><div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase' }}>Indikativer Exit-Wert</div><div style={{ fontSize: 14, fontWeight: 700, color: '#007aff' }}>{formatEUR(exitVal, true)}</div></div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ══ STEP finStep: Finanzierung ══ */}
        {step === finStep && (
          <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={labelStyle}>Loan Amount (€) *</label>
                <input type="number" className="input-glass" style={inputStyle} value={form.fin.loanAmount || ''} onChange={e => updateFin({ loanAmount: parseFloat(e.target.value) || 0 })} />
                {form.uw.purchasePrice > 0 && <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginTop: 3 }}>= {((form.fin.loanAmount / form.uw.purchasePrice) * 100).toFixed(1)}% LTV</div>}
              </div>
              <div><label style={labelStyle}>Interest Rate (%)</label><input type="number" step="0.05" className="input-glass" style={inputStyle} value={form.fin.interestRate} onChange={e => updateFin({ interestRate: parseFloat(e.target.value) || 0 })} /></div>
              <div><label style={labelStyle}>Amortization (%)</label><input type="number" step="0.5" className="input-glass" style={inputStyle} value={form.fin.amortizationRate} onChange={e => updateFin({ amortizationRate: parseFloat(e.target.value) || 0 })} /></div>
              <div><label style={labelStyle}>Loan Term (Jahre)</label><input type="number" className="input-glass" style={inputStyle} value={form.fin.loanTerm} onChange={e => updateFin({ loanTerm: parseInt(e.target.value) || 0 })} /></div>
              <div><label style={labelStyle}>Kreditgeber</label><input className="input-glass" style={inputStyle} value={form.fin.lenderName} onChange={e => updateFin({ lenderName: e.target.value })} /></div>
              <div><label style={labelStyle}>Zinsbindung (J.)</label><input type="number" className="input-glass" style={inputStyle} value={form.fin.fixedRatePeriod} onChange={e => updateFin({ fixedRatePeriod: parseInt(e.target.value) || 0 })} /></div>
            </div>
            {form.fin.loanAmount > 0 && (
              <div className="grid grid-cols-3 gap-3 mt-2">
                {[
                  ['Debt Service p.a.', formatEUR(previewKPIs.annualDebtService), previewKPIs.dscr > 1.25 ? '#4ade80' : '#f87171'],
                  ['DSCR', `${previewKPIs.dscr.toFixed(2)}x`, previewKPIs.dscr > 1.5 ? '#4ade80' : previewKPIs.dscr > 1.2 ? '#fbbf24' : '#f87171'],
                  ['Cash-on-Cash', formatPct(previewKPIs.cashOnCashReturn), previewKPIs.cashOnCashReturn > 4 ? '#4ade80' : '#fbbf24'],
                ].map(([l, v, c]) => (
                  <div key={l as string} style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.03)' }}>
                    <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', marginBottom: 2 }}>{l}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: c as string, fontFamily: 'ui-monospace, monospace' }}>{v}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ STEP cfStep: Cash Flow & IRR ══ */}
        {step === cfStep && (() => {
          if (form.uw.annualGrossRent === 0 || form.fin.loanAmount === 0) {
            return (
              <div className="animate-fade-in flex flex-col items-center justify-center" style={{ padding: '40px 0', gap: 12 }}>
                <BarChart3 size={32} color="rgba(60,60,67,0.25)" />
                <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.45)', textAlign: 'center' }}>
                  Bitte erst Underwriting (Miete, Fläche, Kaufpreis) und Finanzierung ausfüllen.
                </div>
              </div>
            );
          }
          const dcf = computeDealCashFlow(form.uw, form.fin);
          const ma = form.uw.marketAssumptions!;
          const devIRR = isDev && gewerkTotal > 0 ? (() => {
            const projNOI = (form.uw.projectedAnnualRent || form.uw.annualGrossRent) * (1 - form.uw.vacancyRatePercent / 100) * (1 - form.uw.managementCostPercent / 100);
            const exitAtCompletion = projNOI / ((ma.exitCapRate || 5) / 100);
            const totalInvested = form.uw.purchasePrice + gewerkWithContingency;
            const equity = totalInvested - form.fin.loanAmount;
            const netProceeds = exitAtCompletion - form.fin.loanAmount;
            return equity > 0 && netProceeds > equity ? ((netProceeds / equity - 1) * 100) : 0;
          })() : null;
          const chartData = dcf.annualRows.slice(0, 10).map(r => ({
            year: `J${r.year}`, NOI: Math.round(r.noi / 1000), 'Lev.CF': Math.round(r.leveredCashFlow / 1000),
          }));
          let cumCF = 0;
          let paybackYear: number | null = null;
          dcf.annualRows.forEach(r => { cumCF += r.leveredCashFlow; if (paybackYear === null && cumCF >= 0) paybackYear = r.year; });
          const peakNeg = Math.min(...dcf.annualRows.map(r => r.cumulative));
          const kpiLS: React.CSSProperties = { fontSize: 10, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 };
          return (
            <div className="animate-fade-in space-y-5">
              {/* IRR KPI Cards */}
              <div className={`grid gap-4 ${isDev && devIRR !== null ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {isDev && devIRR !== null && (
                  <div style={{ padding: '18px 20px', borderRadius: 14, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.18)' }}>
                    <div style={kpiLS}>Development IRR</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: devIRR > 15 ? '#4ade80' : devIRR > 10 ? '#fbbf24' : '#f87171', fontFamily: 'ui-monospace, monospace' }}>{devIRR.toFixed(1)}%</div>
                    <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.40)', marginTop: 4 }}>Ankauf → Fertigstellung → Exit</div>
                  </div>
                )}
                <div style={{ padding: '18px 20px', borderRadius: 14, background: 'rgba(0,122,255,0.05)', border: '1px solid rgba(0,122,255,0.15)' }}>
                  <div style={kpiLS}>10-Year Hold IRR (Levered)</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: dcf.leveredIRR > 12 ? '#4ade80' : dcf.leveredIRR > 8 ? '#fbbf24' : '#f87171', fontFamily: 'ui-monospace, monospace' }}>{dcf.leveredIRR.toFixed(1)}%</div>
                  <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.40)', marginTop: 4 }}>Haltedauer {dcf.holdingPeriodYears} Jahre</div>
                </div>
                <div style={{ padding: '18px 20px', borderRadius: 14, background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)' }}>
                  <div style={kpiLS}>Equity Multiple</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: dcf.equityMultiple > 1.5 ? '#4ade80' : dcf.equityMultiple > 1.2 ? '#fbbf24' : '#f87171', fontFamily: 'ui-monospace, monospace' }}>{dcf.equityMultiple.toFixed(2)}x</div>
                  <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.40)', marginTop: 4 }}>Total Return / Equity</div>
                </div>
              </div>
              {/* Secondary KPIs */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  ['Exit-Wert (J. ' + dcf.holdingPeriodYears + ')', formatEUR(dcf.terminalValue, true), '#007aff'],
                  ['Payback Period', paybackYear !== null ? `Jahr ${paybackYear}` : 'n/a', '#fbbf24'],
                  ['Peak Equity Required', formatEUR(Math.abs(peakNeg), true), '#f87171'],
                ].map(([l, v, c]) => (
                  <div key={l as string} style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.03)' }}>
                    <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', marginBottom: 2 }}>{l}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: c as string, fontFamily: 'ui-monospace, monospace' }}>{v}</div>
                  </div>
                ))}
              </div>
              {/* Chart */}
              <div style={{ borderRadius: 12, background: 'rgba(0,0,0,0.02)', padding: '12px 10px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', marginBottom: 8, textTransform: 'uppercase' }}>NOI & Levered CF (€k/Jahr)</div>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={chartData} barGap={3}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="year" tick={{ fontSize: 9, fill: 'rgba(60,60,67,0.5)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: 'rgba(60,60,67,0.5)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}k`} />
                    <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(0,0,0,0.10)', borderRadius: 8, fontSize: 11 }} formatter={(v: any) => [`${v}k €`]} />
                    <Bar dataKey="NOI" fill="rgba(0,122,255,0.65)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Lev.CF" fill="rgba(74,222,128,0.65)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Annual table (compact) */}
              <div style={{ overflowX: 'auto', maxHeight: 220, overflowY: 'auto', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.03)' }}>
                      {['J', 'Gross Rent', 'NOI', '− Debt Svc', 'Lev. CF', 'Kumulativ'].map(h => (
                        <th key={h} style={{ ...thS, fontSize: 9 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dcf.annualRows.map(r => (
                      <tr key={r.year} style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                        <td style={{ padding: '5px 10px', fontWeight: 700, color: '#1c1c1e', textAlign: 'right' }}>{r.year}</td>
                        <td style={{ padding: '5px 10px', fontFamily: 'ui-monospace, monospace', color: '#007aff', textAlign: 'right' }}>{formatEUR(r.grossRent, true)}</td>
                        <td style={{ padding: '5px 10px', fontFamily: 'ui-monospace, monospace', fontWeight: 600, color: '#1c1c1e', textAlign: 'right' }}>{formatEUR(r.noi, true)}</td>
                        <td style={{ padding: '5px 10px', fontFamily: 'ui-monospace, monospace', color: '#fbbf24', textAlign: 'right' }}>−{formatEUR(r.annualDebtService, true)}</td>
                        <td style={{ padding: '5px 10px', fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: r.leveredCashFlow >= 0 ? '#4ade80' : '#f87171', textAlign: 'right' }}>{r.leveredCashFlow >= 0 ? '+' : ''}{formatEUR(r.leveredCashFlow, true)}</td>
                        <td style={{ padding: '5px 10px', fontFamily: 'ui-monospace, monospace', color: r.cumulative >= 0 ? '#4ade80' : '#f87171', textAlign: 'right' }}>{formatEUR(r.cumulative, true)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '2px solid rgba(0,0,0,0.10)', background: 'rgba(0,122,255,0.03)' }}>
                      <td colSpan={2} style={{ padding: '7px 10px', fontSize: 11, fontWeight: 700, color: '#1c1c1e' }}>Exit-Wert J. {dcf.holdingPeriodYears}</td>
                      <td colSpan={3} style={{ padding: '7px 10px', fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: '#007aff', textAlign: 'right' }}>{formatEUR(dcf.terminalValue, true)}</td>
                      <td style={{ padding: '7px 10px', fontSize: 10, color: 'rgba(60,60,67,0.45)', textAlign: 'right' }}>@ {dcf.exitCapRate}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* ══ STEP maxStep: Zusammenfassung ══ */}
        {step === maxStep && (
          <div className="space-y-4 animate-fade-in">
            {/* Deal Overview */}
            <GlassPanel style={{ padding: 18 }}>
              <div className="flex items-start justify-between">
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1c1c1e' }}>{form.name || '—'}</div>
                  <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.55)' }}>{form.address}{form.address && ', '}{form.city} {form.zip}</div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: isDev ? 'rgba(167,139,250,0.12)' : 'rgba(201,169,110,0.12)', color: isDev ? '#a78bfa' : '#c9a96e' }}>{form.dealType}</span>
                    <span className="badge-neutral">{form.usageType}</span>
                    <StageBadge stage="Screening" />
                    {isDev && <span className="badge-neutral">{form.developmentType}</span>}
                  </div>
                </div>
                <CompletenessRing score={completeness} size={48} />
              </div>
            </GlassPanel>

            {/* Rent Roll Summary */}
            {units.length > 0 && (
              <GlassPanel style={{ padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#007aff', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Rent Roll</div>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    [`${units.length} Einheiten`, `${rrTotalArea.toLocaleString('de-DE')} m²`],
                    [`${rrOccupancy.toFixed(0)}% vermietet`, `${units.filter(u => u.status === 'Vermietet').length}/${units.length} Einh.`],
                    [`Ø Ist: ${rrAvgRent.toFixed(2)} €/m²`, `Ø ERV: ${rrAvgERV.toFixed(2)} €/m²`],
                    [`Jahresmiete`, `${formatEUR(rrTotalMonthlyRent * 12, true)}`],
                  ].map(([l, v], i) => (
                    <div key={i} style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#1c1c1e' }}>{l}</div>
                      <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.55)' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </GlassPanel>
            )}

            {/* Development Summary */}
            {isDev && gewerke.length > 0 && (
              <GlassPanel style={{ padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Development</div>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    [`${gewerke.length} Gewerke`, `${rrTotalArea > 0 ? (gewerkWithContingency / rrTotalArea).toFixed(0) + ' €/m²' : '—'}`],
                    ['Budget (ohne Puffer)', formatEUR(gewerkTotal, true)],
                    ['Contingency', `${contingencyPct}%`],
                    ['Total Budget', formatEUR(gewerkWithContingency, true)],
                  ].map(([l, v], i) => (
                    <div key={i} style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#1c1c1e' }}>{l}</div>
                      <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.55)' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </GlassPanel>
            )}

            {/* Financial KPIs */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Zap size={12} color="#007aff" /> Live KPI Preview</div>
              <div className="grid grid-cols-4 gap-3">
                <KPICard compact label="NIY" value={formatPct(previewKPIs.netInitialYield)} status={previewKPIs.netInitialYield > 4.5 ? 'good' : previewKPIs.netInitialYield > 3 ? 'warning' : 'danger'} />
                <KPICard compact label="Multiple" value={formatX(previewKPIs.kaufpreisfaktor)} status={previewKPIs.kaufpreisfaktor < 20 ? 'good' : 'warning'} />
                <KPICard compact label="DSCR" value={formatX(previewKPIs.dscr)} status={previewKPIs.dscr > 1.5 ? 'good' : previewKPIs.dscr > 1.2 ? 'warning' : 'danger'} />
                <KPICard compact label="Cash-on-Cash" value={formatPct(previewKPIs.cashOnCashReturn)} status={previewKPIs.cashOnCashReturn > 4 ? 'good' : 'warning'} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <GlassPanel style={{ padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.40)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>Underwriting</div>
                {[
                  ['Purchase Price', formatEUR(form.uw.purchasePrice)],
                  ['Total Acq. Cost', formatEUR(previewKPIs.totalAcquisitionCost)],
                  ['Annual Gross Rent', formatEUR(form.uw.annualGrossRent)],
                  ['NOI', formatEUR(previewKPIs.noi)],
                  ['Equity Required', formatEUR(previewKPIs.equityInvested)],
                  ...(isDev && gewerkTotal > 0 ? [['Dev Budget (inkl. Cont.)', formatEUR(gewerkWithContingency)]] : []),
                ].map(([label, val]) => (
                  <div key={label as string} className="flex justify-between py-1.5" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                    <span style={{ fontSize: 12, color: 'rgba(60,60,67,0.65)' }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1c1c1e', fontFamily: 'ui-monospace, monospace' }}>{val}</span>
                  </div>
                ))}
              </GlassPanel>
              <GlassPanel style={{ padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.40)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>Financing</div>
                {[
                  ['Loan Amount', formatEUR(form.fin.loanAmount)],
                  ['LTV', formatPct(previewKPIs.ltv, 1)],
                  ['Interest Rate', `${form.fin.interestRate}%`],
                  ['Debt Service p.a.', formatEUR(previewKPIs.annualDebtService)],
                  ['Lender', form.fin.lenderName || '—'],
                ].map(([label, val]) => (
                  <div key={label as string} className="flex justify-between py-1.5" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                    <span style={{ fontSize: 12, color: 'rgba(60,60,67,0.65)' }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1c1c1e', fontFamily: 'ui-monospace, monospace' }}>{val}</span>
                  </div>
                ))}
              </GlassPanel>
            </div>
          </div>
        )}
      </Modal>

      {/* ══ Quick-Entry Dialog ══ */}
      {showQuickEntry && (
        <Modal title="Schnell-Erfassung" onClose={() => setShowQuickEntry(false)} width={460}
          actions={
            <div className="flex gap-3 w-full justify-end">
              <button onClick={() => setShowQuickEntry(false)} className="btn-glass px-4 py-2 rounded-xl text-sm" style={{ cursor: 'pointer' }}>Abbrechen</button>
              <button onClick={handleQuickEntry} className="btn-accent px-5 py-2 rounded-xl text-sm flex items-center gap-2" style={{ cursor: 'pointer' }}>
                <Plus size={14} /> {qeCount} Einheiten erstellen
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={labelStyle}>Anzahl Einheiten</label>
                <input type="number" className="input-glass" value={qeCount} min={1} onChange={e => setQeCount(parseInt(e.target.value) || 1)} />
              </div>
              <div>
                <label style={labelStyle}>Fläche je Einheit (m²)</label>
                <input type="number" className="input-glass" value={qeArea} min={1} step={5} onChange={e => setQeArea(parseFloat(e.target.value) || 50)} />
              </div>
              <div>
                <label style={labelStyle}>Nutzungsart</label>
                <select className="input-glass" value={qeUsage} onChange={e => setQeUsage(e.target.value as UsageType)}>
                  {USAGE_TYPES.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select className="input-glass" value={qeStatus} onChange={e => setQeStatus(e.target.value as WizardUnit['status'])}>
                  {['Vermietet', 'Leerstand', 'Eigennutzung'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Ist-Miete €/m²/Mon</label>
                <input type="number" step="0.5" className="input-glass" value={qeRent} onChange={e => setQeRent(parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <label style={labelStyle}>ERV €/m²/Mon</label>
                <input type="number" step="0.5" className="input-glass" value={qeERV} onChange={e => setQeERV(parseFloat(e.target.value) || 0)} />
              </div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(0,122,255,0.04)', border: '1px solid rgba(0,122,255,0.10)', fontSize: 12, color: 'rgba(60,60,67,0.70)' }}>
              Erstellt {qeCount} Einheiten à {qeArea} m² ({qeUsage}, {qeStatus}) · Gesamt: {(qeCount * qeArea).toLocaleString('de-DE')} m² · Jahresmiete: {formatEUR(qeCount * qeArea * qeRent * 12, true)}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ── Main Acquisition Page ───────────────────────────────
export default function AcquisitionPage() {
  const { deals, addDeal } = useStore();
  const { t } = useLanguage();
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
      name: pd.name || 'Neues Objekt',
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
          title="Neues Deal erfassen"
        />
      )}
    </div>
  );
}
