import { create } from 'zustand';

/** Ids of the elements selected on the canvas; their meaning depends on the diagram type. */
interface SelectionState {
  ids: string[];
  set: (ids: string[]) => void;
  clear: () => void;
}

export const useSelection = create<SelectionState>((set, get) => ({
  ids: [],
  set: (ids) => {
    const cur = get().ids;
    if (cur.length === ids.length && cur.every((x, i) => x === ids[i])) return;
    set({ ids });
  },
  clear: () => {
    if (get().ids.length) set({ ids: [] });
  },
}));
