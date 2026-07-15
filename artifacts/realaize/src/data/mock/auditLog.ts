import type { AuditLogEntry } from '@/models/types';


// ─── Audit Log ────────────────────────────────────────────────────────────────

export const mockAuditLog: AuditLogEntry[] = [
  { id: 'audit-001', action: 'Asset erstellt', entityType: 'Asset', entityId: 'asset-001', entityName: 'Wohnhaus Oberkassel', user: 'M. Wagner', timestamp: '2021-05-01T10:00:00', details: 'Asset nach Closing in Bestand überführt.' },
  { id: 'audit-002', action: 'Dokument hochgeladen', entityType: 'Document', entityId: 'doc-001-1', entityName: 'Kaufvertrag Luegallee 42.pdf', user: 'M. Wagner', timestamp: '2021-04-22T14:00:00', details: 'Kaufvertrag für Asset Wohnhaus Oberkassel.' },
  { id: 'audit-003', action: 'Marktdaten aktualisiert', entityType: 'MarketData', entityId: 'loc-duesseldorf', entityName: 'Düsseldorf – Oberkassel', user: 'M. Wagner', timestamp: '2026-06-15T10:00:00', details: 'Wohnmarktreport Q2/2026 importiert.' },
  { id: 'audit-004', action: 'Development erstellt', entityType: 'Asset', entityId: 'dev-001', entityName: 'Wohnprojekt Bilk', user: 'M. Wagner', timestamp: '2026-06-12T11:00:00', details: 'Kernsanierung Bilk in Genehmigungsphase angelegt.' },
  { id: 'audit-005', action: 'Export erstellt', entityType: 'Export', entityId: 'dev-004', entityName: 'Wohnquartier Krefeld', user: 'M. Wagner', timestamp: '2026-06-01T09:00:00', details: 'ETW-Verkaufskonzept als PDF exportiert.' },
];
