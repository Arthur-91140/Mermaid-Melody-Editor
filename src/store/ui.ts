import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { useSettings } from './settings';

export type DialogName = 'new' | 'paste' | 'help';
export type PanelName = 'code' | 'inspector' | 'docs';

interface UiState {
  dialog: DialogName | null;
  /** On narrow screens a single side panel is shown over the canvas. */
  mobilePanel: PanelName | null;
}

export const useUi = create<UiState>(() => ({ dialog: null, mobilePanel: null }));

export const openDialog = (dialog: DialogName | null) => useUi.setState({ dialog });

const NARROW = '(max-width: 900px)';
export const isNarrow = () => typeof window !== 'undefined' && window.matchMedia(NARROW).matches;

export function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(isNarrow);
  useEffect(() => {
    const media = window.matchMedia(NARROW);
    const on = () => setNarrow(media.matches);
    media.addEventListener('change', on);
    return () => media.removeEventListener('change', on);
  }, []);
  return narrow;
}

const SETTING_KEY = { code: 'showCode', inspector: 'showInspector', docs: 'showSidebar' } as const;

export function togglePanel(panel: PanelName) {
  if (isNarrow()) {
    useUi.setState((s) => ({ mobilePanel: s.mobilePanel === panel ? null : panel }));
    return;
  }
  const key = SETTING_KEY[panel];
  useSettings.getState().set({ [key]: !useSettings.getState()[key] });
}

export function closePanel(panel: PanelName) {
  if (isNarrow()) useUi.setState((s) => ({ mobilePanel: s.mobilePanel === panel ? null : s.mobilePanel }));
  else useSettings.getState().set({ [SETTING_KEY[panel]]: false });
}

/** Whether a side panel is shown, taking the narrow layout into account. */
export function usePanelVisible(panel: PanelName): boolean {
  const narrow = useNarrow();
  const mobile = useUi((s) => s.mobilePanel === panel);
  const desktop = useSettings((s) => s[SETTING_KEY[panel]]);
  return narrow ? mobile : desktop;
}
