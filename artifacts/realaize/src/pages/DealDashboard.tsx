import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle, AlertTriangle, FileText, Download,
  Edit3, Save, X, ChevronRight, Bot, Clock, Upload,
  Zap, Info, TrendingUp, TrendingDown, ExternalLink, Plus, Trash2, HardHat
} from 'lucide-react';
import { useStore } from '../store/useStore';
import {
  GlassPanel, PageHeader, KPICard, FormulaDrawer, StageBadge,
  StatusBadge, Modal, Tabs, SectionHeader, CompletenessRing, FreshnessBadge
} from '../components/shared';
import { computeDealKPIs, getKPIFormulaDetails, formatEUR, formatPct, formatX } from '../utils/kpiEngine';
import { computeDealCashFlow } from '../utils/propertyCashFlowModel';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { exportInvestmentMemoPDF, exportDealExcel } from '../utils/exportUtils';
import ImageManager, { TitleImageDisplay } from '../components/ImageManager';
import { useLanguage } from '../i18n/LanguageContext';
import { AcquisitionWizard } from './AcquisitionWizard';
import type { KPIFormulaDetail, ActivityEntry, PropertyData } from '../models/types';
import { createDefaultPropertyData } from '../models/types';

export default function DealDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { deals, updateDeal, deleteDeal, transferToBestand, transferToDevelopment, addActivityToDeal, addAuditEntry, updateDealPropertyData } = useStore();
  const { t, lang } = useLanguage();
  const dateLocale = lang === 'de' ? 'de-DE' : 'en-GB';
  const deal = deals.find(d => d.id === id);

  const [activeTab, setActiveTab] = useState('overview');
  const [formulaDetail, setFormulaDetail] = useState<KPIFormulaDetail | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDevModal, setShowDevModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showWizardEdit, setShowWizardEdit] = useState(false);
  const [editingUW, setEditingUW] = useState(false);
  const [editingFin, setEditingFin] = useState(false);
  const [uwEdit, setUwEdit] = useState<any>(null);
  const [finEdit, setFinEdit] = useState<any>(null);
  const [noteText, setNoteText] = useState('');

  if (!deal) {
    return (
      <div className="p-8">
        <div style={{ color: 'rgba(60,60,67,0.45)' }}>{t('acq.dealNotFound')}</div>
        <Link to="/acquisition" style={{ color: '#007aff' }}>{t('acq.backToList')}</Link>
      </div>
    );
  }

  const kpis = computeDealKPIs(deal.underwritingAssumptions, deal.financingAssumptions);

  const handleShowFormula = (key: string) => {
    setFormulaDetail(getKPIFormulaDetails(key, kpis, deal.underwritingAssumptions, deal.financingAssumptions));
  };

  const handleSaveUW = () => {
    if (uwEdit) {
      updateDeal(deal.id, { underwritingAssumptions: { ...deal.underwritingAssumptions, ...uwEdit } });
      addActivityToDeal(deal.id, {
        id: `act-${Date.now()}`,
        dealId: deal.id,
        type: 'Edit',
        title: 'Underwriting-Annahmen aktualisiert',
        description: 'Underwriting-Annahmen manuell bearbeitet.',
        timestamp: new Date().toISOString(),
        user: 'M. Wagner',
      });
    }
    setEditingUW(false);
    setUwEdit(null);
  };

  const handleSaveFin = () => {
    if (finEdit) {
      updateDeal(deal.id, { financingAssumptions: { ...deal.financingAssumptions, ...finEdit } });
    }
    setEditingFin(false);
    setFinEdit(null);
  };

  const handleTransfer = () => {
    addAuditEntry({
      id: `audit-${Date.now()}`,
      action: 'In Bestand überführt',
      entityType: 'Asset',
      entityId: deal.id,
      entityName: deal.name,
      user: 'M. Wagner',
      timestamp: new Date().toISOString(),
      details: `Deal "${deal.name}" wurde in den Bestand überführt.`,
    });
    transferToBestand(deal.id);
    setShowTransferModal(false);
    navigate('/assets');
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addActivityToDeal(deal.id, {
      id: `act-${Date.now()}`,
      dealId: deal.id,
      type: 'Note',
      title: 'Notiz',
      description: noteText,
      timestamp: new Date().toISOString(),
      user: 'M. Wagner',
    });
    setNoteText('');
  };

  const uwValues = uwEdit || deal.underwritingAssumptions;
  const finValues = finEdit || deal.financingAssumptions;

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/acquisition" style={{ color: 'rgba(60,60,67,0.45)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 13 }}>
          <ArrowLeft size={14} /> Acquisition
        </Link>
        <ChevronRight size={14} color="var(--text-muted)" />
        <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.70)' }}>{deal.name}</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <CompletenessRing score={deal.completenessScore} size={52} />
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, fontFamily: '-apple-system, system-ui, sans-serif', margin: 0 }}>{deal.name}</h1>
            <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.70)', marginTop: 4 }}>
              {deal.address}, {deal.city} · {deal.usageType} · {deal.broker}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <StageBadge stage={deal.stage} />
              <span className="badge-neutral">{deal.usageType}</span>
              {deal.aiRecommendations.some(r => r.isAlert) && (
                <span className="badge-warning flex items-center gap-1"><AlertTriangle size={10} /> AI Warnung</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => deal && exportInvestmentMemoPDF(deal)} className="btn-glass px-4 py-2 rounded-xl text-sm flex items-center gap-2">
            <Download size={14} /> PDF Memo
          </button>
          <button onClick={() => deal && exportDealExcel(deal)} className="btn-glass px-4 py-2 rounded-xl text-sm flex items-center gap-2">
            <Download size={14} /> Excel
          </button>
          <button
            onClick={() => setShowWizardEdit(true)}
            className="btn-glass px-4 py-2 rounded-xl text-sm flex items-center gap-2"
            style={{ color: '#6b4c10', borderColor: 'rgba(201,169,110,0.3)' }}
          >
            <Edit3 size={14} /> Underwriting bearbeiten
          </button>
          <button
            onClick={() => setShowDevModal(true)}
            style={{
              background: 'linear-gradient(135deg, #c9a96e, #a08040)',
              border: 'none', borderRadius: 12, padding: '8px 18px',
              cursor: 'pointer', fontSize: 13, fontWeight: 700,
              color: '#fff', display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 2px 8px rgba(160,128,64,0.35)',
            }}
          >
            <HardHat size={14} /> In Development
          </button>
          <button
            onClick={() => setShowTransferModal(true)}
            className="btn-accent px-5 py-2 rounded-xl text-sm flex items-center gap-2"
          >
            <CheckCircle size={14} /> In Bestand überführen
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            style={{
              background: '#fff',
              border: '1.5px solid #ff3b30',
              borderRadius: 12,
              padding: '0 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'stretch',
            }}
            title="Deal löschen"
          >
            <Trash2 size={15} color="#ff3b30" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <Tabs
          tabs={[
            { key: 'overview', label: 'Überblick' },
            { key: 'underwriting', label: 'Underwriting' },
            { key: 'cashflow', label: 'Cash Flow / IRR' },
            { key: 'financing', label: 'Finanzierung' },
            { key: 'ai', label: 'AI Researcher', count: deal.aiRecommendations.length },
            { key: 'documents', label: 'Dokumente', count: deal.documents.length },
            { key: 'icmemo', label: 'IC Memo' },
            { key: 'activity', label: 'Aktivitäten', count: deal.activityLog.length },
            { key: 'images', label: 'Bilder' },
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
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
      )}

      {/* ── UNDERWRITING TAB ── */}
      {activeTab === 'underwriting' && (
        <div className="animate-fade-in">
          <GlassPanel style={{ padding: 28 }}>
            <div className="flex items-center justify-between mb-6">
              <SectionHeader title="Underwriting Annahmen" />
              {!editingUW ? (
                <button onClick={() => { setEditingUW(true); setUwEdit({ ...deal.underwritingAssumptions }); }}
                  className="btn-glass px-4 py-2 rounded-xl text-sm flex items-center gap-2">
                  <Edit3 size={14} /> Bearbeiten
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => { setEditingUW(false); setUwEdit(null); }} className="btn-glass px-3 py-2 rounded-xl text-sm flex items-center gap-1"><X size={12} /></button>
                  <button onClick={handleSaveUW} className="btn-accent px-4 py-2 rounded-xl text-sm flex items-center gap-2"><Save size={14} /> Speichern</button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {[
                { key: 'purchasePrice', label: 'Kaufpreis (EUR)', type: 'number', prefix: '€' },
                { key: 'closingCostPercent', label: 'Kaufnebenkosten (%)', type: 'number' },
                { key: 'brokerFeePercent', label: 'Maklergebühr (%)', type: 'number' },
                { key: 'initialCapex', label: 'Initialer CapEx (EUR)', type: 'number', prefix: '€' },
                { key: 'annualGrossRent', label: 'Jahreskaltmiete (EUR)', type: 'number', prefix: '€' },
                { key: 'rentPerSqm', label: 'Miete pro m²/Monat (EUR)', type: 'number', prefix: '€' },
                { key: 'vacancyRatePercent', label: 'Leerstandsrate (%)', type: 'number' },
                { key: 'managementCostPercent', label: 'Verwaltungskosten (%)', type: 'number' },
                { key: 'maintenanceReservePerSqm', label: 'Instandhaltungsreserve (€/m²/Jahr)', type: 'number', prefix: '€' },
                { key: 'nonRecoverableOpex', label: 'Nicht-umlagefähige Kosten (EUR)', type: 'number', prefix: '€' },
                { key: 'area', label: 'Fläche (m²)', type: 'number' },
                { key: 'otherOperatingIncome', label: 'Sonstige Einnahmen (EUR)', type: 'number', prefix: '€' },
              ].map(field => (
                <div key={field.key}>
                  <label style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>{field.label}</label>
                  {editingUW ? (
                    <input
                      type="number"
                      className="input-glass"
                      value={uwValues[field.key as keyof typeof uwValues]}
                      onChange={e => setUwEdit((prev: any) => ({ ...prev, [field.key]: parseFloat(e.target.value) || 0 }))}
                    />
                  ) : (
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#1c1c1e', fontFamily: 'ui-monospace, monospace' }}>
                      {field.prefix}{new Intl.NumberFormat(dateLocale).format(deal.underwritingAssumptions[field.key as keyof typeof deal.underwritingAssumptions] as number)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>
      )}

      {/* ── CASHFLOW / IRR TAB ── */}
      {activeTab === 'cashflow' && (() => {
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
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1c1c1e', marginBottom: 12 }}>Marktannahmen (DCF)</div>
              <div className="grid grid-cols-4 gap-6">
                {[
                  ['Haltedauer', `${ma.holdingPeriodYears} Jahre`],
                  ['Mietwachstum p.a.', `${ma.rentalGrowthRate}%`],
                  ['Exit-Cap-Rate', `${ma.exitCapRate}%`],
                  ['ERV €/m²/Mon', `${uw.ervPerSqm || '—'}`],
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
                <div style={kpiLS}>Exit-Wert (Jahr {dcf.holdingPeriodYears})</div>
                <div style={kpiVS('#007aff')}>{formatEUR(dcf.terminalValue, true)}</div>
                <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginTop: 2 }}>@ {dcf.exitCapRate}% Cap Rate</div>
              </GlassPanel>
            </div>

            {/* Chart */}
            <GlassPanel style={{ padding: 24 }}>
              <SectionHeader title="NOI & Levered Cash Flow (jährlich)" />
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: 'rgba(60,60,67,0.55)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'rgba(60,60,67,0.55)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}k`} />
                  <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(0,0,0,0.10)', borderRadius: 10, fontSize: 12 }} formatter={(v: any) => [`${v}k €`]} />
                  <Bar dataKey="NOI" fill="rgba(0,122,255,0.7)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Levered CF" fill="rgba(74,222,128,0.7)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </GlassPanel>

            {/* Annual table */}
            <GlassPanel style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1c1c1e' }}>Jährliche Cashflow-Tabelle (Underwriting)</div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
                      {['Jahr', 'Gross Rent', 'EGI', 'NOI', '− Debt Svc', 'Levered CF', 'Kumulativ'].map(h => (
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
                      <td colSpan={3} style={{ padding: '12px 14px', fontSize: 12, fontWeight: 700, color: '#1c1c1e' }}>Exit-Wert (Jahr {dcf.holdingPeriodYears})</td>
                      <td colSpan={3} style={{ padding: '12px 14px', fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: '#007aff', fontSize: 14, textAlign: 'right' }}>{formatEUR(dcf.terminalValue, true)}</td>
                      <td style={{ padding: '12px 14px', fontSize: 10, color: 'rgba(60,60,67,0.45)', textAlign: 'right' }}>NOI / {dcf.exitCapRate}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </GlassPanel>
          </div>
        );
      })()}

      {/* ── FINANCING TAB ── */}
      {activeTab === 'financing' && (
        <div className="animate-fade-in">
          <GlassPanel style={{ padding: 28 }}>
            <div className="flex items-center justify-between mb-6">
              <SectionHeader title="Finanzierungsannahmen" />
              {!editingFin ? (
                <button onClick={() => { setEditingFin(true); setFinEdit({ ...deal.financingAssumptions }); }}
                  className="btn-glass px-4 py-2 rounded-xl text-sm flex items-center gap-2">
                  <Edit3 size={14} /> Bearbeiten
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => { setEditingFin(false); setFinEdit(null); }} className="btn-glass px-3 py-2 rounded-xl text-sm"><X size={12} /></button>
                  <button onClick={handleSaveFin} className="btn-accent px-4 py-2 rounded-xl text-sm flex items-center gap-2"><Save size={14} /> Speichern</button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {[
                { key: 'lenderName', label: 'Kreditgeber', type: 'text' },
                { key: 'loanAmount', label: 'Darlehensbetrag (EUR)', type: 'number', prefix: '€' },
                { key: 'interestRate', label: 'Zinssatz (% p.a.)', type: 'number' },
                { key: 'amortizationRate', label: 'Tilgungsrate (% p.a.)', type: 'number' },
                { key: 'loanTerm', label: 'Laufzeit (Jahre)', type: 'number' },
                { key: 'fixedRatePeriod', label: 'Zinsbindung (Jahre)', type: 'number' },
              ].map(field => (
                <div key={field.key}>
                  <label style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>{field.label}</label>
                  {editingFin ? (
                    <input
                      type={field.type}
                      className="input-glass"
                      value={finValues[field.key as keyof typeof finValues]}
                      onChange={e => setFinEdit((prev: any) => ({ ...prev, [field.key]: field.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))}
                    />
                  ) : (
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#1c1c1e', fontFamily: 'ui-monospace, monospace' }}>
                      {field.prefix || ''}{typeof deal.financingAssumptions[field.key as keyof typeof deal.financingAssumptions] === 'number'
                        ? new Intl.NumberFormat(dateLocale).format(deal.financingAssumptions[field.key as keyof typeof deal.financingAssumptions] as number)
                        : deal.financingAssumptions[field.key as keyof typeof deal.financingAssumptions]}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-6 pt-6" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(60,60,67,0.45)', marginBottom: 12 }}>BERECHNETE FINANZIERUNGSKENNZAHLEN</div>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                  <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>LTV</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: kpis.ltv < 65 ? '#4ade80' : '#fbbf24' }}>{formatPct(kpis.ltv, 1)}</div>
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                  <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>Jährl. Schuldendienst</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1c1c1e' }}>{formatEUR(kpis.annualDebtService, true)}</div>
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                  <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>Eigenkapital</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#007aff' }}>{formatEUR(kpis.equityInvested, true)}</div>
                </div>
              </div>
            </div>
          </GlassPanel>
        </div>
      )}

      {/* ── AI RESEARCHER TAB ── */}
      {activeTab === 'ai' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'rgba(0,122,255,0.05)', border: '1px solid rgba(0,122,255,0.12)' }}>
            <Bot size={18} color="#007aff" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#007aff' }}>AI Researcher — Empfehlungsmodul</div>
              <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)' }}>
                Deterministischer Vergleich von Underwriting-Annahmen mit Markt-Benchmarks. Nur Unterstützung — KPIs bleiben Referenz.
              </div>
            </div>
            <span className="badge-neutral">Simuliert · Kein LLM</span>
          </div>

          {deal.aiRecommendations.map(rec => (
            <GlassPanel key={rec.id} style={{ padding: 20, border: rec.isAlert ? '1px solid rgba(251,191,36,0.2)' : '1px solid rgba(255,255,255,0.1)' }}>
              <div className="flex items-start gap-4">
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: rec.isAlert ? 'rgba(251,191,36,0.12)' : 'rgba(201,169,110,0.12)',
                  border: `1px solid ${rec.isAlert ? 'rgba(251,191,36,0.2)' : 'rgba(201,169,110,0.2)'}`,
                }}>
                  {rec.isAlert ? <AlertTriangle size={16} color="#fbbf24" /> : <Zap size={16} color="#007aff" />}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ fontSize: 14, fontWeight: 700, color: rec.isAlert ? '#fbbf24' : 'var(--text-primary)' }}>{rec.title}</span>
                    <span className={rec.confidence === 'Hoch' ? 'badge-success' : rec.confidence === 'Mittel' ? 'badge-warning' : 'badge-neutral'}>
                      {rec.confidence}
                    </span>
                    <span className="badge-neutral">{rec.type}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.70)', lineHeight: 1.6, marginBottom: 12 }}>{rec.body}</div>
                  {rec.benchmarkValue !== undefined && rec.userValue !== undefined && (
                    <div className="flex gap-4">
                      <div className="p-3 rounded-lg flex-1" style={{ background: 'rgba(0,0,0,0.03)' }}>
                        <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', letterSpacing: '0.05em' }}>IHRE ANNAHME</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: rec.isAlert ? '#fbbf24' : 'var(--text-primary)' }}>
                          {rec.userValue?.toFixed(2)} {rec.type === 'Miete' ? '€/m²' : 'x'}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg flex-1" style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.15)' }}>
                        <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', letterSpacing: '0.05em' }}>MARKT-BENCHMARK</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#4ade80' }}>
                          {rec.benchmarkValue?.toFixed(2)} {rec.type === 'Miete' ? '€/m²' : 'x'}
                        </div>
                      </div>
                      {rec.deviationPercent !== undefined && (
                        <div className="p-3 rounded-lg flex-1" style={{ background: 'rgba(0,0,0,0.03)' }}>
                          <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', letterSpacing: '0.05em' }}>ABWEICHUNG</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: Math.abs(rec.deviationPercent) > 10 ? '#f87171' : '#fbbf24' }}>
                            {rec.deviationPercent > 0 ? '+' : ''}{rec.deviationPercent.toFixed(1)}%
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginTop: 8 }}>
                    Quelle: {rec.benchmarkLabel} · {new Date(rec.generatedAt).toLocaleDateString(dateLocale)}
                  </div>
                </div>
              </div>
            </GlassPanel>
          ))}
          {deal.aiRecommendations.length === 0 && (
            <div className="text-center py-12">
              <Bot size={32} color="var(--text-muted)" />
              <div style={{ color: 'rgba(60,60,67,0.45)', marginTop: 8 }}>Keine AI-Empfehlungen verfügbar.</div>
            </div>
          )}
        </div>
      )}

      {/* ── DOCUMENTS TAB ── */}
      {activeTab === 'documents' && (
        <div className="animate-fade-in">
          <GlassPanel style={{ padding: 24 }}>
            <div className="flex items-center justify-between mb-4">
              <SectionHeader title="Dokumente" />
              <button className="btn-glass px-3 py-2 rounded-xl text-sm flex items-center gap-2">
                <Upload size={14} /> Hochladen
              </button>
            </div>
            {deal.documents.length === 0 ? (
              <div className="text-center py-8" style={{ color: 'rgba(60,60,67,0.45)' }}>Noch keine Dokumente vorhanden.</div>
            ) : (
              <div className="space-y-2">
                {deal.documents.map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl glass-hover" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
                    <FileText size={16} color="#007aff" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1c1c1e' }}>{doc.name}</div>
                      <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>{doc.category} · {doc.fileSize} · {doc.uploadedBy}</div>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {doc.tags.map(t => <span key={t} className="badge-neutral" style={{ fontSize: 10 }}>{t}</span>)}
                    </div>
                    <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>{new Date(doc.uploadDate).toLocaleDateString(dateLocale)}</span>
                  </div>
                ))}
              </div>
            )}
          </GlassPanel>
        </div>
      )}

      {/* ── IC MEMO TAB ── */}
      {activeTab === 'icmemo' && (
        <div className="animate-fade-in">
          {deal.icMemo ? (
            <div className="space-y-4">
              {[
                { title: 'Executive Summary', content: deal.icMemo.executiveSummary },
                { title: 'Investment Rationale', content: deal.icMemo.investmentRationale },
                { title: 'Exit-Strategie', content: deal.icMemo.exitStrategy },
                { title: 'Empfehlung', content: deal.icMemo.recommendedAction, highlight: true },
              ].map(section => (
                <GlassPanel key={section.title} style={{ padding: 24, border: section.highlight ? '1px solid rgba(201,169,110,0.2)' : undefined }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: section.highlight ? 'var(--accent)' : 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>{section.title}</div>
                  <div style={{ fontSize: 14, color: 'rgba(60,60,67,0.70)', lineHeight: 1.7 }}>{section.content}</div>
                </GlassPanel>
              ))}
              <GlassPanel style={{ padding: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(60,60,67,0.45)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>Risikofaktoren</div>
                <div className="space-y-2">
                  {deal.icMemo.riskFactors.map((risk, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <AlertTriangle size={13} color="#fbbf24" style={{ marginTop: 2, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.70)' }}>{risk}</span>
                    </div>
                  ))}
                </div>
              </GlassPanel>
              <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', textAlign: 'center' }}>
                Erstellt von: {deal.icMemo.preparedBy} · {new Date(deal.icMemo.preparedAt).toLocaleDateString(dateLocale)}
              </div>
            </div>
          ) : (
            <GlassPanel style={{ padding: 48, textAlign: 'center' }}>
              <FileText size={32} color="var(--text-muted)" />
              <div style={{ color: 'rgba(60,60,67,0.45)', marginTop: 12 }}>IC Memo noch nicht verfügbar.</div>
            </GlassPanel>
          )}
        </div>
      )}

      {/* ── ACTIVITY TAB ── */}
      {activeTab === 'activity' && (
        <div className="animate-fade-in">
          <GlassPanel style={{ padding: 24 }}>
            <div className="mb-4">
              <textarea
                className="input-glass"
                placeholder="Notiz hinzufügen..."
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                rows={2}
                style={{ resize: 'none' }}
              />
              <button onClick={handleAddNote} className="btn-accent px-4 py-2 rounded-xl text-sm mt-2 flex items-center gap-2">
                <Plus size={14} /> Notiz speichern
              </button>
            </div>
            <div className="divider mb-4" />
            <div className="space-y-4">
              {deal.activityLog.map((entry, i) => (
                <div key={entry.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,122,255,0.08)', border: '1px solid rgba(0,122,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, color: '#007aff', fontWeight: 700 }}>
                      {entry.type === 'Note' ? '✎' : entry.type === 'Status' ? '◉' : entry.type === 'AI' ? '⚡' : '●'}
                    </div>
                    {i < deal.activityLog.length - 1 && <div style={{ width: 1, flex: 1, marginTop: 4, background: 'rgba(0,122,255,0.10)' }} />}
                  </div>
                  <div style={{ paddingBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1c1c1e' }}>{entry.title}</div>
                    <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.70)', marginTop: 2 }}>{entry.description}</div>
                    <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginTop: 4 }}>
                      {new Date(entry.timestamp).toLocaleString(dateLocale)} · {entry.user}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>
      )}

      {/* Images Tab */}
      {activeTab === 'images' && (
        <GlassPanel style={{ padding: 24 }} className="animate-fade-in">
          <SectionHeader title="Bilder" />
          <ImageManager entityId={deal.id} entityType="Deal" />
        </GlassPanel>
      )}

      {/* Formula Drawer */}
      <FormulaDrawer detail={formulaDetail} onClose={() => setFormulaDetail(null)} />

      {/* Development Modal */}
      {showDevModal && deal && (
        <Modal
          title="In Development überführen"
          onClose={() => setShowDevModal(false)}
          actions={
            <>
              <button onClick={() => setShowDevModal(false)} className="btn-glass px-4 py-2 rounded-xl text-sm">Abbrechen</button>
              <button
                onClick={() => { transferToDevelopment(deal.id); setShowDevModal(false); navigate('/developments'); }}
                className="btn-accent px-5 py-2 rounded-xl text-sm"
                style={{ background: 'linear-gradient(135deg, #ff9500, #b25000)' }}
              >
                Bestätigen & überführen
              </button>
            </>
          }
        >
          <div style={{ fontSize: 14, color: 'rgba(60,60,67,0.70)', lineHeight: 1.7 }}>
            <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(255,149,0,0.07)', border: '1px solid rgba(255,149,0,0.18)' }}>
              <strong style={{ color: '#b25000' }}>{deal.name}</strong> wird in das Development-Modul überführt.
            </div>
            <ul style={{ paddingLeft: 16, lineHeight: 2 }}>
              <li>Underwriting-Daten werden übernommen</li>
              <li>Dokumente bleiben erhalten</li>
              <li>Deal verschwindet aus der Acquisition-Pipeline</li>
              <li>Construction Advisor steht im Development bereit</li>
            </ul>
          </div>
        </Modal>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <Modal
          title="In Bestand überführen"
          onClose={() => setShowTransferModal(false)}
          actions={
            <>
              <button onClick={() => setShowTransferModal(false)} className="btn-glass px-4 py-2 rounded-xl text-sm">Abbrechen</button>
              <button onClick={handleTransfer} className="btn-accent px-5 py-2 rounded-xl text-sm">Bestätigen & überführen</button>
            </>
          }
        >
          <div style={{ fontSize: 14, color: 'rgba(60,60,67,0.70)', lineHeight: 1.7 }}>
            <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(0,122,255,0.06)', border: '1px solid rgba(0,122,255,0.18)' }}>
              <strong style={{ color: '#007aff' }}>{deal.name}</strong> wird aus der Acquisition-Pipeline in den Asset-Bestand überführt.
            </div>
            <p>Diese Aktion:</p>
            <ul style={{ paddingLeft: 16, lineHeight: 2 }}>
              <li>Erstellt einen neuen Asset-Eintrag im Bestand</li>
              <li>Überträgt alle Dokumente und Underwriting-Daten</li>
              <li>Entfernt den Deal aus der Acquisition-Pipeline</li>
              <li>Erstellt einen Audit-Log-Eintrag</li>
            </ul>
            <p style={{ color: 'rgba(60,60,67,0.45)', fontSize: 13 }}>Diese Aktion kann nicht rückgängig gemacht werden.</p>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <Modal
          title="Deal löschen"
          onClose={() => setShowDeleteModal(false)}
          actions={
            <>
              <button onClick={() => setShowDeleteModal(false)} className="btn-glass px-4 py-2 rounded-xl text-sm">Abbrechen</button>
              <button
                onClick={() => { deleteDeal(deal.id); navigate('/acquisition'); }}
                style={{ background: '#ff3b30', color: '#fff', border: 'none', borderRadius: 12, padding: '8px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                Endgültig löschen
              </button>
            </>
          }
        >
          <div style={{ fontSize: 14, color: 'rgba(60,60,67,0.70)', lineHeight: 1.7 }}>
            <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.2)' }}>
              <strong style={{ color: '#ff3b30' }}>{deal.name}</strong> wird dauerhaft aus der Acquisition-Pipeline gelöscht.
            </div>
            <p style={{ color: 'rgba(60,60,67,0.45)', fontSize: 13 }}>Diese Aktion kann nicht rückgängig gemacht werden.</p>
          </div>
        </Modal>
      )}

      {/* AcquisitionWizard Edit */}
      {showWizardEdit && (
        <AcquisitionWizard
          initialData={deal.propertyData || createDefaultPropertyData({
            name: deal.name, address: deal.address, city: deal.city, zip: deal.zip,
            usageType: deal.usageType, dealType: deal.dealType || 'Investment',
            purchasePrice: deal.underwritingAssumptions.purchasePrice,
            vendor: deal.vendorName || '', broker: deal.broker || '',
          })}
          onSave={(pd: PropertyData) => {
            updateDealPropertyData(deal.id, pd);
            updateDeal(deal.id, {
              name: pd.name || deal.name,
              askingPrice: pd.purchasePrice,
              underwritingAssumptions: {
                ...deal.underwritingAssumptions,
                purchasePrice: pd.purchasePrice,
                annualGrossRent: pd.unitsAsIs.reduce((s, u) => s + u.monthlyRent, 0) * 12,
                area: pd.unitsAsIs.reduce((s, u) => s + u.area, 0),
                vacancyRatePercent: pd.operatingCosts.vacancyRatePercent,
                managementCostPercent: pd.operatingCosts.managementCostPercent,
                maintenanceReservePerSqm: pd.operatingCosts.maintenanceReservePerSqm,
              },
              propertyData: pd,
              updatedAt: new Date().toISOString(),
            });
            setShowWizardEdit(false);
          }}
          onClose={() => setShowWizardEdit(false)}
          title={`Underwriting bearbeiten — ${deal.name}`}
        />
      )}
    </div>
  );
}
