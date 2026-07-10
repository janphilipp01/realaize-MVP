# Umsetzungsplan — Market Intelligence als Single Source of Truth

**Entscheidung:** `MKT-OPEN-01` (2026-07-10, Jan) — Welt B (Market Intelligence,
`BenchmarkRecord`) wird die Single Source of Truth; Welt A
(`MarketLocation`/`MarketBenchmark`) wird als Datenmodell abgelöst.
**Scope dieses Plans:** ausschließlich die Etablierung dieser SSoT. Bewusst **nicht**
enthalten: der breitere MVP-Produktivierungs-Umbau (Modularisierung aller Module, Auth,
allgemeines Logging) — das ist separat.

---

## Ziel (Definition of Done)

> Genau **ein** Datensatz — `store.benchmarks` (Welt B, `BenchmarkRecord[]`) — speist **alle**
> Marktdaten-Konsumenten. Eine Änderung dort ist überall sichtbar. Kein unabhängiger
> Welt-A-Datenpfad im Frontend mehr.

Erreicht, wenn diese Stellen nachweislich dieselbe Quelle nutzen:
Deal-Radar-Screening · Acquisition-Wizard · DealDashboard · `/markt` · `/market-intelligence`
· Portfolio · AI Copilot.

---

## Gewählter Weg: „store-first"

Das eigentliche Problem ist **Divergenz**, nicht fehlendes Backend. SSoT wird erreicht, indem
alle Produzenten/Konsumenten auf den einen Welt-B-Datensatz im Store konvergieren.
Backend-Persistenz ist ein separater Lift (an Auth gekoppelt, aktuell deaktiviert) und wird
**hinter einer eingefrorenen Lese-Schnittstelle** später als reiner Swap nachgezogen.

### Deferred decisions (mit Empfehlung)

| Frage | Entscheidung | Begründung |
|---|---|---|
| Backend-Persistenz jetzt/später | **später** | Store ist heute die Laufzeit-DB; Deal Radar & Wizard lesen Welt B bereits daraus. Backend = eigener, Auth-gekoppelter Schritt (→ Phase 4). |
| Screening-Ort (DR-OPEN-01) | **vorerst offen** | Für SSoT muss nur gelten: beide Pfade lesen Welt B. Frontend tut das; Backend-`/screening` ist nicht ans Frontend verdrahtet. |
| Backend `/api/screening` | **deprecaten + Parität fordern** | Kein Löschen; „muss Welt B lesen, bevor es genutzt wird". |

---

## Code-Inventar (verifizierte Berührungspunkte)

**Welt-B-Leser (Ziel, bereits korrekt):**
- Deal Radar — `benchmarksToScreeningSeeds(s.benchmarks)` (`store/useStore.ts`, `OtherPages.tsx`)
- Acquisition-Wizard — `lookupMarketAssumptions(benchmarks, …)` (`AcquisitionWizard.tsx:867`)
- DealDashboard — `lookupMarketAssumptions(benchmarks, …)` (`DealDashboard.tsx:147`)
- Market Intelligence — `s.benchmarks` (`MarketIntelligence.tsx`)

**Welt-A-Leser (müssen umziehen):**
- `/markt` (`OtherPages.tsx:41`) · AI Copilot (`OtherPages.tsx:1156`) · Portfolio (`Portfolio.tsx:18`)
  — alle über `useListMarketLocations`.

**Producer:**
- AI Research Agent → schreibt Welt A (`useRefreshMarketBenchmarks`) → **muss auf Welt B**.
- Quarterly Refresh → Welt B (Mock-Job, kein echter Fetch).
- Review approve/reject/correct → Welt B (lokal).
- `/markt` „Refresh" → nur `lastUpdated` auf Welt A (entfällt).

**Backend:** `/api/screening` löst Benchmarks aus `market_locations` (Welt A) auf → Parität später.

---

## Eingefrorene Lese-Verträge (die einzigen sanktionierten Zugriffe)

Ab Phase 0 lesen alle Konsumenten Marktannahmen **ausschließlich** über:

1. `benchmarksToScreeningSeeds(benchmarks): ScreeningBenchmarkSeed[]` — Screening-Seite.
2. `lookupMarketAssumptions(benchmarks, city, usageType, submarket?): MarketAssumptionLookup`
   — Underwriting-Seite (Miete/Rendite).

Beide sind im Code als „FROZEN READ CONTRACT" markiert. Ihre Signatur bleibt stabil, damit
der Backing-Store später (Phase 4) ohne Konsumenten-Änderung ins Backend wandern kann.

---

## Phasen

### ✅ Phase 0 — Verträge & Vokabular *(erledigt)*

Kleiner, risikoarmer Fundament-Schritt. **Rein interne Konsolidierung, kein Verhaltenswechsel.**

- **Neu:** `utils/marketVocab.ts` — kanonische Single-Source für UsageType⇄AssetClass-Mapping
  (`usageToAssetClass`/`assetClassToUsage`), Labels (`ASSET_CLASS_LABEL`, `USAGE_LABEL_EN`),
  Werte-Sets und die **Konfidenz-Skala** (kanonisch 0–1, mit `confidencePctToUnit` /
  `confidenceUnitToPct` als einzigem Bridge zur Legacy-0–100-Skala).
- **Entduplizert:** dieselben Mappings/Labels lagen zuvor in `valueAddScreening.ts`,
  `marketResearchAgent.ts`, `marketIntelligence.ts` und `useStore.ts` — alle vier ziehen jetzt
  aus `marketVocab.ts`. `ASSET_CLASS_LABEL` wird aus `marketIntelligence.ts` re-exportiert
  (Rückwärtskompatibilität für bestehende Importe).
- **Eingefroren:** die zwei Lese-Verträge (s. o.) mit „FROZEN READ CONTRACT"-Doku markiert.
- **Verifikation:** Root-`tsc --build` grün; keine verwaisten Referenzen (`USAGE_LABELS`,
  `USAGE_TO_ASSET_CLASS`, `usageMap` entfernt).

**Akzeptanz:** ✅ Mapping/Skala existieren an genau einer Stelle; kein Konsument referenziert
Welt-A-Typen außerhalb des (kommenden) Adapters.

---

### Phase 1 — Producer auf Welt B umlenken ⭐ *(schließt die Bruchstelle)*

Der AI Research Agent auf `/markt` schreibt künftig **Welt B** statt Welt A.

- `researchCityMarketData`-Ergebnis **Zod-validieren** (MKT-F-07) statt nur „Array?".
- Ergebnis in `BenchmarkSourceRecord`(s) übersetzen → `reconcile` → `validateBenchmark` →
  `BenchmarkRecord`-Upsert in `store.benchmarks` (neue Store-Action, z. B.
  `ingestResearchedBenchmarks`).
- Konfidenz über `confidencePctToUnit` auf 0–1 bringen; `sourceType: 'ai_qualitative'`.
- Den Welt-A-Schreibpfad (`useRefreshMarketBenchmarks`) aus dem Research-Flow entfernen.

**Dateien:** `utils/marketResearchAgent.ts`, `pages/OtherPages.tsx` (`MarktPage`),
`store/useStore.ts`.
**Akzeptanz:** Research für eine Stadt erzeugt/aktualisiert `BenchmarkRecord`s auf
`/market-intelligence` **und** verändert nachweislich ein Deal-Radar-Screening-Ergebnis.

---

### Phase 2 — Welt-A-Leser auf Welt B umstellen

- Neuer Adapter `benchmarkRecordsToMarketLocations(benchmarks): MarketLocation[]` (Umkehrung
  der KPI-Zerlegung; Konfidenz via `confidenceUnitToPct`).
- `/markt`, `Portfolio.tsx`, AI Copilot rendern über den Adapter statt `useListMarketLocations`.

**Dateien:** `OtherPages.tsx`, `Portfolio.tsx`, neuer Adapter in `utils/`.
**Akzeptanz:** alle sieben Konsumenten zeigen Werte aus demselben Welt-B-Datensatz; eine
Research-/Review-Änderung ist überall sichtbar.

---

### Phase 3 — Welt A stilllegen

- Welt-A-Schreibhooks entfernen (`useRefreshMarketBenchmarks`, `useCreate/UpdateMarketLocation`
  aus dem Research-Flow); „Refresh"-Button entfernen oder auf echte Aktion umstellen (MKT-F-09).
- Backend `market_locations`-Route + `/api/screening`-Welt-A-Lookup als **deprecated**
  markieren; Parität-Anforderung „muss Welt B lesen" dokumentieren.

**Akzeptanz:** `grep` findet keinen `useListMarketLocations`/`MarketLocation`-Import im
Frontend mehr (außer im Adapter aus Phase 2).

---

### Phase 4 — (deferred) Persistenz & Backend-Screening

Erst mit Auth/Multi-User. Läuft als Swap **hinter** der Phase-0-Naht:
`store.benchmarks` → Backend `market_benchmarks` / `market_benchmark_sources`; die zwei
Lese-Verträge auf React-Query-Hooks umstellen; `/api/screening` auf Welt B. Konsumenten
ändern sich nicht. (Das ist der Backend-Weg aus `markt.md §11`.)

---

## Verifikation

- Nach jeder Phase: Root-`tsc --build --emitDeclarationOnly` (grün halten).
- Nach Phase 1 & 2: App fahren, Fluss **Research → Screening** end-to-end durchspielen
  (benötigt den Anthropic-API-Key im Backend-Secret `ANTHROPIC_API_KEY`).

## Risiken & Hinweise

- Reconciliation/Validierung/Seed-Ableitung sind bereits **reine Funktionen** — im Backend
  (Phase 4) wiederverwendbar, nichts wird neu erfunden.
- Kein „Big Bang": Deal Radar & Wizard lesen schon Welt B, funktionieren während der Umstellung
  durchgehend.
- Der Anthropic-Key gehört über einen sicheren Kanal an Marvin (nicht ins Repo/Chat) und als
  `ANTHROPIC_API_KEY`-Secret hinterlegt.
