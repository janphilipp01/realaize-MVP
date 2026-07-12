import { mockAuditLog } from '@/data/mockData';
import type { SetState, GetState } from '@/store/slices/types';
import type { AppState } from '@/store/appState';

export const mediaSlice = (set: SetState, get: GetState): Pick<AppState, 'images' | 'auditLog' | 'addImage' | 'setTitleImage' | 'deleteImage' | 'addDocumentToAsset' | 'addDocumentToDeal' | 'deleteDocument' | 'addAuditEntry'> => ({
      images: [],
      auditLog: mockAuditLog,

      addImage: (image) => set(s => ({ images: [...s.images, image] })),
      setTitleImage: (entityId, imageId) =>
        set(s => ({ images: s.images.map(img => img.entityId === entityId ? { ...img, isTitleImage: img.id === imageId } : img) })),
      deleteImage: (imageId) => set(s => ({ images: s.images.filter(img => img.id !== imageId) })),

      addDocumentToAsset: (assetId, doc) =>
        set(s => ({ assets: s.assets.map(a => a.id === assetId ? { ...a, documents: [...a.documents, doc] } : a) })),

      addDocumentToDeal: (dealId, doc) =>
        set(s => ({ deals: s.deals.map(d => d.id === dealId ? { ...d, documents: [...d.documents, doc] } : d) })),

      deleteDocument: (entityType, entityId, docId) =>
        set(s => entityType === 'asset'
          ? { assets: s.assets.map(a => a.id === entityId ? { ...a, documents: a.documents.filter(d => d.id !== docId) } : a) }
          : { deals: s.deals.map(d => d.id === entityId ? { ...d, documents: d.documents.filter(doc => doc.id !== docId) } : d) }
        ),

      addAuditEntry: (entry) => set(s => ({ auditLog: [entry, ...s.auditLog] })),
});
