import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { detectLanguage, type Language } from '../i18n';
import { safeStorage } from '../lib/storage';

export type AppTheme = 'light' | 'dark' | 'system';
/** Every theme Mermaid provides, light ones first. */
export const LIGHT_MERMAID_THEMES = ['redux-color', 'redux', 'neo', 'default', 'neutral', 'forest', 'base'] as const;
export const DARK_MERMAID_THEMES = ['redux-dark-color', 'redux-dark', 'neo-dark', 'dark'] as const;
export type MermaidTheme = (typeof LIGHT_MERMAID_THEMES)[number] | (typeof DARK_MERMAID_THEMES)[number];

export const isDarkMermaidTheme = (theme: MermaidTheme): boolean => (DARK_MERMAID_THEMES as readonly string[]).includes(theme);
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
  /** Long code lines wrap instead of scrolling sideways. */
  wrapCode: boolean;
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
      mermaidTheme: 'redux-color',
      look: 'classic',
      view: 'preview',
      showCode: true,
      showSidebar: typeof window === 'undefined' || window.innerWidth >= 1280,
      showInspector: true,
      wrapCode: true,
      codeWidth: 380,
      sidebarWidth: 240,
      inspectorWidth: 300,
      set: (patch) => set(patch),
    }),
    {
      name: 'mme:settings',
      version: 1,
      // Version 1 makes redux-color the default theme instead of Mermaid's former default.
      migrate: (persisted, version) => {
        const state = persisted as Partial<SettingsState>;
        if (version < 1 && state.mermaidTheme === 'default') state.mermaidTheme = 'redux-color';
        return state as SettingsState;
      },
      storage: createJSONStorage(() => ({
        getItem: safeStorage.getItem,
        setItem: (k: string, v: string) => void safeStorage.setItem(k, v),
        removeItem: safeStorage.removeItem,
      })),
      partialize: ({ set: _set, ...rest }) => rest,
    },
  ),
);
