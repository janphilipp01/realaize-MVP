import type { GeverkCategory } from '@/models/types';

export const GEWERK_CATEGORIES: GeverkCategory[] = [
  'Abbruch & Entsorgung', 'Rohbau', 'Dach & Abdichtung', 'Fassade & Außenanlagen',
  'Fenster & Türen', 'Innenausbau', 'TGA – Heizung', 'TGA – Sanitär',
  'TGA – Elektro', 'TGA – Lüftung', 'Aufzug', 'Außenanlagen & Tiefbau',
  'Planung & Architektur', 'Genehmigungen & Gebühren', 'Reserve / Unvorhergesehenes', 'Sonstiges',
];

export const STATUS_COLORS: Record<string, string> = {
  'Offen': 'badge-neutral', 'Ausgeschrieben': 'badge-info',
  'Angebot': 'badge-warning', 'Vergeben': 'badge-accent', 'Abgeschlossen': 'badge-success',
};

export const DEV_STATUS_COLOR: Record<string, string> = {
  'Planung': '#007aff', 'Genehmigung': '#af52de', 'Ausschreibung': '#ff9500',
  'Bau': '#34c759', 'Abnahme': '#5ac8fa', 'Fertiggestellt': '#1a7f37',
};
