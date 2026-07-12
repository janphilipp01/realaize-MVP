import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { KPICard, GlassPanel, StatusBadge, Modal, SectionHeader } from '@/components/shared';
import { formatEUR } from '@/utils/kpiEngine';
import { useStore } from '@/store/useStore';
import { useLanguage } from '@/i18n/LanguageContext';
import type { DevelopmentProject, Unit, UsageType } from '@/models/types';

export function RentRollTab({ dev }: { dev: DevelopmentProject }) {
  const { lang } = useLanguage();
  const dateLocale = lang === 'de' ? 'de-DE' : 'en-GB';
  const { addDevUnit, deleteDevUnit } = useStore();
  const [showAddUnitModal, setShowAddUnitModal] = useState(false);
  const [newUnit, setNewUnit] = useState<Partial<Unit>>({ leaseType: 'Leerstand', usageType: 'Wohnen', floor: 0 });
  return (
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
  );
}
