import type { StoreApi } from 'zustand';
import type { AppState } from '../appState';

export type SetState = StoreApi<AppState>['setState'];
export type GetState = StoreApi<AppState>['getState'];
