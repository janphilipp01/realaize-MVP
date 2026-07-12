import type { ActivityEntry } from '@/models/acquisition';
import type { Asset, Document, UsageType } from '@/models/core';
import type { ProjectImage } from '@/models/development';

// ─── Sales ───────────────────────────────────────────────────────────────────

export type SaleStatus = 'Vorbereitung' | 'Aktiv' | 'Closing' | 'Verkauft' | 'Zurückgezogen';
export type BuyerStage = 'Kontaktiert' | 'Besichtigung' | 'NDA' | 'Angebot' | 'LOI' | 'Due Diligence' | 'Signing' | 'Closing' | 'Abgesagt';

export interface SaleObject {
  id: string;
  sourceType: 'Asset' | 'Development';
  sourceId: string;
  name: string;
  address: string;
  city: string;
  zip: string;
  usageType: UsageType;
  status: SaleStatus;
  targetPrice: number;
  minimumPrice: number;
  askingPrice: number;
  totalCost: number; // purchase + development costs
  buyers: BuyerLead[];
  documents: Document[];
  activityLog: ActivityEntry[];
  images: ProjectImage[];
  createdAt: string;
  updatedAt: string;
  notes?: string;
  // sold fields
  soldAt?: string;
  soldPrice?: number;
  disposalGain?: number;
  // from source
  annualRent?: number;
  area?: number;
  noi?: number;
}

export interface BuyerLead {
  id: string;
  saleId: string;
  contactId?: string; // address book ref
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  stage: BuyerStage;
  offeredPrice?: number;
  notes?: string;
  lastContact: string;
  createdAt: string;
}
