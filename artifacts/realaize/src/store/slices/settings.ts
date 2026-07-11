import type { SetState, GetState } from './types';
import { defaultSettings } from '../appState';
import type { AppState } from '../appState';

export const settingsSlice = (set: SetState, get: GetState): Pick<AppState, 'settings' | 'updateSettings'> => ({
      settings: defaultSettings,

      updateSettings: (patch) => set(s => ({ settings: { ...s.settings, ...patch } })),
});
