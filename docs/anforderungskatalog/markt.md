# Anforderungskatalog — Modul „Markt" (inkl. Market Intelligence)

**Routen:** `/markt` (`MarktPage`), `/market-intelligence` (`MarketIntelligencePage`)
**Code:** `artifacts/realaize/src/pages/OtherPages.tsx` (`MarktPage`, ab Z. 38),
`artifacts/realaize/src/pages/MarketIntelligence.tsx`
**Fachlogik:** `src/utils/marketResearchAgent.ts`, `src/utils/marketIntelligence.ts`
**Backend:** `artifacts/api-server/src/routes/marketLocations.ts`
**Konzept:** Module 06 — Market Intelligence Pipeline

> **Wichtig vorab:** „Markt" besteht aktuell aus **zwei** Seiten mit **zwei** getrennten
> Datenmodellen (siehe [README → Zwei parallele Markt-Datenmodelle](./README.md#wichtigste-modulübergreifende-erkenntnis-zwei-parallele-markt-datenmodelle)).
> Dieses Dokument beschreibt beide, weil sie fachlich zusammengehören, und empfiehlt die
> Konsolidierung.

---

## 1. Zweck & fachliche Rolle

Das Markt-Modul ist die **zentrale Quelle für Marktannahmen** (Mieten, Kaufpreise,
Multiplikatoren/Faktoren, Renditen, Leerstand) je Standort und Nutzungsart. Diese
Annahmen sind die Benchmark-Grundlage für:

- das **Deal Radar** (Screening: „ist das Angebot günstig ggü. Markt?"),
- die **Underwriting-Wizards** (Acquisition, Development) als Vorbelegung von Miet-/Renditeannahmen,
- portfolioweite Bewertungen und Exit-Annahmen.

Fachlich muss das Modul zwei Fragen belastbar beantworten:

1. **„Was ist der Marktwert je m² / die Marktmiete / der Faktor hier?"** — als
   nachvollziehbarer, quellenbelegter Wert (nicht als Bauchgefühl).
2. **„Wie verlässlich ist dieser Wert?"** — Konfidenz, Quelle, Aktualität, Streuung
   über mehrere Makler.

Die **Market-Intelligence-Ebene** (Module 06) hebt das auf ein IC-taugliches Niveau:
Multi-Broker-Reconciliation, Plausibilitäts- und Quartalssprung-Prüfung, Review-Queue,
News-Layer, IC-Memo-Block, Quellenkatalog.

---

## 2. Einordnung in die Modul-Landschaft

```
                 ┌────────────────────── Upstream (Datenquellen) ──────────────────────┐
   Makler-Reports (JLL/CBRE/BNP/Savills/Colliers/C&W)   AI Research Agent   Manuelle Eingabe
                          │                                    │                  │
                          ▼                                    ▼                  ▼
        ┌─────────────────────────────────────────────────────────────────────────────┐
        │   MARKT-MODUL                                                                 │
        │   • Welt A: /markt  → market_locations (Backend, MarketBenchmark)            │
        │   • Welt B: /market-intelligence → benchmarks (Store, BenchmarkRecord)      │
        └─────────────────────────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────────────────┐
        ▼                 ▼                             ▼
   Deal Radar        Acquisition-Wizard            Portfolio-/Exit-
   (Screening,       (Vorbelegung Miet-/           Bewertungen
   nur Welt B)       Rendite-Annahmen)
```

**Downstream-Konsumenten (Soll):**
- **Deal Radar** — via `benchmarksToScreeningSeeds(benchmarks)` (`src/utils/marketIntelligence.ts`).
- **Acquisition-Wizard** — via `lookupMarketAssumptions(...)` (`src/utils/valueAddScreening.ts`)
  liest ERV + Net Initial Yield je Stadt/Submarkt/Nutzungsart.
- **Value-Add-Screening** — nutzt Marktmiete + Markt-NIY als Bewertungsbasis.

**Upstream-Quellen:**
- AI Research Agent (`researchCityMarketData`, `web_search` über `/api/ai/chat`).
- Backend `market_locations` (echte Persistenz, org-scoped).
- Mock-Seeds für Welt B (`src/data/marketIntelData.ts`, `mockBenchmarks`).

---

## 3. Datenmodell

### 3.1 Welt A — Markt-Seite (`/markt`)

Geladen via React Query (`useListMarketLocations`) vom Backend
`GET /api/market-locations` (org-scoped, `requireAuth`+`requireOrg`).

- **`MarketLocation`** (`types.ts:268`): `id, city, submarket, region, benchmarks[], updateLog[], lastUpdated`.
- **`MarketBenchmark`** (`types.ts:278`): pro Nutzungsart
  (`Wohnen|Büro|Einzelhandel|Logistik|Mixed Use`) mit
  `rentMin/Median/Max` (€/m²/Monat), `purchasePriceMin/Median/Max` (€/m²),
  `multiplierMin/Median/Max` (Faktor), `vacancyRatePercent`, `confidenceScore` (0–100),
  `sourceLabel`, `lastUpdated`, `notes`.
- **`MarketUpdateEntry`** (`types.ts:298`): Audit-Zeile je Aktualisierung
  (`timestamp, updatedBy, changes, sourceLabel`).

### 3.2 Welt B — Market Intelligence (`/market-intelligence`, Module 06)

Geladen aus dem **Zustand-Store** (`useStore`, Key `restate-storage-v2`), Mock-Seed.

- **`BenchmarkRecord`** (`types.ts:354`): **ein reconciliierter Master-Wert** je
  `city × submarket × assetClass × kpi × periodQuarter`.
  KPIs (`BenchmarkKpi`): `prime_rent, erv, prime_yield, net_initial_yield, vacancy, multiplier`.
  Zusätzlich: `value, unit, sourceType, sourceProvider, confidenceScore (0–1),
  confidenceTier, validationStatus, dataAvailability, consolidationMethod, sourceCount,
  valueSpread, priorValue, sources[], validationFlags[], reviewNote`.
- **`BenchmarkSourceRecord`** (`types.ts:382`): einzelner Makler-Beitrag
  (`provider, value, trustScore, confidenceScore, documentTitle, pageNo, originalText,
  isOutlier, publishedAt`) — der Prüfpfad hinter jedem Master-Wert.
- **`MarketEventRecord`** (`types.ts:407`): News-Layer (deskriptiv), am Display an
  Benchmarks gejoint.
- **`ReportSource`** (`types.ts:420`): Quellenkatalog (Provider × AssetClass × Markt, Cadence, Status).
- **`RefreshJob`** (`types.ts:435`): Quartals-Refresh-Lauf (Kennzahlen: `reportsFetched,
  dataPointsExtracted, autoPassed, pendingReview`).

---

## 4. UI-Aufbau

### 4.1 Markt-Seite (`/markt`)

- **PageHeader:** Titel/Subtitle (i18n), Badge „N Standorte", Aktionen:
  „Stadt hinzufügen", „Excel Export", „CSV Import".
- **AI-Research-Status-Banner** (bedingt): Spinner/Erfolg/Fehler beim Research-Lauf.
- **„Stadt hinzufügen"-Panel** (bedingt): Chips der noch nicht erfassten Top-20-Städte;
  Klick startet AI-Research für diese Stadt.
- **Filterleiste:** Dropdown Stadt, Dropdown Nutzungsart.
- **Zweispaltiges Layout:**
  - **links (1/3):** Standort-Liste (Karten mit Stadt, Submarkt, Nutzungsart-Badges,
    `FreshnessBadge`, „AI"-Button je Karte).
  - **rechts (2/3):** Standort-Detail — je Nutzungsart eine `GlassPanel` mit
    Konfidenz-Balken, drei Kennzahl-Kacheln (Miete / Kaufpreis / Faktor mit
    Median + Range + Mini-Sparkline), Quelle/Stand/Leerstand/Notiz. Darunter
    **Update-Log**.
  - Leerzustand: „Standort auswählen".

### 4.2 Market-Intelligence-Seite (`/market-intelligence`)

- **KPI-Kopf:** Pending-Count, Ø-Konfidenz extrahierter Werte, Coverage
  (Stadt×AssetClass), letzter Refresh-Job.
- **Tab-Navigation** (`TABS`): **Benchmarks**, **Review Queue**, **News Layer**,
  **Cross-Validation**, **IC Memo Block**, **Sources**.
- **Refresh-Button:** stößt „Quarterly Refresh" (Mock) an.
- Badges für `ConfidenceTier`, `ValidationStatus`, `ImpactTier`.

---

## 5. Interaktionen — Soll vs. Ist

> Format: **Element → Soll-Verhalten → Ist-Verhalten → Modul-Zusammenhang.**

### 5.1 Markt-Seite

| Element | Soll | Ist | Zusammenhang |
|---|---|---|---|
| **„Stadt hinzufügen"** | Öffnet Auswahl; gewählte Stadt wird angelegt und mit Marktdaten befüllt. | ✅ Panel toggelt; Chips = Top-20 minus vorhandene. Klick → `handleResearch`. | Legt `MarketLocation` im **Backend** an (`createMarketLocation`). |
| **AI-Research je Stadt** (`Bot`-Button / Chip) | Aktuelle Mieten/Preise/Faktoren je Nutzungsart recherchieren, versioniert ablegen, Konfidenz + Quelle setzen. | 🟡 `researchCityMarketData` → `/api/ai/chat` mit `web_search`; Ergebnis → `refreshBenchmarks` (Backend). Prompt fordert JSON; **kein Schema-Validate** außer „ist Array". | **Schreibt nur Welt A.** Deal Radar (Welt B) profitiert **nicht** davon → siehe `MKT-OPEN-01`. |
| **„Refresh" je Standort** (`handleRefresh`) | Standort neu bewerten / Daten aktualisieren. | 🔴 Setzt nur `lastUpdated` auf heute — **kein** echtes Refresh der Werte. Reines Zeitstempel-Update. | Kosmetisch; erzeugt falsches Frische-Signal. |
| **„Excel Export"** | Aktuelle Marktdaten als Excel exportieren. | ✅ `exportMarketIntelligenceExcel(marketLocations)`. | Reporting. |
| **„CSV Import"** | Marktdaten per CSV importieren. | 🔴 Button ohne `onClick` — **Attrappe**. | — |
| **Filter Stadt / Nutzungsart** | Liste + Detail filtern. | ✅ lokal gefiltert. | — |
| **Standort-Karte klicken** | Detail rechts anzeigen. | ✅ Toggle `selectedLocation`. | — |

### 5.2 Market-Intelligence-Seite

| Element | Soll | Ist | Zusammenhang |
|---|---|---|---|
| **Tabs** (Benchmarks/Review/News/Cross-Val/Memo/Sources) | Jeweils die entsprechende Sicht auf `BenchmarkRecord`/`MarketEvent`/`ReportSource`. | 🟡 Rendern lokale Store-/Mock-Daten. | Master für Deal-Radar-Screening. |
| **„Refresh" (Quarterly)** | Neue Reports ziehen, extrahieren, reconciliieren, validieren, Review-Queue füllen. | 🟡 `triggerQuarterlyRefresh` nach `setTimeout(1100ms)` — **simuliert**, kein echter Fetch/Extract. | Speist Welt B. |
| **Review-Freigabe** | Pending-Werte prüfen/freigeben/ablehnen (`validationStatus`). | 🟡 Reviewer hart auf `'J. Pleuker'` gesetzt (`REVIEWER`), keine Auth-Bindung. | Steuert, welche Werte ins Screening gehen (`rejected` wird ausgeschlossen). |

---

## 6. Fachliche Regeln

### 6.1 Reconciliation (Multi-Broker), `src/utils/marketIntelligence.ts`

- **≥ 3 Quellen** → Median nach Ausreißer-Bereinigung (Ausreißer = > 15 % Abweichung
  vom Median); `spread` = max−min der bereinigten Werte als Qualitätsindikator.
- **2 Quellen** → trust-gewichteter Mittelwert (`trustScore`).
- **1 Quelle** → Wert direkt, Flag „single_source".

### 6.2 Validierung (`validateBenchmark`)

- **Plausibilitätsbereiche** je AssetClass × KPI (`PLAUSIBILITY_RANGES`) — außerhalb → Flag.
- **QoQ-Sprung** > 15 % ggü. Vorquartal → Flag.
- `ai_qualitative` → immer „indicative, nicht IC-zitierfähig".
- **Auto-Pass** nur wenn: in Range **und** Konfidenz ≥ 0,85 **und** nicht `ai_qualitative`;
  sonst `pending` (Review nötig).

### 6.3 Ableitung der Screening-Seeds (`benchmarksToScreeningSeeds`)

Macht Market Intelligence zur Single Source für das Screening. Pro
`city × submarket × assetClass`:
- `rentPerSqmMonth = ERV` (Fallback `prime_rent`),
- `factorMedian = multiplier` **oder** `(1 − 0,10) / (net_initial_yield/100)`,
- `pricePerSqm = ERV × 12 × factor`.
- Ausgeschlossen: `validationStatus === 'rejected'`, `sourceType === 'portfolio_realised'`.

---

## 7. Ist-Zustand & technische Schulden

- 🔴 **Doppeltes Datenmodell** (Welt A vs. Welt B) — der größte Wartbarkeits-/Korrektheitsrisikofaktor. Siehe README.
- 🔴 **Research schreibt in den falschen Topf:** AI-Research auf `/markt` befüllt Welt A;
  Deal Radar liest Welt B → sichtbare „Live"-Aktualisierung ohne Screening-Wirkung.
- 🔴 **„Refresh"-Button** aktualisiert nur `lastUpdated` (Frische-Signal ohne Datenbezug).
- 🔴 **„CSV Import"** ist eine Attrappe (kein Handler).
- 🟡 **Quarterly Refresh** ist ein `setTimeout`-Mock, kein echter Report-Fetch/Extract.
- 🟡 **AI-Antworten ohne robustes Schema-Validate** (nur „Array vorhanden?"; kein Zod-Parse,
  keine Feld-/Range-Prüfung → fehleranfällig bei Halluzination/Formatfehlern).
- 🟡 **Reviewer/Autor hartkodiert** (`REVIEWER = 'J. Pleuker'`, `updatedBy = 'AI Research Agent'`) — keine Auth-Bindung.
- 🟡 **Fehlendes Logging/Error-Handling im Frontend:** `console.error` statt strukturiertem
  Reporting; Fehler landen als roter Banner-Text.
- 🟡 **Backend `/screening` nutzt Welt A**, Frontend-Screening Welt B → zwei Wahrheiten.
- 🟡 **`confidenceScore`-Semantik uneinheitlich:** Welt A 0–100, Welt B 0–1.

---

## 8. Anforderungen (Soll)

### Funktional — Datenhaltung & Konsolidierung

- **MKT-F-01 [M]** — Es gibt **genau eine** Single Source of Truth für Marktannahmen.
  Alle Konsumenten (Deal Radar, Wizards, Bewertungen) lesen aus derselben Quelle.
- **MKT-F-02 [M]** — Jeder Benchmark-Wert ist **quellenbelegt** (Provider, Dokument,
  Seite, Zitat, Veröffentlichungsdatum) und **quartalsversioniert**.
- **MKT-F-03 [M]** — Konfidenz, Konsolidierungsmethode, Quellenanzahl und Streuung sind je
  Wert sichtbar und maschinenlesbar.
- **MKT-F-04 [S]** — Multi-Broker-Reconciliation nach Regel §6.1; Ausreißer werden
  markiert, nicht stillschweigend verworfen (Audit-Trail bleibt).
- **MKT-F-05 [M]** — Validierung nach §6.2 (Range + QoQ + Quelltyp); nicht auto-bestätigte
  Werte gehen in eine **Review-Queue** und sind bis zur Freigabe nicht IC-/Screening-wirksam
  (`rejected`/`pending` werden im Screening ausgeschlossen bzw. nur mit Warnung genutzt).

### Funktional — UI & Interaktion

- **MKT-F-06 [M]** — Standortliste + Detail zeigen je Nutzungsart Miete/Kaufpreis/Faktor
  als Median mit Range und Konfidenz sowie Quelle und Stand.
- **MKT-F-07 [S]** — AI-Research je Standort: aktuelle Werte recherchieren, **gegen Schema
  validieren** (Zod), als neue Quelle/Version ablegen (nicht bestehende überschreiben),
  Konfidenz und Provenienz setzen.
- **MKT-F-08 [M]** — AI-Research schreibt in die **Single Source of Truth** und wirkt damit
  unmittelbar auf das Deal-Radar-Screening (behebt die Bruchstelle).
- **MKT-F-09 [S]** — „Refresh" löst eine **echte** Neubewertung/Neurecherche aus oder wird
  entfernt; ein Frische-Datum wird nur bei tatsächlicher Datenänderung gesetzt.
- **MKT-F-10 [K]** — CSV-Import: Upload → Mapping → Validierung → Import als Quelle.
- **MKT-F-11 [S]** — Excel-Export der aktuell gefilterten Sicht inkl. Quellen/Konfidenz.
- **MKT-F-12 [K]** — News-Layer: relevante Markt-Ereignisse je Stadt/AssetClass, am
  Benchmark angezeigt (Kontext, nicht Wert-verändernd).

### Nicht-funktional

- **MKT-NF-01 [M]** — Jede AI-/Backend-Aktion hat definiertes Error-Handling (nutzerlesbare
  Meldung + strukturiertes Log), keine stillen Fehler.
- **MKT-NF-02 [S]** — AI-Aufrufe sind idempotent bzw. reentrant abgesichert
  (Doppelklick/Doppel-Lauf erzeugt keine Duplikate).
- **MKT-NF-03 [M]** — Konfidenz-Skala und Nutzungsart-/AssetClass-Vokabular sind
  **einheitlich** (eine Skala, ein Mapping).
- **MKT-NF-04 [S]** — Autor/Reviewer stammen aus dem Auth-Kontext, nicht hartkodiert (greift,
  sobald Auth aktiv).

---

## 9. Modularisierungs- & Umstellungshinweise

- **Trennbare, in sich geschlossene Einheiten** (gute Modul-Schnitte für Neubau):
  1. **Ingestion** — Reports/AI/CSV → Roh-Quellwerte (`BenchmarkSourceRecord`).
  2. **Reconciliation** — Quellwerte → Master (`reconcile`). *Bereits rein & isoliert in
     `marketIntelligence.ts` — Vorbild für den Rest.*
  3. **Validierung/Review** — Master → freigegeben (`validateBenchmark` + Queue).
  4. **Seed-Ableitung** — Master → Screening-Seeds (`benchmarksToScreeningSeeds`). *Ebenfalls
     bereits rein.*
  5. **Präsentation** — Seiten/Tabs (reine View-Schicht, keine Fachlogik).
- Die reinen Funktionen in `marketIntelligence.ts` und `valueAddScreening.ts` sind das
  **positive Beispiel**: testbar, ohne UI-Kopplung. Die UI-Fachlogik (Research-Flow im
  `MarktPage`-Component) sollte analog in einen Service/Hook ausgelagert werden.
- **Welt A → Welt B:** Empfohlener Umbau: Welt B als Master etablieren; `MarketLocation`/
  `MarketBenchmark` entweder als **View/Adapter** über Welt B abbilden oder migrieren und
  Welt A abbauen. Backend-`/screening` auf Welt B umstellen, damit Front-/Backend dieselbe
  Basis nutzen.

---

## 10. Offene fachliche Entscheidungen (für Jan)

- **MKT-OPEN-01 [M]** — **Welche Markt-Datenwelt ist Master?** Empfehlung: **Welt B
  (Market Intelligence)**. Soll Welt A (`/markt`) darauf abgebildet, migriert oder
  abgeschaltet werden?
- **MKT-OPEN-02** — Soll AI-Research IC-zitierfähige Werte erzeugen dürfen, oder bleiben
  AI-Werte grundsätzlich „indicative" und dienen nur der Vorbelegung?
- **MKT-OPEN-03** — Verbindliche Quartalskadenz für Refresh (automatisch) — und wer gibt
  Pending-Werte frei (Rolle)?
- **MKT-OPEN-04** — Welche Städte/Submärkte sind Pflichtabdeckung? Aktuell: 20 Top-Städte
  (Liste in `marketResearchAgent.ts`) + Düsseldorfer Prime-Submärkte
  (`valueAddScreening.ts`). Ist der Fokus Düsseldorf + Speckgürtel (so das Deal Radar) oder bundesweit?
- **MKT-OPEN-05** — Mapping `Mixed Use → residential` (in `USAGE_TO_ASSET_CLASS`): fachlich
  gewollt, oder braucht Mixed Use eigene Benchmarks?
