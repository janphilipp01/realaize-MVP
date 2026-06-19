import React, { useState } from 'react';
import { X, Info, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { KPIFormulaDetail } from '../models/types';

// ── Glass Panel ──────────────────────────────────────────
interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  hover?: boolean;
  onClick?: () => void;
}
export function GlassPanel({ children, className = '', style, hover, onClick }: GlassPanelProps) {
  return (
    <div
      className={`glass-card ${hover ? 'cursor-pointer' : ''} ${className}`}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// ── Page Header ──────────────────────────────────────────
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  badge?: string;
}
export function PageHeader({ title, subtitle, actions, badge }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '-0.04em',
            color: '#1c1c1e',
            margin: 0,
          }}>
            {title}
          </h1>
          {badge && <span className="badge-accent">{badge}</span>}
        </div>
        {subtitle && (
          <p style={{ fontSize: 14, color: 'rgba(60,60,67,0.55)', marginTop: 3, margin: 0 }}>{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────
interface KPICardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  status?: 'good' | 'warning' | 'danger' | 'neutral';
  onInfo?: () => void;
  compact?: boolean;
  onClick?: () => void;
}
export function KPICard({ label, value, sub, trend, trendValue, status = 'neutral', onInfo, compact, onClick }: KPICardProps) {
  const statusColors = {
    good: '#1a7f37',
    warning: '#b25000',
    danger: '#cc1a14',
    neutral: '#1c1c1e',
  };
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? '#1a7f37' : trend === 'down' ? '#cc1a14' : 'rgba(60,60,67,0.45)';

  return (
    <div
      className="kpi-card relative"
      style={{ ...(compact ? { padding: 14 } : {}), ...(onClick ? { cursor: 'pointer' } : {}) }}
      onClick={onClick}
    >
      {onInfo && (
        <button
          onClick={(e) => { e.stopPropagation(); onInfo(); }}
          style={{
            position: 'absolute', top: 12, right: 12,
            opacity: 0.35, background: 'none', border: 'none',
            cursor: 'pointer', padding: 2, transition: 'opacity 0.15s',
          }}
          onMouseOver={e => (e.currentTarget.style.opacity = '0.8')}
          onMouseOut={e => (e.currentTarget.style.opacity = '0.35')}
        >
          <Info size={13} color="rgba(60,60,67,0.8)" />
        </button>
      )}
      <div style={{
        fontSize: 11,
        color: 'rgba(60,60,67,0.50)',
        fontWeight: 600,
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
        marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: compact ? 20 : 24,
        fontWeight: 700,
        color: statusColors[status],
        letterSpacing: '-0.03em',
        lineHeight: 1,
      }}>
        {value}
      </div>
      {(sub || trendValue) && (
        <div className="flex items-center gap-2 mt-2">
          {sub && <span style={{ fontSize: 12, color: 'rgba(60,60,67,0.45)' }}>{sub}</span>}
          {trendValue && (
            <div className="flex items-center gap-1" style={{ color: trendColor }}>
              <TrendIcon size={11} />
              <span style={{ fontSize: 11, fontWeight: 600 }}>{trendValue}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Formula Drawer ────────────────────────────────────────
interface FormulaDrawerProps {
  detail: KPIFormulaDetail | null;
  onClose: () => void;
}
export function FormulaDrawer({ detail, onClose }: FormulaDrawerProps) {
  if (!detail) return null;
  const statusColors: Record<string, string> = { good: '#1a7f37', warning: '#b25000', danger: '#cc1a14', neutral: '#007aff' };

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div
        className="fixed top-0 right-0 h-full overflow-y-auto animate-slide-in-right"
        style={{
          width: 420,
          zIndex: 200,
          background: 'rgba(250,250,252,0.97)',
          borderLeft: '1px solid rgba(0,0,0,0.08)',
          backdropFilter: 'blur(32px)',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.10)',
        }}
      >
        <div style={{ padding: 28 }}>
          <div className="flex items-center justify-between mb-6">
            <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em', color: '#1c1c1e' }}>
              {detail.label}
            </h2>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 10, cursor: 'pointer', padding: '6px 8px',
              }}
            >
              <X size={14} color="#3c3c43" />
            </button>
          </div>

          {/* Formula */}
          <div className="mb-5 p-4 rounded-xl" style={{ background: 'rgba(0,122,255,0.06)', border: '1px solid rgba(0,122,255,0.12)' }}>
            <div style={{ fontSize: 11, color: '#007aff', fontWeight: 700, letterSpacing: '0.04em', marginBottom: 6, textTransform: 'uppercase' }}>Formel</div>
            <div style={{ fontSize: 13, color: '#1c1c1e', fontFamily: 'ui-monospace, monospace', lineHeight: 1.6 }}>
              {detail.formula}
            </div>
          </div>

          {/* Inputs */}
          <div className="mb-5">
            <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.50)', fontWeight: 700, letterSpacing: '0.04em', marginBottom: 10, textTransform: 'uppercase' }}>Eingangswerte</div>
            <div className="space-y-2">
              {detail.inputs.map((inp: { label: string; value: string }, i: number) => (
                <div key={i} className="flex justify-between items-center py-2 px-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.05)' }}>
                  <span style={{ fontSize: 13, color: 'rgba(60,60,67,0.70)' }}>{inp.label}</span>
                  <span style={{ fontSize: 13, color: '#1c1c1e', fontWeight: 600, fontFamily: 'ui-monospace, monospace' }}>{inp.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Result */}
          <div className="mb-5 p-4 rounded-xl text-center" style={{
            background: `rgba(${detail.status === 'good' ? '52,199,89' : detail.status === 'warning' ? '255,149,0' : detail.status === 'danger' ? '255,59,48' : '0,122,255'},0.08)`,
            border: `1px solid rgba(${detail.status === 'good' ? '52,199,89' : detail.status === 'warning' ? '255,149,0' : detail.status === 'danger' ? '255,59,48' : '0,122,255'},0.18)`,
          }}>
            <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.50)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Ergebnis</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: statusColors[detail.status], letterSpacing: '-0.03em' }}>{detail.result}</div>
          </div>

          {/* Interpretation */}
          <div className="p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.50)', fontWeight: 700, letterSpacing: '0.04em', marginBottom: 6, textTransform: 'uppercase' }}>Interpretation</div>
            <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.75)', lineHeight: 1.65 }}>{detail.interpretation}</div>
          </div>

          <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.35)', marginTop: 20, textAlign: 'center' }}>
            Zuletzt berechnet: {new Date().toLocaleDateString('de-DE')}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Completeness Ring ─────────────────────────────────────
export function CompletenessRing({ score, size = 40 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? '#34c759' : score >= 50 ? '#ff9500' : '#ff3b30';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={3} />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={3}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span style={{ position: 'absolute', fontSize: size > 50 ? 13 : 10, fontWeight: 700, color }}>{score}</span>
    </div>
  );
}

// ── Status Badge ─────────────────────────────────────────
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const cls = status === 'OK' || status === 'Vermietet' || status === 'Abgeschlossen' ? 'badge-success'
    : status === 'Warning' || status === 'Laufend' ? 'badge-warning'
    : status === 'Breach' || status === 'Leerstand' ? 'badge-danger'
    : status === 'Bestand' ? 'badge-accent'
    : 'badge-neutral';
  return <span className={cls}>{label || status}</span>;
}

// ── Section Header ────────────────────────────────────────
export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 style={{
        fontSize: 12, fontWeight: 700, color: 'rgba(60,60,67,0.50)',
        letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0,
      }}>
        {title}
      </h3>
      {action && action}
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────
export function EmptyState({ icon: Icon, title, sub }: { icon: any; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <Icon size={24} color="rgba(60,60,67,0.40)" />
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#3c3c43', marginBottom: 4 }}>{title}</div>
      {sub && <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.50)' }}>{sub}</div>}
    </div>
  );
}

// ── Freshness Badge ───────────────────────────────────────
export function FreshnessBadge({ date }: { date: string }) {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  const cls = days < 30 ? 'badge-success' : days < 90 ? 'badge-warning' : 'badge-danger';
  const label = days < 30 ? `${days}d` : days < 90 ? `${Math.floor(days/7)}w` : `${Math.floor(days/30)}M`;
  return <span className={cls}>{label} alt</span>;
}

// ── Modal ────────────────────────────────────────────────
interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  width?: number;
  actions?: React.ReactNode;
}
export function Modal({ title, children, onClose, width = 520, actions }: ModalProps) {
  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div
        className="fixed animate-scale-in overflow-y-auto"
        style={{
          zIndex: 200,
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width, maxWidth: '95vw', maxHeight: '90vh',
          background: 'rgba(250,250,252,0.98)',
          border: '1px solid rgba(0,0,0,0.10)',
          borderRadius: 24,
          backdropFilter: 'blur(32px)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ padding: 28 }}>
          <div className="flex items-center justify-between mb-6">
            <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em', color: '#1c1c1e' }}>{title}</h2>
            <button onClick={onClose} style={{ background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, cursor: 'pointer', padding: '6px 8px' }}>
              <X size={14} color="#3c3c43" />
            </button>
          </div>
          {children}
          {actions && <div className="flex gap-3 mt-6 justify-end">{actions}</div>}
        </div>
      </div>
    </>
  );
}

// ── Tabs ─────────────────────────────────────────────────
interface TabsProps {
  tabs: { key: string; label: string; count?: number }[];
  active: string;
  onChange: (key: string) => void;
}
export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.05)', display: 'inline-flex' }}>
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className="px-4 py-2 rounded-lg transition-all"
          style={{
            background: active === tab.key ? '#ffffff' : 'transparent',
            color: active === tab.key ? '#1c1c1e' : 'rgba(60,60,67,0.55)',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: active === tab.key ? 600 : 500,
            boxShadow: active === tab.key ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
            letterSpacing: '-0.01em',
          }}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1.5 badge-neutral" style={{ fontSize: 10 }}>{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Stage Badge ───────────────────────────────────────────
export function StageBadge({ stage }: { stage: string }) {
  const cls = stage === 'Closing' ? 'badge-success'
    : stage === 'Due Diligence' || stage === 'Signing' ? 'badge-info'
    : stage === 'LOI' ? 'badge-accent'
    : 'badge-neutral';
  return <span className={cls}>{stage}</span>;
}
