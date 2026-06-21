import React, { useState, useRef } from 'react';
import logoImg from '@assets/realaize_logo_app_1775478192767.png';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Building2, TrendingUp, BarChart3, CreditCard,
  LineChart, FolderOpen, Bot, Settings, ChevronLeft, ChevronRight,
  AlertTriangle, BookUser, HardHat, ShoppingBag, Newspaper, Radar, CalendarDays,
  GripVertical, Pencil, Check, Database
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useLanguage } from '../../i18n/LanguageContext';
import { useListContacts, useListAppointments } from '@workspace/api-client-react';
import Addressbook from '../Addressbook';
import Calendar from '../Calendar';
import ApiStatusBadge from '../ApiStatusBadge';

/* ── Flag SVGs ──────────────────────────────────────────── */
function FlagDE({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 0.6)} viewBox="0 0 30 18" style={{ borderRadius: 2, overflow: 'hidden', display: 'block' }}>
      <rect width="30" height="6" y="0" fill="#000" />
      <rect width="30" height="6" y="6" fill="#DD0000" />
      <rect width="30" height="6" y="12" fill="#FFCC00" />
    </svg>
  );
}

function FlagEN({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 0.6)} viewBox="0 0 30 18" style={{ borderRadius: 2, overflow: 'hidden', display: 'block' }}>
      <rect width="30" height="18" fill="#012169" />
      <path d="M0,0 L30,18 M30,0 L0,18" stroke="#fff" strokeWidth="3" />
      <path d="M0,0 L30,18 M30,0 L0,18" stroke="#C8102E" strokeWidth="1.5" />
      <path d="M15,0 V18 M0,9 H30" stroke="#fff" strokeWidth="5" />
      <path d="M15,0 V18 M0,9 H30" stroke="#C8102E" strokeWidth="3" />
    </svg>
  );
}

/* ── Types ────────────────────────────────────────────── */
interface SubNavItem { key: string; label: string; icon: any; path: string; }
interface NavItem {
  key: string;
  label: string;
  icon: any;
  path: string;
  sub?: SubNavItem[];
}

interface LayoutProps { children: React.ReactNode; }

const DEFAULT_NAV_ORDER = ['portfolio', 'acquisition', 'developments', 'assets', 'sales', 'debt', 'markt', 'documents', 'ai', 'news', 'settings'];

export default function Layout({ children }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [showAddressbook, setShowAddressbook] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [navEditMode, setNavEditMode] = useState(false);
  const [navOrder, setNavOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('realaize_navOrder');
      return saved ? JSON.parse(saved) : DEFAULT_NAV_ORDER;
    } catch { return DEFAULT_NAV_ORDER; }
  });
  const dragKey = useRef<string | null>(null);
  const location = useLocation();
  const { assets } = useStore();
  const { data: contacts = [] } = useListContacts();
  const { data: appointments = [] } = useListAppointments();
  const { lang, toggleLang, t } = useLanguage();

  /* New sidebar order:
     Portfolio (→ Cashflow as sub)
     Assets · Developments · Debt · Sales · Acquisition · Market
     Documents · AI Copilot · Settings
  */
  const NAV_ITEMS: NavItem[] = [
    {
      key: 'portfolio', label: t('nav.portfolio'), icon: LayoutDashboard, path: '/',
      sub: [
        { key: 'cashflow', label: t('nav.cashflow'), icon: LineChart, path: '/cashflow' },
      ],
    },
    { key: 'assets', label: t('nav.assets'), icon: Building2, path: '/assets' },
    { key: 'developments', label: t('nav.developments'), icon: HardHat, path: '/developments' },
    { key: 'debt', label: t('nav.debt'), icon: CreditCard, path: '/debt' },
    { key: 'sales', label: t('nav.sales'), icon: ShoppingBag, path: '/sales' },
    {
      key: 'acquisition', label: t('nav.acquisition'), icon: TrendingUp, path: '/acquisition',
      sub: [
        { key: 'radar', label: t('radar.nav'), icon: Radar, path: '/radar' },
      ],
    },
    {
      key: 'markt', label: t('nav.market'), icon: BarChart3, path: '/markt',
      sub: [
        { key: 'market-intelligence', label: 'Market Intelligence', icon: Database, path: '/market-intelligence' },
      ],
    },
    { key: 'documents', label: t('nav.documents'), icon: FolderOpen, path: '/documents' },
    { key: 'ai', label: t('nav.ai'), icon: Bot, path: '/ai' },
    { key: 'news', label: t('news.nav'), icon: Newspaper, path: '/news' },
    { key: 'settings', label: t('nav.settings'), icon: Settings, path: '/settings' },
  ];

  const sortedNavItems = [...NAV_ITEMS].sort((a, b) => {
    const ia = navOrder.indexOf(a.key);
    const ib = navOrder.indexOf(b.key);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  const handleNavDragStart = (key: string) => { dragKey.current = key; };
  const handleNavDragOver = (e: React.DragEvent, overKey: string) => {
    e.preventDefault();
    if (!dragKey.current || dragKey.current === overKey) return;
    const newOrder = [...navOrder];
    const fromIdx = newOrder.indexOf(dragKey.current);
    const toIdx = newOrder.indexOf(overKey);
    if (fromIdx === -1 || toIdx === -1) return;
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, dragKey.current);
    setNavOrder(newOrder);
    localStorage.setItem('realaize_navOrder', JSON.stringify(newOrder));
  };
  const handleNavDragEnd = () => { dragKey.current = null; };

  const breachCount = assets.flatMap(a => a.covenants).filter(c => c.status === 'Breach').length;
  const warningCount = assets.flatMap(a => a.covenants).filter(c => c.status === 'Warning').length;

  const isNavActive = (item: NavItem) => {
    if (item.path === '/') return location.pathname === '/';
    return location.pathname === item.path || location.pathname.startsWith(item.path + '/');
  };
  const isSubActive = (sub: SubNavItem) => location.pathname === sub.path;
  const isParentActive = (item: NavItem) => {
    if (isNavActive(item)) return true;
    return item.sub ? item.sub.some(s => isSubActive(s)) : false;
  };

  return (
    <div className="flex h-full bg-gradient-mesh">
      {/* ═══ Sidebar ═══ */}
      <aside
        className="flex flex-col h-full transition-all duration-300 ease-in-out flex-shrink-0"
        style={{
          width: collapsed ? 60 : 216,
          background: 'rgba(242,242,247,0.88)',
          borderRight: '1px solid rgba(0,0,0,0.06)',
          backdropFilter: 'blur(28px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
        }}
      >
        {/* Logo + top actions */}
        <div className="flex items-center justify-between px-3 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          <div className="flex items-center">
            {collapsed ? (
              <div className="flex items-center justify-center rounded-xl flex-shrink-0"
                style={{ width: 34, height: 34, background: 'linear-gradient(145deg, #007aff, #0055d4)', boxShadow: '0 2px 10px rgba(0,122,255,0.35)' }}>
                <Building2 size={17} color="#ffffff" strokeWidth={2} />
              </div>
            ) : (
              <img src={logoImg} alt="realaize" style={{ height: 50, width: 'auto', display: 'block', marginLeft: 6 }} />
            )}
          </div>
          {/* Addressbook + Calendar icons */}
          {!collapsed && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowCalendar(true)}
                title="Kalender"
                style={{
                  background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.07)',
                  borderRadius: 9, cursor: 'pointer', padding: '5px 6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <CalendarDays size={14} color="rgba(60,60,67,0.65)" />
                {appointments.length > 0 && (
                  <span style={{ position: 'absolute', top: -3, right: -3, background: '#007aff', color: '#fff', fontSize: 8, fontWeight: 700, borderRadius: 5, padding: '1px 4px', lineHeight: 1.4 }}>
                    {appointments.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setShowAddressbook(true)}
                title={t('nav.addressbook')}
                style={{
                  background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.07)',
                  borderRadius: 9, cursor: 'pointer', padding: '5px 6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <BookUser size={14} color="rgba(60,60,67,0.65)" />
                {contacts.length > 0 && (
                  <span style={{ position: 'absolute', top: -3, right: -3, background: '#007aff', color: '#fff', fontSize: 8, fontWeight: 700, borderRadius: 5, padding: '1px 4px', lineHeight: 1.4 }}>
                    {contacts.length}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* ─── Navigation ─── */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto">
          {!collapsed && (
            <div className="flex items-center justify-between" style={{ padding: '2px 10px 6px' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(60,60,67,0.35)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('nav.navigation')}</span>
              <button
                onClick={() => setNavEditMode(m => !m)}
                title={navEditMode ? 'Fertig' : 'Reihenfolge bearbeiten'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, padding: '2px 4px', borderRadius: 5, color: navEditMode ? '#007aff' : 'rgba(60,60,67,0.35)' }}
              >
                {navEditMode ? <Check size={11} /> : <Pencil size={10} />}
              </button>
            </div>
          )}
          <div className="space-y-0.5">
            {sortedNavItems.map(item => {
              const parentActive = isParentActive(item);
              return (
                <div
                  key={item.key}
                  draggable={navEditMode && !collapsed}
                  onDragStart={navEditMode ? () => handleNavDragStart(item.key) : undefined}
                  onDragOver={navEditMode ? (e) => handleNavDragOver(e, item.key) : undefined}
                  onDragEnd={navEditMode ? handleNavDragEnd : undefined}
                  style={navEditMode ? { cursor: 'grab', opacity: 1 } : {}}
                >
                  {/* Main nav link */}
                  <Link
                    to={navEditMode ? '#' : item.path}
                    onClick={navEditMode ? (e) => e.preventDefault() : undefined}
                    className={`nav-item ${parentActive && !navEditMode ? 'active' : ''}`}
                    style={collapsed ? { justifyContent: 'center', padding: '9px 0' } : {}}
                  >
                    {navEditMode && !collapsed && <GripVertical size={11} color="rgba(60,60,67,0.30)" style={{ flexShrink: 0, marginRight: -2 }} />}
                    <item.icon size={15} strokeWidth={parentActive ? 2.5 : 1.8} color={parentActive && !navEditMode ? '#007aff' : 'rgba(60,60,67,0.60)'} style={{ flexShrink: 0 }} />
                    {!collapsed && <span>{item.label}</span>}
                    {!collapsed && item.key === 'debt' && (breachCount > 0 || warningCount > 0) && (
                      <span className="ml-auto" style={{ background: '#ff3b30', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '1px 6px', lineHeight: 1.6 }}>
                        {breachCount + warningCount}
                      </span>
                    )}
                  </Link>

                  {/* Sub-items (e.g. Cashflow under Portfolio) */}
                  {!collapsed && !navEditMode && item.sub && parentActive && (
                    <div style={{ paddingLeft: 22, marginTop: 1, marginBottom: 2 }}>
                      {item.sub.map(sub => {
                        const subAct = isSubActive(sub);
                        return (
                          <Link
                            key={sub.key}
                            to={sub.path}
                            className="nav-item"
                            style={{
                              padding: '6px 10px',
                              fontSize: 12,
                              color: subAct ? '#007aff' : 'rgba(60,60,67,0.55)',
                              fontWeight: subAct ? 600 : 400,
                              background: subAct ? 'rgba(0,122,255,0.08)' : 'transparent',
                              borderRadius: 8,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              textDecoration: 'none',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <sub.icon size={13} strokeWidth={subAct ? 2.5 : 1.8} color={subAct ? '#007aff' : 'rgba(60,60,67,0.50)'} />
                            <span>{sub.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* Covenant alert strip */}
        {!collapsed && (breachCount > 0 || warningCount > 0) && (
          <div className="mx-2 mb-2 p-3 rounded-xl" style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.16)' }}>
            <div className="flex items-center gap-2">
              <AlertTriangle size={13} color="#cc1a14" />
              <span style={{ fontSize: 12, color: '#cc1a14', fontWeight: 600 }}>{breachCount} Breach{breachCount !== 1 ? 'es' : ''}</span>
            </div>
            {warningCount > 0 && <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.55)', marginTop: 2 }}>+ {warningCount} Warnings</div>}
          </div>
        )}

        {/* Collapse button */}
        <button onClick={() => setCollapsed(c => !c)}
          className="flex items-center justify-center mx-2 mb-2 p-2 rounded-xl transition-all"
          style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)', cursor: 'pointer', color: 'rgba(60,60,67,0.55)', gap: 6 }}>
          {collapsed ? <ChevronRight size={13} /> : <><ChevronLeft size={13} /><span style={{ fontSize: 12, fontWeight: 500 }}>{t('nav.collapse')}</span></>}
        </button>

        {/* API status */}
        <ApiStatusBadge collapsed={collapsed} />

        {/* Today's date */}
        <div style={{
          padding: collapsed ? '8px 0' : '7px 14px',
          fontSize: 11, color: 'rgba(60,60,67,0.5)', fontWeight: 500,
          textAlign: collapsed ? 'center' : 'left',
          letterSpacing: '0.01em',
          borderTop: '1px solid rgba(0,0,0,0.05)',
        }}>
          {collapsed
            ? new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
            : new Date().toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
          }
        </div>

        {/* User + Language toggle */}
        <div className="flex items-center gap-2 px-3 py-3" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
          <div className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{ width: 30, height: 30, background: 'linear-gradient(145deg, #007aff, #af52de)', color: '#fff', fontSize: 11, fontWeight: 700 }}>
            JL
          </div>
          {!collapsed && (
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1c1c1e', letterSpacing: '-0.01em' }}>Jan Leuker</div>
              <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)' }}>Investment Manager</div>
            </div>
          )}
          {/* 🌐 Language toggle flag */}
          <button
            onClick={toggleLang}
            title={lang === 'de' ? 'Switch to English' : 'Auf Deutsch wechseln'}
            style={{
              background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.07)',
              borderRadius: 8, cursor: 'pointer', padding: '4px 6px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s ease',
              flexShrink: 0,
            }}
            onMouseOver={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.09)'; }}
            onMouseOut={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; }}
          >
            {lang === 'de' ? <FlagDE size={16} /> : <FlagEN size={16} />}
          </button>
        </div>
      </aside>

      {/* ═══ Main content ═══ */}
      <main className="flex-1 overflow-auto">{children}</main>

      {/* Addressbook slide-over */}
      {showAddressbook && <Addressbook onClose={() => setShowAddressbook(false)} />}
      {showCalendar && <Calendar onClose={() => setShowCalendar(false)} />}
    </div>
  );
}
