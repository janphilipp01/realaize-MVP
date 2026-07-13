import { useState } from 'react';
import { Bot } from 'lucide-react';
import { GlassPanel, SectionHeader } from '@/components/shared';
import { useStore } from '@/store/useStore';
import { useDateLocale, useLanguage } from '@/i18n/LanguageContext';
import type { DevelopmentProject } from '@/models/types';

export function AdvisorTab({ dev }: { dev: DevelopmentProject }) {
  const dateLocale = useDateLocale();
  const de = useLanguage().lang === 'de';
  const { updateDevelopment } = useStore();
  const [advisorInput, setAdvisorInput] = useState('');
  const [advisorMessages, setAdvisorMessages] = useState(dev.advisorMessages || []);

  const ADVISOR_RESPONSES: Record<string, string> = {
    default: 'Für dieses Development empfehle ich folgende Budgetpositionen basierend auf aktuellen Marktbenchmarks (DACH, Q1/2025): Rohbau 140–165 €/m², TGA komplett 180–220 €/m², Innenausbau 110–140 €/m². Soll ich konkrete Positionen für Ihr Projekt vorschlagen?',
    neubau: 'Bei einem Neubau kalkulieren Sie bitte: GU-Pauschalangebot 1.600–2.200 €/m² BGF (einfacher Standard) bis 2.800–3.500 €/m² (gehoben). Wichtig: Erschließungskosten, Anschlussgebühren und Außenanlagen separat budgetieren (ca. 80–150 €/m² GF).',
    sanierung: 'Kernsanierung Richtwerte: Entkernung 30–60 €/m², TGA-Erneuerung 200–280 €/m², Fassade 180–320 €/m² (je nach Denkmalschutz), Fenster 350–600 €/Stk. Empfehle Reserve von 15–20% bei Bestandsgebäuden.',
    tga: 'TGA-Benchmarks: Heizung (Wärmepumpe inkl. FBH) 85–120 €/m², Sanitär 65–90 €/m², Elektro 55–80 €/m², Lüftung 45–70 €/m². Gesamte TGA bei Sanierung: 250–360 €/m².',
  };

  const getAdvisorResponse = (input: string) => {
    const l = input.toLowerCase();
    if (l.includes('neubau') || l.includes('neu bauen')) return ADVISOR_RESPONSES.neubau;
    if (l.includes('sanierung') || l.includes('kernsanierung') || l.includes('sanieren')) return ADVISOR_RESPONSES.sanierung;
    if (l.includes('tga') || l.includes('heizung') || l.includes('elektro') || l.includes('sanitär')) return ADVISOR_RESPONSES.tga;
    return ADVISOR_RESPONSES.default;
  };

  const handleAdvisorSend = () => {
    if (!advisorInput.trim()) return;
    const userMsg = { id: `adv-${Date.now()}-u`, role: 'user' as const, content: advisorInput, timestamp: new Date().toISOString() };
    const advMsg = { id: `adv-${Date.now()}-a`, role: 'advisor' as const, content: getAdvisorResponse(advisorInput), timestamp: new Date().toISOString() };
    const updated = [...advisorMessages, userMsg, advMsg];
    setAdvisorMessages(updated);
    updateDevelopment(dev.id, { advisorMessages: updated });
    setAdvisorInput('');
  };
  return (
        <div className="animate-fade-in">
          <div className="p-3 rounded-xl mb-4 flex items-center gap-3" style={{ background: 'rgba(0,122,255,0.06)', border: '1px solid rgba(0,122,255,0.12)' }}>
            <Bot size={16} color="#007aff" />
            <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.75)' }}>
              <strong style={{ color: '#007aff' }}>Construction Advisor</strong> — {de ? 'Simulierter Kostenberater. Benchmarks basieren auf DACH-Marktdaten Q1/2025. Manuell überschreibbar.' : 'Simulated cost advisor. Benchmarks based on DACH market data Q1/2025. Manually overridable.'}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <GlassPanel style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ height: 420, overflowY: 'auto', padding: 20 }}>
                <div className="space-y-3">
                  {advisorMessages.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 32, color: 'rgba(60,60,67,0.40)', fontSize: 13 }}>
                      {de ? 'Beschreiben Sie Ihr Development — Art, Größe, Zustand.' : 'Describe your development — type, size, condition.'}<br />{de ? 'Der Advisor liefert Kostenbenchmarks.' : 'The advisor provides cost benchmarks.'}
                    </div>
                  )}
                  {advisorMessages.map(msg => (
                    <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: msg.role === 'advisor' ? 'rgba(0,122,255,0.10)' : 'rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: msg.role === 'advisor' ? '#007aff' : 'rgba(60,60,67,0.60)' }}>
                        {msg.role === 'advisor' ? '🤖' : 'MW'}
                      </div>
                      <div style={{ maxWidth: '78%', background: msg.role === 'advisor' ? 'rgba(0,0,0,0.04)' : 'rgba(0,122,255,0.10)', border: `1px solid ${msg.role === 'advisor' ? 'rgba(0,0,0,0.06)' : 'rgba(0,122,255,0.18)'}`, borderRadius: msg.role === 'advisor' ? '4px 14px 14px 14px' : '14px 4px 14px 14px', padding: '10px 14px', fontSize: 13, color: 'rgba(60,60,67,0.80)', lineHeight: 1.6 }}>
                        {msg.content}
                        <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.35)', marginTop: 4 }}>{new Date(msg.timestamp).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', padding: 14 }}>
                <div className="flex gap-2 mb-2 flex-wrap">
                  {['Neubau Kosten', 'Kernsanierung', 'TGA Benchmarks', 'Außenanlagen'].map(s => (
                    <button key={s} onClick={() => setAdvisorInput(s)} style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 6, cursor: 'pointer', padding: '3px 8px', fontSize: 11, color: 'rgba(60,60,67,0.65)' }}>{s}</button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input className="input-glass flex-1" placeholder={de ? 'Frage eingeben...' : 'Enter your question...'} value={advisorInput} onChange={e => setAdvisorInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdvisorSend()} style={{ fontSize: 13 }} />
                  <button onClick={handleAdvisorSend} className="btn-accent px-4 py-2 rounded-xl text-sm">{de ? 'Senden' : 'Send'}</button>
                </div>
              </div>
            </GlassPanel>

            {/* Benchmark Reference */}
            <GlassPanel style={{ padding: 20 }}>
              <SectionHeader title="Cost Benchmarks DACH" />
              <div className="space-y-2">
                {[
                  { label: de ? 'Rohbau' : 'Shell construction', range: '130–165 €/m²' },
                  { label: de ? 'Dach komplett' : 'Roof (complete)', range: '120–220 €/m²' },
                  { label: de ? 'Fassade (WDVS)' : 'Facade (ETICS)', range: '80–140 €/m²' },
                  { label: de ? 'Fenster (3-fach Holz-Alu)' : 'Windows (triple, wood-alu)', range: '400–700 €/Stk.' },
                  { label: de ? 'TGA Heizung (WP + FBH)' : 'MEP heating (HP + UFH)', range: '85–125 €/m²' },
                  { label: de ? 'TGA Sanitär' : 'MEP plumbing', range: '65–95 €/m²' },
                  { label: de ? 'TGA Elektro' : 'MEP electrical', range: '55–85 €/m²' },
                  { label: de ? 'Innenausbau' : 'Fit-out', range: '110–160 €/m²' },
                  { label: de ? 'Trockenbau' : 'Drywall', range: '40–65 €/m²' },
                  { label: de ? 'Aufzug (4 Haltestellen)' : 'Elevator (4 stops)', range: '45.000–80.000 €' },
                  { label: de ? 'Planung & Architektur' : 'Planning & architecture', range: de ? '8–12% der Baukosten' : '8–12% of construction cost' },
                  { label: 'Reserve', range: de ? '10–20% Gesamt' : '10–20% total' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between py-2 px-3 rounded-lg" style={{ background: 'rgba(0,0,0,0.03)' }}>
                    <span style={{ fontSize: 12, color: 'rgba(60,60,67,0.65)' }}>{row.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#007aff', fontFamily: 'ui-monospace, monospace' }}>{row.range}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.35)', marginTop: 12, fontStyle: 'italic' }}>
                {de ? 'Quellen: BKI Baukosten 2024, SIRADOS, Marktbefragung · Stand Q1/2025' : 'Sources: BKI construction costs 2024, SIRADOS, market survey · as of Q1/2025'}
              </div>
            </GlassPanel>
          </div>
        </div>
  );
}
