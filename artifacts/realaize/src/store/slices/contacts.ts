import { mockContacts } from '@/data/mockData';
import type { SetState, GetState } from '@/store/slices/types';
import type { AppState } from '@/store/appState';

export const contactsSlice = (set: SetState, get: GetState): Pick<AppState, 'contacts' | 'addContact' | 'updateContact' | 'deleteContact'> => ({
      contacts: mockContacts,

      addContact: (contact) => set(s => ({ contacts: [...s.contacts, contact] })),
      updateContact: (id, patch) => set(s => ({ contacts: s.contacts.map(c => c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c) })),
      deleteContact: (id) => set(s => ({ contacts: s.contacts.filter(c => c.id !== id) })),
});
