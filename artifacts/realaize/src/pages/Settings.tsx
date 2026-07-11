import { CheckCircle, Target } from 'lucide-react';
import { useStore } from '../store/useStore';
import { PageHeader, GlassPanel } from '../components/shared';
import { useLanguage } from '../i18n/LanguageContext';

// ══════════════════════════════════════════════════════════
// SETTINGS PAGE
// ══════════════════════════════════════════════════════════
export function SettingsPage() {
  const { resetToMockData, settings, updateSettings } = useStore();
  const { t, lang } = useLanguage();

  return (
    <div className="p-8 max-w-[900px] mx-auto">
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <div className="space-y-6">

        {/* ── Hold/Sell & IRR ── */}
        <GlassPanel style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1c1c1e', marginBottom: 4 }}>{t('settings.holdSell')}</div>
          <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.45)', marginBottom: 20 }}>
            {t('settings.holdSellDesc')}
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {t('settings.hurdleRate')}
              </label>
              <input
                type="number"
                className="input-glass"
                value={settings.hurrleRate}
                min={1} max={50} step={0.5}
                onChange={e => updateSettings({ hurrleRate: parseFloat(e.target.value) || 15 })}
              />
              <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.40)', marginTop: 4 }}>
                {settings.hurrleRate}%
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {t('settings.taxRate')}
              </label>
              <input
                type="number"
                className="input-glass"
                value={settings.taxRate}
                min={0} max={50} step={1}
                onChange={e => updateSettings({ taxRate: parseFloat(e.target.value) || 25 })}
              />
              <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.40)', marginTop: 4 }}>
                {settings.taxRate}%
              </div>
            </div>
          </div>
        </GlassPanel>

        {/* ── Advisor Language ── */}
        <GlassPanel style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1c1c1e', marginBottom: 4 }}>{t('settings.constructionAdvisor')}</div>
          <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.45)', marginBottom: 16 }}>{t('settings.advisorDesc')}</div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{t('settings.language')}</label>
            <select className="input-glass" style={{ width: 200 }} value={settings.advisorLanguage} onChange={e => updateSettings({ advisorLanguage: e.target.value as 'de' | 'en' })}>
              <option value="de">Deutsch</option>
              <option value="en">English</option>
            </select>
          </div>
        </GlassPanel>

        {/* ── KPI Thresholds ── */}
        <GlassPanel style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1c1c1e', marginBottom: 4 }}>{t('settings.kpiThresholds')}</div>
          <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.45)', marginBottom: 20 }}>{t('settings.kpiThresholdsDesc')}</div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Min. DSCR', key: 'minDSCR', unit: 'x', step: 0.05 },
              { label: 'Max. LTV', key: 'maxLTV', unit: '%', step: 1 },
              { label: 'Target NIY', key: 'targetNIY', unit: '%', step: 0.1 },
              { label: 'Exit Multiplier', key: 'defaultExitMultiplier', unit: 'x', step: 0.5 },
            ].map(field => (
              <div key={field.key}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {field.label} ({field.unit})
                </label>
                <input
                  type="number"
                  className="input-glass"
                  value={(settings as any)[field.key]}
                  step={field.step}
                  onChange={e => updateSettings({ [field.key]: parseFloat(e.target.value) || 0 } as any)}
                />
                <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.40)', marginTop: 3 }}>
                  {(settings as any)[field.key]}{field.unit}
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>

        {/* ── Marktannahmen ── */}
        <GlassPanel style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1c1c1e', marginBottom: 4 }}>
            {lang === 'de' ? 'Marktannahmen & DCF-Parameter' : 'Market Assumptions & DCF Parameters'}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.45)', marginBottom: 20 }}>
            {lang === 'de'
              ? 'Standardwerte für Exit-Cap-Rates und Mietwachstum nach Nutzungsart. Werden beim Anlegen neuer Deals und beim Überführen in den Bestand verwendet.'
              : 'Default values for exit cap rates and rent growth by usage type. Used when creating new deals and transferring to portfolio.'}
          </div>
          <div style={{ marginBottom: 20 }}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {lang === 'de' ? 'Standard-Haltedauer (Jahre)' : 'Default Holding Period (yrs)'}
                </label>
                <input type="number" className="input-glass" value={settings.defaultHoldingPeriod ?? 10} min={1} max={30} step={1}
                  onChange={e => updateSettings({ defaultHoldingPeriod: parseInt(e.target.value) || 10 } as any)} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {lang === 'de' ? 'Standard-Baukostenpuffer (%)' : 'Default Contingency (%)'}
                </label>
                <input type="number" className="input-glass" value={settings.defaultContingencyPercent ?? 10} min={0} max={50} step={1}
                  onChange={e => updateSettings({ defaultContingencyPercent: parseFloat(e.target.value) || 10 } as any)} />
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(60,60,67,0.50)', marginBottom: 12, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {lang === 'de' ? 'Exit-Cap-Rate nach Nutzungsart (%)' : 'Exit Cap Rate by Usage Type (%)'}
          </div>
          <div className="grid grid-cols-5 gap-3 mb-6">
            {['Wohnen', 'Büro', 'Einzelhandel', 'Logistik', 'Mixed Use'].map(ut => (
              <div key={ut}>
                <label style={{ fontSize: 10, fontWeight: 600, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 4 }}>{ut}</label>
                <input type="number" step="0.1" className="input-glass"
                  value={(settings.defaultExitCapRates ?? {})[ut] ?? 5.0}
                  onChange={e => updateSettings({ defaultExitCapRates: { ...(settings.defaultExitCapRates ?? {}), [ut]: parseFloat(e.target.value) || 5 } } as any)} />
                <div style={{ fontSize: 10, color: 'rgba(60,60,67,0.40)', marginTop: 2 }}>
                  = {(100 / ((settings.defaultExitCapRates ?? {})[ut] || 5)).toFixed(1)}x
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(60,60,67,0.50)', marginBottom: 12, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {lang === 'de' ? 'ERV-Wachstum nach Nutzungsart (% p.a.)' : 'ERV Growth Rate by Usage Type (% p.a.)'}
          </div>
          <div className="grid grid-cols-5 gap-3">
            {['Wohnen', 'Büro', 'Einzelhandel', 'Logistik', 'Mixed Use'].map(ut => (
              <div key={ut}>
                <label style={{ fontSize: 10, fontWeight: 600, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 4 }}>{ut}</label>
                <input type="number" step="0.1" className="input-glass"
                  value={(settings.defaultErvGrowthRates ?? {})[ut] ?? 2.0}
                  onChange={e => updateSettings({ defaultErvGrowthRates: { ...(settings.defaultErvGrowthRates ?? {}), [ut]: parseFloat(e.target.value) || 2 } } as any)} />
              </div>
            ))}
          </div>
        </GlassPanel>

        {/* ── Default Operating Costs ── */}
        <GlassPanel style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1c1c1e', marginBottom: 4 }}>{lang === 'de' ? 'Standard-Betriebskosten' : 'Default Operating Costs'}</div>
          <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.45)', marginBottom: 20 }}>{lang === 'de' ? 'Voreinstellungen für neue Assets und Deals. Können pro Objekt überschrieben werden.' : 'Defaults for new assets and deals. Can be overridden per object.'}</div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Vacancy Rate', key: 'defaultVacancyRate', unit: '%', step: 0.5 },
              { label: 'Management Cost', key: 'defaultMgmtCostPct', unit: '%', step: 0.5 },
              { label: 'Maintenance Reserve', key: 'defaultMaintenancePerSqm', unit: '€/m²', step: 1 },
              { label: 'Closing Costs', key: 'defaultClosingCostPct', unit: '%', step: 0.5 },
              { label: 'Broker Fee', key: 'defaultBrokerFeePct', unit: '%', step: 0.5 },
            ].map(field => (
              <div key={field.key}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {field.label} ({field.unit})
                </label>
                <input type="number" className="input-glass" value={(settings as any)[field.key]} step={field.step}
                  onChange={e => updateSettings({ [field.key]: parseFloat(e.target.value) || 0 } as any)} />
              </div>
            ))}
          </div>
        </GlassPanel>

        {/* ── Market Defaults (neue Felder) ── */}
        <GlassPanel style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1c1c1e', marginBottom: 4 }}>
            {t('settings.marketDefaults')}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.45)', marginBottom: 20 }}>
            {t('settings.marketDefaultsDesc')}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {t('settings.defaultOpexInflation')}
              </label>
              <div className="flex items-center gap-2">
                <input type="number" className="input-glass" step={0.1} min={0} max={10}
                  value={(settings as any).defaultOpexInflation ?? 2.0}
                  onChange={e => updateSettings({ defaultOpexInflation: parseFloat(e.target.value) || 2 } as any)} />
                <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.50)' }}>{(settings as any).defaultOpexInflation ?? 2.0}%</span>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {t('settings.defaultCapexInflation')}
              </label>
              <div className="flex items-center gap-2">
                <input type="number" className="input-glass" step={0.1} min={0} max={10}
                  value={(settings as any).defaultCapexInflation ?? 3.0}
                  onChange={e => updateSettings({ defaultCapexInflation: parseFloat(e.target.value) || 3 } as any)} />
                <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.50)' }}>{(settings as any).defaultCapexInflation ?? 3.0}%</span>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {t('settings.defaultSalesCostPct')}
              </label>
              <div className="flex items-center gap-2">
                <input type="number" className="input-glass" step={0.1} min={0} max={10}
                  value={(settings as any).defaultSalesCostPercent ?? 1.5}
                  onChange={e => updateSettings({ defaultSalesCostPercent: parseFloat(e.target.value) || 1.5 } as any)} />
                <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.50)' }}>{(settings as any).defaultSalesCostPercent ?? 1.5}%</span>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.50)', display: 'block', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {t('settings.defaultAcquisitionCosts')}
              </label>
              <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.55)', paddingTop: 6 }}>
                {lang === 'de'
                  ? 'Grunderwerbsteuer, Notar, Grundbuch — per Deal anpassbar im Acquisition Wizard.'
                  : 'Land transfer tax, notary, land register — adjustable per deal in the Acquisition Wizard.'}
              </div>
            </div>
          </div>
        </GlassPanel>

        {/* ── Static info panels ── */}
        {[
          { title: 'Covenant Settings', desc: lang === 'de' ? 'Schwellenwerte für automatische Warnungen und Breach-Alerts.' : 'Thresholds for automatic warnings and breach alerts.', items: ['Warning buffer: 5%', 'Check frequency: Quarterly', 'Notification: Portfolio Manager'] },
          { title: 'Export Templates', desc: lang === 'de' ? 'Investment Memo, Lender Package und Excel-Exporte.' : 'Investment Memo, Lender Package and Excel exports.', items: ['PDF: Investment Memo v2.1', 'Excel: Lender Package', 'PDF: Deal Summary A4', 'PDF: Gantt Export'] },
          { title: 'AI Governance', desc: lang === 'de' ? 'Regeln für KI-Nutzung und Empfehlungs-Freigabe.' : 'Rules for AI usage and recommendation approval.', items: [lang === 'de' ? 'Menschliche Freigabe: Pflicht' : 'Human approval: Required', 'Max. deviation without alert: 5%', 'Audit trail: Active', lang === 'de' ? 'KI als Source of Truth: Verboten' : 'AI as Source of Truth: Prohibited'] },
          { title: 'Data Freshness', desc: lang === 'de' ? 'Maximales Alter von Markt-Benchmarks und Bewertungen.' : 'Maximum age of market benchmarks and valuations.', items: [lang === 'de' ? 'Marktdaten: max. 90 Tage' : 'Market data: max. 90 days', lang === 'de' ? 'Bewertungen: max. 12 Monate' : 'Valuations: max. 12 months', lang === 'de' ? 'CF-Forecast: Quartalsmäßig' : 'CF Forecast: Quarterly'] },
        ].map(section => (
          <GlassPanel key={section.title} style={{ padding: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1c1c1e', marginBottom: 4 }}>{section.title}</div>
            <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.45)', marginBottom: 16 }}>{section.desc}</div>
            <div className="grid grid-cols-2 gap-2">
              {section.items.map(item => (
                <div key={item} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.03)' }}>
                  <CheckCircle size={12} color="#34c759" />
                  <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.70)' }}>{item}</span>
                </div>
              ))}
            </div>
          </GlassPanel>
        ))}

        {/* ── Reset ── */}
        <GlassPanel style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#cc1a14', marginBottom: 4 }}>{t('settings.resetTitle')}</div>
          <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.45)', marginBottom: 16 }}>
            {t('settings.resetDesc')}
          </div>
          <button
            onClick={resetToMockData}
            style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.18)', borderRadius: 12, cursor: 'pointer', padding: '8px 16px', fontSize: 13, fontWeight: 600, color: '#cc1a14' }}
          >
            {t('settings.resetButton')}
          </button>
        </GlassPanel>
      </div>
    </div>
  );
}

