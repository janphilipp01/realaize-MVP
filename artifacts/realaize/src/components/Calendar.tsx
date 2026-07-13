import React, { useState } from 'react';
import { X, Plus, Save, Trash2, CalendarDays, MapPin, Users, Edit3, Building2, ChevronRight } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListAppointments,
  useCreateAppointment,
  useUpdateAppointment,
  useDeleteAppointment,
  getListAppointmentsQueryKey,
  type Appointment,
  type AppointmentWrite,
} from '@workspace/api-client-react';
import { useStore } from '@/store/useStore';
import { useLanguage } from '@/i18n/LanguageContext';
import type { AppointmentCategory, Asset } from '@/models/types';

const CATEGORIES: AppointmentCategory[] = [
  'Kauf', 'Verkauf', 'Vermietung', 'Bau',
  'Verwaltung', 'Finanzierung', 'Business Development', 'Steuer', 'Recht',
];

const CATEGORY_COLOR: Record<string, string> = {
  'Kauf': '#007aff', 'Verkauf': '#ff9500', 'Vermietung': '#34c759',
  'Bau': '#ff6b35', 'Verwaltung': '#8e8e93', 'Finanzierung': '#5856d6',
  'Business Development': '#af52de', 'Steuer': '#ff3b30', 'Recht': '#6d4c41',
};

const CATEGORY_ICON: Record<string, string> = {
  'Kauf': '🏢', 'Verkauf': '💰', 'Vermietung': '🔑',
  'Bau': '🏗', 'Verwaltung': '📋', 'Finanzierung': '🏦',
  'Business Development': '📈', 'Steuer': '🧾', 'Recht': '⚖️',
};

const emptyWrite = (): AppointmentWrite => ({
  title: '',
  date: new Date().toISOString().split('T')[0],
  time: '10:00',
  endTime: '11:00',
  location: null,
  participants: null,
  assetId: null,
  category: 'Verwaltung',
  notes: null,
});

const fromAppointment = (a: Appointment): AppointmentWrite => ({
  title: a.title,
  date: a.date,
  time: a.time,
  endTime: a.endTime ?? null,
  location: a.location ?? null,
  participants: a.participants ?? null,
  assetId: a.assetId ?? null,
  category: a.category,
  notes: a.notes ?? null,
});

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('de-DE', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

function groupByDate(appointments: Appointment[]) {
  const sorted = [...appointments].sort((a, b) =>
    `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)
  );
  const groups: Record<string, Appointment[]> = {};
  for (const appt of sorted) {
    if (!groups[appt.date]) groups[appt.date] = [];
    groups[appt.date].push(appt);
  }
  return groups;
}

interface CalendarProps { onClose: () => void; }

export default function Calendar({ onClose }: CalendarProps) {
  const qc = useQueryClient();
  const de = useLanguage().lang === 'de';
  const invalidate = () => qc.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });

  const { data: appointments = [] } = useListAppointments();
  const { assets } = useStore();

  const createMutation = useCreateAppointment({
    mutation: { onSuccess: (created) => { invalidate(); setAdding(false); setForm(emptyWrite()); setSelected(created); } },
  });
  const updateMutation = useUpdateAppointment({
    mutation: { onSuccess: (updated) => { invalidate(); setSelected(updated); setEditing(false); } },
  });
  const deleteMutation = useDeleteAppointment({
    mutation: { onSuccess: () => { invalidate(); setSelected(null); setEditing(false); } },
  });

  const [selected, setSelected] = useState<Appointment | null>(null);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<AppointmentWrite>(emptyWrite());

  const today = new Date().toISOString().split('T')[0];
  const upcoming = appointments.filter(a => a.date >= today);
  const past = appointments.filter(a => a.date < today);
  const groups = groupByDate(upcoming);
  const pastGroups = groupByDate(past);

  const handleAdd = () => {
    createMutation.mutate({ data: form });
  };

  const handleUpdate = () => {
    if (!selected) return;
    updateMutation.mutate({ id: selected.id, data: form });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate({ id });
  };

  const startEdit = (appt: Appointment) => {
    setForm(fromAppointment(appt));
    setEditing(true);
    setAdding(false);
  };

  const startAdd = () => {
    setForm(emptyWrite());
    setAdding(true);
    setEditing(false);
    setSelected(null);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />
      <div className="fixed top-0 right-0 h-full z-50 flex animate-slide-in-right" style={{ width: 820 }}>

        {/* ── Left: Appointment List ── */}
        <div style={{
          width: 310, height: '100%', overflowY: 'auto',
          background: 'rgba(242,242,247,0.97)',
          borderLeft: '1px solid rgba(0,0,0,0.08)',
          borderRight: '1px solid rgba(0,0,0,0.06)',
          backdropFilter: 'blur(32px)',
        }}>
          <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em', color: '#1c1c1e', margin: 0 }}>{de ? 'Kalender' : 'Calendar'}</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={startAdd}
                  style={{ background: '#007aff', border: 'none', borderRadius: 8, cursor: 'pointer', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4, color: '#fff', fontSize: 12, fontWeight: 600 }}
                >
                  <Plus size={12} /> {de ? 'Neu' : 'New'}
                </button>
                <button onClick={onClose} style={{ background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, cursor: 'pointer', padding: '5px 7px' }}>
                  <X size={14} color="#3c3c43" />
                </button>
              </div>
            </div>
          </div>

          <div style={{ padding: '8px 8px' }}>
            {Object.keys(groups).length === 0 && past.length === 0 && (
              <div style={{ textAlign: 'center', padding: 32, color: 'rgba(60,60,67,0.45)', fontSize: 13 }}>
                <CalendarDays size={28} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                {de ? 'Keine Termine vorhanden.' : 'No appointments.'}
              </div>
            )}
            {Object.keys(groups).length > 0 && (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(60,60,67,0.40)', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 8px 6px' }}>
                  {de ? 'Bevorstehend' : 'Upcoming'}
                </div>
                {Object.entries(groups).map(([date, items]) => (
                  <div key={date} className="mb-3">
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.55)', padding: '3px 8px 4px', borderLeft: '2px solid #007aff', marginLeft: 4, marginBottom: 4 }}>
                      {formatDate(date)}
                    </div>
                    {items.map(appt => (
                      <ApptRow key={appt.id} appt={appt} selected={selected} onSelect={() => { setSelected(appt); setEditing(false); setAdding(false); }} />
                    ))}
                  </div>
                ))}
              </>
            )}
            {Object.keys(pastGroups).length > 0 && (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(60,60,67,0.30)', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '8px 8px 4px', borderTop: '1px solid rgba(0,0,0,0.06)', marginTop: 8 }}>
                  {de ? 'Vergangen' : 'Past'}
                </div>
                {Object.entries(pastGroups).sort((a, b) => b[0].localeCompare(a[0])).map(([date, items]) => (
                  <div key={date} className="mb-3" style={{ opacity: 0.55 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.55)', padding: '3px 8px 4px', borderLeft: '2px solid rgba(0,0,0,0.15)', marginLeft: 4, marginBottom: 4 }}>
                      {formatDate(date)}
                    </div>
                    {items.map(appt => (
                      <ApptRow key={appt.id} appt={appt} selected={selected} onSelect={() => { setSelected(appt); setEditing(false); setAdding(false); }} />
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* ── Right: Detail / Form ── */}
        <div style={{
          flex: 1, height: '100%', overflowY: 'auto',
          background: 'rgba(250,250,252,0.98)',
          backdropFilter: 'blur(32px)',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
        }}>
          {(adding || editing) && (
            <AppointmentForm
              title={adding ? (de ? 'Neuer Termin' : 'New Appointment') : (de ? 'Termin bearbeiten' : 'Edit Appointment')}
              data={form}
              assets={assets}
              onChange={patch => setForm(prev => ({ ...prev, ...patch }))}
              onSave={adding ? handleAdd : handleUpdate}
              onCancel={() => { setAdding(false); setEditing(false); }}
              onDelete={editing && selected ? () => handleDelete(selected.id) : undefined}
            />
          )}
          {selected && !adding && !editing && (
            <AppointmentDetail
              appt={selected}
              assets={assets}
              onEdit={() => startEdit(selected)}
              onDelete={() => handleDelete(selected.id)}
            />
          )}
          {!selected && !adding && !editing && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(60,60,67,0.40)' }}>
              <CalendarDays size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
              <div style={{ fontSize: 14, fontWeight: 500 }}>{de ? 'Termin auswählen' : 'Select an appointment'}</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>{de ? 'oder neuen Termin anlegen' : 'or create a new one'}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ApptRow({ appt, selected, onSelect }: { appt: Appointment; selected: Appointment | null; onSelect: () => void }) {
  const isSelected = selected?.id === appt.id;
  return (
    <div
      onClick={onSelect}
      className="flex items-center gap-2 p-2 rounded-xl cursor-pointer transition-all"
      style={{
        background: isSelected ? 'rgba(0,122,255,0.10)' : 'transparent',
        border: isSelected ? '1px solid rgba(0,122,255,0.18)' : '1px solid transparent',
        marginBottom: 2,
      }}
    >
      <div style={{ width: 4, height: 32, borderRadius: 2, background: CATEGORY_COLOR[appt.category] ?? '#8e8e93', flexShrink: 0 }} />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1c1c1e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {appt.title}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.50)' }}>
          {appt.time}{appt.endTime ? ` – ${appt.endTime}` : ''} · {CATEGORY_ICON[appt.category] ?? '📋'} {appt.category}
        </div>
      </div>
      <ChevronRight size={12} color="rgba(60,60,67,0.35)" />
    </div>
  );
}

function AppointmentDetail({ appt, assets, onEdit, onDelete }: { appt: Appointment; assets: Asset[]; onEdit: () => void; onDelete: () => void }) {
  const de = useLanguage().lang === 'de';
  const linkedAsset = assets.find(a => a.id === appt.assetId);
  const color = CATEGORY_COLOR[appt.category] ?? '#8e8e93';
  return (
    <div style={{ padding: 28 }}>
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div style={{ width: 44, height: 44, borderRadius: 13, background: color + '22', border: `1.5px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
            {CATEGORY_ICON[appt.category] ?? '📋'}
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em', color: '#1c1c1e', margin: 0 }}>{appt.title}</h2>
            <div style={{ fontSize: 12, color, fontWeight: 600, marginTop: 2 }}>{appt.category}</div>
          </div>
        </div>
        <button onClick={onEdit} style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, cursor: 'pointer', padding: '6px 12px', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, color: '#3c3c43' }}>
          <Edit3 size={13} /> {de ? 'Bearbeiten' : 'Edit'}
        </button>
      </div>

      <div className="space-y-2">
        <InfoRow icon={<CalendarDays size={14} color="#007aff" />} label={de ? 'DATUM & UHRZEIT' : 'DATE & TIME'}>
          {formatDate(appt.date)} · {appt.time}{appt.endTime ? ` – ${appt.endTime}${de ? ' Uhr' : ''}` : (de ? ' Uhr' : '')}
        </InfoRow>
        {appt.location && (
          <InfoRow icon={<MapPin size={14} color="#ff9500" />} label={de ? 'ORT' : 'LOCATION'}>
            {appt.location}
          </InfoRow>
        )}
        {appt.participants && (
          <InfoRow icon={<Users size={14} color="#34c759" />} label={de ? 'TEILNEHMER' : 'PARTICIPANTS'}>
            {appt.participants}
          </InfoRow>
        )}
        {linkedAsset && (
          <InfoRow icon={<Building2 size={14} color="#5856d6" />} label="ASSET">
            {linkedAsset.name} · {linkedAsset.city}
          </InfoRow>
        )}
        {appt.notes && (
          <div className="p-3 rounded-xl mt-2" style={{ background: 'rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', letterSpacing: '0.03em', marginBottom: 4 }}>{de ? 'NOTIZEN' : 'NOTES'}</div>
            <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.75)', lineHeight: 1.6 }}>{appt.notes}</div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 28, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <button onClick={onDelete} style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.15)', borderRadius: 10, cursor: 'pointer', padding: '6px 14px', fontSize: 13, color: '#cc1a14', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Trash2 size={13} /> {de ? 'Termin löschen' : 'Delete appointment'}
        </button>
      </div>
      <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.35)', marginTop: 10 }}>
        {de ? 'Erstellt' : 'Created'}: {new Date(appt.createdAt).toLocaleDateString(de ? 'de-DE' : 'en-GB')}
      </div>
    </div>
  );
}

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
      <div style={{ marginTop: 1 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', letterSpacing: '0.03em' }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#1c1c1e' }}>{children}</div>
      </div>
    </div>
  );
}

interface FormProps {
  title: string;
  data: AppointmentWrite;
  assets: Asset[];
  onChange: (patch: Partial<AppointmentWrite>) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}
function AppointmentForm({ title, data, assets, onChange, onSave, onCancel, onDelete }: FormProps) {
  const de = useLanguage().lang === 'de';
  return (
    <div style={{ padding: 28 }}>
      <div className="flex items-center justify-between mb-6">
        <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: '#1c1c1e' }}>{title}</h2>
        <div className="flex gap-2">
          <button onClick={onCancel} style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, cursor: 'pointer', padding: '6px 12px', fontSize: 13, color: '#3c3c43' }}>{de ? 'Abbrechen' : 'Cancel'}</button>
          <button
            onClick={onSave}
            disabled={!data.title || !data.date || !data.time}
            style={{ background: data.title && data.date && data.time ? '#007aff' : 'rgba(0,0,0,0.12)', border: 'none', borderRadius: 10, cursor: data.title ? 'pointer' : 'not-allowed', padding: '6px 14px', fontSize: 13, fontWeight: 600, color: data.title ? '#fff' : 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Save size={13} /> {de ? 'Speichern' : 'Save'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <Field label={de ? 'Titel *' : 'Title *'}>
          <input className="input-glass" value={data.title} onChange={e => onChange({ title: e.target.value })} placeholder={de ? 'Terminbezeichnung' : 'Appointment title'} />
        </Field>
        <div className="flex gap-3">
          <div style={{ flex: 1 }}>
            <Field label={de ? 'Datum *' : 'Date *'}>
              <input type="date" className="input-glass" value={data.date} onChange={e => onChange({ date: e.target.value })} />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label={de ? 'Uhrzeit *' : 'Time *'}>
              <input type="time" className="input-glass" value={data.time} onChange={e => onChange({ time: e.target.value })} />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label={de ? 'Ende' : 'End'}>
              <input type="time" className="input-glass" value={data.endTime ?? ''} onChange={e => onChange({ endTime: e.target.value || null })} />
            </Field>
          </div>
        </div>
        <Field label={de ? 'Kategorie' : 'Category'}>
          <select className="input-glass" value={data.category} onChange={e => onChange({ category: e.target.value })}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label={de ? 'Ort' : 'Location'}>
          <input className="input-glass" value={data.location ?? ''} onChange={e => onChange({ location: e.target.value || null })} placeholder={de ? 'Adresse oder Videokonferenz-Link' : 'Address or video-call link'} />
        </Field>
        <Field label={de ? 'Teilnehmer' : 'Participants'}>
          <input className="input-glass" value={data.participants ?? ''} onChange={e => onChange({ participants: e.target.value || null })} placeholder={de ? 'Namen oder E-Mails, kommagetrennt' : 'Names or emails, comma-separated'} />
        </Field>
        <Field label={de ? 'Asset verknüpfen' : 'Link Asset'}>
          <select className="input-glass" value={data.assetId ?? ''} onChange={e => onChange({ assetId: e.target.value || null })}>
            <option value="">{de ? '— Kein Asset —' : '— No Asset —'}</option>
            {assets.map(a => <option key={a.id} value={a.id}>{a.name} ({a.city})</option>)}
          </select>
        </Field>
        <Field label={de ? 'Notizen' : 'Notes'}>
          <textarea className="input-glass" rows={3} style={{ resize: 'vertical' }} value={data.notes ?? ''} onChange={e => onChange({ notes: e.target.value || null })} placeholder={de ? 'Interne Notizen zum Termin...' : 'Internal notes about the appointment...'} />
        </Field>
      </div>

      {onDelete && (
        <button onClick={onDelete} style={{ marginTop: 24, background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.15)', borderRadius: 10, cursor: 'pointer', padding: '6px 14px', fontSize: 13, color: '#cc1a14', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Trash2 size={13} /> {de ? 'Termin löschen' : 'Delete appointment'}
        </button>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', letterSpacing: '0.04em', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>{label}</label>
      {children}
    </div>
  );
}
