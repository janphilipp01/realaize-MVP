// ─── News & Daily Intelligence ──────────────────────────────────────────────

export type NewsCategory =
  | 'Deals & Transactions'
  | 'Leasing & Lettings'
  | 'Interest Rates & Monetary Policy'
  | 'Regulation & Policy'
  | 'Capital Markets'
  | 'Macro & Global Economy';

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;       // 1-2 sentence summary
  sourceLabel: string;    // e.g. "Immobilien Zeitung", "Handelsblatt"
  sourceUrl: string;      // link to original article
  category: NewsCategory;
  publishedAt: string;    // ISO date
  impactRating: 'high' | 'medium' | 'low'; // relevance for RE market
}

export interface DailyIntelligenceReport {
  id: string;
  date: string;           // YYYY-MM-DD
  articles: NewsArticle[];
  executiveSummary: string;  // AI-generated daily briefing
  marketImpactAnalysis: string; // AI analysis of impact on German RE
  generatedAt: string;    // ISO timestamp
}
