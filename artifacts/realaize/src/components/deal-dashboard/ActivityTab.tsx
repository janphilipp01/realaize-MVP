import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { GlassPanel } from '@/components/shared';

import { useDateLocale } from '@/i18n/LanguageContext';

import type { AcquisitionDeal } from '@/models/types';

export function ActivityTab({ deal }: { deal: AcquisitionDeal }) {
  const { addActivityToDeal } = useStore();
  const dateLocale = useDateLocale();
  const [noteText, setNoteText] = useState('');
  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addActivityToDeal(deal.id, {
      id: `act-${Date.now()}`,
      dealId: deal.id,
      type: 'Note',
      title: 'Notiz',
      description: noteText,
      timestamp: new Date().toISOString(),
      user: 'M. Wagner',
    });
    setNoteText('');
  };
  return (
        <div className="animate-fade-in">
          <GlassPanel style={{ padding: 24 }}>
            <div className="mb-4">
              <textarea
                className="input-glass"
                placeholder="Notiz hinzufügen..."
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                rows={2}
                style={{ resize: 'none' }}
              />
              <button onClick={handleAddNote} className="btn-accent px-4 py-2 rounded-xl text-sm mt-2 flex items-center gap-2">
                <Plus size={14} /> Notiz speichern
              </button>
            </div>
            <div className="divider mb-4" />
            <div className="space-y-4">
              {deal.activityLog.map((entry, i) => (
                <div key={entry.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,122,255,0.08)', border: '1px solid rgba(0,122,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, color: '#007aff', fontWeight: 700 }}>
                      {entry.type === 'Note' ? '✎' : entry.type === 'Status' ? '◉' : entry.type === 'AI' ? '⚡' : '●'}
                    </div>
                    {i < deal.activityLog.length - 1 && <div style={{ width: 1, flex: 1, marginTop: 4, background: 'rgba(0,122,255,0.10)' }} />}
                  </div>
                  <div style={{ paddingBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1c1c1e' }}>{entry.title}</div>
                    <div style={{ fontSize: 13, color: 'rgba(60,60,67,0.70)', marginTop: 2 }}>{entry.description}</div>
                    <div style={{ fontSize: 11, color: 'rgba(60,60,67,0.45)', marginTop: 4 }}>
                      {new Date(entry.timestamp).toLocaleString(dateLocale)} · {entry.user}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>
  );
}
