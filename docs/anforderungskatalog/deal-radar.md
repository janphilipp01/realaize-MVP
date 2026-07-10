# Anforderungskatalog — Modul „Deal Radar" (Deal Sourcing & Screening)

**Route:** `/radar` (`DealRadarPage`)
**Code:** `artifacts/realaize/src/pages/OtherPages.tsx` (`DealRadarPage`, ab Z. 1350)
**Fachlogik:** `src/utils/dealRadarAgent.ts`, `src/utils/screening.ts`,
`src/utils/valueAddScreening.ts`, `lib/screening/src/index.ts` (`@workspace/screening`)
**Store:** `src/store/useStore.ts` (`runScreening`, `ingestCandidatesFromListings`,
`shortlistCandidate`, `rejectCandidate`, `promoteCandidate`)
**Backend:** `artifacts/api-server/src/routes/screening.ts`, `candidateDeals.ts`,
`acquisitionProfiles.ts`
**Konzept:** Module 07 — Deal Sourcing & Screening Pipeline

---

## 1. Zweck & fachliche Rolle

Das Deal Radar ist der **Trichter am Anfang des Ankaufsprozesses**. Es beantwortet
automatisiert die Frage: *„Welche der vielen am Markt angebotenen Objekte sind für uns
überhaupt interessant?"* — gemessen an editierbaren **Ankaufsprofilen (Mandaten)** und an
**Marktannahmen** aus dem Markt-Modul.

Kern ist ein **deterministisches, markt-verankertes Screening** mit zwei Tests je
Kandidat × Profil:

- **Test A · €/m² (Vergleichswert):** liegt der geforderte €/m² ausreichend **unter** dem
  Submarkt-Transaktions-Benchmark?
- **Test B · Faktor / Rendite (Ertragswert):** ist der implizite Multiplikator günstig
  ggü. dem Markt (Value-Add) **bzw.** übersteigt die Brutto-Rendite eine absolute Schwelle
  (Core+)?

Ergebnis ist ein **Ampelsignal** (grün = beide Tests bestanden, amber = einer, none =
kein Match → bleibt vom Radar verborgen, wird aber für die Sourcing-Statistik persistiert).
Interessante Kandidaten werden **vorgemerkt**, **abgelehnt** (mit Grund) oder in die
**Acquisition** übernommen.

---

## 2. Einordnung in die Modul-Landschaft

```
   Portale (ImmoScout/Immowelt) · Makler-Crawl · Inbox · Manueller Upload · AI-Live-Suche
                                   │
                                   ▼  (Extraktion → Kandidat)
        ┌──────────────────────────────────────────────────────────────┐
        │  DEAL RADAR (Module 07)                                       │
        │  candidateDeals × acquisitionProfiles × Benchmark-Seeds       │
        │     → screenCandidate (Test A/B) → ProfileMatch (Signal)      │
        └──────────────────────────────────────────────────────────────┘
             ▲                                        │
             │ Benchmark-Seeds                        │ promote
   ┌─────────┴──────────┐                             ▼
   │  MARKT / Market    │                     ACQUISITION
   │  Intelligence (06) │                     (neuer AcquisitionDeal,
   │  → Screening-Seeds │                      Stage „Screening")
   └────────────────────┘
```

**Upstream (Eingang):**
- **Markt-Modul (Welt B):** liefert Benchmark-Seeds (`benchmarksToScreeningSeeds`) — die
  Marktannahme, gegen die getestet wird. **Ohne Seed kein Screening** (`lookupBenchmark`
  gibt `null` → kein Match).
- **Ankaufsprofile** (`AcquisitionProfile`): die Mandats-Schwellen (Städte, AssetClasses,
  Preis-/Flächenband, Mindest-Discounts/-Rendite).
- **AI-Live-Suche** (`searchDealRadar` → `/api/ai/chat` + `web_search`): erzeugt
  `DealRadarListing`s, die zu Kandidaten werden.

**Downstream (Ausgang):**
- **Acquisition:** „Übernehmen" (`promoteCandidate`) erzeugt einen `AcquisitionDeal`
  (Stage „Screening") mit vorbelegten Underwriting-/Finanzierungsannahmen aus Benchmark +
  Settings, inkl. Aktivitätslog-Eintrag „Aus Deal Radar übernommen".

---

## 3. Datenmodell

Alle drei Entitäten leben aktuell im **Zustand-Store** (Mock-Seed, `localStorage`).

- **`CandidateDeal`** (`types.ts:822`): eine extrahierte Opportunity.
  Schlüsselfelder: `sourceChannel, sourceRef (dedupe-Key), sourceLabel, title, address,
  city, submarket?, assetClass, askingPrice, areaSqm, currentRentPa?, yearBuilt?, numUnits?,
  description?, aiNotes?, status, listingActive, rejectReason?, reviewNote?, firstSeenAt,
  lastSeenAt, matches[]`.
  **Status** (`CandidateStatus`): `pending_extraction → new/matched/unmatched →
  shortlisted/rejected/promoted/inactive`.
- **`AcquisitionProfile`** (`types.ts:770`): editierbares Mandat.
  `screeningMode ('discount_to_market' | 'absolute_yield_threshold'), cities, submarkets?,
  assetClasses, priceMin/Max, areaMin/Max, minDiscountPricePct, minDiscountFactorPct?,
  minGrossYieldPct?, active`. `shortLabel` = Chip (z. B. „V-A", „C+").
- **`ProfileMatch`** (`types.ts:801`): eine Screening-Auswertung Kandidat × Profil.
  Enthält alle Test-Zwischenwerte (`askingPricePerSqm, benchmarkPricePerSqm,
  discountPricePct, annualErv, impliedFactor, impliedGrossYield, benchmarkFactor,
  discountFactorPct, passA, passB, signal, benchmarkAsOf, benchmarkConfidence`).
- **`DealRadarListing`** (`types.ts:727`): Rohtreffer der AI-Live-Suche (wird via
  `listingToCandidate` zu `CandidateDeal`).
- **`ScreeningBenchmarkSeed`** (`types.ts:789`): der aus Market Intelligence abgeleitete
  Benchmark je `city × submarket × assetClass`.

---

## 4. UI-Aufbau

- **PageHeader:** Titel „Deal Radar", Subtitle „AI-gestützte Suche … · Düsseldorf +
  Speckgürtel", Badge „N neu". Aktionen: **Kadenz-Chip** („Gescreent: Mo & Do 07:00"),
  **„Live-Suche (AI)"**, **„Screening starten"**.
- **Fehler-Banner** (bedingt).
- **Status-Tabs:** Alle · Neu · Vorgemerkt · Abgelehnt · Übernommen (je mit Count).
- **Profil-Filter-Chips:** „Alle Profile" + je Profil ein Chip (Farbe nach `screeningMode`,
  Count der Matches).
- **Kadenz-Banner:** „N neue Deals · letztes Screening … · nächstes Screening Mo 07:00".
- **Karten-Grid (2 Spalten):** je Kandidat eine Karte mit Titel, Ort, Asking Price, Fläche,
  €/m² (+ Discount-zu-Markt), Faktor/Brutto-Rendite, AssetClass-Badge, Quelle. Rahmenfarbe =
  bestes Signal. Leerzustand mit Radar-Icon.
- **Detail-Panel (bedingt, rechts, sticky):** Kopf mit Asking/Fläche/€m²/Brutto-Rendite,
  Badges (AssetClass, Baujahr, Einheiten), Beschreibung, **je Match ein Screening-Read-out**
  (Test A/B mit PASS/FAIL), **AI-Einschätzung**, **Market Context** (Benchmark-Werte),
  **Value-Add-Screening** (20 %-Marge-Residual mit Scope-Schaltern), Quelle/Link,
  **Aktionen**: Übernehmen / Vormerken / Ablehnen (mit Grund-Auswahl).

---

## 5. Interaktionen — Soll vs. Ist

| Element | Soll | Ist | Zusammenhang |
|---|---|---|---|
| **„Screening starten"** | Alle aktiven Kandidaten gegen aktive Profile neu bewerten. | ✅ `runScreening` → `runLocalMatcher` (lokal, gegen Store-Benchmarks). Setzt `lastScreeningAt`. | Nutzt **Markt Welt B** als Seed. Kein Backend-Call. |
| **„Live-Suche (AI)"** | Aktuelle Angebote im Web finden, als Kandidaten aufnehmen, direkt screenen. | 🟡 `searchDealRadar` → `/api/ai/chat`+`web_search`; nutzt **hart** `acquisitionProfiles[0]` und **hart** `usageTypes: ['Wohnen','Mixed Use']`. Ergebnis → `ingestCandidatesFromListings` (dedupe über `sourceRef`). | Erzeugt `CandidateDeal`s; Screening lokal. AI-Antwort nur „Array?"-geprüft. |
| **Status-Tabs** | Kandidaten nach Status filtern. | ✅ lokal. | — |
| **Profil-Chips** | Anzeige auf Profile eingrenzen. | ✅ lokal (`activeProfiles`). | Nur **Anzeige**-Filter; das Screening selbst nutzt `profile.active`. |
| **Karte klicken** | Detail öffnen. | ✅ Toggle. | — |
| **Value-Add-Scope-Schalter** (Modernisierung/Sanierung/Ausbau/Redevelopment) | Bau­kosten-Szenario im Residual umschalten. | ✅ `setVaScope` → `screenValueAdd`. | Bewertungs­logik (§6.3). |
| **„Übernehmen"** (`promoteCandidate`) | Kandidat → neuer Acquisition-Deal mit vorbelegten Annahmen; Kandidat auf `promoted`. | ✅ Erzeugt `AcquisitionDeal` (Stage „Screening"), Underwriting-/Finanzierungs-Defaults aus Benchmark + `settings`, Activity-Log-Eintrag. | **Direkte Kopplung an Acquisition-Modul.** `user` hart „M. Wagner". |
| **„Vormerken"** (`shortlistCandidate`) | Kandidat auf `shortlisted`. | ✅ | — |
| **„Ablehnen"** (`rejectCandidate`) | Grund wählen, Kandidat auf `rejected`. | ✅ Gründe aus fixer Liste `REJECT_REASONS`. | Kandidat bleibt für Sourcing-Statistik erhalten. |
| **Kadenz-Chip / „nächstes Screening Mo 07:00"** | Automatischer Zeitplan (z. B. Mo & Do 07:00). | 🔴 **Statischer Text** — kein Scheduler vorhanden. | Suggeriert Automatik, die es nicht gibt. |
| **„Zum Angebot"-Link** | Zur Originalanzeige. | ✅ nur wenn `sourceRef` mit `http` beginnt. | — |

---

## 6. Fachliche Regeln (Screening-Engine)

Kern in `lib/screening/src/index.ts` (`@workspace/screening`) — **rein, framework-agnostisch,
von Front- und Backend geteilt.** Vorbildlich modularisiert.

### 6.1 Hard-Filter (Vorfilter, `runHardFilters`)

Alle müssen erfüllt sein, sonst Abbruch (`signal = none`):
`city ∈ profile.cities` (+ optional Submarkt-Whitelist) · `assetClass ∈ profile.assetClasses`
· `priceMin ≤ askingPrice ≤ priceMax` · `areaMin ≤ areaSqm ≤ areaMax`.

### 6.2 Test A / Test B / Signal

- **Test A (`runTestA`):** `askingPricePerSqm = askingPrice / areaSqm`;
  `discountPricePct = (benchPricePerSqm − askingPricePerSqm) / benchPricePerSqm × 100`;
  **Pass** wenn `discountPricePct ≥ profile.minDiscountPricePct`.
- **Test B (`runTestB`):** `annualErv = bench.rentPerSqmMonth × areaSqm × 12` (**immer
  Marktmiete/ERV, nie die Angebotsmiete**); `impliedFactor = askingPrice / annualErv`;
  `impliedGrossYield = 1/impliedFactor × 100`.
  - Modus `discount_to_market` (Value-Add): Pass wenn
    `discountFactorPct ≥ minDiscountFactorPct`.
  - Modus `absolute_yield_threshold` (Core+): Pass wenn
    `impliedGrossYield ≥ minGrossYieldPct`.
- **Signal (`signalFor`):** beide Pass → **green**, einer → **amber**, keiner → **none**.

### 6.3 Value-Add-Screening (Residual, `screenValueAdd`)

Deterministischer 20 %-Marge-Test (Entscheidungen mit Jan, 2026-07 — im Code dokumentiert):
- `NOI = Fläche × Marktmiete × 12 × (1 − nonRecoverable 10 %)`.
- `Exit-Wert = NOI / (Markt-NIY + Exit-Buffer)`; Exit-Buffer **0,75 %** in Düsseldorfer
  Prime-Submärkten, sonst **1,00 %**.
- Kosten: Baukosten (`BUILD_COST_RATES` je Scope: 500/1000/1500/3000 €/m²), KNK 10 %,
  Finanzierung 5 % von (Kauf+KNK+Bau), Contingency 10 % von (Bau+Finanzierung).
- **Profit-Hürde = 20 % des Exit-Werts**; `maxBid` (geschlossene Formel) = maximaler
  Kaufpreis, der die Hürde noch trifft.

### 6.4 Local Matcher (`runLocalMatcher`)

Re-screent Kandidaten, **überschreibt aber nie Nutzer-Aktionen**
(`shortlisted/rejected/promoted/inactive` bleiben); nur Auto-Status
(`new/matched/unmatched`) wird fortgeschrieben.

---

## 7. Ist-Zustand & technische Schulden

- 🔴 **Screening gegen falsche/leere Marktwelt:** Frontend screent gegen **Welt B** (Store);
  füllt der Nutzer Marktdaten auf `/markt` (Welt A), passiert im Radar **nichts**. Fehlen
  Seeds ganz, liefert `lookupBenchmark` `null` → **alle Kandidaten fallen still durch**
  (kein Hinweis „keine Benchmark vorhanden").
- 🔴 **Kadenz ist Fake:** „Mo & Do 07:00 / nächstes Mo 07:00" ist statischer Text, kein Job.
- 🔴 **Backend-Screening ungenutzt:** `/api/screening` existiert (rechnet gegen Welt A), wird
  vom Frontend **nicht** aufgerufen — zwei Screening-Pfade, zwei Datenbasen.
- 🟡 **Live-Suche hart verdrahtet:** nur `acquisitionProfiles[0]`, Nutzungsarten fix
  `['Wohnen','Mixed Use']`, Preis-Filter „×0,8–×1,2" hart im Agent.
- 🟡 **Keine echte Extraktions-Pipeline:** `sourceChannel`-Kanäle
  (Portal/Crawl/Inbox/Upload) sind typisiert, aber nur die AI-Live-Suche ist implementiert;
  `pending_extraction` wird nie durchlaufen.
- 🟡 **AI-Antwort nicht schema-validiert** (nur „listings Array?"; kein Zod, keine
  Feld-/Plausibilitätsprüfung).
- 🟡 **Hartkodierte Nutzer/Labels:** `promoteCandidate` schreibt `user: 'M. Wagner'`.
- 🟡 **Reine Store-Persistenz:** Kandidaten/Profile/Matches leben lokal; Backend-Tabellen
  (`candidate_deals`, `profile_matches`, `acquisition_profiles`) existieren, sind aber nicht
  ans Frontend angebunden.
- 🟡 **Fehlendes Error-Handling/Logging** im Frontend (`console.error`, Banner-Text).
- 🟡 **Auth inkonsequent:** Backend-Routen fordern `requireAuth+requireOrg`; Frontend nutzt
  sie hier gar nicht (lokaler Store).

---

## 8. Anforderungen (Soll)

### Funktional — Sourcing & Kandidaten

- **DR-F-01 [M]** — Kandidaten entstehen aus **mehreren Kanälen** (Portale, Makler-Crawl,
  Inbox, manueller Upload, AI-Live-Suche); jeder Kandidat trägt Kanal + Quellreferenz und
  wird über `sourceRef` **dedupliziert**.
- **DR-F-02 [M]** — Für jedes gefundene Angebot werden die vier screening-kritischen Felder
  (Stadt, AssetClass, Asking Price, Fläche) extrahiert; unvollständige Angebote gehen in
  `pending_extraction`, nicht still verloren.
- **DR-F-03 [S]** — AI-Live-Suche nutzt die **tatsächlich aktiven Profile** (nicht fix
  Profil 0) und deren Nutzungsarten/Preis-/Flächenbänder; Ergebnis wird gegen Schema (Zod)
  validiert.

### Funktional — Screening

- **DR-F-04 [M]** — Screening je Kandidat × aktivem Profil nach §6 (Hard-Filter → Test A →
  Test B → Signal), mit **allen Zwischenwerten** im `ProfileMatch` (nachvollziehbar).
- **DR-F-05 [M]** — Benchmark-Input kommt **ausschließlich aus der Markt-Single-Source**
  (`MKT-F-01`); Submarkt schlägt Stadt-Fallback. Fehlt eine Benchmark, ist der Kandidat
  klar als **„nicht bewertbar (keine Marktdaten)"** markiert — nicht stumm „none".
- **DR-F-06 [M]** — Test B rechnet **immer** mit Marktmiete (ERV), nie mit der Angebotsmiete.
- **DR-F-07 [S]** — Value-Add-Residual (§6.3) inkl. `maxBid` je Kandidat, mit umschaltbarem
  Renovierungs-Scope; Annahmen (KNK/Finanzierung/Contingency/Marge/Exit-Buffer) stammen aus
  einem zentralen, editierbaren Profil.
- **DR-F-08 [M]** — Re-Screening überschreibt **nie** Nutzer-Aktionen
  (`shortlisted/rejected/promoted`).

### Funktional — Ankaufsprofile & Workflow

- **DR-F-09 [M]** — Profile sind editierbar (Städte/Submärkte/AssetClasses/Bänder/Schwellen/
  aktiv). Profiländerung löst automatisches Re-Screening aus (bereits via
  `updateAcquisitionProfile`).
- **DR-F-10 [M]** — Aktionen: **Vormerken**, **Ablehnen (mit Grund)**, **Übernehmen**.
  Übernahme erzeugt einen `AcquisitionDeal` (Stage „Screening") mit aus Benchmark + Settings
  vorbelegten Underwriting-/Finanzierungsannahmen und Herkunfts-Log.
- **DR-F-11 [S]** — Screening läuft **zeitgesteuert** (echte Kadenz, z. B. Mo & Do 07:00);
  der angezeigte „nächste Lauf" spiegelt den realen Scheduler.
- **DR-F-12 [K]** — Abgelehnte/nicht gematchte Kandidaten bleiben für die
  **Sourcing-Performance-Auswertung** erhalten (Trefferquote je Profil/Kanal).

### Nicht-funktional

- **DR-NF-01 [M]** — Ein Screening-Ergebnis ist **deterministisch reproduzierbar** aus
  (Kandidat, Profil, Benchmark) — gleiche Engine im Front- und Backend (bereits geteilt via
  `@workspace/screening`; Datenbasis vereinheitlichen).
- **DR-NF-02 [M]** — Definiertes Error-Handling + strukturiertes Logging für AI-/Backend-
  Aufrufe; Doppelklicks erzeugen keine Duplikate.
- **DR-NF-03 [S]** — Nutzer/Autor aus Auth-Kontext (nicht hartkodiert), greift bei aktiver Auth.

---

## 9. Modularisierungs- & Umstellungshinweise

- **Positiv-Beispiel:** `@workspace/screening` ist bereits sauber getrennt (pure Funktionen,
  von Front- und Backend geteilt). Dieses Muster ist der Zielzustand für die übrigen Module.
- **Klare Schnitte (unabhängig baubar):**
  1. **Extraction/Ingestion** — Kanal → `CandidateDeal` (`listingToCandidate`, dedupe).
  2. **Benchmark-Resolution** — Kandidat → Seed (`lookupBenchmark`, Submarkt→Stadt-Fallback).
  3. **Screening** — Engine (§6), rein.
  4. **Kandidaten-Lebenszyklus** — Status-Übergänge (`runLocalMatcher` + Aktionen).
  5. **Promotion** — Kandidat → `AcquisitionDeal` (die **einzige** Schreib-Kopplung ans
     Acquisition-Modul; sauber isolierbar in einen „promotion service").
  6. **Präsentation** — Radar-Seite (View).
- **Umbauten:** Live-Suche entkoppeln (Profile/Nutzungsarten/Preisband als Parameter statt
  hart); Store-Persistenz gegen Backend-Anbindung (`candidateDeals.ts`/`screening.ts`)
  tauschen; Kadenz-Text durch echten Scheduler ersetzen oder als „geplant" kennzeichnen.

---

## 10. Offene fachliche Entscheidungen (für Jan)

- **DR-OPEN-01 [M]** — **Screening-Datenbasis:** Front- und Backend müssen dieselbe
  Markt-Single-Source nutzen (hängt an `MKT-OPEN-01`). Läuft Screening künftig im **Backend**
  (Batch, planbar) oder bleibt es **Frontend-lokal**?
- **DR-OPEN-02** — **Persistenz:** Sollen Kandidaten/Profile/Matches ans Backend
  (org-scoped, `candidate_deals`/`profile_matches`) — oder bewusst lokal bleiben, bis Auth
  aktiv ist?
- **DR-OPEN-03** — **Kadenz:** Verbindlicher Screening-Zeitplan (Mo & Do 07:00?) und Trigger
  (Cron/manuell). Wer wird bei neuen grünen Deals benachrichtigt?
- **DR-OPEN-04** — **Fokusmarkt:** Subtitle/Value-Add-Logik sind auf **Düsseldorf +
  Speckgürtel** zugeschnitten (Prime-Submärkte, Exit-Buffer). Bundesweit ausrollen oder
  bewusst regional?
- **DR-OPEN-05** — **Ablehnungsgründe:** feste Liste (`REJECT_REASONS`) ausreichend, oder
  frei/konfigurierbar? Feld aktuell englisch — bewusst?
- **DR-OPEN-06** — **Promotion-Defaults:** LTV 65 %, Zins 4 %, Tilgung 2 %, Laufzeit 10 J.
  fix im `promoteCandidate` — sollen diese aus Settings/Profil kommen?
