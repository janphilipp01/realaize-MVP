import { Upload, FileText } from 'lucide-react';
import { GlassPanel, SectionHeader } from '@/components/shared';
import { useLanguage } from '@/i18n/LanguageContext';
import type { DevelopmentProject } from '@/models/types';

export function DocumentsTab({ dev }: { dev: DevelopmentProject }) {
  const { t } = useLanguage();
  return (
        <GlassPanel style={{ padding: 24 }} className="animate-fade-in">
          <div className="flex justify-between mb-4">
            <SectionHeader title="Documents" />
            <button className="btn-glass px-3 py-1.5 rounded-xl text-xs flex items-center gap-1"><Upload size={12} /> {t('documents.upload')}</button>
          </div>
          <div className="space-y-2">
            {dev.documents.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.05)' }}>
                <FileText size={15} color="#007aff" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1c1c1e' }}>{doc.name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>{doc.fileSize} · {doc.uploadedBy}</div>
                </div>
                <div className="flex gap-1">{doc.tags.map(t => <span key={t} className="badge-neutral" style={{ fontSize: 10 }}>{t}</span>)}</div>
              </div>
            ))}
          </div>
        </GlassPanel>
  );
}
