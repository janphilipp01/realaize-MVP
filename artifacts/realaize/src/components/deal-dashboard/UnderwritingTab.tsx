import React, { useState } from 'react';
import { Edit3, Save, X } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { GlassPanel, SectionHeader } from '@/components/shared';

import { useDateLocale, useLanguage } from '@/i18n/LanguageContext';

import type { AcquisitionDeal } from '@/models/types';

export function UnderwritingTab({ deal }: { deal: AcquisitionDeal }) {
  const { updateDeal, addActivityToDeal } = useStore();
  const { t } = useLanguage();
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
              <SectionHeader title="Underwriting Assumptions" />
              {!editingUW ? (
                <button onClick={() => { setEditingUW(true); setUwEdit({ ...deal.underwritingAssumptions }); }}
                  className="btn-glass px-4 py-2 rounded-xl text-sm flex items-center gap-2">
                  <Edit3 size={14} /> {t('common.edit')}
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => { setEditingUW(false); setUwEdit(null); }} className="btn-glass px-3 py-2 rounded-xl text-sm flex items-center gap-1"><X size={12} /></button>
                  <button onClick={handleSaveUW} className="btn-accent px-4 py-2 rounded-xl text-sm flex items-center gap-2"><Save size={14} /> {t('common.save')}</button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {[
                { key: 'purchasePrice', label: 'Purchase Price (EUR)', type: 'number', prefix: '€' },
                { key: 'closingCostPercent', label: 'Closing Costs (%)', type: 'number' },
                { key: 'brokerFeePercent', label: 'Broker Fee (%)', type: 'number' },
                { key: 'initialCapex', label: 'Initial CapEx (EUR)', type: 'number', prefix: '€' },
                { key: 'annualGrossRent', label: 'Annual Gross Rent (EUR)', type: 'number', prefix: '€' },
                { key: 'rentPerSqm', label: 'Rent per m²/Month (EUR)', type: 'number', prefix: '€' },
                { key: 'vacancyRatePercent', label: 'Vacancy Rate (%)', type: 'number' },
                { key: 'managementCostPercent', label: 'Management Cost (%)', type: 'number' },
                { key: 'maintenanceReservePerSqm', label: 'Maintenance Reserve (€/m²/year)', type: 'number', prefix: '€' },
                { key: 'nonRecoverableOpex', label: 'Non-Recoverable Opex (EUR)', type: 'number', prefix: '€' },
                { key: 'area', label: 'Area (m²)', type: 'number' },
                { key: 'otherOperatingIncome', label: 'Other Operating Income (EUR)', type: 'number', prefix: '€' },
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
