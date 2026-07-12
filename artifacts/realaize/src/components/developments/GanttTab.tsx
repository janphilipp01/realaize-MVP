import { useState } from 'react';
import { Edit3, Save, X } from 'lucide-react';
import { GlassPanel, SectionHeader } from '@/components/shared';
import { formatEUR } from '@/utils/kpiEngine';
import { useStore } from '@/store/useStore';
import { useDateLocale } from '@/i18n/LanguageContext';
import { STATUS_COLORS } from '@/components/developments/constants';
import type { DevelopmentProject } from '@/models/types';

export function GanttTab({ dev, ganttMonths }: { dev: DevelopmentProject; ganttMonths: string[] }) {
  const dateLocale = useDateLocale();
  const { updateGewerk } = useStore();
  const [editingGanttGw, setEditingGanttGw] = useState<string | null>(null);
  const [ganttGwEdits, setGanttGwEdits] = useState<{ ganttStart?: string; ganttDurationMonths?: number }>({});
  return (
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
  );
}
