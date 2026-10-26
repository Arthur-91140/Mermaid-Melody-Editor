import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { detectLanguage, type Language } from '../i18n';
import { safeStorage } from '../lib/storage';

export type AppTheme = 'light' | 'dark' | 'system';
export type MermaidTheme = 'default' | 'neutral' | 'dark' | 'forest' | 'base';
export type MermaidLook = 'classic' | 'handDrawn';
export type ViewMode = 'visual' | 'preview' | 'split';

export interface SettingsState {
  language: Language;
  theme: AppTheme;
  mermaidTheme: MermaidTheme;
  look: MermaidLook;
  view: ViewMode;
  showCode: boolean;
  showSidebar: boolean;
  showInspector: boolean;
  codeWidth: number;
  sidebarWidth: number;
  inspectorWidth: number;
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      language: detectLanguage(),
      theme: 'system',
      mermaidTheme: 'default',
      look: 'classic',
      view: 'visual',
      showCode: true,
      showSidebar: true,
      showInspector: true,
      codeWidth: 420,
      sidebarWidth: 240,
      inspectorWidth: 300,
      set: (patch) => set(patch),
    }),
    {
      name: 'mme:settings',
      storage: createJSONStorage(() => ({
        getItem: safeStorage.getItem,
        setItem: (k: string, v: string) => void safeStorage.setItem(k, v),
        removeItem: safeStorage.removeItem,
      })),
      partialize: ({ set: _set, ...rest }) => rest,
    },
  ),
);
