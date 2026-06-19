// Snapshot of mockData appointments — seeded for every new org on first bootstrap.

export interface SeedAppointment {
  title: string;
  date: string;     // YYYY-MM-DD
  time: string;     // HH:MM
  endTime?: string;
  location?: string;
  participants?: string;
  assetId?: string;
  category: string;
  notes?: string;
}

export const MOCK_APPOINTMENTS: SeedAppointment[] = [
  {
    title: 'Refinanzierungsgespräch – Hafenviertel Logistik',
    date: '2026-04-08', time: '10:00', endTime: '11:30',
    location: 'Berlin Hyp AG, Budapester Str. 1, Berlin',
    participants: 'M. Wagner, Christine Zins (Berlin Hyp)',
    category: 'Finanzierung',
    notes: 'DSCR-Breach besprechen. Neues Term Sheet für Refinanzierung erwarten.',
  },
  {
    title: 'IC-Meeting: Deal Prenzlauer Berg Revitalisierung',
    date: '2026-04-10', time: '09:00', endTime: '11:00',
    location: 'Büro Lestate Real, Schillstraße 5, Berlin',
    participants: 'M. Wagner, S. Klein, Investitionskomitee',
    category: 'Kauf',
    notes: 'Quartalspräsentation Baufortschritt. Kostenkontrolle: Budget vs. Actual.',
  },
  {
    title: 'Jahresgespräch Hauptmieter Westend Plaza',
    date: '2026-04-09', time: '11:00', endTime: '12:00',
    location: 'Bockenheimer Landstraße 47, Frankfurt',
    participants: 'M. Wagner, Claudia Consulting (Consulting AG)',
    category: 'Verwaltung',
    notes: 'Mietvertragsverlängerung besprechen (läuft 12/2027 aus).',
  },
  {
    title: 'Notar: Grundbucheintragung Schwabing Wohnpark',
    date: '2026-04-11', time: '14:30', endTime: '15:30',
    location: 'Notar Dr. Schwarzer, Maximilianstraße 18, München',
    participants: 'M. Wagner',
    category: 'Verwaltung',
    notes: 'Grundschuldänderung nach Teilrückführung.',
  },
  {
    title: 'Baugespräch Düsseldorf Gateway',
    date: '2026-04-14', time: '10:00', endTime: '12:00',
    location: 'Hinz & Partner Architekten, Düsseldorf',
    participants: 'M. Wagner, Lukas Hinz',
    category: 'Bau',
    notes: 'Planungsstand Baugenehmigung besprechen.',
  },
];
