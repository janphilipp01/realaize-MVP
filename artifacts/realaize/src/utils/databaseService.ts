/**
 * ═══════════════════════════════════════════════════════════
 * DATABASE SERVICE — Supabase Preparation Layer
 * ═══════════════════════════════════════════════════════════
 *
 * This file prepares the migration from localStorage (Zustand persist)
 * to Supabase. Currently all functions are stubs that return local data.
 * When Supabase is connected, replace the implementations here.
 *
 * SUPABASE SETUP INSTRUCTIONS:
 *
 * 1. Create a Supabase project at https://supabase.com
 *
 * 2. Create the following tables:
 *
 *    -- Assets table
 *    CREATE TABLE assets (
 *      id TEXT PRIMARY KEY,
 *      name TEXT NOT NULL,
 *      address TEXT,
 *      city TEXT NOT NULL,
 *      zip TEXT,
 *      usage_type TEXT NOT NULL,
 *      status TEXT DEFAULT 'Bestand',
 *      acquisition_date DATE,
 *      purchase_price NUMERIC,
 *      current_value NUMERIC,
 *      total_area NUMERIC,
 *      lettable_area NUMERIC,
 *      occupancy_rate NUMERIC,
 *      annual_rent NUMERIC,
 *      operating_costs JSONB DEFAULT '{}',
 *      completeness_score INTEGER DEFAULT 0,
 *      notes TEXT,
 *      created_at TIMESTAMPTZ DEFAULT NOW(),
 *      updated_at TIMESTAMPTZ DEFAULT NOW()
 *    );
 *
 *    -- Acquisition deals
 *    CREATE TABLE deals (
 *      id TEXT PRIMARY KEY,
 *      name TEXT NOT NULL,
 *      address TEXT,
 *      city TEXT NOT NULL,
 *      zip TEXT,
 *      usage_type TEXT,
 *      deal_type TEXT DEFAULT 'Investment',
 *      stage TEXT DEFAULT 'Screening',
 *      asking_price NUMERIC,
 *      underwriting JSONB DEFAULT '{}',
 *      financing JSONB DEFAULT '{}',
 *      completeness_score INTEGER DEFAULT 0,
 *      broker TEXT,
 *      vendor_name TEXT,
 *      notes TEXT,
 *      created_at TIMESTAMPTZ DEFAULT NOW(),
 *      updated_at TIMESTAMPTZ DEFAULT NOW()
 *    );
 *
 *    -- Development projects
 *    CREATE TABLE developments (
 *      id TEXT PRIMARY KEY,
 *      deal_id TEXT REFERENCES deals(id),
 *      name TEXT NOT NULL,
 *      address TEXT,
 *      city TEXT NOT NULL,
 *      zip TEXT,
 *      usage_type TEXT,
 *      development_type TEXT,
 *      status TEXT DEFAULT 'Planung',
 *      total_area NUMERIC,
 *      start_date DATE,
 *      planned_end_date DATE,
 *      actual_end_date DATE,
 *      purchase_price NUMERIC,
 *      total_budget NUMERIC,
 *      projected_sale_price NUMERIC,
 *      created_at TIMESTAMPTZ DEFAULT NOW(),
 *      updated_at TIMESTAMPTZ DEFAULT NOW()
 *    );
 *
 *    -- Market locations & benchmarks
 *    CREATE TABLE market_locations (
 *      id TEXT PRIMARY KEY,
 *      city TEXT NOT NULL,
 *      submarket TEXT,
 *      region TEXT,
 *      last_updated DATE,
 *      created_at TIMESTAMPTZ DEFAULT NOW()
 *    );
 *
 *    CREATE TABLE market_benchmarks (
 *      id TEXT PRIMARY KEY,
 *      location_id TEXT REFERENCES market_locations(id) ON DELETE CASCADE,
 *      usage_type TEXT NOT NULL,
 *      rent_min NUMERIC, rent_max NUMERIC, rent_median NUMERIC,
 *      purchase_price_min NUMERIC, purchase_price_max NUMERIC, purchase_price_median NUMERIC,
 *      multiplier_min NUMERIC, multiplier_max NUMERIC, multiplier_median NUMERIC,
 *      vacancy_rate_percent NUMERIC,
 *      confidence_score INTEGER,
 *      source_label TEXT,
 *      last_updated DATE,
 *      notes TEXT
 *    );
 *
 *    -- Documents (with Supabase Storage for file data)
 *    CREATE TABLE documents (
 *      id TEXT PRIMARY KEY,
 *      asset_id TEXT REFERENCES assets(id),
 *      deal_id TEXT REFERENCES deals(id),
 *      name TEXT NOT NULL,
 *      category TEXT,
 *      upload_date DATE DEFAULT CURRENT_DATE,
 *      file_size TEXT,
 *      tags TEXT[],
 *      uploaded_by TEXT,
 *      storage_path TEXT, -- path in Supabase Storage bucket
 *      mime_type TEXT,
 *      created_at TIMESTAMPTZ DEFAULT NOW()
 *    );
 *
 *    -- News reports
 *    CREATE TABLE news_reports (
 *      id TEXT PRIMARY KEY,
 *      date DATE NOT NULL UNIQUE,
 *      articles JSONB DEFAULT '[]',
 *      executive_summary TEXT,
 *      market_impact_analysis TEXT,
 *      generated_at TIMESTAMPTZ DEFAULT NOW()
 *    );
 *
 *    -- Construction cost comparables (future)
 *    CREATE TABLE construction_comparables (
 *      id TEXT PRIMARY KEY,
 *      city TEXT NOT NULL,
 *      usage_type TEXT NOT NULL,
 *      gewerk_category TEXT NOT NULL,
 *      cost_per_sqm_min NUMERIC,
 *      cost_per_sqm_max NUMERIC,
 *      cost_per_sqm_median NUMERIC,
 *      source_label TEXT,
 *      last_updated DATE,
 *      notes TEXT,
 *      created_at TIMESTAMPTZ DEFAULT NOW()
 *    );
 *
 *    -- Audit log
 *    CREATE TABLE audit_log (
 *      id TEXT PRIMARY KEY,
 *      action TEXT NOT NULL,
 *      entity_type TEXT,
 *      entity_id TEXT,
 *      entity_name TEXT,
 *      "user" TEXT,
 *      details TEXT,
 *      created_at TIMESTAMPTZ DEFAULT NOW()
 *    );
 *
 * 3. Set up Row Level Security (RLS):
 *    ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
 *    -- Add policies per table as needed
 *
 * 4. Create a Storage bucket for documents:
 *    -- In Supabase Dashboard: Storage → New Bucket → "documents" (private)
 *
 * 5. Add environment variables to Replit Secrets:
 *    VITE_SUPABASE_URL=https://your-project.supabase.co
 *    VITE_SUPABASE_ANON_KEY=your-anon-key
 *
 * 6. Install the client:
 *    npm install @supabase/supabase-js
 *
 * 7. Uncomment and modify the code below to switch from localStorage to Supabase.
 */

// ── Supabase client (uncomment when ready) ──
// import { createClient } from '@supabase/supabase-js';
// const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
// export const supabase = createClient(supabaseUrl, supabaseKey);

// ── Current status: localStorage via Zustand persist ──
export const DB_MODE: 'local' | 'supabase' = 'local';

// ── Migration helper: export current localStorage data to Supabase ──
// Call this once to seed Supabase with existing data
export async function migrateToSupabase(): Promise<void> {
  if (DB_MODE !== 'supabase') {
    console.log('DB_MODE is "local". Set to "supabase" and configure client first.');
    return;
  }
  // TODO: Read from Zustand store, insert into Supabase tables
  console.log('Migration not yet implemented. See instructions above.');
}

// ── Document upload helper (for Supabase Storage) ──
export async function uploadDocumentToStorage(
  file: File,
  path: string,
): Promise<{ url: string; storagePath: string } | null> {
  if (DB_MODE !== 'supabase') {
    // In local mode, files are stored as base64 in the Document object
    return null;
  }
  // TODO: const { data, error } = await supabase.storage.from('documents').upload(path, file);
  // return data ? { url: supabase.storage.from('documents').getPublicUrl(path).data.publicUrl, storagePath: path } : null;
  return null;
}
