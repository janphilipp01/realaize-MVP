import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import {
  withUserScope, candidateDeals, profileMatches, acquisitionProfiles,
  rawDocuments, marketLocations,
} from "@workspace/db";
import {
  screenCandidate,
  type ScreeningProfile, type ScreeningCandidate, type ScreeningBenchmark,
  type ScreeningAssetClass,
} from "@workspace/screening";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrg } from "../middlewares/requireOrg";
import { requireRole } from "../middlewares/requireRole";

const router: IRouter = Router();

router.use("/screening", requireAuth, requireOrg);

// Candidate asset class → market_locations benchmark usageType label.
const ASSET_TO_USAGE: Record<ScreeningAssetClass, string> = {
  residential: "Wohnen",
  mixed_use: "Mixed Use",
  office: "Büro",
  retail: "Einzelhandel",
  logistics: "Logistik",
};

interface MlBenchmark {
  usageType: string;
  rentMedian: number;            // €/m²/month
  purchasePriceMedian: number;   // €/m²
  multiplierMedian: number;      // factor
}

// Resolve the benchmark for a candidate: submarket first, city fallback.
function makeBenchLookup(
  locations: { city: string; submarket: string; lastUpdated: string; benchmarks: MlBenchmark[] }[],
) {
  return (c: ScreeningCandidate): ScreeningBenchmark | null => {
    const usage = ASSET_TO_USAGE[c.assetClass];
    const pick = (loc: typeof locations[number]) =>
      loc.benchmarks.find((b) => b.usageType === usage);

    if (c.submarket) {
      const sub = locations.find((l) => l.submarket && l.submarket === c.submarket);
      const b = sub && pick(sub);
      if (sub && b) return toBench(b, sub.lastUpdated, "submarket");
    }
    const cityLoc = locations.find((l) => l.city === c.city);
    const cb = cityLoc && pick(cityLoc);
    if (cityLoc && cb) return toBench(cb, cityLoc.lastUpdated, "city_fallback");
    return null;
  };
}

function toBench(b: MlBenchmark, lastUpdated: string, confidence: "submarket" | "city_fallback"): ScreeningBenchmark {
  const q = Math.floor((new Date(lastUpdated).getMonth()) / 3) + 1;
  const asOf = `${new Date(lastUpdated).getFullYear()}-Q${Number.isFinite(q) ? q : 1}`;
  return {
    pricePerSqm: b.purchasePriceMedian,
    rentPerSqmMonth: b.rentMedian,
    factorMedian: b.multiplierMedian,
    asOf,
    confidence,
  };
}

function toScreeningProfile(p: typeof acquisitionProfiles.$inferSelect): ScreeningProfile {
  return {
    id: p.id,
    name: p.name,
    screeningMode: p.screeningMode,
    cities: p.cities ?? [],
    submarkets: p.submarkets ?? [],
    assetClasses: (p.assetClasses ?? []) as ScreeningAssetClass[],
    priceMin: p.priceMin,
    priceMax: p.priceMax,
    areaMin: p.areaMin,
    areaMax: p.areaMax,
    minDiscountPricePct: p.minDiscountPricePct,
    minDiscountFactorPct: p.minDiscountFactorPct,
    minGrossYieldPct: p.minGrossYieldPct,
  };
}

// ── Ingest a raw document (Mailgun webhook / crawler / manual upload). ───────
// Idempotent on (org, content_hash). Optionally creates a candidate_deal.
router.post("/screening/ingest", requireRole("admin", "editor"), async (req, res) => {
  try {
    const b = req.body as Record<string, unknown>;
    const out = await withUserScope(req.auth!.authId, async (tx) => {
      const docRows = await tx.insert(rawDocuments).values({
        orgId: req.org!.id,
        kind: String(b.kind ?? "manual_pdf") as never,
        contentHash: String(b.contentHash ?? ""),
        storagePath: b.storagePath != null ? String(b.storagePath) : null,
        sourceRef: b.sourceRef != null ? String(b.sourceRef) : null,
        rawPayload: b.rawPayload != null ? String(b.rawPayload) : null,
        extractionStatus: "pending_extraction",
      })
        .onConflictDoNothing({ target: [rawDocuments.orgId, rawDocuments.contentHash] })
        .returning();
      return docRows[0] ?? null;
    });
    // Idempotent replay: hash already seen.
    if (!out) { res.status(200).json({ deduplicated: true }); return; }
    res.status(201).json(out);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

// ── Run the batch matcher over all screenable candidates. ────────────────────
// Mon/Thu 07:00 in production (cron); exposed here for manual "Screening starten".
router.post("/screening/run", requireRole("admin", "editor"), async (req, res) => {
  try {
    const summary = await withUserScope(req.auth!.authId, async (tx) => {
      const profiles = (await tx.select().from(acquisitionProfiles)
        .where(and(eq(acquisitionProfiles.orgId, req.org!.id), eq(acquisitionProfiles.active, true))))
        .map(toScreeningProfile);

      const cands = await tx.select().from(candidateDeals)
        .where(and(
          eq(candidateDeals.orgId, req.org!.id),
          inArray(candidateDeals.status, ["new", "matched", "unmatched", "shortlisted"]),
        ));

      const locations = (await tx.select().from(marketLocations)
        .where(eq(marketLocations.orgId, req.org!.id)))
        .map((l) => ({
          city: l.city, submarket: l.submarket, lastUpdated: l.lastUpdated,
          benchmarks: (l.benchmarks as MlBenchmark[]) ?? [],
        }));
      const benchFor = makeBenchLookup(locations);

      let matched = 0, unmatched = 0, skippedNoBenchmark = 0, matchRows = 0;

      for (const c of cands) {
        const sc: ScreeningCandidate = {
          city: c.city, submarket: c.submarket, assetClass: c.assetClass,
          askingPrice: c.askingPrice, areaSqm: c.areaSqm,
        };
        const bench = benchFor(sc);
        if (!bench) { skippedNoBenchmark++; continue; }

        let anyMatch = false;
        for (const p of profiles) {
          const r = screenCandidate(sc, p, bench);
          if (r.signal === "none") {
            // Remove any stale match for this pair.
            await tx.delete(profileMatches).where(and(
              eq(profileMatches.candidateId, c.id), eq(profileMatches.profileId, p.id)));
            continue;
          }
          anyMatch = true;
          matchRows++;
          await tx.insert(profileMatches).values({
            orgId: req.org!.id,
            candidateId: c.id,
            profileId: p.id,
            benchmarkAsOf: r.benchmarkAsOf,
            benchmarkConfidence: r.benchmarkConfidence,
            askingPricePerSqm: r.askingPricePerSqm,
            benchmarkPricePerSqm: r.benchmarkPricePerSqm,
            discountPricePct: r.discountPricePct,
            annualErv: r.annualErv,
            impliedFactor: r.impliedFactor,
            impliedGrossYield: r.impliedGrossYield,
            benchmarkFactor: r.benchmarkFactor,
            discountFactorPct: r.discountFactorPct,
            passA: r.passA,
            passB: r.passB,
            signal: r.signal,
          }).onConflictDoUpdate({
            target: [profileMatches.candidateId, profileMatches.profileId],
            set: {
              benchmarkAsOf: r.benchmarkAsOf, benchmarkConfidence: r.benchmarkConfidence,
              askingPricePerSqm: r.askingPricePerSqm, benchmarkPricePerSqm: r.benchmarkPricePerSqm,
              discountPricePct: r.discountPricePct, annualErv: r.annualErv,
              impliedFactor: r.impliedFactor, impliedGrossYield: r.impliedGrossYield,
              benchmarkFactor: r.benchmarkFactor, discountFactorPct: r.discountFactorPct,
              passA: r.passA, passB: r.passB, signal: r.signal, matchedAt: new Date(),
            },
          });
        }

        // Only advance auto statuses; never override user actions (shortlisted).
        if (c.status === "new" || c.status === "matched" || c.status === "unmatched") {
          const next = anyMatch ? "matched" : "unmatched";
          if (next !== c.status) {
            await tx.update(candidateDeals).set({ status: next, updatedAt: new Date() })
              .where(eq(candidateDeals.id, c.id));
          }
        }
        if (anyMatch) matched++; else unmatched++;
      }

      return {
        ranAt: new Date().toISOString(),
        profilesEvaluated: profiles.length,
        candidatesScreened: cands.length,
        matched, unmatched, skippedNoBenchmark, matchRows,
      };
    });
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

export default router;
