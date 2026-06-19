import React, { useState, useRef } from 'react';
import { Upload, FileText, X, Trash2, ExternalLink } from 'lucide-react';
import type { Document, DocumentCategory } from '../models/types';

const DOC_CATEGORIES: DocumentCategory[] = [
  'Kaufvertrag', 'Mietvertrag', 'Finanzierung', 'Gutachten', 'Due Diligence', 'IC Memo', 'Sonstiges'
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

interface DocumentUploadProps {
  documents: Document[];
  entityId: string;
  entityType: 'asset' | 'deal';
  onUpload: (doc: Document) => void;
  onDelete: (docId: string) => void;
  lang: 'de' | 'en';
}

export default function DocumentUpload({ documents, entityId, entityType, onUpload, onDelete, lang }: DocumentUploadProps) {
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [category, setCategory] = useState<DocumentCategory>('Sonstiges');
  const [tags, setTags] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      const doc: Document = {
        id: `doc-${Date.now()}`,
        [entityType === 'asset' ? 'assetId' : 'dealId']: entityId,
        name: file.name,
        category,
        uploadDate: new Date().toISOString().split('T')[0],
        fileSize: formatBytes(file.size),
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        uploadedBy: 'M. Wagner',
        fileData: base64,
        mimeType: file.type,
      };
      onUpload(doc);
      setShowUploadForm(false);
      setCategory('Sonstiges');
      setTags('');
      if (fileRef.current) fileRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleDownload = (doc: Document) => {
    if (doc.fileData && doc.mimeType) {
      const blob = new Blob([Uint8Array.from(atob(doc.fileData), c => c.charCodeAt(0))], { type: doc.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      a.click();
      URL.revokeObjectURL(url);
    } else if (doc.url) {
      window.open(doc.url, '_blank');
    }
  };

  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 5, letterSpacing: '0.04em', textTransform: 'uppercase' };

  return (
    <div>
      {/* Upload button / form */}
      {!showUploadForm ? (
        <button onClick={() => setShowUploadForm(true)}
          className="btn-glass px-4 py-2 rounded-xl text-sm flex items-center gap-2 mb-4"
          style={{ cursor: 'pointer' }}>
          <Upload size={14} /> {lang === 'de' ? 'Dokument hochladen' : 'Upload Document'}
        </button>
      ) : (
        <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(0,122,255,0.04)', border: '1px solid rgba(0,122,255,0.12)' }}>
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1c1c1e' }}>{lang === 'de' ? 'Neues Dokument' : 'New Document'}</span>
            <button onClick={() => setShowUploadForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={14} color="rgba(60,60,67,0.45)" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label style={labelStyle}>{lang === 'de' ? 'Kategorie' : 'Category'}</label>
              <select className="input-glass" style={{ width: '100%' }} value={category} onChange={e => setCategory(e.target.value as DocumentCategory)}>
                {DOC_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Tags ({lang === 'de' ? 'kommagetrennt' : 'comma-separated'})</label>
              <input className="input-glass" style={{ width: '100%' }} value={tags} onChange={e => setTags(e.target.value)} placeholder="z.B. KV, Notar" />
            </div>
          </div>
          <div>
            <label style={labelStyle}>{lang === 'de' ? 'Datei auswählen' : 'Select File'}</label>
            <input ref={fileRef} type="file" onChange={handleFileSelect}
              accept=".pdf,.docx,.xlsx,.xls,.pptx,.doc,.txt,.csv,.jpg,.jpeg,.png"
              style={{ fontSize: 13, color: 'rgba(60,60,67,0.70)' }} />
          </div>
        </div>
      )}

      {/* Document list */}
      {documents.length === 0 ? (
        <div style={{ color: 'rgba(60,60,67,0.45)', fontSize: 13, textAlign: 'center', padding: 24 }}>
          {lang === 'de' ? 'Noch keine Dokumente vorhanden.' : 'No documents yet.'}
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl glass-hover" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
              <FileText size={16} color="#007aff" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1c1c1e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="badge-neutral" style={{ fontSize: 9 }}>{doc.category}</span>
                  {doc.tags?.map(tag => <span key={tag} className="badge-neutral" style={{ fontSize: 9 }}>{tag}</span>)}
                  <span style={{ fontSize: 10, color: 'rgba(60,60,67,0.40)' }}>{doc.fileSize}</span>
                  <span style={{ fontSize: 10, color: 'rgba(60,60,67,0.40)' }}>{doc.uploadedBy}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {(doc.fileData || doc.url) && (
                  <button onClick={() => handleDownload(doc)} className="btn-glass p-1.5 rounded-lg" style={{ cursor: 'pointer' }} title={lang === 'de' ? 'Herunterladen' : 'Download'}>
                    <ExternalLink size={12} color="rgba(60,60,67,0.55)" />
                  </button>
                )}
                <button onClick={() => onDelete(doc.id)} className="btn-glass p-1.5 rounded-lg" style={{ cursor: 'pointer' }} title={lang === 'de' ? 'Löschen' : 'Delete'}>
                  <Trash2 size={12} color="#f87171" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
