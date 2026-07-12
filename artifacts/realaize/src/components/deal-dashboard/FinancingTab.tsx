import React, { useState } from 'react';
import { Edit3, Save, X } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { GlassPanel, SectionHeader } from '@/components/shared';
import { computeDealKPIs, formatEUR, formatPct } from '@/utils/kpiEngine';

import { useDateLocale } from '@/i18n/LanguageContext';

import type { AcquisitionDeal } from '@/models/types';

export function FinancingTab({ deal }: { deal: AcquisitionDeal }) {
  const { updateDeal } = useStore();
  const dateLocale = useDateLocale();
  const kpis = computeDealKPIs(deal.underwritingAssumptions, deal.financingAssumptions);
  const [editingFin, setEditingFin] = useState(false);
  const [finEdit, setFinEdit] = useState<any>(null);
  const handleSaveFin = () => {
    if (finEdit) {
      updateDeal(deal.id, { financingAssumptions: { ...deal.financingAssumptions, ...finEdit } });
    }
    setEditingFin(false);
    setFinEdit(null);
  };
  const finValues = finEdit || deal.financingAssumptions;
  return (
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
  );
}
