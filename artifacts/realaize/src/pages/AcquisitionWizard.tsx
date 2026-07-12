import { useState, useCallback, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import type { PropertyData } from '@/models/types';
import { createDefaultPropertyData } from '@/models/types';
import { TAB_ICONS, INVESTMENT_TABS, DEVELOPMENT_TABS, type TabKey } from '@/components/acquisition-wizard/shared';
import {
  TabStammdaten, TabAcquisition, TabDevelopment, TabFinanzierung,
  TabRentRoll, TabOpex, TabMarket, TabCashflow, TabSummary,
} from '@/components/acquisition-wizard/tabs';

interface AcquisitionWizardProps {
  initialData?: Partial<PropertyData>;
  onSave: (pd: PropertyData) => void;
  onClose: () => void;
  title?: string;
}

export function AcquisitionWizard({ initialData, onSave, onClose, title }: AcquisitionWizardProps) {
  const [pd, setPd] = useState<PropertyData>(() => createDefaultPropertyData(initialData));
  const [activeTab, setActiveTab] = useState(0);

  const isDev = pd.dealType === 'Development';
  const visibleTabs: TabKey[] = isDev ? DEVELOPMENT_TABS : INVESTMENT_TABS;

  // Clamp activeTab when switching deal types (e.g. Dev → Investment shrinks the list)
  useEffect(() => {
    if (activeTab >= visibleTabs.length) setActiveTab(visibleTabs.length - 1);
  }, [visibleTabs.length, activeTab]);

  const updatePd = useCallback((patch: Partial<PropertyData>) => {
    setPd(prev => ({ ...prev, ...patch }));
  }, []);

  const handleSave = () => onSave(pd);

  const renderTab = (key: TabKey) => {
    switch (key) {
      case 'Stammdaten':   return <TabStammdaten pd={pd} onChange={updatePd} />;
      case 'Acquisition':  return <TabAcquisition pd={pd} onChange={updatePd} />;
      case 'Development':  return <TabDevelopment pd={pd} onChange={updatePd} />;
      case 'Finanzierung': return <TabFinanzierung pd={pd} onChange={updatePd} />;
      case 'Rent Roll':    return <TabRentRoll pd={pd} onChange={updatePd} />;
      case 'Opex':         return <TabOpex pd={pd} onChange={updatePd} />;
      case 'Market':       return <TabMarket pd={pd} onChange={updatePd} />;
      case 'Cashflow':     return <TabCashflow pd={pd} />;
      case 'Summary':      return <TabSummary pd={pd} />;
      default:             return null;
    }
  };
  const tabContent = () => renderTab(visibleTabs[activeTab]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'stretch', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        width: '100%', maxWidth: 1080, background: 'rgba(255,255,255,0.97)',
        borderRadius: 20, boxShadow: '0 32px 80px rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid rgba(0,0,0,0.08)',
          background: 'rgba(255,255,255,0.98)',
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1c1c1e' }}>{title || 'Neues Deal erfassen'}</div>
            <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)', marginTop: 2 }}>
              {pd.name || 'Objektname eingeben'} · {pd.city || 'Stadt'}
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '6px', borderRadius: 8, color: 'rgba(60,60,67,0.55)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 2,
          padding: '10px 16px', borderBottom: '1px solid rgba(0,0,0,0.08)',
          overflowX: 'auto', background: 'rgba(248,248,248,0.8)',
        }}>
          {visibleTabs.map((label, i) => {
            const Icon = TAB_ICONS[label];
            const isActive = activeTab === i;
            return (
              <button
                key={label}
                onClick={() => setActiveTab(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: isActive ? 700 : 500, whiteSpace: 'nowrap',
                  background: isActive ? '#007aff' : 'transparent',
                  color: isActive ? '#fff' : 'rgba(60,60,67,0.55)',
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={13} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {tabContent()}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 24px', borderTop: '1px solid rgba(0,0,0,0.08)',
          background: 'rgba(248,248,248,0.9)',
        }}>
          <button
            onClick={() => setActiveTab(t => Math.max(0, t - 1))}
            disabled={activeTab === 0}
            className="btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: activeTab === 0 ? 0.35 : 1 }}
          >
            <ChevronLeft size={16} /> Zurück
          </button>
          <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)' }}>
            {activeTab + 1} / {visibleTabs.length}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={handleSave}
              className="btn-ghost"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontWeight: 600, color: '#4ade80', whiteSpace: 'nowrap',
              }}
            >
              <CheckCircle2 size={14} /> Speichern
            </button>
            {activeTab < visibleTabs.length - 1 ? (
              <button
                onClick={() => setActiveTab(t => Math.min(visibleTabs.length - 1, t + 1))}
                className="btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
              >
                Weiter <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleSave}
                className="btn-primary"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                  background: 'linear-gradient(135deg, #007aff, #0051a8)',
                }}
              >
                <CheckCircle2 size={14} /> Deal anlegen
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AcquisitionWizard;
