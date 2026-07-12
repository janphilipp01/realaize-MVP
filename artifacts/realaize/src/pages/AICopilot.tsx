import { useState } from 'react';
import { RefreshCw, Bot, Shield } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { PageHeader, GlassPanel, SectionHeader } from '@/components/shared';
import { computeAssetNOI, computeAssetLTV } from '@/utils/kpiEngine';
import { useLanguage } from '@/i18n/LanguageContext';
import { aiChat, useListMarketLocations } from '@workspace/api-client-react';

// ══════════════════════════════════════════════════════════
// AI COPILOT PAGE
// ══════════════════════════════════════════════════════════
export function AICopilotPage() {
  const { t, lang } = useLanguage();
  const { assets, deals, developments, sales, settings } = useStore();
  const { data: marketLocations = [] } = useListMarketLocations();
  const dateLocale = lang === 'de' ? 'de-DE' : 'en-GB';
  const [messages, setMessages] = useState<{ role: string; text: string; timestamp?: string }[]>([
    { role: 'assistant', text: t('ai.welcome'), timestamp: new Date().toISOString() },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Build portfolio context summary for Claude
  const buildContext = () => {
    const totalValue = assets.reduce((s, a) => s + a.currentValue, 0);
    const totalDebt = assets.flatMap(a => a.debtInstruments).reduce((s, d) => s + d.outstandingAmount, 0);
    const assetSummaries = assets.map(a => {
      const noi = computeAssetNOI(a);
      const ltv = computeAssetLTV(a);
      return `- ${a.name} (${a.city}, ${a.usageType}): Value ${(a.currentValue/1e6).toFixed(1)}M, NOI ${(noi.noi/1e3).toFixed(0)}k, LTV ${ltv.toFixed(1)}%, Occupancy ${(a.occupancyRate*100).toFixed(0)}%`;
    }).join('\n');
    const dealSummaries = deals.map(d => `- ${d.name} (${d.city}, ${d.dealType}): ${d.stage}, Asking ${(d.askingPrice/1e6).toFixed(1)}M`).join('\n');
    const marketSummary = marketLocations.slice(0, 5).map(l => `- ${l.city}: ${l.benchmarks.length} benchmarks, last updated ${l.lastUpdated}`).join('\n');

    return `PORTFOLIO CONTEXT (Lestate Real GmbH):
Assets (${assets.length}): Total value €${(totalValue/1e6).toFixed(1)}M, Total debt €${(totalDebt/1e6).toFixed(1)}M
${assetSummaries}

Acquisition Pipeline (${deals.length} deals):
${dealSummaries}

Developments: ${developments.length} projects
Sales: ${sales.length} objects

Market Intelligence: ${marketLocations.length} locations tracked
${marketSummary}

Settings: Hurdle Rate ${settings.hurrleRate}%, Tax Rate ${settings.taxRate}%, Exit Multiplier ${settings.defaultExitMultiplier}x, Min DSCR ${settings.minDSCR}x, Max LTV ${settings.maxLTV}%`;
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', text: input, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const conversationHistory = messages.slice(-10).map(m => ({
        role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: m.text,
      }));

      const result = await aiChat({
        maxTokens: 1500,
        system: `You are an AI investment analyst copilot for Lestate Real GmbH, a German private real estate investment firm. You have access to the following live portfolio data:

${buildContext()}

Answer questions about the portfolio, provide analysis, and make recommendations. Always be specific — reference actual asset names, numbers, and KPIs. Respond in ${lang === 'de' ? 'German' : 'English'}. Keep responses concise (3-8 sentences). All KPI terms stay in English regardless of language.

Important: Your recommendations are advisory only. All KPIs are calculated deterministically by the KPI engine. You support the human decision-maker but never replace them.`,
        messages: [...conversationHistory, { role: 'user', content: input }],
      });

      const aiText = result.text || 'No response received.';

      setMessages(prev => [...prev, { role: 'assistant', text: aiText, timestamp: new Date().toISOString() }]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: lang === 'de'
          ? `⚠️ API-Verbindung fehlgeschlagen (${err.message}).`
          : `⚠️ API connection failed (${err.message}).`,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const SUGGESTIONS = [t('ai.suggestion1'), t('ai.suggestion2'), t('ai.suggestion3'), t('ai.suggestion4')];

  return (
    <div className="p-8 max-w-[1000px] mx-auto">
      <PageHeader title={t('ai.title')} subtitle={t('ai.subtitle')} badge="Live" />

      <div className="p-3 rounded-xl mb-6 flex items-center gap-3"
        style={{ background: 'rgba(0,122,255,0.05)', border: '1px solid rgba(0,122,255,0.12)' }}>
        <Shield size={16} color="#007aff" />
        <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.70)' }}>
          <strong style={{ color: '#007aff' }}>{t('ai.governanceNote')}</strong> {t('ai.governanceText')}
        </div>
      </div>

      {/* Chat */}
      <GlassPanel style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ height: 460, overflowY: 'auto', padding: 24 }}>
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: msg.role === 'assistant' ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {msg.role === 'assistant' ? <Bot size={14} color="#007aff" /> : <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.70)' }}>MW</span>}
                </div>
                <div style={{
                  maxWidth: '75%',
                  background: msg.role === 'assistant' ? 'rgba(255,255,255,0.05)' : 'rgba(201,169,110,0.1)',
                  border: `1px solid ${msg.role === 'assistant' ? 'rgba(255,255,255,0.08)' : 'rgba(201,169,110,0.2)'}`,
                  borderRadius: msg.role === 'assistant' ? '4px 18px 18px 18px' : '18px 4px 18px 18px',
                  padding: '12px 16px', fontSize: 13, color: 'rgba(60,60,67,0.70)', lineHeight: 1.6,
                }}>
                  {msg.text}
                  {msg.role === 'assistant' && msg.timestamp && (
                    <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', marginTop: 6 }}>
                      Claude Sonnet · {new Date(msg.timestamp).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(201,169,110,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RefreshCw size={14} color="#007aff" className="animate-spin" />
                </div>
                <div style={{ padding: '12px 16px', fontSize: 13, color: 'rgba(60,60,67,0.45)', fontStyle: 'italic' }}>
                  {lang === 'de' ? 'Analysiere Portfolio-Daten...' : 'Analyzing portfolio data...'}
                </div>
              </div>
            )}
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', padding: '16px 24px' }}>
          <div className="flex gap-2 mb-3 flex-wrap">
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => setInput(s)}
                className="badge-neutral cursor-pointer"
                style={{ cursor: 'pointer', fontSize: 12, padding: '4px 10px', background: 'rgba(0,0,0,0.04)' }}>
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <input className="input-glass flex-1" placeholder={t('ai.placeholder')} value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()} />
            <button onClick={handleSend} disabled={loading} className="btn-accent px-5 py-2 rounded-xl text-sm" style={{ opacity: loading ? 0.6 : 1 }}>{t('ai.send')}</button>
          </div>
        </div>
      </GlassPanel>

      {/* Audit trail */}
      <GlassPanel style={{ padding: 20 }}>
        <SectionHeader title={t('ai.auditTitle')} />
        <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)', fontStyle: 'italic' }}>
          {t('ai.auditText')}
        </div>
      </GlassPanel>
    </div>
  );
}

