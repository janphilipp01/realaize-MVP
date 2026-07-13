// Mock data for the Market Intelligence "Review Queues" cockpit.
// Demonstration only — a self-contained triage board of data points awaiting
// human sign-off. Not wired into the real benchmark store; the component keeps
// approve/reject/reassign state locally so the demo is fully interactive.

import { Activity, AlertTriangle, Database, Newspaper } from 'lucide-react';

export type QueueId = 'benchmark' | 'outlier' | 'news' | 'source';
export type ReviewPriority = 'high' | 'medium' | 'low';

export interface ReviewQueueDef {
  id: QueueId;
  label: string; // technical queue name — English always
  icon: typeof Database;
  blurb: { de: string; en: string };
}

export interface ReviewQueueItem {
  id: string;
  queue: QueueId;
  title: string; // English (KPI / provider / event headline)
  context: { de: string; en: string };
  city: string;
  submittedBy: string;
  submittedAt: string; // ISO
  slaDueAt: string; // ISO
  priority: ReviewPriority;
  current?: string; // reconciled / captured value
  proposed?: string; // suggested corrected value
  meta?: string; // short technical tag (spread, trust, impact …)
}

// Dates are computed relative to load time so the SLA/overdue logic always
// looks live in the demo.
const iso = (dayOffset: number, hour = 9) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

export const REVIEW_QUEUES: ReviewQueueDef[] = [
  {
    id: 'benchmark',
    label: 'Benchmark Validation',
    icon: Database,
    blurb: {
      de: 'Reconciled Werte außerhalb der Plausibilitätsspanne oder mit niedriger Konfidenz.',
      en: 'Reconciled values outside the plausibility band or with low confidence.',
    },
  },
  {
    id: 'outlier',
    label: 'Outlier Escalation',
    icon: AlertTriangle,
    blurb: {
      de: 'Einzelne Broker-Quellen, die von der Peer-Gruppe abweichen und geklärt werden müssen.',
      en: 'Individual broker sources deviating from the peer group that need clearing.',
    },
  },
  {
    id: 'news',
    label: 'News Impact',
    icon: Newspaper,
    blurb: {
      de: 'Markt-Events, deren Impact-Tier vor Aufnahme ins IC-Memo bestätigt werden muss.',
      en: 'Market events whose impact tier must be confirmed before entering the IC memo.',
    },
  },
  {
    id: 'source',
    label: 'Source Onboarding',
    icon: Activity,
    blurb: {
      de: 'Neue Report-Quellen, die einen Trust-Score und Freigabe benötigen.',
      en: 'New report sources awaiting a trust score and sign-off.',
    },
  },
];

export const REVIEW_QUEUE_ITEMS: ReviewQueueItem[] = [
  // ── Benchmark Validation ──
  {
    id: 'rq-bm-01', queue: 'benchmark', title: 'Prime Rent · Office',
    city: 'München',
    context: { de: 'Konsolidierter Wert 4,7 % über oberer Plausibilitätsspanne.', en: 'Reconciled value 4.7% above the upper plausibility band.' },
    submittedBy: 'MI Agent', submittedAt: iso(-4), slaDueAt: iso(-1),
    priority: 'high', current: '46,50 €/m²', proposed: '43,20 €/m²', meta: 'spread Δ4.7 · 3 sources',
  },
  {
    id: 'rq-bm-02', queue: 'benchmark', title: 'Net Initial Yield · Logistics',
    city: 'Düsseldorf',
    context: { de: 'AI-qualitative Schätzung — keine Broker-Quelle, nur ein Datenpunkt.', en: 'AI qualitative estimate — no broker source, single data point.' },
    submittedBy: 'MI Agent', submittedAt: iso(-2), slaDueAt: iso(2),
    priority: 'medium', current: '4,15 %', proposed: '4,40 %', meta: 'confidence low',
  },
  {
    id: 'rq-bm-03', queue: 'benchmark', title: 'Multiplier · Residential',
    city: 'Berlin',
    context: { de: 'Faktor unter historischem Korridor — Prüfung auf Datenfehler.', en: 'Multiplier below the historical corridor — check for data error.' },
    submittedBy: 'MI Agent', submittedAt: iso(-1), slaDueAt: iso(4),
    priority: 'low', current: '24,8x', proposed: '27,1x', meta: '2 sources',
  },

  // ── Outlier Escalation ──
  {
    id: 'rq-ol-01', queue: 'outlier', title: 'Colliers · Prime Rent Office',
    city: 'München',
    context: { de: 'Meldung 18,50 €/m² weicht 22 % von der Peer-Gruppe ab.', en: 'Reported 18.50 €/m² deviates 22% from the peer group.' },
    submittedBy: 'Cross-Validation', submittedAt: iso(-3), slaDueAt: iso(-1),
    priority: 'high', current: '18,50 €/m²', meta: 'z-score 2.8 · trust 0.61',
  },
  {
    id: 'rq-ol-02', queue: 'outlier', title: 'BNP · Purchase Price Factor',
    city: 'Hamburg',
    context: { de: 'Einzelwert oberhalb IQR — möglicher Copy-Paste-Fehler im Report.', en: 'Single value above the IQR — possible copy-paste error in the report.' },
    submittedBy: 'Cross-Validation', submittedAt: iso(-1), slaDueAt: iso(3),
    priority: 'medium', current: '32,0x', meta: 'z-score 2.1 · p.4',
  },

  // ── News Impact ──
  {
    id: 'rq-nw-01', queue: 'news', title: 'Allianz sells prime office to institutional buyer',
    city: 'Frankfurt',
    context: { de: 'Agent klassifiziert als High Impact — Rendite 4,1 % setzt Benchmark.', en: 'Agent classified as High Impact — 4.1% yield sets a benchmark.' },
    submittedBy: 'News Agent', submittedAt: iso(-2), slaDueAt: iso(1),
    priority: 'high', meta: 'suggested: high · yield 4.1%',
  },
  {
    id: 'rq-nw-02', queue: 'news', title: '12,000 m² office handed back near CBD',
    city: 'Düsseldorf',
    context: { de: 'Erhöht lokalen Leerstand — deskriptiver Kontext, keine ERV-Anpassung.', en: 'Raises local vacancy — descriptive context, no ERV adjustment.' },
    submittedBy: 'News Agent', submittedAt: iso(-1), slaDueAt: iso(4),
    priority: 'low', meta: 'suggested: medium',
  },

  // ── Source Onboarding ──
  {
    id: 'rq-sc-01', queue: 'source', title: 'JLL Residential City Report Q1',
    city: 'Berlin',
    context: { de: 'Neue Quelle vorgeschlagen — Trust-Score und Provenance prüfen.', en: 'New source proposed — verify trust score and provenance.' },
    submittedBy: 'MI Agent', submittedAt: iso(-5), slaDueAt: iso(-2),
    priority: 'medium', meta: 'proposed trust 0.82 · PDF · 44 p.',
  },
  {
    id: 'rq-sc-02', queue: 'source', title: 'Savills Logistics Snapshot',
    city: 'München',
    context: { de: 'Erstmalige Quelle für Logistik-Yields in diesem Submarkt.', en: 'First-time source for logistics yields in this submarket.' },
    submittedBy: 'MI Agent', submittedAt: iso(0), slaDueAt: iso(5),
    priority: 'low', meta: 'proposed trust 0.74',
  },
];

export const REVIEWERS = ['J. Pleuker', 'M. Wagner', 'S. Bauer', 'Unassigned'];
