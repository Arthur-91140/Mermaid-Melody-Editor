import { create } from 'zustand';

export type DialogName = 'new' | 'paste' | 'help';

export const useUi = create<{ dialog: DialogName | null }>(() => ({ dialog: null }));

export const openDialog = (dialog: DialogName | null) => useUi.setState({ dialog });
