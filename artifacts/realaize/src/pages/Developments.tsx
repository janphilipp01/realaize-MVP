import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Plus, CheckCircle, Download, Trash2, TrendingUp } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { GlassPanel, PageHeader, KPICard, SectionHeader, CompletenessRing, Modal, Tabs } from '@/components/shared';
import ImageManager, { TitleImageDisplay } from '@/components/ImageManager';
import { formatEUR, formatPct } from '@/utils/kpiEngine';
import { analyzeHoldSell } from '@/utils/irrCalculator';

import { useLanguage, useDateLocale } from '@/i18n/LanguageContext';
import { DEV_STATUS_COLOR } from '@/components/developments/constants';
import { OverviewTab } from '@/components/developments/OverviewTab';
import { RentRollTab } from '@/components/developments/RentRollTab';
import { BudgetTab } from '@/components/developments/BudgetTab';
import { GanttTab } from '@/components/developments/GanttTab';
import { DebtTab } from '@/components/developments/DebtTab';
import { ValuationTab } from '@/components/developments/ValuationTab';
import { AdvisorTab } from '@/components/developments/AdvisorTab';
import { HoldSellTab } from '@/components/developments/HoldSellTab';
import { CashFlowTab } from '@/components/developments/CashFlowTab';
import { DocumentsTab } from '@/components/developments/DocumentsTab';

// ─── Developments List ──────────────────────────────────────────────────────
export function DevelopmentsPage() {
  const { developments } = useStore();
  const { t, lang } = useLanguage();
  const dateLocale = useDateLocale();

  const totalBudget = developments.reduce((s, d) => s + d.totalBudget, 0);
  const totalSpent = developments.reduce((s, d) =>
    s + d.gewerke.reduce((gs, g) => gs + (g.actualCost || 0), 0), 0);

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title={t('dev.title')}
        subtitle={`${developments.length} ${lang === 'de' ? 'Projekte' : 'Projects'} · ${formatEUR(totalBudget, true)} ${lang === 'de' ? 'Gesamtbudget' : 'Total Budget'}`}
        badge="Development"
        actions={
          <button className="btn-glass px-4 py-2 rounded-xl text-sm flex items-center gap-2">
            <Plus size={14} /> {t('dev.newProject')}
          </button>
        }
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KPICard label="Total Projects" value={`${developments.length}`} status="neutral" />
        <KPICard label="Total Budget" value={formatEUR(totalBudget, true)} status="neutral" />
        <KPICard label="Spent to Date" value={formatEUR(totalSpent, true)} status="neutral" sub={formatPct((totalSpent / totalBudget) * 100, 1) + (lang === 'de' ? ' des Budgets' : ' of Budget')} />
        <KPICard label="Active Projects" value={`${developments.filter(d => d.status === 'Bau').length}`} status="good" />
      </div>

      <div className="grid grid-cols-3 gap-5">
        {developments.map(dev => {
          const totalContract = dev.gewerke.reduce((s, g) => s + (g.contractAmount || 0), 0);
          const budgetUsage = dev.totalBudget > 0 ? (totalContract / dev.totalBudget) * 100 : 0;
          return (
            <Link key={dev.id} to={`/developments/${dev.id}`} style={{ textDecoration: 'none' }}>
              <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <TitleImageDisplay entityId={dev.id} height={150} />
                <div style={{ padding: 20 }}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1c1c1e', margin: 0 }}>{dev.name}</h3>
                      <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.50)', marginTop: 2 }}>{dev.city} · {dev.developmentType}</div>
                    </div>
                    <CompletenessRing score={dev.completenessScore} size={38} />
                  </div>
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span style={{ background: `rgba(${DEV_STATUS_COLOR[dev.status] === '#34c759' ? '52,199,89' : '0,122,255'},0.10)`, color: DEV_STATUS_COLOR[dev.status], border: `1px solid ${DEV_STATUS_COLOR[dev.status]}30`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                      {dev.status}
                    </span>
                    <span className="badge-neutral">{dev.usageType}</span>
                    {dev.holdSellDecision !== 'Offen' && (
                      <span className={dev.holdSellDecision === 'Hold' ? 'badge-success' : 'badge-info'}>{dev.holdSellDecision}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Budget</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#1c1c1e' }}>{formatEUR(dev.totalBudget, true)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Vergaben</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: budgetUsage > 90 ? '#cc1a14' : budgetUsage > 70 ? '#b25000' : '#1a7f37' }}>{formatEUR(totalContract, true)}</div>
                    </div>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${Math.min(budgetUsage, 100)}%`, background: budgetUsage > 90 ? '#ff3b30' : budgetUsage > 70 ? '#ff9500' : '#007aff' }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginTop: 6 }}>
                    {budgetUsage.toFixed(1)}% vergeben · Ende: {new Date(dev.plannedEndDate).toLocaleDateString(dateLocale)}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Development Detail ─────────────────────────────────────────────────────
export function DevelopmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { developments, deleteDevelopment, transferDevToBestand, transferDevToSale, settings } = useStore();
  const { t, lang } = useLanguage();
  const de = lang === 'de';
  const dateLocale = useDateLocale();
  const dev = developments.find(d => d.id === id);
  const [activeTab, setActiveTab] = useState('overview');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showHoldSellModal, setShowHoldSellModal] = useState<'Hold' | 'Sell' | null>(null);

  if (!dev) return <div className="p-8"><Link to="/developments" style={{ color: '#007aff' }}>{t('common.back')}</Link></div>;

  const totalBudget = dev.gewerke.reduce((s, g) => s + g.underwritingBudget, 0);
  const totalOffer = dev.gewerke.reduce((s, g) => s + (g.offerAmount || 0), 0);
  const totalContract = dev.gewerke.reduce((s, g) => s + (g.contractAmount || 0), 0);
  const totalActual = dev.gewerke.reduce((s, g) => s + (g.actualCost || 0), 0);
  const totalCost = dev.purchasePrice + totalBudget;

  const analysis = dev.underwritingCashFlows && dev.projectedSalePrice
    ? analyzeHoldSell({
        purchasePrice: dev.purchasePrice,
        totalDevelopmentCost: totalBudget,
        annualCashFlows: dev.underwritingCashFlows,
        projectedSalePrice: dev.projectedSalePrice,
        hurrleRate: settings.hurrleRate,
        taxRate: settings.taxRate,
        exitMultiplier: settings.defaultExitMultiplier,
        developmentStartDate: dev.startDate,
        developmentEndDate: dev.actualEndDate || dev.plannedEndDate,
      })
    : null;

  // Gantt data
  const ganttMonths = Array.from({ length: 24 }, (_, i) => {
    const d = new Date(2024, 5 + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const handleHoldSellConfirm = (decision: 'Hold' | 'Sell') => {
    if (decision === 'Hold') transferDevToBestand(dev.id);
    else transferDevToSale(dev.id);
    setShowHoldSellModal(null);
    navigate('/developments');
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-5">
        <Link to="/developments" style={{ color: 'rgba(60,60,67,0.55)', fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          <ArrowLeft size={13} /> Developments
        </Link>
        <ChevronRight size={13} color="rgba(60,60,67,0.35)" />
        <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.70)' }}>{dev.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <CompletenessRing score={dev.completenessScore} size={52} />
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.04em', color: '#1c1c1e', margin: 0 }}>{dev.name}</h1>
            <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.55)', marginTop: 4 }}>{dev.address}, {dev.city} · {dev.developmentType}</div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span style={{ background: 'rgba(52,199,89,0.10)', color: DEV_STATUS_COLOR[dev.status], border: `1px solid ${DEV_STATUS_COLOR[dev.status]}30`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{dev.status}</span>
              <span className="badge-neutral">{dev.usageType}</span>
              <span style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)' }}>Fertig: {new Date(dev.plannedEndDate).toLocaleDateString(dateLocale)}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-glass px-4 py-2 rounded-xl text-sm flex items-center gap-2"><Download size={14} /> Export</button>
          <button onClick={() => setShowHoldSellModal('Hold')} className="btn-glass px-4 py-2 rounded-xl text-sm flex items-center gap-2" style={{ color: '#1a7f37', borderColor: 'rgba(52,199,89,0.3)' }}>
            <CheckCircle size={14} /> Hold → Bestand
          </button>
          <button onClick={() => setShowHoldSellModal('Sell')} className="btn-accent px-4 py-2 rounded-xl text-sm flex items-center gap-2">
            <TrendingUp size={14} /> Sell → Sales
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="btn-glass px-3 py-2 rounded-xl text-sm flex items-center gap-2"
            style={{ color: '#ff3b30', borderColor: 'rgba(255,59,48,0.2)' }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <KPICard label="Purchase Price" value={formatEUR(dev.purchasePrice, true)} status="neutral" />
        <KPICard label="Total Construction Budget" value={formatEUR(totalBudget, true)} status="neutral" />
        <KPICard label="Contracts" value={formatEUR(totalContract, true)} sub={formatPct((totalContract / totalBudget) * 100, 1) + (de ? ' des Budgets' : ' of budget')} status={totalContract > totalBudget ? 'danger' : 'good'} />
        <KPICard label="Payments" value={formatEUR(totalActual, true)} status="neutral" />
        <KPICard label="Proj. Sale Price" value={formatEUR(dev.projectedSalePrice || 0, true)} status={analysis ? (analysis.recommendation === 'Sell' ? 'good' : 'neutral') : 'neutral'} />
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <Tabs
          tabs={[
            { key: 'overview', label: de ? 'Übersicht' : 'Overview' },
            { key: 'rentroll', label: 'Rent Roll', count: (dev.units || []).length },
            { key: 'budget', label: de ? 'Kosten & Budget' : 'Costs & Budget', count: dev.gewerke.length },
            { key: 'gantt', label: 'Gantt' },
            { key: 'debt', label: 'Debt' },
            { key: 'valuation', label: 'Valuation' },
            { key: 'advisor', label: 'Construction Advisor' },
            { key: 'holdsell', label: 'Hold / Sell' },
            { key: 'cashflow', label: 'Cash Flow / IRR' },
            { key: 'images', label: de ? 'Bilder' : 'Images' },
            { key: 'documents', label: de ? 'Dokumente' : 'Documents', count: dev.documents.length },
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {/* ── OVERVIEW ── */}
      {activeTab === 'overview' && <OverviewTab dev={dev} totalBudget={totalBudget} totalOffer={totalOffer} totalContract={totalContract} totalActual={totalActual} totalCost={totalCost} />}

      {/* ── MIETERLISTE (RENT ROLL) ── */}
      {activeTab === 'rentroll' && <RentRollTab dev={dev} />}

      {/* ── BUDGET ── */}
      {activeTab === 'budget' && <BudgetTab dev={dev} totalBudget={totalBudget} totalOffer={totalOffer} totalContract={totalContract} />}

      {/* ── GANTT ── */}
      {activeTab === 'gantt' && <GanttTab dev={dev} ganttMonths={ganttMonths} />}

      {/* ── DEBT ── */}
      {activeTab === 'debt' && <DebtTab dev={dev} totalBudget={totalBudget} />}

      {/* ── VALUATION ── */}
      {activeTab === 'valuation' && <ValuationTab dev={dev} totalBudget={totalBudget} />}

      {/* ── CONSTRUCTION ADVISOR ── */}
      {activeTab === 'advisor' && <AdvisorTab dev={dev} />}

      {/* ── HOLD / SELL ── */}
      {activeTab === 'holdsell' && <HoldSellTab dev={dev} analysis={analysis} setShowHoldSellModal={setShowHoldSellModal} />}

      {/* ── CASH FLOW / IRR ── */}
      {activeTab === 'cashflow' && <CashFlowTab dev={dev} />}

      {/* ── IMAGES ── */}
      {activeTab === 'images' && (
        <GlassPanel style={{ padding: 24 }} className="animate-fade-in">
          <SectionHeader title="Images" />
          <ImageManager entityId={dev.id} entityType="Development" />
        </GlassPanel>
      )}

      {/* ── DOCUMENTS ── */}
      {activeTab === 'documents' && <DocumentsTab dev={dev} />}

      {/* Hold/Sell Confirmation Modal */}
      {showHoldSellModal && (
        <Modal
          title={showHoldSellModal === 'Hold' ? (de ? 'In Bestand überführen' : 'Transfer to Assets') : (de ? 'In Sales überführen' : 'Transfer to Sales')}
          onClose={() => setShowHoldSellModal(null)}
          actions={
            <>
              <button onClick={() => setShowHoldSellModal(null)} className="btn-glass px-4 py-2 rounded-xl text-sm">{de ? 'Abbrechen' : 'Cancel'}</button>
              <button onClick={() => handleHoldSellConfirm(showHoldSellModal)} className={`${showHoldSellModal === 'Hold' ? 'btn-glass' : 'btn-accent'} px-5 py-2 rounded-xl text-sm`} style={showHoldSellModal === 'Hold' ? { color: '#1a7f37', borderColor: 'rgba(52,199,89,0.3)' } : {}}>
                {de ? `Bestätigen & ${showHoldSellModal === 'Hold' ? 'in Bestand' : 'in Sales'} überführen` : `Confirm & transfer to ${showHoldSellModal === 'Hold' ? 'Assets' : 'Sales'}`}
              </button>
            </>
          }
        >
          <div style={{ fontSize: 14, color: 'rgba(60,60,67,0.70)', lineHeight: 1.7 }}>
            <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(0,122,255,0.06)', border: '1px solid rgba(0,122,255,0.12)' }}>
              {de
                ? <><strong style={{ color: '#007aff' }}>{dev.name}</strong> wird {showHoldSellModal === 'Hold' ? 'als neues Asset in den Bestand' : 'in die Sales-Pipeline'} überführt.</>
                : <><strong style={{ color: '#007aff' }}>{dev.name}</strong> will be transferred {showHoldSellModal === 'Hold' ? 'as a new asset to Assets' : 'to the Sales pipeline'}.</>}
            </div>
            {analysis && (
              <div>IRR (Hold): <strong>{analysis.holdIRR.toFixed(1)}%</strong> · {de ? 'Nettogewinn' : 'Net Profit'} (Sell): <strong>{formatEUR(analysis.sellNetProfit)}</strong></div>
            )}
            <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.40)', marginTop: 12 }}>{de ? 'Diese Aktion erstellt einen Audit-Log-Eintrag und kann nicht rückgängig gemacht werden.' : 'This action creates an audit-log entry and cannot be undone.'}</div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 20, padding: 28, maxWidth: 420, width: '90%', boxShadow: '0 24px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1c1c1e', marginBottom: 12 }}>{de ? 'Projekt löschen' : 'Delete Project'}</div>
            <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.15)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#ff3b30', marginBottom: 6 }}>{de ? 'Wirklich löschen?' : 'Really delete?'}</div>
              <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.70)' }}>
                {de
                  ? <><strong>{dev.name}</strong> wird unwiderruflich aus dem Development-Portfolio entfernt. Alle Gewerke, Aktivitäten und Dokumente gehen verloren.</>
                  : <><strong>{dev.name}</strong> will be permanently removed from the development portfolio. All trades, activities and documents will be lost.</>}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteModal(false)} className="btn-glass px-4 py-2 rounded-xl text-sm">{de ? 'Abbrechen' : 'Cancel'}</button>
              <button
                onClick={() => { deleteDevelopment(dev.id); navigate('/developments'); }}
                style={{ background: 'rgba(255,59,48,0.12)', color: '#ff3b30', border: '1px solid rgba(255,59,48,0.2)', borderRadius: 12, padding: '8px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Trash2 size={14} /> {de ? 'Endgültig löschen' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
