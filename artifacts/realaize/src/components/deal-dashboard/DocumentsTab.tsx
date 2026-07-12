import React from 'react';
import { FileText, Upload } from 'lucide-react';

import { GlassPanel, SectionHeader } from '@/components/shared';

import { useDateLocale } from '@/i18n/LanguageContext';

import type { AcquisitionDeal } from '@/models/types';

export function DocumentsTab({ deal }: { deal: AcquisitionDeal }) {
  const dateLocale = useDateLocale();
  return (
        <div className="animate-fade-in">
          <GlassPanel style={{ padding: 24 }}>
            <div className="flex items-center justify-between mb-4">
              <SectionHeader title="Dokumente" />
              <button className="btn-glass px-3 py-2 rounded-xl text-sm flex items-center gap-2">
                <Upload size={14} /> Hochladen
              </button>
            </div>
            {deal.documents.length === 0 ? (
              <div className="text-center py-8" style={{ color: 'rgba(60,60,67,0.45)' }}>Noch keine Dokumente vorhanden.</div>
            ) : (
              <div className="space-y-2">
                {deal.documents.map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl glass-hover" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
                    <FileText size={16} color="#007aff" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1c1c1e' }}>{doc.name}</div>
                      <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>{doc.category} · {doc.fileSize} · {doc.uploadedBy}</div>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {doc.tags.map(t => <span key={t} className="badge-neutral" style={{ fontSize: 10 }}>{t}</span>)}
                    </div>
                    <span style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>{new Date(doc.uploadDate).toLocaleDateString(dateLocale)}</span>
                  </div>
                ))}
              </div>
            )}
          </GlassPanel>
        </div>
  );
}
