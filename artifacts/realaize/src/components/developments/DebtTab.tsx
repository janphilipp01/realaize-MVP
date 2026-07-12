import { GlassPanel, SectionHeader } from '@/components/shared';
import { formatEUR } from '@/utils/kpiEngine';
import { useStore } from '@/store/useStore';
import { useLanguage } from '@/i18n/LanguageContext';
import type { DevelopmentProject, DevDebtAssumptions } from '@/models/types';
import { useState } from 'react';

export function DebtTab({ dev, totalBudget }: { dev: DevelopmentProject; totalBudget: number }) {
  const { lang } = useLanguage();
  const dateLocale = lang === 'de' ? 'de-DE' : 'en-GB';
  const { updateDevelopment } = useStore();
  const [debtForm, setDebtForm] = useState<DevDebtAssumptions>(dev.debtAssumptions || { ltvPct: 60, ltcPct: 70, interestRatePct: 4.5, loanType: 'Bullet', annuityTermYears: 15 });
        const purchaseLoan = dev.purchasePrice * (debtForm.ltvPct / 100);
        const constructionLoan = totalBudget * (debtForm.ltcPct / 100);
        const totalDebt = purchaseLoan + constructionLoan;
        const annualInterest = totalDebt * (debtForm.interestRatePct / 100);
        const monthlyInterest = annualInterest / 12;
        let monthlyPayment = 0;
        if (debtForm.loanType === 'Annuität' && (debtForm.annuityTermYears || 0) > 0) {
          const i = debtForm.interestRatePct / 100 / 12;
          const n = (debtForm.annuityTermYears || 15) * 12;
          monthlyPayment = totalDebt * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
        }
        const completionDate = dev.actualEndDate || dev.plannedEndDate;
        return (
          <div className="animate-fade-in">
            <div className="grid grid-cols-2 gap-6">
              {/* Form */}
              <GlassPanel style={{ padding: 24 }}>
                <SectionHeader title="Finanzierungsannahmen" />
                <div className="space-y-4 mt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>LTV (% des Kaufpreises)</label>
                      <div className="flex items-center gap-2">
                        <input type="number" className="input-glass flex-1" min={0} max={100} step={0.5}
                          value={debtForm.ltvPct}
                          onChange={e => setDebtForm(p => ({ ...p, ltvPct: parseFloat(e.target.value) || 0 }))}
                        />
                        <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.55)' }}>%</span>
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>LTC (% der Baukosten)</label>
                      <div className="flex items-center gap-2">
                        <input type="number" className="input-glass flex-1" min={0} max={100} step={0.5}
                          value={debtForm.ltcPct}
                          onChange={e => setDebtForm(p => ({ ...p, ltcPct: parseFloat(e.target.value) || 0 }))}
                        />
                        <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.55)' }}>%</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Zinssatz p.a.</label>
                    <div className="flex items-center gap-2">
                      <input type="number" className="input-glass flex-1" min={0} max={20} step={0.05}
                        value={debtForm.interestRatePct}
                        onChange={e => setDebtForm(p => ({ ...p, interestRatePct: parseFloat(e.target.value) || 0 }))}
                      />
                      <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.55)' }}>%</span>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Darlehensart</label>
                    <select className="input-glass w-full" value={debtForm.loanType}
                      onChange={e => setDebtForm(p => ({ ...p, loanType: e.target.value as 'Bullet' | 'Annuität' }))}>
                      <option value="Bullet">Bullet Loan (Rückzahlung bei Fertigstellung)</option>
                      <option value="Annuität">Annuitätendarlehen</option>
                    </select>
                  </div>
                  {debtForm.loanType === 'Annuität' && (
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Laufzeit (Jahre)</label>
                      <input type="number" className="input-glass" min={1} max={40}
                        value={debtForm.annuityTermYears ?? 15}
                        onChange={e => setDebtForm(p => ({ ...p, annuityTermYears: parseInt(e.target.value) || 15 }))}
                      />
                    </div>
                  )}
                  {debtForm.loanType === 'Bullet' && completionDate && (
                    <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(0,122,255,0.06)', border: '1px solid rgba(0,122,255,0.12)', fontSize: 12, color: 'rgba(60,60,67,0.65)' }}>
                      Bullet-Rückzahlung zum Abschluss gemäß Gantt: <strong style={{ color: '#007aff' }}>{new Date(completionDate).toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' })}</strong>
                    </div>
                  )}
                  <button
                    onClick={() => updateDevelopment(dev.id, { debtAssumptions: debtForm })}
                    className="btn-accent px-5 py-2 rounded-xl text-sm w-full"
                  >
                    Annahmen speichern
                  </button>
                </div>
              </GlassPanel>

              {/* Computed results */}
              <GlassPanel style={{ padding: 24 }}>
                <SectionHeader title="Finanzierungsstruktur" />
                <div className="space-y-2 mt-2">
                  {[
                    { label: 'Kaufpreis (Basis LTV)', value: formatEUR(dev.purchasePrice), sub: null },
                    { label: `Kaufpreisdarlehen (${debtForm.ltvPct}% LTV)`, value: formatEUR(purchaseLoan), color: '#007aff' },
                    { label: 'Baukosten (Basis LTC)', value: formatEUR(totalBudget), sub: null },
                    { label: `Baukostendarlehen (${debtForm.ltcPct}% LTC)`, value: formatEUR(constructionLoan), color: '#007aff' },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between py-2 px-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                      <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.65)' }}>{row.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: row.color || '#1c1c1e', fontFamily: 'ui-monospace, monospace' }}>{row.value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-3 px-3 rounded-xl" style={{ background: 'rgba(0,122,255,0.07)', border: '1px solid rgba(0,122,255,0.15)', marginTop: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1c1c1e' }}>Gesamtdarlehen</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#007aff', fontFamily: 'ui-monospace, monospace' }}>{formatEUR(totalDebt)}</span>
                  </div>
                  <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)', paddingTop: 12, marginTop: 4 }}>
                    <div className="flex justify-between py-2 px-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                      <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.65)' }}>Jahreszinsen ({debtForm.interestRatePct}%)</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#ff9500', fontFamily: 'ui-monospace, monospace' }}>{formatEUR(annualInterest)}</span>
                    </div>
                    <div className="flex justify-between py-2 px-3 rounded-xl mt-1" style={{ background: 'rgba(0,0,0,0.03)' }}>
                      <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.65)' }}>Monatliche Zinslast</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#ff9500', fontFamily: 'ui-monospace, monospace' }}>{formatEUR(monthlyInterest)}</span>
                    </div>
                    {debtForm.loanType === 'Annuität' && monthlyPayment > 0 && (
                      <div className="flex justify-between py-2 px-3 rounded-xl mt-1" style={{ background: 'rgba(0,0,0,0.03)' }}>
                        <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.65)' }}>Monatliche Annuität</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1c1c1e', fontFamily: 'ui-monospace, monospace' }}>{formatEUR(monthlyPayment)}</span>
                      </div>
                    )}
                    {debtForm.loanType === 'Bullet' && (
                      <div className="flex justify-between py-2 px-3 rounded-xl mt-1" style={{ background: 'rgba(0,0,0,0.03)' }}>
                        <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.65)' }}>Rückzahlung (Bullet)</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1c1c1e', fontFamily: 'ui-monospace, monospace' }}>{formatEUR(totalDebt)} bei Fertigstellung</span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between py-2 px-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                    <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.65)' }}>Eigenkapital (Gesamt)</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1a7f37', fontFamily: 'ui-monospace, monospace' }}>{formatEUR(dev.purchasePrice + totalBudget - totalDebt)}</span>
                  </div>
                </div>
              </GlassPanel>
            </div>
          </div>
        );
}
