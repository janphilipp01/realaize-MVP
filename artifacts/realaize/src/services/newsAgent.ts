import { aiChat } from '@workspace/api-client-react';
import type { NewsArticle, NewsCategory, DailyIntelligenceReport } from '@/models/types';

export interface NewsResearchResult {
  success: boolean;
  report: DailyIntelligenceReport | null;
  error?: string;
}

export async function generateDailyIntelligenceReport(date: string): Promise<NewsResearchResult> {
  const prompt = `You are a German real estate market analyst. Today: ${date}.

Do ONE web search for "German real estate market news ${date}" or "Immobilienmarkt Deutschland aktuell", then compile 6-8 news items from the results.

Reply ONLY with valid JSON (no markdown):
{"articles":[{"title":"...","summary":"1-2 sentences","sourceLabel":"publication name","sourceUrl":"URL or empty","category":"Deals & Transactions|Leasing & Lettings|Interest Rates & Monetary Policy|Regulation & Policy|Capital Markets|Macro & Global Economy","impactRating":"high|medium|low"}],"executiveSummary":"3-4 sentences in German","marketImpactAnalysis":"4-5 sentences in German on impact for investors"}`;

  try {
    const result = await aiChat({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2000,
      webSearch: true,
    });

    const cleanJson = result.text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    if (!parsed.articles || !Array.isArray(parsed.articles)) {
      throw new Error('Invalid response: missing articles array');
    }

    const articles: NewsArticle[] = parsed.articles.map((a: any, i: number) => ({
      id: `news-${date}-${i}`,
      title: a.title || 'Untitled',
      summary: a.summary || '',
      sourceLabel: a.sourceLabel || 'Unknown',
      sourceUrl: a.sourceUrl || '',
      category: (a.category as NewsCategory) || 'Macro & Global Economy',
      publishedAt: date,
      impactRating: a.impactRating || 'medium',
    }));

    const report: DailyIntelligenceReport = {
      id: `report-${date}`,
      date,
      articles,
      executiveSummary: parsed.executiveSummary || '',
      marketImpactAnalysis: parsed.marketImpactAnalysis || '',
      generatedAt: new Date().toISOString(),
    };

    return { success: true, report };
  } catch (error: any) {
    console.error('News research failed:', error);
    return { success: false, report: null, error: error.message };
  }
}
