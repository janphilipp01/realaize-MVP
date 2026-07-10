# Anforderungskatalog — Realaize

> **Zweck dieses Dokuments.** Der Quelltext bildet ab, *was aktuell passiert* — nicht,
> *was fachlich passieren soll*. Dieser Katalog schließt diese Lücke: Er beschreibt pro
> Modul die **Soll-Funktion** (UI, Interaktionen, Regeln, Modul-Zusammenhänge) und stellt
> sie dem **Ist-Zustand** im Code gegenüber. Damit lassen sich Teile gezielt entschlacken,
> neu bauen oder umbauen, ohne fachliches Wissen aus tausendzeiligen Funktionen zu
> rekonstruieren.

Stand: 2026-07-10 · Basis-Branch: `claude/module-requirements-catalog-ycgim7`

---

## Enthaltene Module

| Datei | Modul | Route | Konzept-Bezug |
|---|---|---|---|
| [`markt.md`](./markt.md) | **Markt** (inkl. Market Intelligence) | `/markt`, `/market-intelligence` | Module 06 |
| [`deal-radar.md`](./deal-radar.md) | **Deal Radar** (Deal Sourcing & Screening) | `/radar` | Module 07 |

Weitere Module folgen im Projektverlauf (Portfolio, Assets, Developments, Sales,
Acquisition, Debt, Documents, AI Copilot, News, Settings).

---

## Legende / So ist der Katalog aufgebaut

Jedes Modul-Dokument folgt derselben Gliederung:

1. **Zweck & fachliche Rolle** — wozu das Modul dient.
2. **Einordnung in die Modul-Landschaft** — Datenquellen (Upstream) und Konsumenten (Downstream).
3. **Datenmodell** — was geladen wird, woher, in welche Typen.
4. **UI-Aufbau** — was der Nutzer sieht.
5. **Interaktionen** — jeder Button/Input/Filter mit **Soll** vs. **Ist** und Modul-Zusammenhang.
6. **Fachliche Regeln** — Berechnungen, Formeln, Schwellenwerte.
7. **Ist-Zustand & technische Schulden** — Mocks, fehlende Verdrahtung, Auth, Doppelstrukturen.
8. **Anforderungen (Soll)** — nummeriert und testbar.
9. **Modularisierungs- & Umstellungshinweise** — was trennbar ist / zusammengehört.
10. **Offene fachliche Entscheidungen** — Punkte, die Jan entscheiden muss.

### Anforderungs-IDs

- `MKT-*` = Markt / Market Intelligence, `DR-*` = Deal Radar.
- `-F-` = funktional, `-NF-` = nicht-funktional, `-OPEN-` = offene Entscheidung.
- Priorität: **[M]** Muss · **[S]** Soll · **[K]** Kann.

### Ist-Kennzeichnung

- ✅ **umgesetzt** — im Code vorhanden und verdrahtet.
- 🟡 **teilweise / Mock** — sichtbar, aber Daten oder Backend fehlen bzw. sind statisch.
- 🔴 **fehlt** — im Code nicht vorhanden.

---

## Wichtigste modulübergreifende Erkenntnis: Zwei parallele Markt-Datenmodelle

Bei der Analyse fällt der zentrale strukturelle Bruch auf, der die Wartbarkeit am
stärksten belastet. Es existieren **zwei unabhängige Markt-Datenwelten**, die nicht
synchron sind:

| | **Welt A — „Markt" (Legacy)** | **Welt B — „Market Intelligence" (Module 06)** |
|---|---|---|
| Route / Seite | `/markt` (`MarktPage`) | `/market-intelligence` (`MarketIntelligencePage`) |
| Typ | `MarketLocation` → `MarketBenchmark` | `BenchmarkRecord` (+ `BenchmarkSourceRecord`) |
| Granularität | pro Stadt × Nutzungsart, Min/Median/Max | pro Stadt × Submarkt × AssetClass × **KPI** × Quartal |
| Speicherort | **Backend** (`market_locations`, Postgres) via React-Query | **Zustand-Store** (lokal, `restate-storage-v2`), Mock-Seed |
| Befüllung | AI Research Agent (`researchCityMarketData`) | Quarterly Refresh Job (Mock), Reviewer-Freigabe |
| Qualitätslogik | einfacher `confidenceScore` 0–100 | Multi-Broker-Reconciliation, Plausibilitäts- & QoQ-Prüfung, Review-Queue |

**Konsequenz — die entscheidende Bruchstelle:**

- Das **Deal Radar** (Frontend) screent ausschließlich gegen **Welt B**
  (`benchmarks` aus dem Store → `benchmarksToScreeningSeeds`).
- Der **AI Research Agent** auf der `/markt`-Seite schreibt aber nur nach **Welt A**
  (Backend `market_locations`).
- **Folge:** Eine Marktdaten-Recherche auf der Markt-Seite verändert die
  Screening-Ergebnisse im Deal Radar **nicht**. Beide Seiten wirken „live", speisen
  aber getrennte Töpfe.
- Zusätzlich: Der **Backend-Screening-Endpoint** (`/api/screening`) rechnet wiederum
  gegen **Welt A** (`market_locations`), während das Frontend-Screening lokal gegen
  **Welt B** läuft. Es gibt also sogar zwei Screening-Pfade mit unterschiedlicher
  Datenbasis.

**Entscheidung (2026-07-10, Jan) — `MKT-OPEN-01` geklärt:** **Welt B (Market Intelligence)
ist die Single Source of Truth.** Welt A wird als Datenmodell **abgelöst**; die
`/markt`-Ansicht wird während der Umstellung per **Adapter auf Welt B abgebildet**. Der
konkrete, phasenweise Umbau steht in
[`markt.md` §11 — Zielarchitektur & Migrationsplan](./markt.md#11-zielarchitektur--migrationsplan-welt-b-als-single-source-of-truth).
Kernpunkt der Reihenfolge: Welt B hat das bessere Modell, aber **keine** Backend-Persistenz —
sie muss also zuerst persistent gemacht werden, bevor Schreiber und Backend-Screening auf sie
umgelenkt werden und Welt A fällt.

---

## Systemkontext (Kurzfassung)

- **Frontend:** React + Vite, Zustand-Store mit `localStorage`-Persistenz
  (`restate-storage-v2`), React Router, TailwindCSS. UI durchgängig **Deutsch**
  (i18n via `LanguageContext`, `de`/`en`).
- **Backend:** Express 5, Drizzle ORM + PostgreSQL. Auth-Kette
  `requireAuth → requireOrg → requireRole`. In der aktuellen Entwicklung mit
  „Authentication = DISABLED" (Dev-Auth-Bypass).
- **AI:** Alle Agenten laufen über **einen** Backend-Endpoint `POST /api/ai/chat`
  (proxied Anthropic Claude, `web_search`-Tool, Rate-Limit, pino-Logging). Die
  browserseitigen Agenten (`dealRadarAgent`, `marketResearchAgent`, `newsAgent`)
  rufen diesen Endpoint über den generierten Client `aiChat` auf.
- **Datenhaltung Frontend vs. Backend:** gemischt. Manche Module (Markt-Locations,
  Contacts, Appointments) lesen echt vom Backend; Deal Radar, Market Intelligence,
  Benchmarks etc. leben rein im lokalen Store mit Mock-Seed. Diese Uneinheitlichkeit
  ist in jedem Modul-Dokument im Abschnitt „Ist-Zustand" markiert.
