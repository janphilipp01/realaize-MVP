import type { SetState, GetState } from '@/store/slices/types';
import { defaultSettings } from '@/store/appState';
import type { AppState } from '@/store/appState';

export const settingsSlice = (set: SetState, get: GetState): Pick<AppState, 'settings' | 'updateSettings'> => ({
      settings: defaultSettings,

      updateSettings: (patch) => set(s => ({ settings: { ...s.settings, ...patch } })),
});
