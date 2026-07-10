// ─────────────────────────────────────────────────────────────────────────────
// Market vocabulary — the single source of truth for market classification,
// labels and confidence scaling.  (SSoT-Migration · Phase 0 · "Verträge")
//
// Before this module the UsageType↔AssetClass mapping, the display labels and the
// confidence scale were duplicated across marketResearchAgent, valueAddScreening,
// marketIntelligence and the store.  Every consumer of market data now derives
// these from here, so the vocabulary can never drift between modules again.
//
// Depends only on the domain types — importing this creates no cycles.
// ─────────────────────────────────────────────────────────────────────────────

import type { AssetClass, ScreeningAssetClass, UsageType } from '../models/types';

// ── Canonical value sets ──────────────────────────────────────────────────────

export const USAGE_TYPES: readonly UsageType[] = [
  'Wohnen',
  'Büro',
  'Einzelhandel',
  'Logistik',
  'Mixed Use',
];

export const ASSET_CLASSES: readonly AssetClass[] = [
  'residential',
  'office',
  'retail',
  'logistics',
  'mixed_use',
];

// ── UsageType ⇄ AssetClass ────────────────────────────────────────────────────
// NOTE: 'Mixed Use' maps to 'residential' for screening/benchmark lookups. This
// intentional simplification is the subject of MKT-OPEN-05 — keep it here as the
// one place to revisit if Mixed Use should get its own benchmark basis.

const USAGE_TO_ASSET_CLASS: Record<UsageType, AssetClass> = {
  Wohnen: 'residential',
  Büro: 'office',
  Einzelhandel: 'retail',
  Logistik: 'logistics',
  'Mixed Use': 'residential',
};

const ASSET_CLASS_TO_USAGE: Record<AssetClass, UsageType> = {
  residential: 'Wohnen',
  office: 'Büro',
  retail: 'Einzelhandel',
  logistics: 'Logistik',
  mixed_use: 'Mixed Use',
};

/** UsageType → AssetClass. 'Mixed Use' → 'residential' (see note above). */
export function usageToAssetClass(usage: UsageType): AssetClass {
  return USAGE_TO_ASSET_CLASS[usage];
}

/** AssetClass → UsageType. Round-trips every class to its natural usage label. */
export function assetClassToUsage(assetClass: AssetClass | ScreeningAssetClass): UsageType {
  return ASSET_CLASS_TO_USAGE[assetClass];
}

// ── Display labels ────────────────────────────────────────────────────────────

export const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  residential: 'Residential',
  office: 'Office',
  retail: 'Retail',
  logistics: 'Logistics',
  mixed_use: 'Mixed Use',
};

/** English label for a German UsageType (used by the research agent prompts). */
export const USAGE_LABEL_EN: Record<UsageType, string> = {
  Wohnen: 'Residential',
  Büro: 'Office',
  Einzelhandel: 'Retail',
  Logistik: 'Logistics',
  'Mixed Use': 'Mixed Use',
};

// ── Confidence scale ──────────────────────────────────────────────────────────
// CANONICAL scale for confidence is the unit interval [0, 1] — the scale the
// Market Intelligence master (BenchmarkRecord.confidenceScore) uses.  The legacy
// Welt-A model (MarketBenchmark.confidenceScore) used 0–100; these converters are
// the single sanctioned bridge while Welt A is retired (Phases 1–4).

/** Legacy 0–100 confidence → canonical 0–1. Clamped. */
export function confidencePctToUnit(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.min(1, Math.max(0, pct / 100));
}

/** Canonical 0–1 confidence → legacy 0–100 (for the Welt-A display adapter). */
export function confidenceUnitToPct(unit: number): number {
  if (!Number.isFinite(unit)) return 0;
  return Math.round(Math.min(1, Math.max(0, unit)) * 100);
}
