import type { AuditLogEntry } from '@/models/types';


// ─── Audit Log ────────────────────────────────────────────────────────────────

export const mockAuditLog: AuditLogEntry[] = [
  { id: 'audit-001', action: 'Asset erstellt', entityType: 'Asset', entityId: 'asset-001', entityName: 'Westend Plaza', user: 'M. Wagner', timestamp: '2021-03-15T10:00:00', details: 'Asset nach Closing in Bestand überführt.' },
  { id: 'audit-002', action: 'Dokument hochgeladen', entityType: 'Document', entityId: 'doc-001-3', entityName: 'Wertgutachten 2023.pdf', user: 'M. Wagner', timestamp: '2023-11-20T14:00:00', details: 'Gutachten für Asset Westend Plaza.' },
  { id: 'audit-003', action: 'Marktdaten aktualisiert', entityType: 'MarketData', entityId: 'loc-berlin', entityName: 'Berlin – Prenzlauer Berg', user: 'M. Wagner', timestamp: '2024-12-15T10:00:00', details: 'JLL Wohnmarktreport Q4/2024 importiert.' },
  { id: 'audit-004', action: 'AI Empfehlungen generiert', entityType: 'AI', entityId: 'deal-001', entityName: 'Prenzlauer Berg Portfolio', user: 'System', timestamp: '2024-12-15T11:00:00', details: '3 Empfehlungen basierend auf Marktdaten generiert.' },
  { id: 'audit-005', action: 'Export erstellt', entityType: 'Export', entityId: 'deal-001', entityName: 'Prenzlauer Berg Portfolio', user: 'M. Wagner', timestamp: '2024-12-16T09:00:00', details: 'Investment Memo als PDF exportiert.' },
];
