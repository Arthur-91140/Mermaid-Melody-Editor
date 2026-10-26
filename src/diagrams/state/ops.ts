import { emptyState, endId, isPseudo, startId, type StateKind, type StateModel, type StateNode, type StateNote } from './model';

export const STATE_ID_RE = /^[\p{L}\p{N}_][\p{L}\p{N}_.-]*$/u;

export const stateTaken = (m: StateModel, id: string) => m.states.some((s) => s.id === id);

export function nextStateId(m: StateModel, base: string): string {
  const clean = base.replace(/[^\p{L}\p{N}_]/gu, '') || 'State';
  let n = 1;
  while (stateTaken(m, `${clean}${n}`)) n++;
  return `${clean}${n}`;
}

/** Adds a state; start/end pseudo-states are unique per composite, so an existing one is reused. */
export function addState(
  m: StateModel,
  kind: StateKind,
  parent: string | null,
  base = 'State',
): { model: StateModel; id: string } {
  if (kind === 'start' || kind === 'end') {
    const id = kind === 'start' ? startId(parent) : endId(parent);
    if (stateTaken(m, id)) return { model: m, id };
    return { model: { ...m, states: [...m.states, { ...emptyState(id, parent), kind }] }, id };
  }
  const id = nextStateId(m, kind === 'state' ? base : kind);
  return { model: { ...m, states: [...m.states, { ...emptyState(id, parent), kind }] }, id };
}

export function updateState(m: StateModel, id: string, patch: Partial<StateNode>): StateModel {
  return { ...m, states: m.states.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
}

export function renameState(m: StateModel, from: string, to: string): StateModel {
  if (from === to || stateTaken(m, to)) return m;
  const pseudo = new Map([
    [from, to],
    [startId(from), startId(to)],
    [endId(from), endId(to)],
  ]);
  const r = (id: string) => pseudo.get(id) ?? id;
  return {
    ...m,
    states: m.states.map((s) => ({ ...s, id: r(s.id), parent: s.parent && r(s.parent) })),
    transitions: m.transitions.map((t) => ({ ...t, from: r(t.from), to: r(t.to), scope: t.scope && r(t.scope) })),
    notes: m.notes.map((n) => ({ ...n, target: r(n.target), scope: n.scope && r(n.scope) })),
  };
}

function lowestCommonScope(m: StateModel, a: string | null, b: string | null): string | null {
  const chain = (id: string | null) => {
    const out: (string | null)[] = [];
    let cur = id;
    for (let g = 0; cur && g < 100; g++) {
      out.push(cur);
      cur = m.states.find((s) => s.id === cur)?.parent ?? null;
    }
    out.push(null);
    return out;
  };
  const ca = chain(a);
  return chain(b).find((x) => ca.includes(x)) ?? null;
}

/** Adds a transition, written in the scope required by pseudo-states (or the common scope). */
export function addTransition(m: StateModel, from: string, to: string, label: string | null = null): StateModel {
  const a = m.states.find((s) => s.id === from);
  const b = m.states.find((s) => s.id === to);
  if (!a || !b) return m;
  if (a.kind === 'end' || b.kind === 'start') return m;
  let scope: string | null;
  if (a.kind === 'start') scope = a.parent;
  else if (b.kind === 'end') scope = b.parent;
  else scope = a.parent === b.parent ? a.parent : lowestCommonScope(m, a.parent, b.parent);
  if (a.kind === 'start' && b.kind === 'end' && a.parent !== b.parent) return m;
  return { ...m, transitions: [...m.transitions, { from, to, label, scope }] };
}

export function updateTransition(m: StateModel, index: number, patch: Partial<StateModel['transitions'][number]>): StateModel {
  return { ...m, transitions: m.transitions.map((t, i) => (i === index ? { ...t, ...patch } : t)) };
}

/**
 * Deletes states (with their transitions and notes), transitions and notes.
 * A deleted composite hands its states to its parent; its own start/end go away.
 */
export function deleteStateItems(m: StateModel, stateIds: string[], transitionIdx: number[], noteIdx: number[]): StateModel {
  const removed = new Set(stateIds);
  for (const id of stateIds) {
    const s = m.states.find((x) => x.id === id);
    if (s?.composite) {
      removed.add(startId(id));
      removed.add(endId(id));
    }
  }
  const parentOf = new Map(m.states.map((s) => [s.id, s.parent]));
  const lift = (p: string | null): string | null => {
    let cur = p;
    while (cur && removed.has(cur)) cur = parentOf.get(cur) ?? null;
    return cur;
  };
  const trans = new Set(transitionIdx);
  const notes = new Set(noteIdx);
  return {
    ...m,
    states: m.states.filter((s) => !removed.has(s.id)).map((s) => ({ ...s, parent: lift(s.parent) })),
    transitions: m.transitions
      .filter((t, i) => !trans.has(i) && !removed.has(t.from) && !removed.has(t.to))
      .map((t) => ({ ...t, scope: lift(t.scope) })),
    notes: m.notes.filter((n, i) => !notes.has(i) && !removed.has(n.target)).map((n) => ({ ...n, scope: lift(n.scope) })),
  };
}

/** Moves states into a composite (or the root); pseudo-states and cycles are refused. */
export function moveStates(m: StateModel, ids: string[], composite: string | null): StateModel {
  const set = new Set(ids);
  const isInside = (id: string | null, ancestor: string): boolean => {
    let cur = id;
    for (let g = 0; cur && g < 100; g++) {
      if (cur === ancestor) return true;
      cur = m.states.find((s) => s.id === cur)?.parent ?? null;
    }
    return false;
  };
  return {
    ...m,
    states: m.states.map((s) => {
      if (!set.has(s.id) || isPseudo(s)) return s;
      if (composite && isInside(composite, s.id)) return s;
      return { ...s, parent: composite };
    }),
  };
}

export function addNote(m: StateModel, target: string, text: string): StateModel {
  const s = m.states.find((x) => x.id === target);
  const note: StateNote = { target, position: 'right of', text, scope: s?.parent ?? null };
  return { ...m, notes: [...m.notes, note] };
}

export function duplicateStates(m: StateModel, ids: string[]): { model: StateModel; mapping: Map<string, string> } {
  let model = m;
  const mapping = new Map<string, string>();
  for (const id of ids) {
    const src = m.states.find((s) => s.id === id);
    if (!src || isPseudo(src) || src.composite) continue;
    const res = addState(model, src.kind, src.parent, src.id.replace(/\d+$/, ''));
    model = updateState(res.model, res.id, { label: src.label, descriptions: [...src.descriptions], cssClasses: [...src.cssClasses], style: src.style });
    mapping.set(id, res.id);
  }
  return { model, mapping };
}

/** Sets the text shown as a state's title (alias, first description, or a renamed id). */
export function setStateTitle(m: StateModel, id: string, text: string): { model: StateModel; id: string } {
  const s = m.states.find((x) => x.id === id);
  const value = text.trim();
  if (!s || !value) return { model: m, id };
  if (s.label !== null) return { model: updateState(m, id, { label: value }), id };
  if (s.descriptions.length) return { model: updateState(m, id, { descriptions: [value, ...s.descriptions.slice(1)] }), id };
  if (STATE_ID_RE.test(value) && !stateTaken(m, value)) return { model: renameState(m, id, value), id: value };
  if (value === id) return { model: m, id };
  return { model: updateState(m, id, { label: value.replace(/"/g, "'") }), id };
}
