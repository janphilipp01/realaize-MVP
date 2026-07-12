import { useState } from 'react';
import { Upload, Search, FileText } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { PageHeader, GlassPanel } from '@/components/shared';
import { useLanguage } from '@/i18n/LanguageContext';

// ══════════════════════════════════════════════════════════
// DOCUMENTS PAGE
// ══════════════════════════════════════════════════════════
export function DocumentsPage() {
  const { assets, deals } = useStore();
  const { t, lang } = useLanguage();
  const dateLocale = lang === 'de' ? 'de-DE' : 'en-GB';
  const [filterCat, setFilterCat] = useState('Alle');
  const [search, setSearch] = useState('');

  const allDocs = [
    ...assets.flatMap(a => a.documents.map(d => ({ ...d, linkedName: a.name }))),
    ...deals.flatMap(d => d.documents.map(doc => ({ ...doc, linkedName: d.name }))),
  ];

  const categories = ['Alle', ...Array.from(new Set(allDocs.map(d => d.category)))];
  const filtered = allDocs.filter(d => {
    const matchCat = filterCat === 'Alle' || d.category === filterCat;
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title={t('documents.title')}
        subtitle={`${allDocs.length} ${t('documents.title')} · Assets & Deals`}
        actions={
          <button className="btn-glass px-4 py-2 rounded-xl text-sm flex items-center gap-2">
            <Upload size={14} /> {t('documents.upload')}
          </button>
        }
      />
      <div className="flex gap-3 mb-6">
        <div className="relative">
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(60,60,67,0.45)' }} />
          <input className="input-glass pl-8" placeholder={t('documents.search')} value={search} onChange={e => setSearch(e.target.value)} style={{ width: 240 }} />
        </div>
        <select className="input-glass" value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ width: 200 }}>
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      <GlassPanel style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              {[t('documents.filename'), t('documents.category'), t('documents.linkedTo'), t('documents.tags'), t('documents.size'), t('documents.uploaded'), t('documents.by')].map(h => (
                <th key={h} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.45)', textAlign: 'left', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(doc => (
              <tr key={doc.id} className="table-glass" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                <td style={{ padding: '13px 16px' }}>
                  <div className="flex items-center gap-2">
                    <FileText size={14} color="#007aff" />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1c1c1e' }}>{doc.name}</span>
                  </div>
                </td>
                <td style={{ padding: '13px 16px' }}><span className="badge-neutral">{doc.category}</span></td>
                <td style={{ padding: '13px 16px', fontSize: 13, color: 'rgba(60,60,67,0.70)' }}>{(doc as any).linkedName}</td>
                <td style={{ padding: '13px 16px' }}>
                  <div className="flex gap-1 flex-wrap">{doc.tags.map(t => <span key={t} className="badge-neutral" style={{ fontSize: 10 }}>{t}</span>)}</div>
                </td>
                <td style={{ padding: '13px 16px', fontSize: 12, color: 'rgba(60,60,67,0.45)', fontFamily: 'ui-monospace, monospace' }}>{doc.fileSize}</td>
                <td style={{ padding: '13px 16px', fontSize: 12, color: 'rgba(60,60,67,0.45)' }}>{new Date(doc.uploadDate).toLocaleDateString(dateLocale)}</td>
                <td style={{ padding: '13px 16px', fontSize: 12, color: 'rgba(60,60,67,0.45)' }}>{doc.uploadedBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12" style={{ color: 'rgba(60,60,67,0.45)' }}>{t('documents.noResults')}</div>
        )}
      </GlassPanel>
    </div>
  );
}

