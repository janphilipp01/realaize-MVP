import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Building2, Search, Filter, ChevronRight, ArrowLeft,
  Edit3, Save, X, FileText, AlertTriangle, TrendingUp,
  BarChart3, Home, Info, Trash2
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line, CartesianGrid } from 'recharts';
import { useStore } from '../store/useStore';
import { PageHeader, GlassPanel, KPICard, StatusBadge, CompletenessRing, SectionHeader, StageBadge } from '../components/shared';
import { formatEUR, formatPct, computeAssetNOI, computeAssetLTV, computeAssetMonthlyCashFlow } from '../utils/kpiEngine';
import { computePropertyCashFlow } from '../utils/propertyCashFlowModel';
import ImageManager, { TitleImageDisplay } from '../components/ImageManager';
import DocumentUpload from '../components/DocumentUpload';
import { useLanguage } from '../i18n/LanguageContext';
import type { Asset, AssetOperatingCosts } from '../models/types';

// ─── Assets List Page ─────────────────────────────────────────────────────────
export function AssetsPage() {
  const { assets } = useStore();
  const { t, lang } = useLanguage();
  const dateLocale = lang === 'de' ? 'de-DE' : 'en-GB';
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('Alle');
  const [view, setView] = useState<'cards' | 'table'>('cards');

  const filtered = assets.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) || a.city.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'Alle' || a.usageType === filterType;
    return matchSearch && matchType;
  });

  const totalValue = assets.reduce((s, a) => s + a.currentValue, 0);
  const totalRent = assets.reduce((s, a) => s + a.annualRent, 0);

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title={t('assets.title')}
        subtitle={`${assets.length} ${t('portfolio.objects')} · ${formatEUR(totalValue, true)} Portfolio Value · ${formatEUR(totalRent, true)} p.a. Annual Rent`}
        badge={t('portfolio.inventory')}
      />

      {/* Filter Bar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative">
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(60,60,67,0.45)' }} />
          <input className="input-glass pl-8" placeholder={t('assets.search')} value={search} onChange={e => setSearch(e.target.value)} style={{ width: 220 }} />
        </div>
        <select className="input-glass" value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 160 }}>
          <option>Alle</option>
          {['Wohnen', 'Büro', 'Logistik', 'Einzelhandel', 'Mixed Use'].map(t => <option key={t}>{t}</option>)}
        </select>
        <div className="ml-auto flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
          {(['table', 'cards'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: view === v ? 'rgba(201,169,110,0.15)' : 'transparent', color: view === v ? 'var(--accent)' : 'var(--text-secondary)', border: view === v ? '1px solid rgba(201,169,110,0.2)' : '1px solid transparent', cursor: 'pointer' }}>
              {v === 'table' ? 'Tabelle' : 'Karten'}
            </button>
          ))}
        </div>
      </div>

      {view === 'table' ? (
        <GlassPanel style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                {[t('debt.object'), t('assets.city'), t('assets.usageType'), 'Value', 'Annual Net Rent', 'Occupancy', 'LTV', t('acq.completeness'), ''].map(h => (
                  <th key={h} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.45)', textAlign: 'left', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(asset => {
                const totalDebt = asset.debtInstruments.reduce((s, d) => s + d.outstandingAmount, 0);
                const ltv = asset.currentValue > 0 ? (totalDebt / asset.currentValue) * 100 : 0;
                const breach = asset.covenants.some(c => c.status === 'Breach');
                const warn = asset.covenants.some(c => c.status === 'Warning');
                return (
                  <tr key={asset.id} className="table-glass" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <Link to={`/assets/${asset.id}`} style={{ textDecoration: 'none' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1c1c1e', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {breach && <AlertTriangle size={12} color="#f87171" />}
                          {!breach && warn && <AlertTriangle size={12} color="#fbbf24" />}
                          {asset.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>{asset.address}</div>
                      </Link>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: 'rgba(60,60,67,0.70)' }}>{asset.city}</td>
                    <td style={{ padding: '14px 16px' }}><span className="badge-neutral">{asset.usageType}</span></td>
                    <td style={{ padding: '14px 16px', fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 600, color: '#007aff' }}>{formatEUR(asset.currentValue, true)}</td>
                    <td style={{ padding: '14px 16px', fontFamily: 'ui-monospace, monospace', fontSize: 13, color: '#1c1c1e' }}>{formatEUR(asset.annualRent, true)}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <StatusBadge status={asset.occupancyRate > 0.9 ? 'OK' : asset.occupancyRate > 0.8 ? 'Warning' : 'Breach'} label={`${(asset.occupancyRate * 100).toFixed(0)}%`} />
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <StatusBadge status={ltv < 55 ? 'OK' : ltv < 65 ? 'Warning' : 'Breach'} label={`${ltv.toFixed(1)}%`} />
                    </td>
                    <td style={{ padding: '14px 16px' }}><CompletenessRing score={asset.completenessScore} size={36} /></td>
                    <td style={{ padding: '14px 16px' }}>
                      <Link to={`/assets/${asset.id}`} style={{ color: '#007aff', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 12 }}>
                        Detail <ChevronRight size={12} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </GlassPanel>
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {filtered.map(asset => (
            <Link key={asset.id} to={`/assets/${asset.id}`} style={{ textDecoration: 'none' }}>
              <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <TitleImageDisplay entityId={asset.id} height={120} />
                <div style={{ padding: 20 }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1c1c1e' }}>{asset.name}</div>
                    <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)' }}>{asset.city} · {asset.usageType}</div>
                  </div>
                  <CompletenessRing score={asset.completenessScore} size={38} />
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div><div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)' }}>WERT</div><div style={{ fontSize: 16, fontWeight: 700, color: '#007aff' }}>{formatEUR(asset.currentValue, true)}</div></div>
                  <div><div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)' }}>MIETE/J</div><div style={{ fontSize: 16, fontWeight: 700, color: '#1c1c1e' }}>{formatEUR(asset.annualRent, true)}</div></div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <StatusBadge status={asset.occupancyRate > 0.9 ? 'OK' : 'Warning'} label={`${(asset.occupancyRate * 100).toFixed(0)}%`} />
                  <span className="badge-neutral">{asset.units.length} Units</span>
                </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Asset Detail Page ────────────────────────────────────────────────────────
export function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { assets, updateAsset, deleteAsset, addDocumentToAsset, deleteDocument } = useStore();
  const { t, lang } = useLanguage();
  const dateLocale = lang === 'de' ? 'de-DE' : 'en-GB';
  const asset = assets.find(a => a.id === id);
  const [activeTab, setActiveTab] = useState('overview');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingOpCosts, setEditingOpCosts] = useState(false);
  const [opCostEdits, setOpCostEdits] = useState<AssetOperatingCosts>(asset?.operatingCosts ?? { vacancyRatePercent: 5, managementCostPercent: 3, maintenanceReservePerSqm: 8, nonRecoverableOpex: 0, otherOperatingIncome: 0, rentalGrowthRate: 2 });
  const [dcfExitCap, setDcfExitCap] = useState<number | null>(null);
  const [dcfHolding, setDcfHolding] = useState<number | null>(null);

  if (!asset) return (
    <div className="p-8">
      <Link to="/assets" style={{ color: '#007aff' }}>{t('common.back')}</Link>
      <div style={{ color: 'rgba(60,60,67,0.45)', marginTop: 12 }}>{t('common.notFound')}</div>
    </div>
  );

  const totalDebt = asset.debtInstruments.reduce((s, d) => s + d.outstandingAmount, 0);
  const ltv = computeAssetLTV(asset);
  const noiBreakdown = computeAssetNOI(asset);
  const unrealisedGain = asset.currentValue - asset.purchasePrice;
  const unrealisedGainPct = asset.purchasePrice > 0 ? (unrealisedGain / asset.purchasePrice) * 100 : 0;

  // CF chart
  const now = new Date();
  const cfData = Array.from({ length: 10 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 4 + i, 1);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const inflow = asset.cashFlows.filter(c => c.period === period && c.amount > 0).reduce((s, c) => s + c.amount, 0);
    const outflow = Math.abs(asset.cashFlows.filter(c => c.period === period && c.amount < 0).reduce((s, c) => s + c.amount, 0));
    return {
      period: d.toLocaleDateString(dateLocale, { month: 'short' }),
      Einnahmen: Math.round(inflow / 1000),
      Ausgaben: Math.round(outflow / 1000),
      isForecast: i > 4,
    };
  });

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 mb-5">
        <Link to="/assets" style={{ color: 'rgba(60,60,67,0.45)', fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          <ArrowLeft size={14} /> Assets
        </Link>
        <ChevronRight size={14} color="var(--text-muted)" />
        <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.70)' }}>{asset.name}</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <CompletenessRing score={asset.completenessScore} size={52} />
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, fontFamily: '-apple-system, system-ui, sans-serif', margin: 0 }}>{asset.name}</h1>
            <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.70)', marginTop: 4 }}>{asset.address} · {asset.city}</div>
            <div className="flex items-center gap-2 mt-2">
              <span className="badge-accent">{t('portfolio.inventory')}</span>
              <span className="badge-neutral">{asset.usageType}</span>
              <span style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)' }}>{lang === 'de' ? 'Erwerb' : 'Acquired'}: {new Date(asset.acquisitionDate).toLocaleDateString(dateLocale)}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-glass px-4 py-2 rounded-xl text-sm flex items-center gap-2">
            <FileText size={14} /> Export
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

      {/* KPI strip */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <KPICard label="Market Value" value={formatEUR(asset.currentValue, true)} sub={`${lang === 'de' ? 'Erwerb' : 'Acquired'}: ${formatEUR(asset.purchasePrice, true)}`} status="neutral" />
        <KPICard label="Unrealised Gain" value={formatEUR(unrealisedGain, true)} sub={`${formatPct(unrealisedGainPct, 1)}`} status={unrealisedGain > 0 ? 'good' : 'danger'} trend={unrealisedGain > 0 ? 'up' : 'down'} />
        <KPICard label="NOI" value={formatEUR(noiBreakdown.noi, true)} sub={`NIY ${formatPct(asset.currentValue > 0 ? (noiBreakdown.noi / asset.currentValue) * 100 : 0)}`} status={noiBreakdown.noi > 0 ? 'good' : 'danger'} />
        <KPICard label="Occupancy Rate" value={formatPct(asset.occupancyRate * 100, 1)} sub={`${asset.units.filter(u => u.leaseType === 'Vermietet').length}/${asset.units.length} ${lang === 'de' ? 'Einheiten' : 'Units'}`} status={asset.occupancyRate > 0.9 ? 'good' : 'warning'} />
        <KPICard label="LTV" value={formatPct(ltv, 1)} sub={formatEUR(totalDebt, true)} status={ltv < 55 ? 'good' : ltv < 65 ? 'warning' : 'danger'} />
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)', display: 'inline-flex' }}>
          {['overview', 'rentroll', 'opscosts', 'debt', 'cashflow', 'documents'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="px-4 py-2 rounded-lg transition-all text-sm font-medium"
              style={{
                background: activeTab === tab ? 'rgba(201,169,110,0.15)' : 'transparent',
                color: activeTab === tab ? 'var(--accent)' : 'var(--text-secondary)',
                border: activeTab === tab ? '1px solid rgba(201,169,110,0.2)' : '1px solid transparent',
                cursor: 'pointer', fontSize: 13,
              }}>
              {tab === 'overview' ? t('assets.overview') : tab === 'rentroll' ? 'Rent Roll' : tab === 'opscosts' ? 'Operating Costs' : tab === 'debt' ? t('assets.debtOverview') : tab === 'cashflow' ? 'Cash Flow' : tab === 'images' ? (lang === 'de' ? 'Bilder' : 'Images') : t('assets.documents')}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-2 gap-6 animate-fade-in">
          {/* NOI Breakdown */}
          <GlassPanel style={{ padding: 24 }}>
            <SectionHeader title="NOI Breakdown" />
            <div className="space-y-2">
              {[
                { label: 'Gross Annual Rent', value: noiBreakdown.grossRent, color: '#007aff' },
                { label: `− Vacancy Loss (${asset.operatingCosts.vacancyRatePercent}%)`, value: -noiBreakdown.vacancyLoss, color: '#f87171' },
                { label: '+ Other Operating Income', value: asset.operatingCosts.otherOperatingIncome, color: '#4ade80' },
                { label: `− Management (${asset.operatingCosts.managementCostPercent}%)`, value: -noiBreakdown.managementCost, color: '#f87171' },
                { label: `− Maintenance (${asset.operatingCosts.maintenanceReservePerSqm} €/m²)`, value: -noiBreakdown.maintenanceReserve, color: '#f87171' },
                { label: '− Non-Recoverable Opex', value: -noiBreakdown.nonRecoverableOpex, color: '#f87171' },
              ].map(row => (
                <div key={row.label} className="flex justify-between py-1.5" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                  <span style={{ fontSize: 12, color: 'rgba(60,60,67,0.65)' }}>{row.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'ui-monospace, monospace', color: row.value >= 0 ? '#1c1c1e' : '#f87171' }}>{formatEUR(Math.abs(row.value))}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2" style={{ borderTop: '2px solid rgba(0,0,0,0.10)' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1c1c1e' }}>= NOI</span>
                <span style={{ fontSize: 15, fontWeight: 700, fontFamily: 'ui-monospace, monospace', color: noiBreakdown.noi >= 0 ? '#4ade80' : '#f87171' }}>{formatEUR(noiBreakdown.noi)}</span>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginTop: 8 }}>
                Operating Cost Ratio: {noiBreakdown.operatingCostRatio.toFixed(1)}% · NIY: {formatPct(asset.currentValue > 0 ? (noiBreakdown.noi / asset.currentValue) * 100 : 0)}
              </div>
            </div>
          </GlassPanel>
          <GlassPanel style={{ padding: 24 }}>
            <SectionHeader title="Covenant-Status" />
            {asset.covenants.length === 0 ? (
              <div style={{ color: 'rgba(60,60,67,0.45)', fontSize: 13 }}>Keine Covenants erfasst.</div>
            ) : (
              <div className="space-y-3">
                {asset.covenants.map(cov => (
                  <div key={cov.id} className="p-3 rounded-xl" style={{
                    background: cov.status === 'OK' ? 'rgba(74,222,128,0.07)' : cov.status === 'Warning' ? 'rgba(251,191,36,0.07)' : 'rgba(248,113,113,0.08)',
                    border: `1px solid ${cov.status === 'OK' ? 'rgba(74,222,128,0.15)' : cov.status === 'Warning' ? 'rgba(251,191,36,0.2)' : 'rgba(248,113,113,0.2)'}`,
                  }}>
                    <div className="flex justify-between items-center">
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1c1c1e' }}>{cov.name}</span>
                      <StatusBadge status={cov.status} />
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)', marginTop: 4 }}>
                      Aktuell: {cov.currentValue.toFixed(2)}{cov.type === 'LTV' ? '%' : 'x'} /
                      Schwelle: {cov.threshold}{cov.type === 'LTV' ? '%' : 'x'}
                    </div>
                    {cov.description && <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginTop: 4, fontStyle: 'italic' }}>{cov.description}</div>}
                  </div>
                ))}
              </div>
            )}
          </GlassPanel>
        </div>
      )}

      {activeTab === 'opscosts' && (
        <div className="animate-fade-in">
          <GlassPanel style={{ padding: 24 }}>
            <div className="flex items-center justify-between mb-6">
              <SectionHeader title="Operating Costs" />
              {!editingOpCosts ? (
                <button onClick={() => { setEditingOpCosts(true); setOpCostEdits(asset.operatingCosts); }}
                  className="btn-glass px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5" style={{ cursor: 'pointer' }}>
                  <Edit3 size={12} /> {t('common.edit')}
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setEditingOpCosts(false)} className="btn-glass px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5" style={{ cursor: 'pointer' }}>
                    <X size={12} /> {t('common.cancel')}
                  </button>
                  <button onClick={() => {
                    updateAsset(asset.id, { operatingCosts: opCostEdits });
                    setEditingOpCosts(false);
                  }} className="btn-accent px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5" style={{ cursor: 'pointer' }}>
                    <Save size={12} /> {t('common.save')}
                  </button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-6">
              {[
                { label: 'Vacancy Rate', key: 'vacancyRatePercent', unit: '%', step: 0.5 },
                { label: 'Management Cost', key: 'managementCostPercent', unit: '% of Gross Rent', step: 0.5 },
                { label: 'Maintenance Reserve', key: 'maintenanceReservePerSqm', unit: '€/m²/year', step: 1 },
                { label: 'Non-Recoverable Opex', key: 'nonRecoverableOpex', unit: '€/year', step: 1000 },
                { label: 'Other Operating Income', key: 'otherOperatingIncome', unit: '€/year', step: 1000 },
                { label: 'Mietindexierung', key: 'rentalGrowthRate', unit: '% p.a.', step: 0.1 },
              ].map(field => (
                <div key={field.key}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    {field.label} ({field.unit})
                  </label>
                  {editingOpCosts ? (
                    <input type="number" step={field.step} className="input-glass" style={{ width: '100%' }}
                      value={(opCostEdits as any)[field.key]}
                      onChange={e => setOpCostEdits(prev => ({ ...prev, [field.key]: parseFloat(e.target.value) || 0 }))} />
                  ) : (
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#1c1c1e', padding: '8px 0' }}>
                      {(asset.operatingCosts as any)[field.key]}{field.unit.startsWith('%') ? '%' : field.unit.startsWith('€/m') ? ' €/m²' : ' €'}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Live NOI impact preview */}
            {editingOpCosts && (
              <div className="mt-6 p-4 rounded-xl" style={{ background: 'rgba(0,122,255,0.05)', border: '1px solid rgba(0,122,255,0.12)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#007aff', marginBottom: 8 }}>
                  {lang === 'de' ? 'Live-Vorschau: Auswirkung auf NOI' : 'Live Preview: Impact on NOI'}
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {(() => {
                    const previewAsset = { ...asset, operatingCosts: opCostEdits };
                    const previewNOI = computeAssetNOI(previewAsset);
                    const delta = previewNOI.noi - noiBreakdown.noi;
                    return (
                      <>
                        <div><div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)' }}>CURRENT NOI</div><div style={{ fontSize: 16, fontWeight: 700 }}>{formatEUR(noiBreakdown.noi)}</div></div>
                        <div><div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)' }}>NEW NOI</div><div style={{ fontSize: 16, fontWeight: 700, color: '#007aff' }}>{formatEUR(previewNOI.noi)}</div></div>
                        <div><div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)' }}>DELTA</div><div style={{ fontSize: 16, fontWeight: 700, color: delta >= 0 ? '#4ade80' : '#f87171' }}>{delta >= 0 ? '+' : ''}{formatEUR(delta)}</div></div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </GlassPanel>
        </div>
      )}

      {activeTab === 'rentroll' && (
        <GlassPanel style={{ overflow: 'hidden' }} className="animate-fade-in">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                {[lang === 'de' ? 'Einheit' : 'Unit', lang === 'de' ? 'Etage' : 'Floor', lang === 'de' ? 'Fläche' : 'Area', lang === 'de' ? 'Nutzung' : 'Usage', 'Status', lang === 'de' ? 'Mieter' : 'Tenant', '€/m²', lang === 'de' ? 'Monatsmiete' : 'Monthly Rent', lang === 'de' ? 'Mietende' : 'Lease End'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.45)', textAlign: 'left', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {asset.units.map(unit => (
                <tr key={unit.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#1c1c1e' }}>{unit.unitNumber}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'rgba(60,60,67,0.70)' }}>{unit.floor > 0 ? `${unit.floor}. OG` : unit.floor < 0 ? 'UG' : 'EG'}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'ui-monospace, monospace', fontSize: 13, color: '#1c1c1e' }}>{unit.area} m²</td>
                  <td style={{ padding: '12px 16px' }}><span className="badge-neutral">{unit.usageType}</span></td>
                  <td style={{ padding: '12px 16px' }}><StatusBadge status={unit.leaseType === 'Vermietet' ? 'OK' : unit.leaseType === 'Leerstand' ? 'Breach' : 'Warning'} label={unit.leaseType} /></td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'rgba(60,60,67,0.70)' }}>{unit.tenant || '—'}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'ui-monospace, monospace', fontSize: 13, color: unit.rentPerSqm > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {unit.rentPerSqm > 0 ? `${unit.rentPerSqm.toFixed(2)} €` : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'ui-monospace, monospace', fontSize: 13, color: '#007aff', fontWeight: 600 }}>
                    {unit.monthlyRent > 0 ? formatEUR(unit.monthlyRent) : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'rgba(60,60,67,0.45)' }}>
                    {unit.leaseEnd ? new Date(unit.leaseEnd).toLocaleDateString(dateLocale) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassPanel>
      )}

      {activeTab === 'debt' && (
        <div className="space-y-4 animate-fade-in">
          {asset.debtInstruments.map(debt => (
            <GlassPanel key={debt.id} style={{ padding: 24 }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1c1c1e' }}>{debt.lender}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="badge-neutral">{debt.type}</span>
                    <span className="badge-neutral">{debt.interestType}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#007aff', fontFamily: 'ui-monospace, monospace' }}>{formatEUR(debt.outstandingAmount, true)}</div>
                  <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)' }}>Ursprung: {formatEUR(debt.amount, true)}</div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div><div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)' }}>ZINSSATZ</div><div style={{ fontSize: 16, fontWeight: 700, color: '#1c1c1e' }}>{debt.interestRate.toFixed(2)}%</div></div>
                <div><div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)' }}>TILGUNG</div><div style={{ fontSize: 16, fontWeight: 700, color: '#1c1c1e' }}>{debt.amortizationRate}%</div></div>
                <div><div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)' }}>FÄLLIGKEIT</div><div style={{ fontSize: 16, fontWeight: 700, color: new Date(debt.maturityDate) < new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 2) ? '#fbbf24' : 'var(--text-primary)' }}>{new Date(debt.maturityDate).toLocaleDateString(dateLocale)}</div></div>
                <div><div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)' }}>VALUTIERUNG</div><div style={{ fontSize: 16, fontWeight: 700, color: '#1c1c1e' }}>{new Date(debt.drawdownDate).toLocaleDateString(dateLocale)}</div></div>
              </div>
            </GlassPanel>
          ))}
          {asset.debtInstruments.length === 0 && (
            <GlassPanel style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ color: 'rgba(60,60,67,0.45)' }}>Keine Fremdfinanzierung erfasst.</div>
            </GlassPanel>
          )}
        </div>
      )}

      {activeTab === 'cashflow' && (() => {
        const annualDebtService = asset.debtInstruments.reduce((s, d) =>
          s + d.outstandingAmount * ((d.interestRate / 100) + (d.amortizationRate / 100)), 0);
        const dcf = computePropertyCashFlow(asset, {
          holdingPeriodYears: dcfHolding ?? asset.holdingPeriodYears ?? 10,
          exitCapRate: dcfExitCap ?? asset.exitCapRate ?? 5.0,
          annualDebtService,
        });
        const chartData = dcf.annualRows.map(r => ({
          year: `Jahr ${r.year}`,
          NOI: Math.round(r.noi / 1000),
          'Levered CF': Math.round(r.leveredCashFlow / 1000),
          Kumulativ: Math.round(r.cumulative / 1000),
        }));
        const kpiLabelStyle = { fontSize: 10, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' };
        const kpiValStyle = (c?: string): React.CSSProperties => ({ fontSize: 18, fontWeight: 700, color: c || '#1c1c1e', fontFamily: 'ui-monospace, monospace' });
        return (
          <div className="space-y-6 animate-fade-in">
            {/* Assumptions Panel */}
            <GlassPanel style={{ padding: 20 }}>
              <div className="flex items-center justify-between mb-4">
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1c1c1e' }}>DCF-Annahmen</div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label style={{ ...kpiLabelStyle, display: 'block', marginBottom: 4 }}>Haltedauer (Jahre)</label>
                  <input type="number" className="input-glass" style={{ width: '100%' }}
                    value={dcfHolding ?? asset.holdingPeriodYears ?? 10}
                    onChange={e => setDcfHolding(parseInt(e.target.value) || 10)} />
                </div>
                <div>
                  <label style={{ ...kpiLabelStyle, display: 'block', marginBottom: 4 }}>Exit-Cap-Rate (%)</label>
                  <input type="number" step="0.1" className="input-glass" style={{ width: '100%' }}
                    value={dcfExitCap ?? asset.exitCapRate ?? 5.0}
                    onChange={e => setDcfExitCap(parseFloat(e.target.value) || 5.0)} />
                </div>
                <div>
                  <label style={{ ...kpiLabelStyle, display: 'block', marginBottom: 4 }}>Mietwachstum p.a. (%)</label>
                  <input type="number" step="0.1" className="input-glass" readOnly
                    style={{ width: '100%', opacity: 0.6, cursor: 'not-allowed' }}
                    value={asset.operatingCosts.rentalGrowthRate ?? 2.0} />
                  <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.40)', marginTop: 2 }}>Bearbeitung in OpCosts</div>
                </div>
                <div>
                  <label style={{ ...kpiLabelStyle, display: 'block', marginBottom: 4 }}>ERV €/m²/Mon</label>
                  <input type="number" step="0.5" className="input-glass" style={{ width: '100%', opacity: 0.6, cursor: 'not-allowed' }}
                    value={asset.ervPerSqm ?? 0} readOnly />
                  <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.40)', marginTop: 2 }}>Aus Underwriting</div>
                </div>
              </div>
            </GlassPanel>

            {/* IRR KPI Strip */}
            <div className="grid grid-cols-4 gap-4">
              <GlassPanel style={{ padding: 18 }}>
                <div style={kpiLabelStyle}>Unlevered IRR</div>
                <div style={kpiValStyle(dcf.unleveredIRR > 8 ? '#4ade80' : dcf.unleveredIRR > 5 ? '#fbbf24' : '#f87171')}>{dcf.unleveredIRR.toFixed(2)}%</div>
                <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginTop: 2 }}>Auf Gesamtkapital</div>
              </GlassPanel>
              <GlassPanel style={{ padding: 18 }}>
                <div style={kpiLabelStyle}>Levered IRR</div>
                <div style={kpiValStyle(dcf.leveredIRR > 12 ? '#4ade80' : dcf.leveredIRR > 8 ? '#fbbf24' : '#f87171')}>{dcf.leveredIRR.toFixed(2)}%</div>
                <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginTop: 2 }}>Auf Eigenkapital</div>
              </GlassPanel>
              <GlassPanel style={{ padding: 18 }}>
                <div style={kpiLabelStyle}>Equity Multiple</div>
                <div style={kpiValStyle(dcf.equityMultiple > 1.5 ? '#4ade80' : dcf.equityMultiple > 1.2 ? '#fbbf24' : '#f87171')}>{dcf.equityMultiple.toFixed(2)}x</div>
                <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginTop: 2 }}>EK-Rückfluss</div>
              </GlassPanel>
              <GlassPanel style={{ padding: 18 }}>
                <div style={kpiLabelStyle}>Exit-Wert (Jahr {dcf.holdingPeriodYears})</div>
                <div style={kpiValStyle('#007aff')}>{formatEUR(dcf.terminalValue, true)}</div>
                <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginTop: 2 }}>@ {dcf.exitCapRate}% Cap Rate</div>
              </GlassPanel>
            </div>

            {/* Chart */}
            <GlassPanel style={{ padding: 24 }}>
              <SectionHeader title="NOI & Levered Cash Flow (jährlich)" />
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'rgba(60,60,67,0.55)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'rgba(60,60,67,0.55)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}k`} />
                  <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(0,0,0,0.10)', borderRadius: 10, fontSize: 12 }} formatter={(v: any) => [`${v}k €`]} />
                  <Bar dataKey="NOI" fill="rgba(0,122,255,0.7)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Levered CF" fill="rgba(74,222,128,0.7)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </GlassPanel>

            {/* Annual Table */}
            <GlassPanel style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1c1c1e' }}>Jährliche Cashflow-Tabelle</div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
                      {['Jahr', 'Gross Rent', '− Leerstand', 'EGI', '− OpEx', 'NOI', '− Debt Service', 'Levered CF', 'Kumulativ'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 600, color: 'rgba(60,60,67,0.45)', textAlign: 'right', letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dcf.annualRows.map(row => (
                      <tr key={row.year} style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1c1c1e', textAlign: 'right' }}>{row.year}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, monospace', color: '#007aff', textAlign: 'right' }}>{formatEUR(row.grossRent, true)}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, monospace', color: '#f87171', textAlign: 'right' }}>−{formatEUR(row.vacancyLoss, true)}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, monospace', color: '#1c1c1e', textAlign: 'right' }}>{formatEUR(row.effectiveGrossIncome, true)}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, monospace', color: '#f87171', textAlign: 'right' }}>−{formatEUR(row.managementCost + row.maintenanceReserve + row.nonRecoverableOpex, true)}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, monospace', fontWeight: 600, color: row.noi >= 0 ? '#1c1c1e' : '#f87171', textAlign: 'right' }}>{formatEUR(row.noi, true)}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, monospace', color: '#fbbf24', textAlign: 'right' }}>−{formatEUR(row.debtService, true)}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: row.leveredCashFlow >= 0 ? '#4ade80' : '#f87171', textAlign: 'right' }}>{row.leveredCashFlow >= 0 ? '+' : ''}{formatEUR(row.leveredCashFlow, true)}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, monospace', color: row.cumulative >= 0 ? '#4ade80' : '#f87171', textAlign: 'right' }}>{formatEUR(row.cumulative, true)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '2px solid rgba(0,0,0,0.10)', background: 'rgba(0,122,255,0.03)' }}>
                      <td colSpan={5} style={{ padding: '12px 14px', fontSize: 12, fontWeight: 700, color: '#1c1c1e' }}>Exit-Wert (Jahr {dcf.holdingPeriodYears})</td>
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

      {activeTab === 'images' && (
        <GlassPanel style={{ padding: 24 }} className="animate-fade-in">
          <SectionHeader title="Bilder" />
          <ImageManager entityId={asset.id} entityType="Asset" />
        </GlassPanel>
      )}

      {activeTab === 'documents' && (
        <GlassPanel style={{ padding: 24 }} className="animate-fade-in">
          <SectionHeader title={t('assets.documents')} />
          <DocumentUpload
            documents={asset.documents}
            entityId={asset.id}
            entityType="asset"
            onUpload={(doc) => addDocumentToAsset(asset.id, doc)}
            onDelete={(docId) => deleteDocument('asset', asset.id, docId)}
            lang={lang}
          />
        </GlassPanel>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 20, padding: 28, maxWidth: 420, width: '90%', boxShadow: '0 24px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1c1c1e', marginBottom: 12 }}>Asset löschen</div>
            <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.15)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#ff3b30', marginBottom: 6 }}>Wirklich löschen?</div>
              <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.70)' }}>
                <strong>{asset.name}</strong> wird unwiderruflich aus dem Bestand entfernt. Alle zugehörigen Daten, Dokumente und Einheiten gehen verloren.
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteModal(false)} className="btn-glass px-4 py-2 rounded-xl text-sm">Abbrechen</button>
              <button
                onClick={() => { deleteAsset(asset.id); navigate('/assets'); }}
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
