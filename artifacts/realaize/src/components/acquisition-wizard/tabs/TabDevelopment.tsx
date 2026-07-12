import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { pdComputeTotalArea, pdComputeTotalDevBudget } from '@/utils/propertyCashFlowModel';
import type { PropertyData, GewerkePosition } from '@/models/types';
import { DEFAULT_GEWERKE_CATEGORIES } from '@/models/types';
import { COST_DISTRIBUTIONS, uid, fmt, Field, Chip, SH } from '@/components/acquisition-wizard/shared';

export function TabDevelopment({ pd, onChange }: { pd: PropertyData; onChange: (p: Partial<PropertyData>) => void }) {
  const totalArea = pdComputeTotalArea(pd.unitsTarget.length > 0 ? pd.unitsTarget : pd.unitsAsIs);
  const rawBudget = pd.gewerke.reduce((s, g) => s + g.budgetTotal, 0);
  const totalBudget = pdComputeTotalDevBudget(pd.gewerke, pd.contingencyPercent);

  const addGewerk = () => {
    onChange({
      gewerke: [...pd.gewerke, {
        id: uid(), category: 'Rohbau', description: '',
        budgetInputMode: 'pauschal', budgetAmount: 0, budgetTotal: 0, costPerSqm: 0,
        startWeek: 1, durationWeeks: 8, endWeek: 9,
        costDistribution: 'linear', status: 'Geplant',
      }]
    });
  };

  const updateGw = (id: string, patch: Partial<GewerkePosition>) => {
    onChange({
      gewerke: pd.gewerke.map(g => {
        if (g.id !== id) return g;
        const updated = { ...g, ...patch };
        if ('budgetAmount' in patch || 'budgetInputMode' in patch) {
          updated.budgetTotal = updated.budgetInputMode === 'per_sqm'
            ? updated.budgetAmount * totalArea
            : updated.budgetAmount;
          updated.costPerSqm = totalArea > 0 ? updated.budgetTotal / totalArea : 0;
        }
        if ('startWeek' in patch || 'durationWeeks' in patch) {
          updated.endWeek = updated.startWeek + updated.durationWeeks - 1;
        }
        return updated;
      })
    });
  };

  const maxWeek = pd.gewerke.length > 0 ? Math.max(...pd.gewerke.map(g => g.startWeek + g.durationWeeks - 1)) : 0;
  const ganttWidth = Math.max(maxWeek, 1);

  return (
    <div>
      <SH>Projektparameter</SH>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
        <Field label="Projektstart" type="date" value={pd.projectStart} onChange={e => onChange({ projectStart: e.target.value })} />
        <Field label="Contingency %" type="number" step="0.5" value={pd.contingencyPercent} onChange={e => onChange({ contingencyPercent: parseFloat(e.target.value) || 0 })} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'flex-end' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Gesamtbudget inkl. Contingency</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#007aff' }}>{fmt(totalBudget)}</div>
        </div>
      </div>

      <SH>Gewerke</SH>
      <div style={{ overflowX: 'auto', marginBottom: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
              {['Gewerk', 'Beschreibung', 'Modus', 'Budget', 'Start KW', 'Dauer KW', 'Gesamt €', 'Verteilung', 'Status', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 10, fontWeight: 700, color: 'rgba(60,60,67,0.45)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pd.gewerke.map(g => (
              <tr key={g.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                <td style={{ padding: '4px 6px' }}>
                  <select className="input-glass" value={g.category} onChange={e => updateGw(g.id, { category: e.target.value })} style={{ width: 130, fontSize: 12 }}>
                    {DEFAULT_GEWERKE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td style={{ padding: '4px 6px' }}><input className="input-glass" value={g.description} onChange={e => updateGw(g.id, { description: e.target.value })} style={{ width: 120, fontSize: 12 }} /></td>
                <td style={{ padding: '4px 6px' }}>
                  <select className="input-glass" value={g.budgetInputMode} onChange={e => updateGw(g.id, { budgetInputMode: e.target.value as any })} style={{ width: 80, fontSize: 12 }}>
                    <option value="pauschal">Pausch.</option>
                    <option value="per_sqm">€/m²</option>
                  </select>
                </td>
                <td style={{ padding: '4px 6px' }}><input className="input-glass" type="number" value={g.budgetAmount || ''} onChange={e => updateGw(g.id, { budgetAmount: parseFloat(e.target.value) || 0 })} style={{ width: 90, fontSize: 12 }} /></td>
                <td style={{ padding: '4px 6px' }}><input className="input-glass" type="number" value={g.startWeek} onChange={e => updateGw(g.id, { startWeek: parseInt(e.target.value) || 1 })} style={{ width: 56, fontSize: 12 }} /></td>
                <td style={{ padding: '4px 6px' }}><input className="input-glass" type="number" value={g.durationWeeks} onChange={e => updateGw(g.id, { durationWeeks: parseInt(e.target.value) || 1 })} style={{ width: 56, fontSize: 12 }} /></td>
                <td style={{ padding: '4px 6px', fontWeight: 600, color: '#007aff', whiteSpace: 'nowrap' }}>{fmt(g.budgetTotal)}</td>
                <td style={{ padding: '4px 6px' }}>
                  <select className="input-glass" value={g.costDistribution} onChange={e => updateGw(g.id, { costDistribution: e.target.value as any })} style={{ width: 90, fontSize: 12 }}>
                    {COST_DISTRIBUTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </td>
                <td style={{ padding: '4px 6px' }}>
                  <select className="input-glass" value={g.status} onChange={e => updateGw(g.id, { status: e.target.value as any })} style={{ width: 100, fontSize: 12 }}>
                    {['Geplant', 'Beauftragt', 'Laufend', 'Abgeschlossen'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td style={{ padding: '4px 6px' }}><button onClick={() => onChange({ gewerke: pd.gewerke.filter(x => x.id !== g.id) })} className="btn-ghost" style={{ padding: '4px', color: '#f87171' }}><Trash2 size={13} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={addGewerk}
        className="btn-ghost"
        style={{
          fontSize: 12, marginBottom: 24, whiteSpace: 'nowrap',
          display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
          border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '6px 12px',
        }}
      >
        <Plus size={12} /> Gewerk hinzufügen
      </button>

      {pd.gewerke.length > 0 && (
        <>
          <SH>Bauablauf (Gantt)</SH>
          <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
            <div style={{ minWidth: ganttWidth * 14 + 160, fontFamily: 'monospace' }}>
              {pd.gewerke.map((g, i) => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 4, height: 22 }}>
                  <div style={{ width: 160, fontSize: 11, color: 'rgba(60,60,67,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{g.category}</div>
                  <div style={{ flex: 1, position: 'relative', height: 18 }}>
                    <div style={{
                      position: 'absolute',
                      left: `${((g.startWeek - 1) / ganttWidth) * 100}%`,
                      width: `${(g.durationWeeks / ganttWidth) * 100}%`,
                      height: '100%',
                      background: 'rgba(0,122,255,0.25)',
                      border: '1px solid rgba(0,122,255,0.5)',
                      borderRadius: 4,
                      display: 'flex', alignItems: 'center', paddingLeft: 4,
                    }}>
                      <span style={{ fontSize: 10, color: '#007aff', whiteSpace: 'nowrap' }}>{fmt(g.budgetTotal)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16 }}>
            <Chip label="Budget netto" value={fmt(rawBudget)} />
            <Chip label="Contingency" value={fmt(totalBudget - rawBudget)} color="#f59e0b" />
            <Chip label="Budget gesamt" value={fmt(totalBudget)} color="#007aff" />
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 7: Finanzierung
// ═══════════════════════════════════════════════════════════════════════════
