import { create } from 'zustand';
import { detectKind, type DiagramKind } from '../diagrams/common';
import { readJson, safeStorage, writeJson } from '../lib/storage';

export interface Pos {
  x: number;
  y: number;
  /** Size set by the user on the Mermaid preview. */
  w?: number;
  h?: number;
}
export type Layout = Record<string, Pos>;

/** Prefix of the positions set on the Mermaid preview, keyed by canvas id (e.g. `pv:n:A`). */
export const PREVIEW_KEY = 'pv:';

/**
 * Renames an element in a layout: its canvas position (`from`) and its preview
 * position (a `pv:` key whose canvas id ends with `:from`).
 */
export function renameLayoutId(layout: Layout, from: string, to: string): Layout {
  if (from === to) return layout;
  let changed = false;
  const out: Layout = {};
  for (const [k, v] of Object.entries(layout)) {
    let key = k;
    if (k === from) key = to;
    else if (k.startsWith(PREVIEW_KEY) && k.endsWith(`:${from}`)) key = k.slice(0, k.length - from.length) + to;
    if (key !== k) changed = true;
    out[key] = v;
  }
  return changed ? out : layout;
}

export interface DocMeta {
  id: string;
  name: string;
  kind: DiagramKind;
  createdAt: number;
  updatedAt: number;
}

interface StoredDoc {
  code: string;
  layout: Layout;
}

interface Snapshot {
  code: string;
  layout: Layout;
}

export type EditSource = 'typing' | 'canvas' | 'external';

interface DocState {
  index: DocMeta[];
  currentId: string | null;
  code: string;
  layout: Layout;
  past: Snapshot[];
  future: Snapshot[];
  /** Incremented whenever the code is replaced from outside the code editor. */
  externalVersion: number;
  lastEdit: { source: EditSource; at: number } | null;

  init: (fallback: () => { name: string; code: string }) => void;
  /** Changes the code; typing bursts are merged into one undo step. */
  setCode: (code: string, source: EditSource) => void;
  /** Applies a visual edit (code and/or layout) as one undo step. */
  commit: (code: string, layout?: Layout) => void;
  /** Updates positions; `record` adds an undo step (end of a drag). */
  setLayout: (layout: Layout, record?: boolean) => void;
  undo: () => void;
  redo: () => void;
  createDoc: (name: string, code: string, layout?: Layout) => string;
  openDoc: (id: string) => void;
  renameDoc: (id: string, name: string) => void;
  duplicateDoc: (id: string, suffix: string) => string | null;
  deleteDoc: (id: string) => void;
}

const INDEX_KEY = 'mme:index';
const CURRENT_KEY = 'mme:current';
const docKey = (id: string) => `mme:doc:${id}`;
const HISTORY_LIMIT = 200;
const TYPING_MERGE_MS = 800;

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(get: () => DocState) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    flushSave(get());
  }, 300);
}

function flushSave(s: DocState) {
  if (!s.currentId) return;
  writeJson(docKey(s.currentId), { code: s.code, layout: s.layout } satisfies StoredDoc);
  writeJson(INDEX_KEY, s.index);
  safeStorage.setItem(CURRENT_KEY, s.currentId);
}

function touch(index: DocMeta[], id: string | null, code: string): DocMeta[] {
  if (!id) return index;
  return index.map((d) => (d.id === id ? { ...d, kind: detectKind(code), updatedAt: Date.now() } : d));
}

export const useDocuments = create<DocState>()((set, get) => {
  const pushPast = (s: DocState): Snapshot[] =>
    [...s.past, { code: s.code, layout: s.layout }].slice(-HISTORY_LIMIT);

  const afterChange = () => scheduleSave(get);

  return {
    index: [],
    currentId: null,
    code: '',
    layout: {},
    past: [],
    future: [],
    externalVersion: 0,
    lastEdit: null,

    init: (fallback) => {
      const index = readJson<DocMeta[]>(INDEX_KEY, []).filter((d) => d && d.id);
      const wanted = safeStorage.getItem(CURRENT_KEY);
      const current = index.find((d) => d.id === wanted) ?? index[0];
      if (current) {
        const doc = readJson<StoredDoc>(docKey(current.id), { code: '', layout: {} });
        set({ index, currentId: current.id, code: doc.code, layout: doc.layout ?? {}, past: [], future: [] });
      } else {
        set({ index });
        const f = fallback();
        get().createDoc(f.name, f.code);
      }
      set((s) => ({ externalVersion: s.externalVersion + 1 }));
    },

    setCode: (code, source) => {
      const s = get();
      if (code === s.code) return;
      const now = Date.now();
      const merge =
        source === 'typing' && s.lastEdit?.source === 'typing' && now - s.lastEdit.at < TYPING_MERGE_MS;
      set({
        code,
        past: merge ? s.past : pushPast(s),
        future: [],
        lastEdit: { source, at: now },
        index: touch(s.index, s.currentId, code),
        externalVersion: source === 'typing' ? s.externalVersion : s.externalVersion + 1,
      });
      afterChange();
    },

    commit: (code, layout) => {
      const s = get();
      const nextLayout = layout ?? s.layout;
      if (code === s.code && nextLayout === s.layout) return;
      set({
        code,
        layout: nextLayout,
        past: pushPast(s),
        future: [],
        lastEdit: { source: 'canvas', at: Date.now() },
        index: touch(s.index, s.currentId, code),
        externalVersion: code === s.code ? s.externalVersion : s.externalVersion + 1,
      });
      afterChange();
    },

    setLayout: (layout, record = false) => {
      const s = get();
      set({
        layout,
        ...(record ? { past: pushPast(s), future: [], lastEdit: { source: 'canvas' as const, at: Date.now() } } : {}),
      });
      afterChange();
    },

    undo: () => {
      const s = get();
      const prev = s.past[s.past.length - 1];
      if (!prev) return;
      set({
        code: prev.code,
        layout: prev.layout,
        past: s.past.slice(0, -1),
        future: [{ code: s.code, layout: s.layout }, ...s.future],
        lastEdit: null,
        index: touch(s.index, s.currentId, prev.code),
        externalVersion: s.externalVersion + 1,
      });
      afterChange();
    },

    redo: () => {
      const s = get();
      const next = s.future[0];
      if (!next) return;
      set({
        code: next.code,
        layout: next.layout,
        past: pushPast(s),
        future: s.future.slice(1),
        lastEdit: null,
        index: touch(s.index, s.currentId, next.code),
        externalVersion: s.externalVersion + 1,
      });
      afterChange();
    },

    createDoc: (name, code, layout = {}) => {
      const s = get();
      flushSave(s);
      const id = newId();
      const now = Date.now();
      const meta: DocMeta = { id, name, kind: detectKind(code), createdAt: now, updatedAt: now };
      set({
        index: [meta, ...s.index],
        currentId: id,
        code,
        layout,
        past: [],
        future: [],
        lastEdit: null,
        externalVersion: s.externalVersion + 1,
      });
      flushSave(get());
      return id;
    },

    openDoc: (id) => {
      const s = get();
      if (id === s.currentId) return;
      flushSave(s);
      const doc = readJson<StoredDoc>(docKey(id), { code: '', layout: {} });
      set({
        currentId: id,
        code: doc.code,
        layout: doc.layout ?? {},
        past: [],
        future: [],
        lastEdit: null,
        externalVersion: s.externalVersion + 1,
      });
      safeStorage.setItem(CURRENT_KEY, id);
    },

    renameDoc: (id, name) => {
      set((s) => ({ index: s.index.map((d) => (d.id === id ? { ...d, name, updatedAt: Date.now() } : d)) }));
      afterChange();
      writeJson(INDEX_KEY, get().index);
    },

    duplicateDoc: (id, suffix) => {
      const s = get();
      flushSave(s);
      const meta = s.index.find((d) => d.id === id);
      if (!meta) return null;
      const doc = id === s.currentId ? { code: s.code, layout: s.layout } : readJson<StoredDoc>(docKey(id), { code: '', layout: {} });
      return get().createDoc(`${meta.name} ${suffix}`, doc.code, doc.layout);
    },

    deleteDoc: (id) => {
      const s = get();
      safeStorage.removeItem(docKey(id));
      const index = s.index.filter((d) => d.id !== id);
      set({ index });
      writeJson(INDEX_KEY, index);
      if (id === s.currentId) {
        const next = index[0];
        set({ currentId: null });
        if (next) get().openDoc(next.id);
        else set({ code: '', layout: {}, past: [], future: [], externalVersion: get().externalVersion + 1 });
      }
    },
  };
});

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => flushSave(useDocuments.getState()));
}
