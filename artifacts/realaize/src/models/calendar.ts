// ─── Calendar / Appointments ─────────────────────────────────────────────────

export type AppointmentCategory =
  | 'Kauf' | 'Verkauf' | 'Vermietung' | 'Bau'
  | 'Verwaltung' | 'Finanzierung' | 'Business Development'
  | 'Steuer' | 'Recht';

export interface Appointment {
  id: string;
  title: string;
  date: string;        // YYYY-MM-DD
  time: string;        // HH:MM
  endTime?: string;    // HH:MM
  location?: string;
  participants?: string;
  assetId?: string;    // optional link to portfolio asset
  category: AppointmentCategory;
  notes?: string;
  createdAt: string;
}
