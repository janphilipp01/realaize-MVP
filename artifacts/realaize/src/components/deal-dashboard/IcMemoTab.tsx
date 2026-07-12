import React from 'react';
import { AlertTriangle, FileText } from 'lucide-react';

import { GlassPanel } from '@/components/shared';

import { useDateLocale } from '@/i18n/LanguageContext';

import type { AcquisitionDeal } from '@/models/types';

export function IcMemoTab({ deal }: { deal: AcquisitionDeal }) {
  const dateLocale = useDateLocale();
  return (
        <div className="animate-fade-in">
          {deal.icMemo ? (
            <div className="space-y-4">
              {[
                { title: 'Executive Summary', content: deal.icMemo.executiveSummary },
                { title: 'Investment Rationale', content: deal.icMemo.investmentRationale },
                { title: 'Exit-Strategie', content: deal.icMemo.exitStrategy },
                { title: 'Empfehlung', content: deal.icMemo.recommendedAction, highlight: true },
              ].map(section => (
                <GlassPanel key={section.title} style={{ padding: 24, border: section.highlight ? '1px solid rgba(201,169,110,0.2)' : undefined }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: section.highlight ? 'var(--accent)' : 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>{section.title}</div>
                  <div style={{ fontSize: 14, color: 'rgba(60,60,67,0.70)', lineHeight: 1.7 }}>{section.content}</div>
                </GlassPanel>
              ))}
              <GlassPanel style={{ padding: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(60,60,67,0.45)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>Risikofaktoren</div>
                <div className="space-y-2">
                  {deal.icMemo.riskFactors.map((risk, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <AlertTriangle size={13} color="#fbbf24" style={{ marginTop: 2, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.70)' }}>{risk}</span>
                    </div>
                  ))}
                </div>
              </GlassPanel>
              <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', textAlign: 'center' }}>
                Erstellt von: {deal.icMemo.preparedBy} · {new Date(deal.icMemo.preparedAt).toLocaleDateString(dateLocale)}
              </div>
            </div>
          ) : (
            <GlassPanel style={{ padding: 48, textAlign: 'center' }}>
              <FileText size={32} color="var(--text-muted)" />
              <div style={{ color: 'rgba(60,60,67,0.45)', marginTop: 12 }}>IC Memo noch nicht verfügbar.</div>
            </GlassPanel>
          )}
        </div>
  );
}
