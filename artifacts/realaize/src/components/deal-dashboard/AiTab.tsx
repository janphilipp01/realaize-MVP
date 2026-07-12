import React from 'react';
import { AlertTriangle, Bot, Zap } from 'lucide-react';

import { GlassPanel } from '@/components/shared';

import { useDateLocale } from '@/i18n/LanguageContext';

import type { AcquisitionDeal } from '@/models/types';

export function AiTab({ deal }: { deal: AcquisitionDeal }) {
  const dateLocale = useDateLocale();
  return (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'rgba(0,122,255,0.05)', border: '1px solid rgba(0,122,255,0.12)' }}>
            <Bot size={18} color="#007aff" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#007aff' }}>AI Researcher — Empfehlungsmodul</div>
              <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)' }}>
                Deterministischer Vergleich von Underwriting-Annahmen mit Markt-Benchmarks. Nur Unterstützung — KPIs bleiben Referenz.
              </div>
            </div>
            <span className="badge-neutral">Simuliert · Kein LLM</span>
          </div>

          {deal.aiRecommendations.map(rec => (
            <GlassPanel key={rec.id} style={{ padding: 20, border: rec.isAlert ? '1px solid rgba(251,191,36,0.2)' : '1px solid rgba(255,255,255,0.1)' }}>
              <div className="flex items-start gap-4">
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: rec.isAlert ? 'rgba(251,191,36,0.12)' : 'rgba(201,169,110,0.12)',
                  border: `1px solid ${rec.isAlert ? 'rgba(251,191,36,0.2)' : 'rgba(201,169,110,0.2)'}`,
                }}>
                  {rec.isAlert ? <AlertTriangle size={16} color="#fbbf24" /> : <Zap size={16} color="#007aff" />}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ fontSize: 14, fontWeight: 700, color: rec.isAlert ? '#fbbf24' : 'var(--text-primary)' }}>{rec.title}</span>
                    <span className={rec.confidence === 'Hoch' ? 'badge-success' : rec.confidence === 'Mittel' ? 'badge-warning' : 'badge-neutral'}>
                      {rec.confidence}
                    </span>
                    <span className="badge-neutral">{rec.type}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.70)', lineHeight: 1.6, marginBottom: 12 }}>{rec.body}</div>
                  {rec.benchmarkValue !== undefined && rec.userValue !== undefined && (
                    <div className="flex gap-4">
                      <div className="p-3 rounded-lg flex-1" style={{ background: 'rgba(0,0,0,0.03)' }}>
                        <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', letterSpacing: '0.05em' }}>IHRE ANNAHME</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: rec.isAlert ? '#fbbf24' : 'var(--text-primary)' }}>
                          {rec.userValue?.toFixed(2)} {rec.type === 'Miete' ? '€/m²' : 'x'}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg flex-1" style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.15)' }}>
                        <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', letterSpacing: '0.05em' }}>MARKT-BENCHMARK</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#4ade80' }}>
                          {rec.benchmarkValue?.toFixed(2)} {rec.type === 'Miete' ? '€/m²' : 'x'}
                        </div>
                      </div>
                      {rec.deviationPercent !== undefined && (
                        <div className="p-3 rounded-lg flex-1" style={{ background: 'rgba(0,0,0,0.03)' }}>
                          <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.45)', letterSpacing: '0.05em' }}>ABWEICHUNG</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: Math.abs(rec.deviationPercent) > 10 ? '#f87171' : '#fbbf24' }}>
                            {rec.deviationPercent > 0 ? '+' : ''}{rec.deviationPercent.toFixed(1)}%
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginTop: 8 }}>
                    Quelle: {rec.benchmarkLabel} · {new Date(rec.generatedAt).toLocaleDateString(dateLocale)}
                  </div>
                </div>
              </div>
            </GlassPanel>
          ))}
          {deal.aiRecommendations.length === 0 && (
            <div className="text-center py-12">
              <Bot size={32} color="var(--text-muted)" />
              <div style={{ color: 'rgba(60,60,67,0.45)', marginTop: 8 }}>Keine AI-Empfehlungen verfügbar.</div>
            </div>
          )}
        </div>
  );
}
