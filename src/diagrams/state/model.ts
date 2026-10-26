export type StateKind = 'state' | 'choice' | 'fork' | 'join' | 'start' | 'end';

export interface StateNode {
  id: string;
  kind: StateKind;
  /** Display name given with `state "Name" as id`. */
  label: string | null;
  /** Lines added with `id : text`. */
  descriptions: string[];
  /** Composite state containing this one. */
  parent: string | null;
  /** Declared with a `{ ... }` body. */
  composite: boolean;
  direction: string | null;
  cssClasses: string[];
  style: string | null;
}

export interface StateTransition {
  from: string;
  to: string;
  label: string | null;
  /** Composite in which the transition is written (null for the root). */
  scope: string | null;
}

export interface StateNote {
  target: string;
  position: 'left of' | 'right of';
  text: string;
  scope: string | null;
}

export interface StateModel {
  kind: 'state';
  keyword: string;
  direction: string | null;
  states: StateNode[];
  transitions: StateTransition[];
  notes: StateNote[];
  classDefs: { names: string; style: string }[];
  extras: string[];
  /** Set when the source uses syntax the visual editor cannot keep (e.g. concurrency). */
  readOnlyReason: string | null;
}

export const startId = (scope: string | null) => `${scope ?? 'root'}_start`;
export const endId = (scope: string | null) => `${scope ?? 'root'}_end`;

export const isPseudo = (s: StateNode) => s.kind === 'start' || s.kind === 'end';

export function emptyState(id: string, parent: string | null): StateNode {
  return {
    id,
    kind: 'state',
    label: null,
    descriptions: [],
    parent,
    composite: false,
    direction: null,
    cssClasses: [],
    style: null,
  };
}

/** Title and extra lines as Mermaid shows them: without an alias, the first description becomes the title. */
export function stateDisplay(s: StateNode): { title: string; lines: string[] } {
  if (s.label !== null) return { title: s.label, lines: s.descriptions };
  if (s.descriptions.length) return { title: s.descriptions[0], lines: s.descriptions.slice(1) };
  return { title: s.id, lines: [] };
}
