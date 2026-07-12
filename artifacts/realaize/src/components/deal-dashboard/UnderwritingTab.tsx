import React, { useState } from 'react';
import { Edit3, Save, X } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { GlassPanel, SectionHeader } from '@/components/shared';

import { useDateLocale } from '@/i18n/LanguageContext';

import type { AcquisitionDeal } from '@/models/types';

export function UnderwritingTab({ deal }: { deal: AcquisitionDeal }) {
  const { updateDeal, addActivityToDeal } = useStore();
  const dateLocale = useDateLocale();
  const [editingUW, setEditingUW] = useState(false);
  const [uwEdit, setUwEdit] = useState<any>(null);
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
  const uwValues = uwEdit || deal.underwritingAssumptions;
  return (
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
  );
}
