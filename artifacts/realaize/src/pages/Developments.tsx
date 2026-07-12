import React, { useState, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, Plus, Edit3, Save, X, AlertTriangle,
  CheckCircle, Bot, Download, Upload, Trash2, Building2, Calendar,
  TrendingUp, BarChart3, FileText
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { useStore } from '@/store/useStore';
import {
  GlassPanel, PageHeader, KPICard, SectionHeader, StatusBadge,
  CompletenessRing, Modal, Tabs
} from '@/components/shared';
import ImageManager, { TitleImageDisplay } from '@/components/ImageManager';
import { formatEUR, formatPct } from '@/utils/kpiEngine';
import { analyzeHoldSell } from '@/utils/irrCalculator';
import { computeDealCashFlow } from '@/utils/propertyCashFlowModel';
import { useLanguage } from '@/i18n/LanguageContext';
import { useListContacts } from '@workspace/api-client-react';
import type { GeverkPosition, GeverkCategory, ActivityEntry, Unit, UsageType, DevDebtAssumptions, DevValuationAssumptions } from '@/models/types';

const GEWERK_CATEGORIES: GeverkCategory[] = [
  'Abbruch & Entsorgung', 'Rohbau', 'Dach & Abdichtung', 'Fassade & Außenanlagen',
  'Fenster & Türen', 'Innenausbau', 'TGA – Heizung', 'TGA – Sanitär',
  'TGA – Elektro', 'TGA – Lüftung', 'Aufzug', 'Außenanlagen & Tiefbau',
  'Planung & Architektur', 'Genehmigungen & Gebühren', 'Reserve / Unvorhergesehenes', 'Sonstiges',
];

const STATUS_COLORS: Record<string, string> = {
  'Offen': 'badge-neutral', 'Ausgeschrieben': 'badge-info',
  'Angebot': 'badge-warning', 'Vergeben': 'badge-accent', 'Abgeschlossen': 'badge-success',
};

const DEV_STATUS_COLOR: Record<string, string> = {
  'Planung': '#007aff', 'Genehmigung': '#af52de', 'Ausschreibung': '#ff9500',
  'Bau': '#34c759', 'Abnahme': '#5ac8fa', 'Fertiggestellt': '#1a7f37',
};

// ─── Developments List ──────────────────────────────────────────────────────
export function DevelopmentsPage() {
  const { developments } = useStore();
  const { t, lang } = useLanguage();
  const dateLocale = lang === 'de' ? 'de-DE' : 'en-GB';

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
          const totalActual = dev.gewerke.reduce((s, g) => s + (g.actualCost || 0), 0);
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
  const { developments, updateDevelopment, deleteDevelopment, updateGewerk, addGewerk, deleteGewerk, addActivityToDevelopment, addDevUnit, updateDevUnit, deleteDevUnit, transferDevToBestand, transferDevToSale, settings, addOffer, updateOffer, deleteOffer, addInvoice, updateInvoice, deleteInvoice, updateDevelopmentPropertyData } = useStore();
  const { data: contacts = [] } = useListContacts();
  const { t, lang } = useLanguage();
  const dateLocale = lang === 'de' ? 'de-DE' : 'en-GB';
  const dev = developments.find(d => d.id === id);
  const [activeTab, setActiveTab] = useState('overview');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showHoldSellModal, setShowHoldSellModal] = useState<'Hold' | 'Sell' | null>(null);
  const [showAddUnitModal, setShowAddUnitModal] = useState(false);
  const [newUnit, setNewUnit] = useState<Partial<Unit>>({ leaseType: 'Leerstand', usageType: 'Wohnen', floor: 0 });
  const [advisorInput, setAdvisorInput] = useState('');
  const [advisorMessages, setAdvisorMessages] = useState(dev?.advisorMessages || []);
  const [editingGw, setEditingGw] = useState<string | null>(null);
  const [gwEdits, setGwEdits] = useState<Partial<GeverkPosition>>({});
  const [colWidths, setColWidths] = useState<number[]>([16, 9, 9, 11, 11, 11, 11, 8, 10]);
  const budgetTableRef = useRef<HTMLTableElement>(null);
  const resizingCol = useRef<{ idx: number; startX: number; startW: number; nextStartW: number } | null>(null);

  const handleColResizeMouseDown = (idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    const tableEl = budgetTableRef.current;
    if (!tableEl) return;
    const tableW = tableEl.getBoundingClientRect().width;
    resizingCol.current = {
      idx,
      startX: e.clientX,
      startW: colWidths[idx] / 100 * tableW,
      nextStartW: (colWidths[idx + 1] ?? 0) / 100 * tableW,
    };
    const onMove = (ev: MouseEvent) => {
      if (!resizingCol.current) return;
      const { idx, startX, startW, nextStartW } = resizingCol.current;
      const delta = ev.clientX - startX;
      const newW = Math.max(40, startW + delta);
      const newNext = Math.max(40, nextStartW - delta);
      const tW = budgetTableRef.current!.getBoundingClientRect().width;
      setColWidths(prev => {
        const next = [...prev];
        next[idx] = (newW / tW) * 100;
        if (idx + 1 < next.length) next[idx + 1] = (newNext / tW) * 100;
        return next;
      });
    };
    const onUp = () => {
      resizingCol.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };
  const [editingGanttGw, setEditingGanttGw] = useState<string | null>(null);
  const [ganttGwEdits, setGanttGwEdits] = useState<{ ganttStart?: string; ganttDurationMonths?: number }>({});
  const [debtForm, setDebtForm] = useState<DevDebtAssumptions>(dev?.debtAssumptions || { ltvPct: 60, ltcPct: 70, interestRatePct: 4.5, loanType: 'Bullet', annuityTermYears: 15 });
  const [valuationForm, setValuationForm] = useState<DevValuationAssumptions>(dev?.valuationAssumptions || { opexPct: 15, exitYieldPct: 5.0, purchasingCostsPct: 10 });

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
  const now = new Date();
  const ganttMonths = Array.from({ length: 24 }, (_, i) => {
    const d = new Date(2024, 5 + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Construction Advisor response
  const ADVISOR_RESPONSES: Record<string, string> = {
    default: 'Für dieses Development empfehle ich folgende Budgetpositionen basierend auf aktuellen Marktbenchmarks (DACH, Q1/2025): Rohbau 140–165 €/m², TGA komplett 180–220 €/m², Innenausbau 110–140 €/m². Soll ich konkrete Positionen für Ihr Projekt vorschlagen?',
    neubau: 'Bei einem Neubau kalkulieren Sie bitte: GU-Pauschalangebot 1.600–2.200 €/m² BGF (einfacher Standard) bis 2.800–3.500 €/m² (gehoben). Wichtig: Erschließungskosten, Anschlussgebühren und Außenanlagen separat budgetieren (ca. 80–150 €/m² GF).',
    sanierung: 'Kernsanierung Richtwerte: Entkernung 30–60 €/m², TGA-Erneuerung 200–280 €/m², Fassade 180–320 €/m² (je nach Denkmalschutz), Fenster 350–600 €/Stk. Empfehle Reserve von 15–20% bei Bestandsgebäuden.',
    tga: 'TGA-Benchmarks: Heizung (Wärmepumpe inkl. FBH) 85–120 €/m², Sanitär 65–90 €/m², Elektro 55–80 €/m², Lüftung 45–70 €/m². Gesamte TGA bei Sanierung: 250–360 €/m².',
  };

  const getAdvisorResponse = (input: string) => {
    const l = input.toLowerCase();
    if (l.includes('neubau') || l.includes('neu bauen')) return ADVISOR_RESPONSES.neubau;
    if (l.includes('sanierung') || l.includes('kernsanierung') || l.includes('sanieren')) return ADVISOR_RESPONSES.sanierung;
    if (l.includes('tga') || l.includes('heizung') || l.includes('elektro') || l.includes('sanitär')) return ADVISOR_RESPONSES.tga;
    return ADVISOR_RESPONSES.default;
  };

  const handleAdvisorSend = () => {
    if (!advisorInput.trim()) return;
    const userMsg = { id: `adv-${Date.now()}-u`, role: 'user' as const, content: advisorInput, timestamp: new Date().toISOString() };
    const advMsg = { id: `adv-${Date.now()}-a`, role: 'advisor' as const, content: getAdvisorResponse(advisorInput), timestamp: new Date().toISOString() };
    const updated = [...advisorMessages, userMsg, advMsg];
    setAdvisorMessages(updated);
    updateDevelopment(dev.id, { advisorMessages: updated });
    setAdvisorInput('');
  };

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
        <KPICard label="Kaufpreis" value={formatEUR(dev.purchasePrice, true)} status="neutral" />
        <KPICard label="Gesamtbudget Bau" value={formatEUR(totalBudget, true)} status="neutral" />
        <KPICard label="Vergaben" value={formatEUR(totalContract, true)} sub={formatPct((totalContract / totalBudget) * 100, 1) + ' des Budgets'} status={totalContract > totalBudget ? 'danger' : 'good'} />
        <KPICard label="Zahlungen" value={formatEUR(totalActual, true)} status="neutral" />
        <KPICard label="Proj. Verkaufspreis" value={formatEUR(dev.projectedSalePrice || 0, true)} status={analysis ? (analysis.recommendation === 'Sell' ? 'good' : 'neutral') : 'neutral'} />
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <Tabs
          tabs={[
            { key: 'overview', label: 'Übersicht' },
            { key: 'rentroll', label: 'Rent Roll', count: (dev.units || []).length },
            { key: 'budget', label: 'Kosten & Budget', count: dev.gewerke.length },
            { key: 'gantt', label: 'Gantt' },
            { key: 'debt', label: 'Debt' },
            { key: 'valuation', label: 'Valuation' },
            { key: 'advisor', label: 'Construction Advisor' },
            { key: 'holdsell', label: 'Hold / Sell' },
            { key: 'cashflow', label: 'Cash Flow / IRR' },
            { key: 'images', label: 'Bilder' },
            { key: 'documents', label: 'Dokumente', count: dev.documents.length },
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {/* ── OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-2 gap-6 animate-fade-in">
          <GlassPanel style={{ padding: 24 }}>
            <SectionHeader title="Budget-Übersicht" />
            <div className="space-y-3">
              {[
                { label: 'Underwriting-Budget', value: totalBudget, color: '#1c1c1e' },
                { label: 'Angebote gesamt', value: totalOffer, color: totalOffer > totalBudget ? '#cc1a14' : '#1c1c1e' },
                { label: 'Vergaben gesamt', value: totalContract, color: totalContract > totalBudget ? '#cc1a14' : '#1a7f37' },
                { label: 'Zahlungen', value: totalActual, color: '#1c1c1e' },
                { label: 'Gesamtinvestition (inkl. Kauf)', value: totalCost, color: '#007aff', bold: true },
              ].map(row => (
                <div key={row.label} className="flex justify-between py-2 px-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                  <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.65)' }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: row.bold ? 700 : 600, color: row.color, fontFamily: 'ui-monospace, monospace' }}>{formatEUR(row.value)}</span>
                </div>
              ))}
            </div>
          </GlassPanel>
          <GlassPanel style={{ padding: 24 }}>
            <SectionHeader title="Budget nach Gewerk" />
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dev.gewerke.map(g => ({ name: g.category.split(' ')[0], Budget: Math.round(g.underwritingBudget / 1000), Vergabe: Math.round((g.contractAmount || 0) / 1000) }))}>
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'rgba(60,60,67,0.45)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'rgba(60,60,67,0.45)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}k`} />
                <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(0,0,0,0.10)', borderRadius: 10, fontSize: 11 }} />
                <Bar dataKey="Budget" fill="rgba(0,122,255,0.25)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Vergabe" fill="#007aff" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </GlassPanel>
        </div>
      )}

      {/* ── MIETERLISTE (RENT ROLL) ── */}
      {activeTab === 'rentroll' && (
        <div className="animate-fade-in space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <SectionHeader title="Rent Roll" />
              <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.50)', marginTop: 2 }}>
                {(dev.units || []).length === 0 ? 'Noch keine Einheiten erfasst.' : `${(dev.units || []).length} Einheiten · ${formatEUR((dev.units || []).reduce((s, u) => s + u.monthlyRent, 0) * 12, true)} p.a.`}
                {' '}· Wird bei "Hold → Bestand" 1:1 übernommen.
              </div>
            </div>
            <button onClick={() => setShowAddUnitModal(true)} className="btn-glass px-4 py-2 rounded-xl text-sm flex items-center gap-2">
              <Plus size={14} /> Einheit hinzufügen
            </button>
          </div>

          {/* Summary KPIs */}
          {(dev.units || []).length > 0 && (() => {
            const units = dev.units || [];
            const totalArea = units.reduce((s, u) => s + u.area, 0);
            const occupiedArea = units.filter(u => u.leaseType === 'Vermietet').reduce((s, u) => s + u.area, 0);
            const monthlyRent = units.reduce((s, u) => s + u.monthlyRent, 0);
            const annualRent = monthlyRent * 12;
            const avgRentPerSqm = totalArea > 0 ? monthlyRent / (occupiedArea || 1) : 0;
            return (
              <div className="grid grid-cols-4 gap-4">
                <KPICard label="Gesamtfläche" value={`${totalArea.toLocaleString(dateLocale)} m²`} status="neutral" />
                <KPICard label="Vermietungsquote" value={`${totalArea > 0 ? ((occupiedArea / totalArea) * 100).toFixed(1) : 0}%`} status={occupiedArea / totalArea > 0.9 ? 'good' : occupiedArea / totalArea > 0.7 ? 'warning' : 'danger'} />
                <KPICard label="Monatsmiete" value={formatEUR(monthlyRent, true)} status="neutral" />
                <KPICard label="Jahresnettomiete" value={formatEUR(annualRent, true)} status="neutral" sub={`Ø ${avgRentPerSqm.toFixed(2)} €/m²`} />
              </div>
            );
          })()}

          {(dev.units || []).length > 0 ? (
            <GlassPanel style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    {['Einheit', 'Etage', 'Fläche', 'Nutzung', 'Status', 'Mieter', '€/m²', 'Monatsmiete', 'Mietende', ''].map(h => (
                      <th key={h} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.45)', textAlign: 'left', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(dev.units || []).map(unit => (
                    <tr key={unit.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#1c1c1e' }}>{unit.unitNumber}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'rgba(60,60,67,0.70)' }}>{unit.floor > 0 ? `${unit.floor}. OG` : unit.floor < 0 ? 'UG' : 'EG'}</td>
                      <td style={{ padding: '12px 16px', fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>{unit.area} m²</td>
                      <td style={{ padding: '12px 16px' }}><span className="badge-neutral">{unit.usageType}</span></td>
                      <td style={{ padding: '12px 16px' }}><StatusBadge status={unit.leaseType === 'Vermietet' ? 'OK' : unit.leaseType === 'Leerstand' ? 'Breach' : 'Warning'} label={unit.leaseType} /></td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'rgba(60,60,67,0.70)' }}>{unit.tenant || '—'}</td>
                      <td style={{ padding: '12px 16px', fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>{unit.rentPerSqm > 0 ? `${unit.rentPerSqm.toFixed(2)} €` : '—'}</td>
                      <td style={{ padding: '12px 16px', fontFamily: 'ui-monospace, monospace', fontSize: 13, color: '#007aff', fontWeight: 600 }}>{unit.monthlyRent > 0 ? formatEUR(unit.monthlyRent) : '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'rgba(60,60,67,0.45)' }}>{unit.leaseEnd ? new Date(unit.leaseEnd).toLocaleDateString(dateLocale) : '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <button onClick={() => deleteDevUnit(dev.id, unit.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,59,48,0.6)' }}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'rgba(0,0,0,0.03)', borderTop: '2px solid rgba(0,0,0,0.07)' }}>
                    <td colSpan={7} style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'rgba(60,60,67,0.55)' }}>Gesamt</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 700, color: '#007aff' }}>{formatEUR((dev.units || []).reduce((s, u) => s + u.monthlyRent, 0))}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </GlassPanel>
          ) : (
            <GlassPanel style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ color: 'rgba(60,60,67,0.40)', fontSize: 13 }}>Noch keine Einheiten angelegt.</div>
              <button onClick={() => setShowAddUnitModal(true)} className="btn-glass px-4 py-2 rounded-xl text-sm mt-4 mx-auto flex items-center gap-2">
                <Plus size={14} /> Erste Einheit hinzufügen
              </button>
            </GlassPanel>
          )}

          {/* Add Unit Modal */}
          {showAddUnitModal && (
            <Modal title="Einheit hinzufügen" onClose={() => setShowAddUnitModal(false)}
              actions={
                <>
                  <button onClick={() => setShowAddUnitModal(false)} className="btn-glass px-4 py-2 rounded-xl text-sm">Abbrechen</button>
                  <button
                    onClick={() => {
                      if (!newUnit.unitNumber || !newUnit.area) return;
                      const unit: Unit = {
                        id: `unit-${Date.now()}`,
                        assetId: dev.id,
                        unitNumber: newUnit.unitNumber!,
                        floor: newUnit.floor || 0,
                        area: newUnit.area!,
                        usageType: (newUnit.usageType || 'Wohnen') as UsageType,
                        tenant: newUnit.tenant,
                        rentPerSqm: newUnit.rentPerSqm || 0,
                        monthlyRent: newUnit.monthlyRent || 0,
                        leaseStart: newUnit.leaseStart,
                        leaseEnd: newUnit.leaseEnd,
                        leaseType: newUnit.leaseType as 'Vermietet' | 'Leerstand' | 'Eigennutzung',
                      };
                      addDevUnit(dev.id, unit);
                      setNewUnit({ leaseType: 'Leerstand', usageType: 'Wohnen', floor: 0 });
                      setShowAddUnitModal(false);
                    }}
                    className="btn-accent px-5 py-2 rounded-xl text-sm"
                  >
                    Hinzufügen
                  </button>
                </>
              }
            >
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Einheitsnr. *</label>
                    <input className="input-glass" value={newUnit.unitNumber || ''} onChange={e => setNewUnit(p => ({ ...p, unitNumber: e.target.value }))} placeholder="z. B. WE 01" />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Etage</label>
                    <input type="number" className="input-glass" value={newUnit.floor ?? 0} onChange={e => setNewUnit(p => ({ ...p, floor: parseInt(e.target.value) || 0 }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fläche (m²) *</label>
                    <input type="number" className="input-glass" value={newUnit.area || ''} onChange={e => setNewUnit(p => ({ ...p, area: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Nutzung</label>
                    <select className="input-glass" value={newUnit.usageType} onChange={e => setNewUnit(p => ({ ...p, usageType: e.target.value as UsageType }))}>
                      {['Wohnen', 'Büro', 'Einzelhandel', 'Logistik', 'Mixed Use'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</label>
                    <select className="input-glass" value={newUnit.leaseType} onChange={e => setNewUnit(p => ({ ...p, leaseType: e.target.value as 'Vermietet' | 'Leerstand' | 'Eigennutzung' }))}>
                      {['Vermietet', 'Leerstand', 'Eigennutzung'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Mieter</label>
                    <input className="input-glass" value={newUnit.tenant || ''} onChange={e => setNewUnit(p => ({ ...p, tenant: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>€/m²</label>
                    <input type="number" className="input-glass" value={newUnit.rentPerSqm || ''} onChange={e => setNewUnit(p => ({ ...p, rentPerSqm: parseFloat(e.target.value) || 0, monthlyRent: (parseFloat(e.target.value) || 0) * (p.area || 0) }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Monatsmiete (€)</label>
                    <input type="number" className="input-glass" value={newUnit.monthlyRent || ''} onChange={e => setNewUnit(p => ({ ...p, monthlyRent: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Mietbeginn</label>
                    <input type="date" className="input-glass" value={newUnit.leaseStart || ''} onChange={e => setNewUnit(p => ({ ...p, leaseStart: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Mietende</label>
                    <input type="date" className="input-glass" value={newUnit.leaseEnd || ''} onChange={e => setNewUnit(p => ({ ...p, leaseEnd: e.target.value }))} />
                  </div>
                </div>
              </div>
            </Modal>
          )}
        </div>
      )}

      {/* ── BUDGET ── */}
      {activeTab === 'budget' && (
        <div className="animate-fade-in">
          <div className="flex justify-between mb-4">
            <SectionHeader title="Kosten nach Gewerk" />
            <button
              onClick={() => {
                const newGw: GeverkPosition = {
                  id: `gw-${Date.now()}`, developmentId: dev.id, category: 'Sonstiges',
                  description: 'Neue Position', unit: 'Pauschal', quantity: 1,
                  underwritingBudget: 0, status: 'Offen',
                };
                addGewerk(dev.id, newGw);
              }}
              className="btn-glass px-3 py-1.5 rounded-xl text-xs flex items-center gap-1"
            >
              <Plus size={12} /> Gewerk hinzufügen
            </button>
          </div>
          <GlassPanel style={{ overflow: 'hidden' }}>
            <table ref={budgetTableRef} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                {colWidths.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}
              </colgroup>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  {['Gewerk', 'Beschreibung', 'Underwriting', 'Angebot', 'Vergabe', 'Δ Budget', 'Status', 'Auftragnehmer', ''].map((h, i) => (
                    <th key={h} style={{ padding: '10px 10px', fontSize: 10, fontWeight: 700, color: 'rgba(60,60,67,0.45)', textAlign: 'left', letterSpacing: '0.04em', textTransform: 'uppercase', overflow: 'hidden', position: 'relative', userSelect: 'none' }}>
                      {h}
                      {i < 8 && (
                        <div
                          onMouseDown={(e) => handleColResizeMouseDown(i, e)}
                          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, cursor: 'col-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}
                        >
                          <div style={{ width: 2, height: '50%', background: 'rgba(0,0,0,0.10)', borderRadius: 1 }} />
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dev.gewerke.map(gw => {
                  const delta = (gw.contractAmount || gw.offerAmount || gw.underwritingBudget) - gw.underwritingBudget;
                  const contractor = contacts.find(c => c.id === gw.contractorId);
                  const isEditing = editingGw === gw.id;
                  return (
                    <tr key={gw.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <td style={{ padding: '8px 10px', overflow: 'hidden' }}>
                        {isEditing ? (
                          <select className="input-glass" style={{ fontSize: 11, padding: '3px 4px', width: '100%' }} value={gwEdits.category || gw.category} onChange={e => setGwEdits(p => ({ ...p, category: e.target.value as GeverkCategory }))}>
                            {GEWERK_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                          </select>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#1c1c1e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{gw.category}</span>
                        )}
                      </td>
                      <td style={{ padding: '8px 10px', overflow: 'hidden' }}>
                        {isEditing ? (
                          <input className="input-glass" style={{ fontSize: 11, padding: '3px 4px', width: '100%' }} value={gwEdits.description ?? gw.description} onChange={e => setGwEdits(p => ({ ...p, description: e.target.value }))} />
                        ) : (
                          <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.70)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{gw.description}</span>
                        )}
                      </td>
                      {['underwritingBudget', 'offerAmount', 'contractAmount'].map(key => (
                        <td key={key} style={{ padding: '8px 10px', overflow: 'hidden' }}>
                          {isEditing ? (
                            <input type="number" className="input-glass" style={{ fontSize: 11, padding: '3px 4px', width: '100%' }}
                              value={(gwEdits as any)[key] ?? (gw as any)[key] ?? ''}
                              onChange={e => setGwEdits(p => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
                            />
                          ) : (
                            <span style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', color: (gw as any)[key] ? '#1c1c1e' : 'rgba(60,60,67,0.30)' }}>
                              {(gw as any)[key] ? formatEUR((gw as any)[key], true) : '—'}
                            </span>
                          )}
                        </td>
                      ))}
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'ui-monospace, monospace', color: delta > 0 ? '#cc1a14' : delta < 0 ? '#1a7f37' : 'rgba(60,60,67,0.45)' }}>
                          {delta !== 0 ? `${delta > 0 ? '+' : ''}${formatEUR(delta, true)}` : '—'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        {isEditing ? (
                          <select className="input-glass" style={{ fontSize: 11, padding: '3px 4px', width: '100%' }} value={gwEdits.status || gw.status} onChange={e => setGwEdits(p => ({ ...p, status: e.target.value as any }))}>
                            {['Offen', 'Ausgeschrieben', 'Angebot', 'Vergeben', 'Abgeschlossen'].map(s => <option key={s}>{s}</option>)}
                          </select>
                        ) : (
                          <span className={STATUS_COLORS[gw.status]}>{gw.status}</span>
                        )}
                      </td>
                      <td style={{ padding: '8px 10px', overflow: 'hidden' }}>
                        {isEditing ? (
                          <select className="input-glass" style={{ fontSize: 11, padding: '3px 4px', width: '100%' }}
                            value={gwEdits.contractorId ?? gw.contractorId ?? ''}
                            onChange={e => setGwEdits(p => ({ ...p, contractorId: e.target.value || undefined }))}
                          >
                            <option value="">— kein</option>
                            {contacts.map(c => (
                              <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                            {contractor ? `${contractor.firstName} ${contractor.lastName}` : '—'}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div className="flex items-center gap-1">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => { updateGewerk(dev.id, gw.id, gwEdits); setEditingGw(null); setGwEdits({}); }}
                                style={{ background: '#007aff', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center' }}
                              >
                                <Save size={11} color="#fff" />
                              </button>
                              <button
                                onClick={() => { setEditingGw(null); setGwEdits({}); }}
                                style={{ background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.10)', borderRadius: 6, cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center' }}
                              >
                                <X size={11} color="rgba(60,60,67,0.60)" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => { setEditingGw(gw.id); setGwEdits({}); }}
                                style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 6, cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center' }}
                              >
                                <Edit3 size={11} color="rgba(60,60,67,0.55)" />
                              </button>
                              <button
                                onClick={() => deleteGewerk(dev.id, gw.id)}
                                style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.15)', borderRadius: 6, cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center' }}
                              >
                                <Trash2 size={11} color="#cc1a14" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid rgba(0,0,0,0.08)', background: 'rgba(0,0,0,0.02)' }}>
                  <td colSpan={2} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#1c1c1e' }}>GESAMT</td>
                  <td style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, fontFamily: 'ui-monospace, monospace', color: '#1c1c1e' }}>{formatEUR(totalBudget, true)}</td>
                  <td style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, fontFamily: 'ui-monospace, monospace', color: '#1c1c1e' }}>{totalOffer ? formatEUR(totalOffer, true) : '—'}</td>
                  <td style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, fontFamily: 'ui-monospace, monospace', color: totalContract > totalBudget ? '#cc1a14' : '#1a7f37' }}>{formatEUR(totalContract, true)}</td>
                  <td style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, fontFamily: 'ui-monospace, monospace', color: (totalContract - totalBudget) > 0 ? '#cc1a14' : '#1a7f37' }}>
                    {totalContract - totalBudget !== 0 ? `${totalContract - totalBudget > 0 ? '+' : ''}${formatEUR(totalContract - totalBudget, true)}` : '—'}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </GlassPanel>

          {/* ── Angebote ── */}
          <div style={{ marginTop: 24 }}>
            <div className="flex justify-between mb-3">
              <SectionHeader title="Angebote" />
              <button
                onClick={() => addOffer(dev.id, {
                  id: `offer-${Date.now()}`, gewerkId: '', gewerkCategory: 'Sonstiges',
                  description: '', measure: '', amountNet: 0, amountGross: 0, date: new Date().toISOString().split('T')[0],
                })}
                className="btn-glass px-3 py-1.5 rounded-xl text-xs flex items-center gap-1"
              >
                <Plus size={12} /> Angebot hinzufügen
              </button>
            </div>
            <GlassPanel style={{ overflow: 'hidden' }}>
              {(dev.offers || []).length === 0 ? (
                <div style={{ padding: '20px 16px', color: 'rgba(60,60,67,0.40)', fontSize: 13, textAlign: 'center' }}>Noch keine Angebote erfasst.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                      {['Gewerk', 'Maßnahme', 'Beschreibung', 'Datum', 'Netto', 'Brutto', ''].map(h => (
                        <th key={h} style={{ padding: '8px 10px', fontSize: 10, fontWeight: 700, color: 'rgba(60,60,67,0.45)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(dev.offers || []).map(o => (
                      <tr key={o.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                        <td style={{ padding: '6px 10px' }}>
                          <select className="input-glass" value={o.gewerkCategory} onChange={e => updateOffer(dev.id, o.id, { gewerkCategory: e.target.value })} style={{ fontSize: 11, width: 130 }}>
                            {GEWERK_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <input className="input-glass" value={o.measure} onChange={e => updateOffer(dev.id, o.id, { measure: e.target.value })} style={{ fontSize: 11, width: 100 }} />
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <input className="input-glass" value={o.description} onChange={e => updateOffer(dev.id, o.id, { description: e.target.value })} style={{ fontSize: 11, width: 140 }} />
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <input type="date" className="input-glass" value={o.date} onChange={e => updateOffer(dev.id, o.id, { date: e.target.value })} style={{ fontSize: 11, width: 120 }} />
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <input type="number" className="input-glass" value={o.amountNet || ''} onChange={e => { const net = parseFloat(e.target.value) || 0; updateOffer(dev.id, o.id, { amountNet: net, amountGross: parseFloat((net * 1.19).toFixed(2)) }); }} style={{ fontSize: 11, width: 90 }} />
                        </td>
                        <td style={{ padding: '6px 10px', fontWeight: 600, color: '#007aff', fontSize: 12 }}>{formatEUR(o.amountGross, true)}</td>
                        <td style={{ padding: '6px 10px' }}>
                          <button onClick={() => deleteOffer(dev.id, o.id)} style={{ background: 'rgba(255,59,48,0.08)', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center' }}>
                            <Trash2 size={11} color="#cc1a14" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid rgba(0,0,0,0.08)', background: 'rgba(0,0,0,0.02)' }}>
                      <td colSpan={4} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700 }}>GESAMT</td>
                      <td style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, fontFamily: 'ui-monospace, monospace' }}>{formatEUR((dev.offers || []).reduce((s, o) => s + o.amountNet, 0), true)}</td>
                      <td style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, fontFamily: 'ui-monospace, monospace', color: '#007aff' }}>{formatEUR((dev.offers || []).reduce((s, o) => s + o.amountGross, 0), true)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}
            </GlassPanel>
          </div>

          {/* ── Rechnungen ── */}
          <div style={{ marginTop: 24 }}>
            <div className="flex justify-between mb-3">
              <SectionHeader title="Rechnungen" />
              <button
                onClick={() => addInvoice(dev.id, {
                  id: `inv-${Date.now()}`, gewerkId: '', gewerkCategory: 'Sonstiges',
                  measure: '', invoiceType: 'Vollzahlung', description: '',
                  amountNet: 0, amountGross: 0, date: new Date().toISOString().split('T')[0],
                })}
                className="btn-glass px-3 py-1.5 rounded-xl text-xs flex items-center gap-1"
              >
                <Plus size={12} /> Rechnung hinzufügen
              </button>
            </div>
            <GlassPanel style={{ overflow: 'hidden' }}>
              {(dev.invoices || []).length === 0 ? (
                <div style={{ padding: '20px 16px', color: 'rgba(60,60,67,0.40)', fontSize: 13, textAlign: 'center' }}>Noch keine Rechnungen erfasst.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                      {['Gewerk', 'Maßnahme', 'Typ', 'Beschreibung', 'Datum', 'Netto', 'Brutto', ''].map(h => (
                        <th key={h} style={{ padding: '8px 10px', fontSize: 10, fontWeight: 700, color: 'rgba(60,60,67,0.45)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(dev.invoices || []).map(inv => (
                      <tr key={inv.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                        <td style={{ padding: '6px 10px' }}>
                          <select className="input-glass" value={inv.gewerkCategory} onChange={e => updateInvoice(dev.id, inv.id, { gewerkCategory: e.target.value })} style={{ fontSize: 11, width: 130 }}>
                            {GEWERK_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <input className="input-glass" value={inv.measure} onChange={e => updateInvoice(dev.id, inv.id, { measure: e.target.value })} style={{ fontSize: 11, width: 100 }} />
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <select className="input-glass" value={inv.invoiceType} onChange={e => updateInvoice(dev.id, inv.id, { invoiceType: e.target.value as any })} style={{ fontSize: 11, width: 110 }}>
                            {['Anzahlung', 'Vollzahlung', 'Baufortschritt', 'Schlussrechnung'].map(t => <option key={t}>{t}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <input className="input-glass" value={inv.description} onChange={e => updateInvoice(dev.id, inv.id, { description: e.target.value })} style={{ fontSize: 11, width: 120 }} />
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <input type="date" className="input-glass" value={inv.date} onChange={e => updateInvoice(dev.id, inv.id, { date: e.target.value })} style={{ fontSize: 11, width: 120 }} />
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <input type="number" className="input-glass" value={inv.amountNet || ''} onChange={e => { const net = parseFloat(e.target.value) || 0; updateInvoice(dev.id, inv.id, { amountNet: net, amountGross: parseFloat((net * 1.19).toFixed(2)) }); }} style={{ fontSize: 11, width: 90 }} />
                        </td>
                        <td style={{ padding: '6px 10px', fontWeight: 700, color: '#007aff', fontSize: 12 }}>{formatEUR(inv.amountGross, true)}</td>
                        <td style={{ padding: '6px 10px' }}>
                          <button onClick={() => deleteInvoice(dev.id, inv.id)} style={{ background: 'rgba(255,59,48,0.08)', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center' }}>
                            <Trash2 size={11} color="#cc1a14" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid rgba(0,0,0,0.08)', background: 'rgba(0,0,0,0.02)' }}>
                      <td colSpan={5} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700 }}>GESAMT BEZAHLT</td>
                      <td style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, fontFamily: 'ui-monospace, monospace' }}>{formatEUR((dev.invoices || []).reduce((s, i) => s + i.amountNet, 0), true)}</td>
                      <td style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, fontFamily: 'ui-monospace, monospace', color: '#007aff' }}>{formatEUR((dev.invoices || []).reduce((s, i) => s + i.amountGross, 0), true)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}
            </GlassPanel>
          </div>
        </div>
      )}

      {/* ── GANTT ── */}
      {activeTab === 'gantt' && (
        <div className="animate-fade-in">
          <GlassPanel style={{ padding: 24, overflowX: 'auto' }}>
            <div className="flex items-center justify-between mb-4">
              <SectionHeader title="Bauzeitenplan nach Gewerk" />
              <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)' }}>Zeiträume sind direkt editierbar — Stifticon klicken</div>
            </div>
            <div style={{ minWidth: 1000 }}>
              {/* Header months */}
              <div style={{ display: 'grid', gridTemplateColumns: '220px 130px repeat(24, 1fr)', borderBottom: '1px solid rgba(0,0,0,0.08)', marginBottom: 4 }}>
                <div style={{ padding: '6px 8px', fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.45)' }}>GEWERK</div>
                <div style={{ padding: '6px 8px', fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.45)' }}>ZEITRAUM</div>
                {ganttMonths.map(m => {
                  const d = new Date(m);
                  return (
                    <div key={m} style={{ padding: '6px 2px', fontSize: 9, fontWeight: 600, color: 'rgba(60,60,67,0.40)', textAlign: 'center', letterSpacing: '0.02em' }}>
                      {d.toLocaleDateString(dateLocale, { month: 'short' })}
                      <div style={{ fontSize: 8, color: 'rgba(60,60,67,0.30)' }}>{d.getFullYear().toString().slice(2)}</div>
                    </div>
                  );
                })}
              </div>
              {/* Rows — all gewerke */}
              {dev.gewerke.map((gw, idx) => {
                const startIdx = ganttMonths.indexOf(gw.ganttStart || '');
                const dur = gw.ganttDurationMonths || 0;
                const isEditingGantt = editingGanttGw === gw.id;
                return (
                  <div key={gw.id} style={{ display: 'grid', gridTemplateColumns: '220px 130px repeat(24, 1fr)', marginBottom: 3, background: idx % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent', borderRadius: 6 }}>
                    {/* Gewerk name + edit toggle */}
                    <div style={{ padding: '8px 8px', fontSize: 12, fontWeight: 500, color: '#1c1c1e', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className={STATUS_COLORS[gw.status]} style={{ fontSize: 9, padding: '1px 4px' }}>●</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{gw.category.split(' – ').pop()?.split(' & ')[0]}</span>
                      <button
                        onClick={() => {
                          if (isEditingGantt) {
                            updateGewerk(dev.id, gw.id, ganttGwEdits);
                            setEditingGanttGw(null);
                            setGanttGwEdits({});
                          } else {
                            setEditingGanttGw(gw.id);
                            setGanttGwEdits({ ganttStart: gw.ganttStart, ganttDurationMonths: gw.ganttDurationMonths });
                          }
                        }}
                        style={{ background: isEditingGantt ? '#007aff' : 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 5, cursor: 'pointer', padding: '3px 6px', flexShrink: 0 }}
                      >
                        {isEditingGantt ? <Save size={10} color="#fff" /> : <Edit3 size={10} color="rgba(60,60,67,0.5)" />}
                      </button>
                      {isEditingGantt && (
                        <button
                          onClick={() => { setEditingGanttGw(null); setGanttGwEdits({}); }}
                          style={{ background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 5, cursor: 'pointer', padding: '3px 6px', flexShrink: 0 }}
                        >
                          <X size={10} color="rgba(60,60,67,0.5)" />
                        </button>
                      )}
                    </div>
                    {/* Inline time editor */}
                    <div style={{ padding: '4px 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {isEditingGantt ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
                          <input
                            type="month"
                            className="input-glass"
                            value={ganttGwEdits.ganttStart || ''}
                            onChange={e => setGanttGwEdits(p => ({ ...p, ganttStart: e.target.value }))}
                            style={{ fontSize: 10, padding: '2px 4px', width: '100%' }}
                          />
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              className="input-glass"
                              min={1} max={48}
                              value={ganttGwEdits.ganttDurationMonths ?? ''}
                              onChange={e => setGanttGwEdits(p => ({ ...p, ganttDurationMonths: parseInt(e.target.value) || 1 }))}
                              style={{ fontSize: 10, padding: '2px 4px', width: 46 }}
                            />
                            <span style={{ fontSize: 9, color: 'rgba(60,60,67,0.45)' }}>Mo.</span>
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', lineHeight: 1.4 }}>
                          {gw.ganttStart ? (
                            <>
                              {new Date(gw.ganttStart).toLocaleDateString(dateLocale, { month: 'short', year: '2-digit' })}
                              {dur > 0 && <> · {dur} Mo.</>}
                            </>
                          ) : (
                            <span style={{ color: 'rgba(60,60,67,0.25)' }}>—</span>
                          )}
                        </span>
                      )}
                    </div>
                    {/* Gantt bar cells */}
                    {ganttMonths.map((m, mi) => {
                      const inRange = startIdx >= 0 && dur > 0 && mi >= startIdx && mi < startIdx + dur;
                      const isFirst = mi === startIdx;
                      const isLast = mi === startIdx + dur - 1;
                      return (
                        <div key={m} style={{ padding: '4px 1px', display: 'flex', alignItems: 'center' }}>
                          {inRange && (
                            <div style={{
                              height: 20, width: '100%',
                              background: gw.status === 'Abgeschlossen' ? '#34c759' : gw.status === 'Vergeben' ? '#007aff' : gw.status === 'Angebot' ? '#ff9500' : 'rgba(0,122,255,0.35)',
                              borderRadius: `${isFirst ? 6 : 0}px ${isLast ? 6 : 0}px ${isLast ? 6 : 0}px ${isFirst ? 6 : 0}px`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {isFirst && dur > 2 && (
                                <span style={{ fontSize: 8, color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', paddingLeft: 4 }}>
                                  {formatEUR(gw.contractAmount || gw.underwritingBudget, true)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {[['Offen', 'rgba(0,122,255,0.35)'], ['Angebot', '#ff9500'], ['Vergeben', '#007aff'], ['Abgeschlossen', '#34c759']].map(([label, color]) => (
                  <div key={label} className="flex items-center gap-2">
                    <div style={{ width: 14, height: 8, borderRadius: 2, background: color }} />
                    <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.55)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </GlassPanel>
        </div>
      )}

      {/* ── DEBT ── */}
      {activeTab === 'debt' && (() => {
        const purchaseLoan = dev.purchasePrice * (debtForm.ltvPct / 100);
        const constructionLoan = totalBudget * (debtForm.ltcPct / 100);
        const totalDebt = purchaseLoan + constructionLoan;
        const annualInterest = totalDebt * (debtForm.interestRatePct / 100);
        const monthlyInterest = annualInterest / 12;
        let monthlyPayment = 0;
        if (debtForm.loanType === 'Annuität' && (debtForm.annuityTermYears || 0) > 0) {
          const i = debtForm.interestRatePct / 100 / 12;
          const n = (debtForm.annuityTermYears || 15) * 12;
          monthlyPayment = totalDebt * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
        }
        const completionDate = dev.actualEndDate || dev.plannedEndDate;
        return (
          <div className="animate-fade-in">
            <div className="grid grid-cols-2 gap-6">
              {/* Form */}
              <GlassPanel style={{ padding: 24 }}>
                <SectionHeader title="Finanzierungsannahmen" />
                <div className="space-y-4 mt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>LTV (% des Kaufpreises)</label>
                      <div className="flex items-center gap-2">
                        <input type="number" className="input-glass flex-1" min={0} max={100} step={0.5}
                          value={debtForm.ltvPct}
                          onChange={e => setDebtForm(p => ({ ...p, ltvPct: parseFloat(e.target.value) || 0 }))}
                        />
                        <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.55)' }}>%</span>
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>LTC (% der Baukosten)</label>
                      <div className="flex items-center gap-2">
                        <input type="number" className="input-glass flex-1" min={0} max={100} step={0.5}
                          value={debtForm.ltcPct}
                          onChange={e => setDebtForm(p => ({ ...p, ltcPct: parseFloat(e.target.value) || 0 }))}
                        />
                        <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.55)' }}>%</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Zinssatz p.a.</label>
                    <div className="flex items-center gap-2">
                      <input type="number" className="input-glass flex-1" min={0} max={20} step={0.05}
                        value={debtForm.interestRatePct}
                        onChange={e => setDebtForm(p => ({ ...p, interestRatePct: parseFloat(e.target.value) || 0 }))}
                      />
                      <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.55)' }}>%</span>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Darlehensart</label>
                    <select className="input-glass w-full" value={debtForm.loanType}
                      onChange={e => setDebtForm(p => ({ ...p, loanType: e.target.value as 'Bullet' | 'Annuität' }))}>
                      <option value="Bullet">Bullet Loan (Rückzahlung bei Fertigstellung)</option>
                      <option value="Annuität">Annuitätendarlehen</option>
                    </select>
                  </div>
                  {debtForm.loanType === 'Annuität' && (
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Laufzeit (Jahre)</label>
                      <input type="number" className="input-glass" min={1} max={40}
                        value={debtForm.annuityTermYears ?? 15}
                        onChange={e => setDebtForm(p => ({ ...p, annuityTermYears: parseInt(e.target.value) || 15 }))}
                      />
                    </div>
                  )}
                  {debtForm.loanType === 'Bullet' && completionDate && (
                    <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(0,122,255,0.06)', border: '1px solid rgba(0,122,255,0.12)', fontSize: 12, color: 'rgba(60,60,67,0.65)' }}>
                      Bullet-Rückzahlung zum Abschluss gemäß Gantt: <strong style={{ color: '#007aff' }}>{new Date(completionDate).toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' })}</strong>
                    </div>
                  )}
                  <button
                    onClick={() => updateDevelopment(dev.id, { debtAssumptions: debtForm })}
                    className="btn-accent px-5 py-2 rounded-xl text-sm w-full"
                  >
                    Annahmen speichern
                  </button>
                </div>
              </GlassPanel>

              {/* Computed results */}
              <GlassPanel style={{ padding: 24 }}>
                <SectionHeader title="Finanzierungsstruktur" />
                <div className="space-y-2 mt-2">
                  {[
                    { label: 'Kaufpreis (Basis LTV)', value: formatEUR(dev.purchasePrice), sub: null },
                    { label: `Kaufpreisdarlehen (${debtForm.ltvPct}% LTV)`, value: formatEUR(purchaseLoan), color: '#007aff' },
                    { label: 'Baukosten (Basis LTC)', value: formatEUR(totalBudget), sub: null },
                    { label: `Baukostendarlehen (${debtForm.ltcPct}% LTC)`, value: formatEUR(constructionLoan), color: '#007aff' },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between py-2 px-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                      <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.65)' }}>{row.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: row.color || '#1c1c1e', fontFamily: 'ui-monospace, monospace' }}>{row.value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-3 px-3 rounded-xl" style={{ background: 'rgba(0,122,255,0.07)', border: '1px solid rgba(0,122,255,0.15)', marginTop: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1c1c1e' }}>Gesamtdarlehen</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#007aff', fontFamily: 'ui-monospace, monospace' }}>{formatEUR(totalDebt)}</span>
                  </div>
                  <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)', paddingTop: 12, marginTop: 4 }}>
                    <div className="flex justify-between py-2 px-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                      <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.65)' }}>Jahreszinsen ({debtForm.interestRatePct}%)</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#ff9500', fontFamily: 'ui-monospace, monospace' }}>{formatEUR(annualInterest)}</span>
                    </div>
                    <div className="flex justify-between py-2 px-3 rounded-xl mt-1" style={{ background: 'rgba(0,0,0,0.03)' }}>
                      <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.65)' }}>Monatliche Zinslast</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#ff9500', fontFamily: 'ui-monospace, monospace' }}>{formatEUR(monthlyInterest)}</span>
                    </div>
                    {debtForm.loanType === 'Annuität' && monthlyPayment > 0 && (
                      <div className="flex justify-between py-2 px-3 rounded-xl mt-1" style={{ background: 'rgba(0,0,0,0.03)' }}>
                        <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.65)' }}>Monatliche Annuität</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1c1c1e', fontFamily: 'ui-monospace, monospace' }}>{formatEUR(monthlyPayment)}</span>
                      </div>
                    )}
                    {debtForm.loanType === 'Bullet' && (
                      <div className="flex justify-between py-2 px-3 rounded-xl mt-1" style={{ background: 'rgba(0,0,0,0.03)' }}>
                        <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.65)' }}>Rückzahlung (Bullet)</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1c1c1e', fontFamily: 'ui-monospace, monospace' }}>{formatEUR(totalDebt)} bei Fertigstellung</span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between py-2 px-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                    <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.65)' }}>Eigenkapital (Gesamt)</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1a7f37', fontFamily: 'ui-monospace, monospace' }}>{formatEUR(dev.purchasePrice + totalBudget - totalDebt)}</span>
                  </div>
                </div>
              </GlassPanel>
            </div>
          </div>
        );
      })()}

      {/* ── VALUATION ── */}
      {activeTab === 'valuation' && (() => {
        const units = dev.units || [];
        const grossRentMonthly = units.reduce((s, u) => s + u.monthlyRent, 0);
        const grossRentAnnual = grossRentMonthly * 12;
        const opexAmount = grossRentAnnual * (valuationForm.opexPct / 100);
        const noi = grossRentAnnual - opexAmount;
        const valuation = valuationForm.exitYieldPct > 0
          ? noi / ((valuationForm.exitYieldPct / 100) * (1 + valuationForm.purchasingCostsPct / 100))
          : 0;
        return (
          <div className="animate-fade-in">
            <div className="grid grid-cols-2 gap-6">
              {/* Inputs */}
              <GlassPanel style={{ padding: 24 }}>
                <SectionHeader title="Bewertungsannahmen" />
                <div className="space-y-4 mt-2">
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>OpEx (% der Bruttomiete)</label>
                    <div className="flex items-center gap-2">
                      <input type="number" className="input-glass flex-1" min={0} max={100} step={0.5}
                        value={valuationForm.opexPct}
                        onChange={e => setValuationForm(p => ({ ...p, opexPct: parseFloat(e.target.value) || 0 }))}
                      />
                      <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.55)' }}>%</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.40)', marginTop: 4 }}>Bewirtschaftungskosten, Instandhaltung, Verwaltung</div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Exit Yield (Nettoanfangsrendite)</label>
                    <div className="flex items-center gap-2">
                      <input type="number" className="input-glass flex-1" min={0.1} max={20} step={0.05}
                        value={valuationForm.exitYieldPct}
                        onChange={e => setValuationForm(p => ({ ...p, exitYieldPct: parseFloat(e.target.value) || 0 }))}
                      />
                      <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.55)' }}>%</span>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Erwerbsnebenkosten (Käufer)</label>
                    <div className="flex items-center gap-2">
                      <input type="number" className="input-glass flex-1" min={0} max={20} step={0.5}
                        value={valuationForm.purchasingCostsPct}
                        onChange={e => setValuationForm(p => ({ ...p, purchasingCostsPct: parseFloat(e.target.value) || 0 }))}
                      />
                      <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.55)' }}>%</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.40)', marginTop: 4 }}>GrESt, Notar, Makler</div>
                  </div>
                  <button
                    onClick={() => {
                      updateDevelopment(dev.id, { valuationAssumptions: valuationForm, projectedSalePrice: valuation > 0 ? valuation : dev.projectedSalePrice });
                    }}
                    className="btn-accent px-5 py-2 rounded-xl text-sm w-full"
                  >
                    Annahmen speichern &amp; Proj. Verkaufspreis setzen
                  </button>
                  {units.length === 0 && (
                    <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.20)', fontSize: 12, color: 'rgba(60,60,67,0.65)' }}>
                      Noch keine Einheiten im Rent Roll erfasst — Mieteinnahmen = 0.
                    </div>
                  )}
                </div>
              </GlassPanel>

              {/* Valuation waterfall */}
              <GlassPanel style={{ padding: 24 }}>
                <SectionHeader title="Bewertung bei Fertigstellung" />
                <div className="space-y-2 mt-2">
                  {[
                    { label: 'Bruttomiete p.a. (aus Rent Roll)', value: formatEUR(grossRentAnnual), color: '#1a7f37' },
                    { label: `− OpEx (${valuationForm.opexPct}% der Bruttomiete)`, value: `− ${formatEUR(opexAmount)}`, color: '#cc1a14' },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between py-2 px-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                      <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.65)' }}>{row.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: row.color, fontFamily: 'ui-monospace, monospace' }}>{row.value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-3 px-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.05)', borderTop: '2px solid rgba(0,0,0,0.08)' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1c1c1e' }}>= NOI p.a.</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1c1c1e', fontFamily: 'ui-monospace, monospace' }}>{formatEUR(noi)}</span>
                  </div>

                  {/* Formula display */}
                  <div style={{ padding: '14px', borderRadius: 12, background: 'rgba(0,122,255,0.05)', border: '1px solid rgba(0,122,255,0.12)', marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Bewertungsformel</div>
                    <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.70)', lineHeight: 1.8, fontFamily: 'ui-monospace, monospace' }}>
                      NOI ÷ (Exit Yield × (1 + Erwerb%))<br />
                      <span style={{ color: '#007aff' }}>
                        {formatEUR(noi)} ÷ ({valuationForm.exitYieldPct}% × (1 + {valuationForm.purchasingCostsPct}%))
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between py-3 px-3 rounded-xl" style={{ background: 'rgba(0,122,255,0.08)', border: '1px solid rgba(0,122,255,0.20)', marginTop: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#1c1c1e' }}>= Valuation bei Fertigstellung</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#007aff', fontFamily: 'ui-monospace, monospace' }}>{valuation > 0 ? formatEUR(valuation) : '—'}</span>
                  </div>
                  <div className="flex justify-between py-3 px-3 rounded-xl" style={{ background: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.20)' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#1c1c1e' }}>= Proj. Verkaufspreis</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#1a7f37', fontFamily: 'ui-monospace, monospace' }}>{valuation > 0 ? formatEUR(valuation) : '—'}</span>
                  </div>

                  {valuation > 0 && (() => {
                    const totalInvestment = dev.purchasePrice + totalBudget;
                    const profit = valuation - totalInvestment;
                    const profitPct = totalInvestment > 0 ? (profit / totalInvestment) * 100 : 0;
                    return (
                      <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)', paddingTop: 10, marginTop: 4 }}>
                        <div className="flex justify-between py-2 px-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                          <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.65)' }}>Gesamtinvestition</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#1c1c1e', fontFamily: 'ui-monospace, monospace' }}>{formatEUR(totalInvestment)}</span>
                        </div>
                        <div className="flex justify-between py-2 px-3 rounded-xl mt-1" style={{ background: 'rgba(0,0,0,0.03)' }}>
                          <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.65)' }}>Development Profit</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: profit >= 0 ? '#1a7f37' : '#cc1a14', fontFamily: 'ui-monospace, monospace' }}>
                            {profit >= 0 ? '+' : ''}{formatEUR(profit)} ({profitPct.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </GlassPanel>
            </div>
          </div>
        );
      })()}

      {/* ── CONSTRUCTION ADVISOR ── */}
      {activeTab === 'advisor' && (
        <div className="animate-fade-in">
          <div className="p-3 rounded-xl mb-4 flex items-center gap-3" style={{ background: 'rgba(0,122,255,0.06)', border: '1px solid rgba(0,122,255,0.12)' }}>
            <Bot size={16} color="#007aff" />
            <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.75)' }}>
              <strong style={{ color: '#007aff' }}>Construction Advisor</strong> — Simulierter Kostenberater. Benchmarks basieren auf DACH-Marktdaten Q1/2025. Manuell überschreibbar.
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <GlassPanel style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ height: 420, overflowY: 'auto', padding: 20 }}>
                <div className="space-y-3">
                  {advisorMessages.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 32, color: 'rgba(60,60,67,0.40)', fontSize: 13 }}>
                      Beschreiben Sie Ihr Development — Art, Größe, Zustand.<br />Der Advisor liefert Kostenbenchmarks.
                    </div>
                  )}
                  {advisorMessages.map(msg => (
                    <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: msg.role === 'advisor' ? 'rgba(0,122,255,0.10)' : 'rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: msg.role === 'advisor' ? '#007aff' : 'rgba(60,60,67,0.60)' }}>
                        {msg.role === 'advisor' ? '🤖' : 'MW'}
                      </div>
                      <div style={{ maxWidth: '78%', background: msg.role === 'advisor' ? 'rgba(0,0,0,0.04)' : 'rgba(0,122,255,0.10)', border: `1px solid ${msg.role === 'advisor' ? 'rgba(0,0,0,0.06)' : 'rgba(0,122,255,0.18)'}`, borderRadius: msg.role === 'advisor' ? '4px 14px 14px 14px' : '14px 4px 14px 14px', padding: '10px 14px', fontSize: 13, color: 'rgba(60,60,67,0.80)', lineHeight: 1.6 }}>
                        {msg.content}
                        <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.35)', marginTop: 4 }}>{new Date(msg.timestamp).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', padding: 14 }}>
                <div className="flex gap-2 mb-2 flex-wrap">
                  {['Neubau Kosten', 'Kernsanierung', 'TGA Benchmarks', 'Außenanlagen'].map(s => (
                    <button key={s} onClick={() => setAdvisorInput(s)} style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 6, cursor: 'pointer', padding: '3px 8px', fontSize: 11, color: 'rgba(60,60,67,0.65)' }}>{s}</button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input className="input-glass flex-1" placeholder="Frage eingeben..." value={advisorInput} onChange={e => setAdvisorInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdvisorSend()} style={{ fontSize: 13 }} />
                  <button onClick={handleAdvisorSend} className="btn-accent px-4 py-2 rounded-xl text-sm">Senden</button>
                </div>
              </div>
            </GlassPanel>

            {/* Benchmark Reference */}
            <GlassPanel style={{ padding: 20 }}>
              <SectionHeader title="Kostenbenchmarks DACH" />
              <div className="space-y-2">
                {[
                  { label: 'Rohbau', range: '130–165 €/m²' },
                  { label: 'Dach komplett', range: '120–220 €/m²' },
                  { label: 'Fassade (WDVS)', range: '80–140 €/m²' },
                  { label: 'Fenster (3-fach Holz-Alu)', range: '400–700 €/Stk.' },
                  { label: 'TGA Heizung (WP + FBH)', range: '85–125 €/m²' },
                  { label: 'TGA Sanitär', range: '65–95 €/m²' },
                  { label: 'TGA Elektro', range: '55–85 €/m²' },
                  { label: 'Innenausbau', range: '110–160 €/m²' },
                  { label: 'Trockenbau', range: '40–65 €/m²' },
                  { label: 'Aufzug (4 Haltestellen)', range: '45.000–80.000 €' },
                  { label: 'Planung & Architektur', range: '8–12% der Baukosten' },
                  { label: 'Reserve', range: '10–20% Gesamt' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between py-2 px-3 rounded-lg" style={{ background: 'rgba(0,0,0,0.03)' }}>
                    <span style={{ fontSize: 12, color: 'rgba(60,60,67,0.65)' }}>{row.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#007aff', fontFamily: 'ui-monospace, monospace' }}>{row.range}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.35)', marginTop: 12, fontStyle: 'italic' }}>
                Quellen: BKI Baukosten 2024, SIRADOS, Marktbefragung · Stand Q1/2025
              </div>
            </GlassPanel>
          </div>
        </div>
      )}

      {/* ── HOLD / SELL ── */}
      {activeTab === 'holdsell' && (
        <div className="animate-fade-in">
          {analysis ? (
            <div className="space-y-5">
              {/* Recommendation banner */}
              <div className="p-5 rounded-2xl" style={{
                background: analysis.recommendation === 'Hold' ? 'rgba(52,199,89,0.08)' : analysis.recommendation === 'Sell' ? 'rgba(0,122,255,0.08)' : 'rgba(0,0,0,0.04)',
                border: `1px solid ${analysis.recommendation === 'Hold' ? 'rgba(52,199,89,0.20)' : analysis.recommendation === 'Sell' ? 'rgba(0,122,255,0.20)' : 'rgba(0,0,0,0.08)'}`,
              }}>
                <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.55)', marginBottom: 4 }}>EMPFEHLUNG</div>
                <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.04em', color: analysis.recommendation === 'Hold' ? '#1a7f37' : analysis.recommendation === 'Sell' ? '#007aff' : '#1c1c1e', marginBottom: 8 }}>
                  {analysis.recommendation === 'Hold' ? '📈 HOLD — Im Portfolio halten' : analysis.recommendation === 'Sell' ? '💰 SELL — Verkauf empfohlen' : '⚖️ Neutral — Strategische Entscheidung'}
                </div>
                <div style={{ fontSize: 14, color: 'rgba(60,60,67,0.70)', lineHeight: 1.6 }}>{analysis.reasoning}</div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                {/* Hold */}
                <GlassPanel style={{ padding: 22 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1a7f37', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>📈 Hold-Szenario (10 Jahre)</div>
                  {[
                    { label: '10-Jahres IRR', value: `${analysis.holdIRR.toFixed(1)}%`, highlight: true },
                    { label: 'Hurdle Rate', value: `${settings.hurrleRate}%` },
                    { label: 'IRR über Hurdle', value: `${(analysis.holdIRR - settings.hurrleRate).toFixed(1)}%`, color: analysis.holdIRR >= settings.hurrleRate ? '#1a7f37' : '#cc1a14' },
                    { label: 'Gesamtinvestition', value: formatEUR(analysis.totalCost) },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between py-2 px-3 rounded-xl mb-1" style={{ background: 'rgba(0,0,0,0.03)' }}>
                      <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.65)' }}>{row.label}</span>
                      <span style={{ fontSize: 13, fontWeight: row.highlight ? 700 : 600, color: row.color || (row.highlight ? '#1a7f37' : '#1c1c1e'), fontFamily: 'ui-monospace, monospace' }}>{row.value}</span>
                    </div>
                  ))}
                  {/* CF chart */}
                  <div className="mt-4">
                    <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Netto-Cashflow Prognose</div>
                    <ResponsiveContainer width="100%" height={120}>
                      <LineChart data={dev.underwritingCashFlows?.map(cf => ({ Jahr: `J${cf.year}`, NCF: Math.round(cf.netCashFlow / 1000) })) || []}>
                        <XAxis dataKey="Jahr" tick={{ fontSize: 10, fill: 'rgba(60,60,67,0.45)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: 'rgba(60,60,67,0.45)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}k`} />
                        <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, fontSize: 11 }} />
                        <Line type="monotone" dataKey="NCF" stroke="#34c759" strokeWidth={2} dot={{ r: 3, fill: '#34c759' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <button onClick={() => setShowHoldSellModal('Hold')} className="btn-glass w-full mt-4 py-2 rounded-xl text-sm font-semibold" style={{ color: '#1a7f37', borderColor: 'rgba(52,199,89,0.3)', display: 'block', textAlign: 'center' }}>
                    ✓ In Bestand überführen (Hold)
                  </button>
                </GlassPanel>

                {/* Sell */}
                <GlassPanel style={{ padding: 22 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#007aff', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>💰 Sell-Szenario</div>
                  <div className="mb-3">
                    <label style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', display: 'block', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Proj. Verkaufspreis (editierbar)</label>
                    <input
                      type="number"
                      className="input-glass"
                      value={dev.projectedSalePrice || ''}
                      onChange={e => updateDevelopment(dev.id, { projectedSalePrice: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  {[
                    { label: 'Bruttogewinn', value: formatEUR((dev.projectedSalePrice || 0) - analysis.totalCost) },
                    { label: `Steuer (${settings.taxRate}%)`, value: `− ${formatEUR(Math.max(0, ((dev.projectedSalePrice || 0) - analysis.totalCost)) * settings.taxRate / 100)}` },
                    { label: 'Nettogewinn', value: formatEUR(analysis.sellNetProfit), highlight: true },
                    { label: 'ROI (nach Steuer)', value: `${analysis.sellROI.toFixed(1)}%`, color: analysis.sellROI > 15 ? '#1a7f37' : '#b25000' },
                    { label: 'Sell-IRR', value: `${analysis.sellIRR.toFixed(1)}%` },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between py-2 px-3 rounded-xl mb-1" style={{ background: 'rgba(0,0,0,0.03)' }}>
                      <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.65)' }}>{row.label}</span>
                      <span style={{ fontSize: 13, fontWeight: row.highlight ? 700 : 600, color: row.color || (row.highlight ? '#007aff' : '#1c1c1e'), fontFamily: 'ui-monospace, monospace' }}>{row.value}</span>
                    </div>
                  ))}
                  <button onClick={() => setShowHoldSellModal('Sell')} className="btn-accent w-full mt-4 py-2 rounded-xl text-sm font-semibold" style={{ display: 'block', textAlign: 'center' }}>
                    → In Sales überführen (Sell)
                  </button>
                </GlassPanel>
              </div>

              <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.35)', textAlign: 'center', fontStyle: 'italic' }}>
                * IRR-Berechnung deterministisch. Steuer: {settings.taxRate}% pauschal (in Einstellungen anpassbar). Cashflows manuell editierbar.
              </div>
            </div>
          ) : (
            <GlassPanel style={{ padding: 48, textAlign: 'center' }}>
              <BarChart3 size={32} color="rgba(60,60,67,0.30)" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(60,60,67,0.50)' }}>Hold/Sell-Analyse nicht verfügbar</div>
              <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.35)', marginTop: 4 }}>Bitte Cashflow-Prognose und Verkaufspreis hinterlegen.</div>
            </GlassPanel>
          )}
        </div>
      )}

      {/* ── CASH FLOW / IRR ── */}
      {activeTab === 'cashflow' && (() => {
        // Build synthetic UW + Fin from dev's own fields
        const devUnits = dev.units || [];
        const totalMonthlyRent = devUnits.reduce((s, u) => s + u.monthlyRent, 0);
        const exitYield = dev.valuationAssumptions?.exitYieldPct || 5.0;
        const loanAmt = dev.debtAssumptions
          ? dev.purchasePrice * (dev.debtAssumptions.ltvPct / 100)
          : 0;
        const syntheticUW = {
          purchasePrice: dev.purchasePrice + dev.totalBudget,
          closingCostPercent: 6.5, brokerFeePercent: 1.5, initialCapex: 0,
          annualGrossRent: totalMonthlyRent > 0 ? totalMonthlyRent * 12 : (dev.totalBudget * exitYield / 100),
          vacancyRatePercent: 5, managementCostPercent: 3,
          maintenanceReservePerSqm: 10, nonRecoverableOpex: 0,
          area: dev.totalArea, rentPerSqm: dev.totalArea > 0 ? totalMonthlyRent / dev.totalArea : 0,
          otherOperatingIncome: 0,
          marketAssumptions: {
            exitCapRate: exitYield, holdingPeriodYears: 10,
            rentalGrowthRate: 2, ervGrowthRate: 2,
          },
        };
        const syntheticFin = {
          loanAmount: loanAmt, interestRate: dev.debtAssumptions?.interestRatePct || 4.0,
          amortizationRate: 2.0, loanTerm: 10, lenderName: '', fixedRatePeriod: 5,
        };
        const uw = syntheticUW;
        const fin = syntheticFin;
        const dcf = computeDealCashFlow(uw as any, fin);
        const chartData = dcf.annualRows.map(r => ({
          year: `J${r.year}`,
          NOI: Math.round(r.noi / 1000),
          'Levered CF': Math.round(r.leveredCashFlow / 1000),
        }));
        const kpiLS: React.CSSProperties = { fontSize: 10, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em' };
        const kpiVS = (c?: string): React.CSSProperties => ({ fontSize: 18, fontWeight: 700, color: c || '#1c1c1e', fontFamily: 'ui-monospace, monospace' });
        const ma = uw.marketAssumptions;
        return (
          <div className="space-y-6 animate-fade-in">
            {/* Assumptions */}
            <GlassPanel style={{ padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1c1c1e', marginBottom: 12 }}>Marktannahmen (DCF)</div>
              <div className="grid grid-cols-4 gap-6">
                {[
                  ['Haltedauer', `${dcf.holdingPeriodYears} Jahre`],
                  ['Mietwachstum p.a.', `${ma?.rentalGrowthRate ?? 2}%`],
                  ['Exit-Cap-Rate', `${dcf.exitCapRate}%`],
                  ['ERV €/m²/Mon', `${(uw as any).ervPerSqm ?? '—'}`],
                ].map(([l, v]) => (
                  <div key={l}>
                    <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{l}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1c1c1e', fontFamily: 'ui-monospace, monospace' }}>{v}</div>
                  </div>
                ))}
              </div>
            </GlassPanel>
            {/* KPIs */}
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
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1c1c1e' }}>Jährliche Cashflow-Tabelle</div>
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

      {/* ── IMAGES ── */}
      {activeTab === 'images' && (
        <GlassPanel style={{ padding: 24 }} className="animate-fade-in">
          <SectionHeader title="Bilder" />
          <ImageManager entityId={dev.id} entityType="Development" />
        </GlassPanel>
      )}

      {/* ── DOCUMENTS ── */}
      {activeTab === 'documents' && (
        <GlassPanel style={{ padding: 24 }} className="animate-fade-in">
          <div className="flex justify-between mb-4">
            <SectionHeader title="Dokumente" />
            <button className="btn-glass px-3 py-1.5 rounded-xl text-xs flex items-center gap-1"><Upload size={12} /> Hochladen</button>
          </div>
          <div className="space-y-2">
            {dev.documents.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.05)' }}>
                <FileText size={15} color="#007aff" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1c1c1e' }}>{doc.name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>{doc.fileSize} · {doc.uploadedBy}</div>
                </div>
                <div className="flex gap-1">{doc.tags.map(t => <span key={t} className="badge-neutral" style={{ fontSize: 10 }}>{t}</span>)}</div>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Hold/Sell Confirmation Modal */}
      {showHoldSellModal && (
        <Modal
          title={showHoldSellModal === 'Hold' ? 'In Bestand überführen' : 'In Sales überführen'}
          onClose={() => setShowHoldSellModal(null)}
          actions={
            <>
              <button onClick={() => setShowHoldSellModal(null)} className="btn-glass px-4 py-2 rounded-xl text-sm">Abbrechen</button>
              <button onClick={() => handleHoldSellConfirm(showHoldSellModal)} className={`${showHoldSellModal === 'Hold' ? 'btn-glass' : 'btn-accent'} px-5 py-2 rounded-xl text-sm`} style={showHoldSellModal === 'Hold' ? { color: '#1a7f37', borderColor: 'rgba(52,199,89,0.3)' } : {}}>
                Bestätigen & {showHoldSellModal === 'Hold' ? 'in Bestand' : 'in Sales'} überführen
              </button>
            </>
          }
        >
          <div style={{ fontSize: 14, color: 'rgba(60,60,67,0.70)', lineHeight: 1.7 }}>
            <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(0,122,255,0.06)', border: '1px solid rgba(0,122,255,0.12)' }}>
              <strong style={{ color: '#007aff' }}>{dev.name}</strong> wird {showHoldSellModal === 'Hold' ? 'als neues Asset in den Bestand' : 'in die Sales-Pipeline'} überführt.
            </div>
            {analysis && (
              <div>IRR (Hold): <strong>{analysis.holdIRR.toFixed(1)}%</strong> · Nettogewinn (Sell): <strong>{formatEUR(analysis.sellNetProfit)}</strong></div>
            )}
            <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.40)', marginTop: 12 }}>Diese Aktion erstellt einen Audit-Log-Eintrag und kann nicht rückgängig gemacht werden.</div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 20, padding: 28, maxWidth: 420, width: '90%', boxShadow: '0 24px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1c1c1e', marginBottom: 12 }}>Projekt löschen</div>
            <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.15)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#ff3b30', marginBottom: 6 }}>Wirklich löschen?</div>
              <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.70)' }}>
                <strong>{dev.name}</strong> wird unwiderruflich aus dem Development-Portfolio entfernt. Alle Gewerke, Aktivitäten und Dokumente gehen verloren.
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteModal(false)} className="btn-glass px-4 py-2 rounded-xl text-sm">Abbrechen</button>
              <button
                onClick={() => { deleteDevelopment(dev.id); navigate('/developments'); }}
                style={{ background: 'rgba(255,59,48,0.12)', color: '#ff3b30', border: '1px solid rgba(255,59,48,0.2)', borderRadius: 12, padding: '8px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Trash2 size={14} /> Endgültig löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
