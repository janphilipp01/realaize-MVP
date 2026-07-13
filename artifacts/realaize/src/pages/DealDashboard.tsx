import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, AlertTriangle, Download, Edit3, ChevronRight, Trash2, HardHat } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { FormulaDrawer, StageBadge, Modal, Tabs, CompletenessRing } from '@/components/shared';
import { computeDealKPIs, getKPIFormulaDetails } from '@/utils/kpiEngine';
import { screenValueAdd, lookupMarketAssumptions, resolveExitYieldBuffer } from '@/utils/valueAddScreening';

import { exportInvestmentMemoPDF, exportDealExcel } from '@/utils/exportUtils';

import { useLanguage } from '@/i18n/LanguageContext';
import { AcquisitionWizard } from '@/pages/AcquisitionWizard';
import type { KPIFormulaDetail, PropertyData } from '@/models/types';
import { createDefaultPropertyData } from '@/models/types';
import { OverviewTab } from '@/components/deal-dashboard/OverviewTab';
import { UnderwritingTab } from '@/components/deal-dashboard/UnderwritingTab';
import { CashFlowTab } from '@/components/deal-dashboard/CashFlowTab';
import { FinancingTab } from '@/components/deal-dashboard/FinancingTab';
import { AiTab } from '@/components/deal-dashboard/AiTab';
import { DocumentsTab } from '@/components/deal-dashboard/DocumentsTab';
import { IcMemoTab } from '@/components/deal-dashboard/IcMemoTab';
import { ActivityTab } from '@/components/deal-dashboard/ActivityTab';
import { ImagesTab } from '@/components/deal-dashboard/ImagesTab';

export default function DealDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { deals, updateDeal, deleteDeal, transferToBestand, transferToDevelopment, addAuditEntry, updateDealPropertyData } = useStore();
  const benchmarks = useStore(s => s.benchmarks);
  const targetNIY = useStore(s => s.settings.targetNIY);
  const { t, lang } = useLanguage();
  const de = lang === 'de';
  const deal = deals.find(d => d.id === id);

  const [activeTab, setActiveTab] = useState('overview');
  const [formulaDetail, setFormulaDetail] = useState<KPIFormulaDetail | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDevModal, setShowDevModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showWizardEdit, setShowWizardEdit] = useState(false);

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
              {(() => {
                const area = deal.underwritingAssumptions.area || deal.totalArea || 0;
                const price = deal.underwritingAssumptions.purchasePrice || deal.askingPrice || 0;
                const m = lookupMarketAssumptions(benchmarks, deal.city, deal.usageType, deal.submarket);
                if (!m.marketRent || area <= 0 || price <= 0) return null;
                const r = screenValueAdd({ area, purchasePrice: price, marketRent: m.marketRent, marketNIY: m.marketNIY ?? targetNIY, scope: 'sanierung', profile: { exitYieldBufferPct: resolveExitYieldBuffer(deal.city, deal.submarket) } });
                return (
                  <span title={lang === 'de' ? 'Value-Add Screening (Profil, Scope: Sanierung) — Detail im Underwriting → Market' : 'Value-add screening (profile, scope: refurbishment)'}
                    className="flex items-center gap-1" style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                      background: r.pass ? 'rgba(22,163,74,0.10)' : 'rgba(220,38,38,0.09)', color: r.pass ? '#16a34a' : '#dc2626' }}>
                    {r.pass ? '✓' : '✗'} Value-Add {r.marginPct.toFixed(0)}%
                  </span>
                );
              })()}
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
            title={de ? 'Deal löschen' : 'Delete deal'}
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
      {activeTab === 'overview' && <OverviewTab deal={deal} kpis={kpis} handleShowFormula={handleShowFormula} />}

      {/* ── UNDERWRITING TAB ── */}
      {activeTab === 'underwriting' && <UnderwritingTab deal={deal} />}

      {/* ── CASHFLOW / IRR TAB ── */}
      {activeTab === 'cashflow' && <CashFlowTab deal={deal} />}

      {/* ── FINANCING TAB ── */}
      {activeTab === 'financing' && <FinancingTab deal={deal} />}

      {/* ── AI RESEARCHER TAB ── */}
      {activeTab === 'ai' && <AiTab deal={deal} />}

      {/* ── DOCUMENTS TAB ── */}
      {activeTab === 'documents' && <DocumentsTab deal={deal} />}

      {/* ── IC MEMO TAB ── */}
      {activeTab === 'icmemo' && <IcMemoTab deal={deal} />}

      {/* ── ACTIVITY TAB ── */}
      {activeTab === 'activity' && <ActivityTab deal={deal} />}

      {/* Images Tab */}
      {activeTab === 'images' && <ImagesTab deal={deal} />}

      {/* Formula Drawer */}
      <FormulaDrawer detail={formulaDetail} onClose={() => setFormulaDetail(null)} />

      {/* Development Modal */}
      {showDevModal && deal && (
        <Modal
          title={de ? 'In Development überführen' : 'Transfer to Development'}
          onClose={() => setShowDevModal(false)}
          actions={
            <>
              <button onClick={() => setShowDevModal(false)} className="btn-glass px-4 py-2 rounded-xl text-sm">{de ? 'Abbrechen' : 'Cancel'}</button>
              <button
                onClick={() => { transferToDevelopment(deal.id); setShowDevModal(false); navigate('/developments'); }}
                className="btn-accent px-5 py-2 rounded-xl text-sm"
                style={{ background: 'linear-gradient(135deg, #ff9500, #b25000)' }}
              >
                {de ? 'Bestätigen & überführen' : 'Confirm & transfer'}
              </button>
            </>
          }
        >
          <div style={{ fontSize: 14, color: 'rgba(60,60,67,0.70)', lineHeight: 1.7 }}>
            <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(255,149,0,0.07)', border: '1px solid rgba(255,149,0,0.18)' }}>
              {de
                ? <><strong style={{ color: '#b25000' }}>{deal.name}</strong> wird in das Development-Modul überführt.</>
                : <><strong style={{ color: '#b25000' }}>{deal.name}</strong> will be transferred to the Development module.</>}
            </div>
            <ul style={{ paddingLeft: 16, lineHeight: 2 }}>
              {de ? (
                <>
                  <li>Underwriting-Daten werden übernommen</li>
                  <li>Dokumente bleiben erhalten</li>
                  <li>Deal verschwindet aus der Acquisition-Pipeline</li>
                  <li>Construction Advisor steht im Development bereit</li>
                </>
              ) : (
                <>
                  <li>Underwriting data is carried over</li>
                  <li>Documents are retained</li>
                  <li>Deal is removed from the Acquisition pipeline</li>
                  <li>Construction Advisor becomes available in Development</li>
                </>
              )}
            </ul>
          </div>
        </Modal>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <Modal
          title={de ? 'In Bestand überführen' : 'Transfer to Assets'}
          onClose={() => setShowTransferModal(false)}
          actions={
            <>
              <button onClick={() => setShowTransferModal(false)} className="btn-glass px-4 py-2 rounded-xl text-sm">{de ? 'Abbrechen' : 'Cancel'}</button>
              <button onClick={handleTransfer} className="btn-accent px-5 py-2 rounded-xl text-sm">{de ? 'Bestätigen & überführen' : 'Confirm & transfer'}</button>
            </>
          }
        >
          <div style={{ fontSize: 14, color: 'rgba(60,60,67,0.70)', lineHeight: 1.7 }}>
            <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(0,122,255,0.06)', border: '1px solid rgba(0,122,255,0.18)' }}>
              {de
                ? <><strong style={{ color: '#007aff' }}>{deal.name}</strong> wird aus der Acquisition-Pipeline in den Asset-Bestand überführt.</>
                : <><strong style={{ color: '#007aff' }}>{deal.name}</strong> will be transferred from the Acquisition pipeline into Assets.</>}
            </div>
            <p>{de ? 'Diese Aktion:' : 'This action:'}</p>
            <ul style={{ paddingLeft: 16, lineHeight: 2 }}>
              {de ? (
                <>
                  <li>Erstellt einen neuen Asset-Eintrag im Bestand</li>
                  <li>Überträgt alle Dokumente und Underwriting-Daten</li>
                  <li>Entfernt den Deal aus der Acquisition-Pipeline</li>
                  <li>Erstellt einen Audit-Log-Eintrag</li>
                </>
              ) : (
                <>
                  <li>Creates a new asset entry in Assets</li>
                  <li>Transfers all documents and underwriting data</li>
                  <li>Removes the deal from the Acquisition pipeline</li>
                  <li>Creates an audit-log entry</li>
                </>
              )}
            </ul>
            <p style={{ color: 'rgba(60,60,67,0.45)', fontSize: 13 }}>{de ? 'Diese Aktion kann nicht rückgängig gemacht werden.' : 'This action cannot be undone.'}</p>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <Modal
          title={de ? 'Deal löschen' : 'Delete Deal'}
          onClose={() => setShowDeleteModal(false)}
          actions={
            <>
              <button onClick={() => setShowDeleteModal(false)} className="btn-glass px-4 py-2 rounded-xl text-sm">{de ? 'Abbrechen' : 'Cancel'}</button>
              <button
                onClick={() => { deleteDeal(deal.id); navigate('/acquisition'); }}
                style={{ background: '#ff3b30', color: '#fff', border: 'none', borderRadius: 12, padding: '8px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                {de ? 'Endgültig löschen' : 'Delete permanently'}
              </button>
            </>
          }
        >
          <div style={{ fontSize: 14, color: 'rgba(60,60,67,0.70)', lineHeight: 1.7 }}>
            <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.2)' }}>
              {de
                ? <><strong style={{ color: '#ff3b30' }}>{deal.name}</strong> wird dauerhaft aus der Acquisition-Pipeline gelöscht.</>
                : <><strong style={{ color: '#ff3b30' }}>{deal.name}</strong> will be permanently deleted from the Acquisition pipeline.</>}
            </div>
            <p style={{ color: 'rgba(60,60,67,0.45)', fontSize: 13 }}>{de ? 'Diese Aktion kann nicht rückgängig gemacht werden.' : 'This action cannot be undone.'}</p>
          </div>
        </Modal>
      )}

      {/* AcquisitionWizard Edit */}
      {showWizardEdit && (
        <AcquisitionWizard
          initialData={deal.propertyData || createDefaultPropertyData({
            name: deal.name, address: deal.address, city: deal.city, zip: deal.zip,
            submarket: deal.submarket,
            usageType: deal.usageType, dealType: deal.dealType || 'Investment',
            purchasePrice: deal.underwritingAssumptions.purchasePrice,
            vendor: deal.vendorName || '', broker: deal.broker || '',
          })}
          onSave={(pd: PropertyData) => {
            updateDealPropertyData(deal.id, pd);
            updateDeal(deal.id, {
              name: pd.name || deal.name,
              submarket: pd.submarket ?? deal.submarket,
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
