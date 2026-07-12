import React, { useState } from 'react';
import { X, Plus, Search, Phone, Mail, Building2, Tag, Link2, ChevronRight, Edit3, Save, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListContacts,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  getListContactsQueryKey,
  type Contact,
  type ContactWrite,
} from '@workspace/api-client-react';
import type { ContactCategory, HandwerkerSubcategory } from '@/models/types';

const CATEGORIES: ContactCategory[] = [
  'Handwerker', 'Architekt & Planer', 'Property Manager', 'Facility Manager',
  'Hausverwaltung', 'Mieter', 'Potentieller Mieter', 'Banker & Finanzierer',
  'Makler', 'Potentieller Käufer', 'Käufer', 'Potentieller Investor',
  'Investor', 'Stadtverwaltung', 'Anderer Eigentümer', 'Sonstiges',
];

const HANDWERKER_SUBS: HandwerkerSubcategory[] = [
  'Rohbau', 'Elektro', 'Sanitär', 'Heizung', 'Trockenbau',
  'Maler & Lackierer', 'Dach', 'Fassade', 'Aufzug', 'Lüftung',
  'Fliesen', 'Böden', 'Schreiner', 'Metall & Stahl', 'Sonstiges',
];

const CATEGORY_ICONS: Record<string, string> = {
  'Handwerker': '🔨', 'Architekt & Planer': '📐', 'Property Manager': '🏢',
  'Facility Manager': '🔧', 'Hausverwaltung': '🏠', 'Mieter': '👥',
  'Potentieller Mieter': '👤', 'Banker & Finanzierer': '🏦', 'Makler': '🤝',
  'Potentieller Käufer': '💰', 'Käufer': '✅', 'Potentieller Investor': '📈',
  'Investor': '💼', 'Stadtverwaltung': '🏛', 'Anderer Eigentümer': '🏘', 'Sonstiges': '📋',
};

interface AddressbookProps { onClose: () => void; }

const emptyWrite = (): ContactWrite => ({
  category: 'Sonstiges', firstName: '', lastName: '',
  company: null, position: null, email: null, phone: null,
  mobile: null, address: null, city: null, website: null,
  notes: null, tags: null, linkedObjectIds: null,
});

export default function Addressbook({ onClose }: AddressbookProps) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: getListContactsQueryKey() });

  const { data: contacts = [], isLoading } = useListContacts();

  const createMutation = useCreateContact({
    mutation: { onSuccess: (created) => { invalidate(); setAdding(false); setNewContact(emptyWrite()); setSelected(created); } },
  });
  const updateMutation = useUpdateContact({
    mutation: { onSuccess: (updated) => { invalidate(); setSelected(updated); setEditing(false); } },
  });
  const deleteMutation = useDeleteContact({
    mutation: { onSuccess: () => { invalidate(); setSelected(null); setEditing(false); } },
  });

  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<ContactCategory | 'Alle'>('Alle');
  const [selected, setSelected] = useState<Contact | null>(null);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newContact, setNewContact] = useState<ContactWrite>(emptyWrite());
  // Local edit draft (so form changes don't mutate the cache directly)
  const [editDraft, setEditDraft] = useState<ContactWrite>(emptyWrite());

  const filtered = contacts.filter(c => {
    const matchCat = filterCat === 'Alle' || c.category === filterCat;
    const q = search.toLowerCase();
    const matchSearch = !q || `${c.firstName} ${c.lastName} ${c.company ?? ''}`.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = filtered.filter(c => c.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {} as Record<string, Contact[]>);

  const handleStartEdit = () => {
    if (!selected) return;
    setEditDraft({
      category: selected.category,
      subcategory: selected.subcategory,
      firstName: selected.firstName,
      lastName: selected.lastName,
      company: selected.company,
      position: selected.position,
      email: selected.email,
      phone: selected.phone,
      mobile: selected.mobile,
      address: selected.address,
      city: selected.city,
      website: selected.website,
      notes: selected.notes,
      tags: selected.tags,
      linkedObjectIds: selected.linkedObjectIds,
    });
    setEditing(true);
  };

  const handleSaveNew = () => {
    if (!newContact.firstName || !newContact.lastName) return;
    createMutation.mutate({ data: newContact });
  };

  const handleSaveEdit = () => {
    if (!selected) return;
    updateMutation.mutate({ id: selected.id, data: editDraft });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate({ id });
  };

  const isBusy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <>
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />
      <div
        className="fixed top-0 right-0 h-full z-50 flex animate-slide-in-right"
        style={{ width: 780 }}
      >
        {/* Contact List */}
        <div style={{
          width: 300, height: '100%', overflowY: 'auto',
          background: 'rgba(242,242,247,0.97)',
          borderLeft: '1px solid rgba(0,0,0,0.08)',
          borderRight: '1px solid rgba(0,0,0,0.06)',
          backdropFilter: 'blur(32px)',
        }}>
          {/* Header */}
          <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em', color: '#1c1c1e', margin: 0 }}>Adressbuch</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setAdding(true); setEditing(false); setSelected(null); }}
                  style={{ background: '#007aff', border: 'none', borderRadius: 8, cursor: 'pointer', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4, color: '#fff', fontSize: 12, fontWeight: 600 }}
                >
                  <Plus size={12} /> Neu
                </button>
                <button onClick={onClose} style={{ background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, cursor: 'pointer', padding: '5px 7px' }}>
                  <X size={14} color="#3c3c43" />
                </button>
              </div>
            </div>
            <div className="relative">
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'rgba(60,60,67,0.45)' }} />
              <input
                className="input-glass"
                placeholder="Suchen..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 28, fontSize: 13 }}
              />
            </div>
            <select
              className="input-glass mt-2"
              value={filterCat}
              onChange={e => setFilterCat(e.target.value as ContactCategory | 'Alle')}
              style={{ fontSize: 12 }}
            >
              <option value="Alle">Alle Kategorien</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          {/* List */}
          <div style={{ padding: '8px 8px' }}>
            {isLoading && (
              <div style={{ textAlign: 'center', padding: 32, color: 'rgba(60,60,67,0.45)', fontSize: 13 }}>
                Lädt…
              </div>
            )}
            {!isLoading && Object.keys(grouped).length === 0 && (
              <div style={{ textAlign: 'center', padding: 32, color: 'rgba(60,60,67,0.45)', fontSize: 13 }}>
                Keine Kontakte gefunden.
              </div>
            )}
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat} className="mb-4">
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(60,60,67,0.45)', letterSpacing: '0.05em', textTransform: 'uppercase', padding: '4px 8px 6px' }}>
                  {CATEGORY_ICONS[cat]} {cat} ({items.length})
                </div>
                {items.map(contact => (
                  <div
                    key={contact.id}
                    onClick={() => { setSelected(contact); setEditing(false); setAdding(false); }}
                    className="flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all"
                    style={{
                      background: selected?.id === contact.id ? 'rgba(0,122,255,0.10)' : 'transparent',
                      border: selected?.id === contact.id ? '1px solid rgba(0,122,255,0.18)' : '1px solid transparent',
                      marginBottom: 2,
                    }}
                  >
                    <div style={{
                      width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                      background: selected?.id === contact.id ? '#007aff' : 'rgba(0,0,0,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700,
                      color: selected?.id === contact.id ? '#fff' : 'rgba(60,60,67,0.6)',
                    }}>
                      {contact.firstName[0]}{contact.lastName[0]}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1c1c1e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {contact.firstName} {contact.lastName}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.50)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {contact.company ?? contact.category}
                      </div>
                    </div>
                    <ChevronRight size={12} color="rgba(60,60,67,0.35)" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Detail / Edit / Add Panel */}
        <div style={{
          flex: 1, height: '100%', overflowY: 'auto',
          background: 'rgba(250,250,252,0.98)',
          backdropFilter: 'blur(32px)',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
        }}>
          {adding && (
            <ContactForm
              title="Neuer Kontakt"
              data={newContact}
              onChange={patch => setNewContact(prev => ({ ...prev, ...patch }))}
              onSave={handleSaveNew}
              onCancel={() => setAdding(false)}
              busy={isBusy}
            />
          )}
          {selected && !adding && (
            editing ? (
              <ContactForm
                title="Kontakt bearbeiten"
                data={editDraft}
                onChange={patch => setEditDraft(prev => ({ ...prev, ...patch }))}
                onSave={handleSaveEdit}
                onCancel={() => setEditing(false)}
                onDelete={() => handleDelete(selected.id)}
                busy={isBusy}
              />
            ) : (
              <ContactDetail
                contact={selected}
                onEdit={handleStartEdit}
                onDelete={() => handleDelete(selected.id)}
              />
            )
          )}
          {!selected && !adding && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(60,60,67,0.40)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Kontakt auswählen</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>oder neuen Kontakt anlegen</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ContactDetail({ contact, onEdit, onDelete }: { contact: Contact; onEdit: () => void; onDelete: () => void }) {
  return (
    <div style={{ padding: 28 }}>
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(145deg, #007aff, #af52de)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff' }}>
            {contact.firstName[0]}{contact.lastName[0]}
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em', color: '#1c1c1e', margin: 0 }}>
              {contact.firstName} {contact.lastName}
            </h2>
            {contact.position && <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.55)', marginTop: 2 }}>{contact.position}</div>}
            {contact.company && <div style={{ fontSize: 13, color: '#007aff', fontWeight: 600, marginTop: 2 }}>{contact.company}</div>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onEdit} style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, cursor: 'pointer', padding: '6px 12px', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, color: '#3c3c43' }}>
            <Edit3 size={13} /> Bearbeiten
          </button>
        </div>
      </div>

      <div className="space-y-2 mb-6">
        <span className="badge-accent">{CATEGORY_ICONS[contact.category]} {contact.category}</span>
        {contact.subcategory && <span className="badge-neutral ml-2">{contact.subcategory}</span>}
      </div>

      <div className="space-y-3">
        {contact.email && (
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
            <Mail size={15} color="#007aff" />
            <div>
              <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', letterSpacing: '0.03em' }}>E-MAIL</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#007aff' }}>{contact.email}</div>
            </div>
          </div>
        )}
        {contact.phone && (
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
            <Phone size={15} color="#34c759" />
            <div>
              <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', letterSpacing: '0.03em' }}>TELEFON</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#1c1c1e' }}>{contact.phone}</div>
            </div>
          </div>
        )}
        {contact.mobile && (
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
            <Phone size={15} color="#5ac8fa" />
            <div>
              <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', letterSpacing: '0.03em' }}>MOBIL</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#1c1c1e' }}>{contact.mobile}</div>
            </div>
          </div>
        )}
        {(contact.address || contact.city) && (
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
            <Building2 size={15} color="rgba(60,60,67,0.5)" />
            <div>
              <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', letterSpacing: '0.03em' }}>ADRESSE</div>
              <div style={{ fontSize: 13, color: '#1c1c1e' }}>{contact.address}{contact.city ? `, ${contact.city}` : ''}</div>
            </div>
          </div>
        )}
        {contact.website && (
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
            <Link2 size={15} color="rgba(60,60,67,0.5)" />
            <div>
              <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', letterSpacing: '0.03em' }}>WEBSITE</div>
              <div style={{ fontSize: 13, color: '#007aff' }}>{contact.website}</div>
            </div>
          </div>
        )}
        {contact.notes && (
          <div className="p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', letterSpacing: '0.03em', marginBottom: 4 }}>NOTIZEN</div>
            <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.75)', lineHeight: 1.6 }}>{contact.notes}</div>
          </div>
        )}
        {contact.tags && contact.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {contact.tags.map(tag => <span key={tag} className="badge-neutral">{tag}</span>)}
          </div>
        )}
      </div>

      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <button onClick={onDelete} style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.15)', borderRadius: 10, cursor: 'pointer', padding: '6px 14px', fontSize: 13, color: '#cc1a14', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Trash2 size={13} /> Löschen
        </button>
      </div>
      <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.35)', marginTop: 12 }}>
        Erstellt: {new Date(contact.createdAt).toLocaleDateString('de-DE')}
      </div>
    </div>
  );
}

interface ContactFormProps {
  title: string;
  data: ContactWrite;
  onChange: (patch: Partial<ContactWrite>) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  busy?: boolean;
}
function ContactForm({ title, data, onChange, onSave, onCancel, onDelete, busy }: ContactFormProps) {
  return (
    <div style={{ padding: 28 }}>
      <div className="flex items-center justify-between mb-6">
        <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: '#1c1c1e' }}>{title}</h2>
        <div className="flex gap-2">
          <button onClick={onCancel} disabled={busy} style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, cursor: 'pointer', padding: '6px 12px', fontSize: 13, color: '#3c3c43' }}>Abbrechen</button>
          <button onClick={onSave} disabled={busy} style={{ background: '#007aff', border: 'none', borderRadius: 10, cursor: busy ? 'wait' : 'pointer', padding: '6px 14px', fontSize: 13, fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 4, opacity: busy ? 0.6 : 1 }}>
            <Save size={13} /> {busy ? 'Speichert…' : 'Speichern'}
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {([
          { label: 'Vorname *', key: 'firstName', type: 'text' },
          { label: 'Nachname *', key: 'lastName', type: 'text' },
          { label: 'Firma', key: 'company', type: 'text' },
          { label: 'Position', key: 'position', type: 'text' },
          { label: 'E-Mail', key: 'email', type: 'email' },
          { label: 'Telefon', key: 'phone', type: 'tel' },
          { label: 'Mobil', key: 'mobile', type: 'tel' },
          { label: 'Adresse', key: 'address', type: 'text' },
          { label: 'Stadt', key: 'city', type: 'text' },
          { label: 'Website', key: 'website', type: 'text' },
        ] as const).map(field => (
          <div key={field.key}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', letterSpacing: '0.04em', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>{field.label}</label>
            <input
              type={field.type}
              className="input-glass"
              value={(data as unknown as Record<string, unknown>)[field.key] as string ?? ''}
              onChange={e => onChange({ [field.key]: e.target.value || null })}
            />
          </div>
        ))}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', letterSpacing: '0.04em', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Kategorie *</label>
          <select className="input-glass" value={data.category ?? 'Sonstiges'} onChange={e => onChange({ category: e.target.value as ContactCategory })}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        {data.category === 'Handwerker' && (
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', letterSpacing: '0.04em', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Subkategorie</label>
            <select className="input-glass" value={data.subcategory ?? ''} onChange={e => onChange({ subcategory: e.target.value as HandwerkerSubcategory || null })}>
              <option value="">—</option>
              {HANDWERKER_SUBS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        )}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(60,60,67,0.50)', letterSpacing: '0.04em', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Notizen</label>
          <textarea
            className="input-glass"
            value={data.notes ?? ''}
            onChange={e => onChange({ notes: e.target.value || null })}
            rows={3}
            style={{ resize: 'vertical' }}
          />
        </div>
      </div>
      {onDelete && (
        <button onClick={onDelete} disabled={busy} style={{ marginTop: 24, background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.15)', borderRadius: 10, cursor: 'pointer', padding: '6px 14px', fontSize: 13, color: '#cc1a14', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Trash2 size={13} /> Kontakt löschen
        </button>
      )}
    </div>
  );
}
