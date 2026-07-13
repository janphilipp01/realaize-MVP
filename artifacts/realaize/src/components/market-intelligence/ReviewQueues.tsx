import { useMemo, useState } from 'react';
import { Check, X, UserCog, Clock, AlertTriangle, ArrowRight, RotateCcw, Inbox } from 'lucide-react';
import { dateLocaleFor } from '@/i18n/LanguageContext';
import { Badge, IMPACT_STYLE } from '@/components/market-intelligence/shared';
import {
  REVIEW_QUEUES, REVIEW_QUEUE_ITEMS, REVIEWERS,
  type QueueId, type ReviewQueueItem, type ReviewPriority,
} from '@/data/mock/reviewQueues';

type Decision = 'open' | 'approved' | 'rejected';
type FilterKey = 'open' | 'resolved' | 'all';

const PRIORITY_STYLE: Record<ReviewPriority, { stripe: string; label: { de: string; en: string } }> = {
  high: { stripe: '#d92c20', label: { de: 'Hoch', en: 'High' } },
  medium: { stripe: '#c2750a', label: { de: 'Mittel', en: 'Medium' } },
  low: { stripe: 'rgba(60,60,67,0.35)', label: { de: 'Niedrig', en: 'Low' } },
};

const DAY_MS = 24 * 60 * 60 * 1000;

// SLA state derived from the due date relative to now.
function slaState(dueAt: string): 'overdue' | 'due_soon' | 'on_track' {
  const diff = new Date(dueAt).getTime() - Date.now();
  if (diff < 0) return 'overdue';
  if (diff < DAY_MS) return 'due_soon';
  return 'on_track';
}

const ageDays = (from: string) => Math.max(0, Math.round((Date.now() - new Date(from).getTime()) / DAY_MS));

export function ReviewQueues({ lang }: { lang: string }) {
  const de = lang === 'de';
  const locale = dateLocaleFor(lang);

  const [selected, setSelected] = useState<QueueId>('benchmark');
  const [filter, setFilter] = useState<FilterKey>('open');
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [assignees, setAssignees] = useState<Record<string, string>>({});

  const decisionOf = (id: string): Decision => decisions[id] ?? 'open';
  const assigneeOf = (item: ReviewQueueItem) => assignees[item.id] ?? 'Unassigned';

  const setDecision = (id: string, d: Decision) => setDecisions(prev => ({ ...prev, [id]: d }));
  const reassign = (item: ReviewQueueItem) => {
    const current = assigneeOf(item);
    const next = REVIEWERS[(REVIEWERS.indexOf(current) + 1) % REVIEWERS.length];
    setAssignees(prev => ({ ...prev, [item.id]: next }));
  };

  // Portfolio-wide stats across every queue (open items drive the cockpit).
  const stats = useMemo(() => {
    const open = REVIEW_QUEUE_ITEMS.filter(i => decisionOf(i.id) === 'open');
    const overdue = open.filter(i => slaState(i.slaDueAt) === 'overdue');
    const avgAge = open.length
      ? Math.round(open.reduce((s, i) => s + ageDays(i.submittedAt), 0) / open.length)
      : 0;
    const resolved = REVIEW_QUEUE_ITEMS.filter(i => decisionOf(i.id) !== 'open').length;
    return { open: open.length, overdue: overdue.length, avgAge, resolved };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decisions]);

  const openCountFor = (q: QueueId) =>
    REVIEW_QUEUE_ITEMS.filter(i => i.queue === q && decisionOf(i.id) === 'open').length;
  const overdueCountFor = (q: QueueId) =>
    REVIEW_QUEUE_ITEMS.filter(i => i.queue === q && decisionOf(i.id) === 'open' && slaState(i.slaDueAt) === 'overdue').length;

  const queueItems = REVIEW_QUEUE_ITEMS.filter(i => i.queue === selected);
  const visibleItems = queueItems.filter(i => {
    const d = decisionOf(i.id);
    if (filter === 'open') return d === 'open';
    if (filter === 'resolved') return d !== 'open';
    return true;
  });

  const activeQueue = REVIEW_QUEUES.find(q => q.id === selected)!;

  return (
    <div className="space-y-5">
      {/* Demo banner */}
      <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.6)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Inbox size={14} />
        {de
          ? 'Portfolio-Review-Cockpit — Datenpunkte über alle Queues, mit SLA und Zuweisung. Demo mit Mock-Daten.'
          : 'Portfolio review cockpit — data points across every queue, with SLA and assignment. Demo with mock data.'}
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatTile label={de ? 'Offen' : 'Open'} value={stats.open} />
        <StatTile label={de ? 'Überfällig' : 'Overdue'} value={stats.overdue} tone={stats.overdue > 0 ? 'danger' : 'muted'} />
        <StatTile label={de ? 'Ø Alter (Tage)' : 'Avg age (days)'} value={stats.avgAge} />
        <StatTile label={de ? 'Erledigt (Session)' : 'Resolved (session)'} value={stats.resolved} tone={stats.resolved > 0 ? 'good' : 'muted'} />
      </div>

      {/* Queue selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {REVIEW_QUEUES.map(q => {
          const active = selected === q.id;
          const open = openCountFor(q.id);
          const overdue = overdueCountFor(q.id);
          return (
            <button
              key={q.id}
              onClick={() => setSelected(q.id)}
              className="flex items-center gap-2 text-sm"
              style={{
                padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
                border: active ? '1px solid #0a6cff' : '1px solid rgba(0,0,0,0.08)',
                background: active ? 'rgba(10,108,255,0.08)' : 'rgba(0,0,0,0.02)',
                color: active ? '#0a6cff' : 'rgba(60,60,67,0.7)',
                fontWeight: active ? 700 : 500,
              }}
            >
              <q.icon size={14} />
              {q.label}
              <span style={{ background: active ? 'rgba(10,108,255,0.15)' : 'rgba(0,0,0,0.06)', color: 'inherit', borderRadius: 999, padding: '0 7px', fontSize: 11, fontWeight: 700 }}>{open}</span>
              {overdue > 0 && <span title="overdue" style={{ width: 7, height: 7, borderRadius: 999, background: '#d92c20', display: 'inline-block' }} />}
            </button>
          );
        })}
      </div>

      {/* Queue header + filter */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.6)' }}>{de ? activeQueue.blurb.de : activeQueue.blurb.en}</div>
        <div style={{ display: 'inline-flex', gap: 2, padding: 2, background: 'rgba(0,0,0,0.04)', borderRadius: 9 }}>
          {(['open', 'resolved', 'all'] as FilterKey[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '4px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                background: filter === f ? 'rgba(255,255,255,0.9)' : 'transparent',
                color: filter === f ? '#1c1c1e' : 'rgba(60,60,67,0.55)',
                boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {f === 'open' ? (de ? 'Offen' : 'Open') : f === 'resolved' ? (de ? 'Erledigt' : 'Resolved') : (de ? 'Alle' : 'All')}
            </button>
          ))}
        </div>
      </div>

      {/* Items */}
      {visibleItems.length === 0 ? (
        <div className="glass-card" style={{ padding: 36, textAlign: 'center' }}>
          <Check size={26} color="#1f9d4d" style={{ margin: '0 auto 8px' }} />
          <div style={{ fontWeight: 600 }}>{de ? 'Queue leer' : 'Queue clear'}</div>
          <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.55)', marginTop: 4 }}>
            {de ? 'Keine Einträge im aktuellen Filter.' : 'No items match the current filter.'}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleItems.map(item => (
            <ReviewItemCard
              key={item.id}
              item={item}
              lang={lang}
              locale={locale}
              decision={decisionOf(item.id)}
              assignee={assigneeOf(item)}
              onApprove={() => setDecision(item.id, 'approved')}
              onReject={() => setDecision(item.id, 'rejected')}
              onReopen={() => setDecision(item.id, 'open')}
              onReassign={() => reassign(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'good' | 'danger' | 'muted' }) {
  const color = tone === 'danger' ? '#d92c20' : tone === 'good' ? '#1f9d4d' : tone === 'muted' ? 'rgba(60,60,67,0.55)' : '#1c1c1e';
  return (
    <div className="glass-card" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(60,60,67,0.45)' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

function ReviewItemCard({
  item, lang, locale, decision, assignee, onApprove, onReject, onReopen, onReassign,
}: {
  item: ReviewQueueItem;
  lang: string;
  locale: 'de-DE' | 'en-GB';
  decision: Decision;
  assignee: string;
  onApprove: () => void;
  onReject: () => void;
  onReopen: () => void;
  onReassign: () => void;
}) {
  const de = lang === 'de';
  const prio = PRIORITY_STYLE[item.priority];
  const sla = slaState(item.slaDueAt);
  const resolved = decision !== 'open';

  const slaBadge = sla === 'overdue'
    ? { bg: IMPACT_STYLE.high.bg, color: IMPACT_STYLE.high.color, text: de ? 'Überfällig' : 'Overdue' }
    : sla === 'due_soon'
      ? { bg: IMPACT_STYLE.medium.bg, color: IMPACT_STYLE.medium.color, text: de ? 'Fällig < 24h' : 'Due < 24h' }
      : { bg: 'rgba(52,199,89,0.12)', color: '#1f9d4d', text: de ? 'Im Plan' : 'On track' };

  const fmtDate = (s: string) => new Date(s).toLocaleDateString(locale, { day: '2-digit', month: 'short' });

  return (
    <div
      className="glass-card"
      style={{
        padding: 18, borderLeft: `3px solid ${prio.stripe}`,
        opacity: resolved ? 0.72 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{item.title}</span>
            <Badge bg={`${prio.stripe}22`} color={prio.stripe}>{de ? prio.label.de : prio.label.en}</Badge>
            {!resolved && <Badge bg={slaBadge.bg} color={slaBadge.color}><Clock size={11} /> {slaBadge.text}</Badge>}
            {decision === 'approved' && <Badge bg="rgba(52,199,89,0.14)" color="#1f9d4d"><Check size={11} /> {de ? 'Freigegeben' : 'Approved'}</Badge>}
            {decision === 'rejected' && <Badge bg="rgba(255,59,48,0.12)" color="#d92c20"><X size={11} /> {de ? 'Abgelehnt' : 'Rejected'}</Badge>}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.7)', marginTop: 5 }}>
            <strong>{item.city}</strong> · {de ? item.context.de : item.context.en}
          </div>
        </div>
      </div>

      {/* value diff + meta */}
      {(item.current || item.meta) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          {item.current && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ padding: '3px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.05)' }}>{item.current}</span>
              {item.proposed && (
                <>
                  <ArrowRight size={14} color="rgba(60,60,67,0.45)" />
                  <span style={{ padding: '3px 10px', borderRadius: 8, background: 'rgba(10,108,255,0.1)', color: '#0a6cff', fontWeight: 700 }}>{item.proposed}</span>
                </>
              )}
            </div>
          )}
          {item.meta && (
            <span style={{ fontSize: 12, color: 'rgba(60,60,67,0.55)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <AlertTriangle size={12} color="rgba(60,60,67,0.4)" /> {item.meta}
            </span>
          )}
        </div>
      )}

      {/* footer: provenance + actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 11.5, color: 'rgba(60,60,67,0.55)' }}>
          {item.submittedBy} · {fmtDate(item.submittedAt)} · SLA {fmtDate(item.slaDueAt)} ·{' '}
          <button
            onClick={onReassign}
            title={de ? 'Neu zuweisen' : 'Reassign'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: assignee === 'Unassigned' ? 'rgba(60,60,67,0.45)' : '#0a6cff', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5 }}
          >
            <UserCog size={12} /> {assignee === 'Unassigned' ? (de ? 'Nicht zugewiesen' : 'Unassigned') : assignee}
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {resolved ? (
            <button className="btn-glass px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5" style={{ cursor: 'pointer' }} onClick={onReopen}>
              <RotateCcw size={13} /> {de ? 'Rückgängig' : 'Undo'}
            </button>
          ) : (
            <>
              <button className="btn-glass px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5" style={{ cursor: 'pointer' }} onClick={onReassign}>
                <UserCog size={13} /> {de ? 'Zuweisen' : 'Reassign'}
              </button>
              <button className="btn-glass px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5" style={{ cursor: 'pointer', color: '#d92c20' }} onClick={onReject}>
                <X size={13} /> {de ? 'Ablehnen' : 'Reject'}
              </button>
              <button className="btn-accent px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5" style={{ cursor: 'pointer' }} onClick={onApprove}>
                <Check size={13} /> {de ? 'Freigeben' : 'Approve'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
