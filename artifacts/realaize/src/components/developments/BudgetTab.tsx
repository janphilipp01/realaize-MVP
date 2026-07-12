import React, { useState, useRef } from 'react';
import { Plus, Edit3, Save, X, Trash2 } from 'lucide-react';
import { GlassPanel, SectionHeader } from '@/components/shared';
import { formatEUR } from '@/utils/kpiEngine';
import { useStore } from '@/store/useStore';
import { useListContacts } from '@workspace/api-client-react';
import { GEWERK_CATEGORIES, STATUS_COLORS } from '@/components/developments/constants';
import type { DevelopmentProject, GeverkPosition, GeverkCategory } from '@/models/types';

interface Props {
  dev: DevelopmentProject;
  totalBudget: number;
  totalOffer: number;
  totalContract: number;
}

export function BudgetTab({ dev, totalBudget, totalOffer, totalContract }: Props) {
  const { updateGewerk, addGewerk, deleteGewerk, addOffer, updateOffer, deleteOffer, addInvoice, updateInvoice, deleteInvoice } = useStore();
  const { data: contacts = [] } = useListContacts();
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
  return (
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
                          <select className="input-glass" style={{ fontSize: 11, padding: '3px 4px', width: '100%' }} value={gwEdits.status || gw.status} onChange={e => setGwEdits(p => ({ ...p, status: e.target.value as typeof gw.status }))}>
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
                          <select className="input-glass" value={inv.invoiceType} onChange={e => updateInvoice(dev.id, inv.id, { invoiceType: e.target.value as typeof inv.invoiceType })} style={{ fontSize: 11, width: 110 }}>
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
  );
}
