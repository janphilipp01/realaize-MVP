import type { StoreApi } from 'zustand';
import type { AppState } from '@/store/appState';

export type SetState = StoreApi<AppState>['setState'];
export type GetState = StoreApi<AppState>['getState'];
