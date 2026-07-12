// ─── Address Book ─────────────────────────────────────────────────────────────

export type ContactCategory =
  | 'Handwerker' | 'Architekt & Planer' | 'Property Manager' | 'Facility Manager'
  | 'Hausverwaltung' | 'Mieter' | 'Potentieller Mieter' | 'Banker & Finanzierer'
  | 'Makler' | 'Potentieller Käufer' | 'Käufer' | 'Potentieller Investor'
  | 'Investor' | 'Stadtverwaltung' | 'Anderer Eigentümer' | 'Sonstiges';

export type HandwerkerSubcategory =
  | 'Rohbau' | 'Elektro' | 'Sanitär' | 'Heizung' | 'Trockenbau'
  | 'Maler & Lackierer' | 'Dach' | 'Fassade' | 'Aufzug' | 'Lüftung'
  | 'Fliesen' | 'Böden' | 'Schreiner' | 'Metall & Stahl' | 'Sonstiges';

export interface Contact {
  id: string;
  category: ContactCategory;
  subcategory?: HandwerkerSubcategory; // only for Handwerker
  firstName: string;
  lastName: string;
  company?: string;
  position?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  city?: string;
  website?: string;
  notes?: string;
  linkedObjectIds?: string[]; // asset/deal/dev/sale IDs
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}
