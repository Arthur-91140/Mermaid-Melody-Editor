import { BRANCH_OF, type BlockKind, type ParticipantKind, type SeqItem, type SeqModel, type SeqParticipant } from './model';

export const PARTICIPANT_ID_RE = /^[\p{L}\p{N}_][\p{L}\p{N}_.-]*$/u;

export const participantTaken = (m: SeqModel, id: string) => m.participants.some((p) => p.id === id);

export function nextParticipantId(m: SeqModel, base: string): string {
  const clean = base.replace(/[^\p{L}\p{N}_]/gu, '') || 'P';
  let n = 1;
  while (participantTaken(m, `${clean}${n}`)) n++;
  return `${clean}${n}`;
}

export function addParticipant(m: SeqModel, kind: ParticipantKind, base: string, index?: number): { model: SeqModel; id: string } {
  const id = nextParticipantId(m, base);
  const p: SeqParticipant = { id, label: null, kind, meta: null, declared: true, created: false };
  const participants = [...m.participants];
  participants.splice(index ?? participants.length, 0, p);
  return { model: { ...m, participants }, id };
}

export function updateParticipant(m: SeqModel, id: string, patch: Partial<SeqParticipant>): SeqModel {
  return { ...m, participants: m.participants.map((p) => (p.id === id ? { ...p, ...patch, declared: true } : p)) };
}

function mapActors(item: SeqItem, r: (id: string) => string): SeqItem {
  switch (item.t) {
    case 'message':
      return { ...item, from: r(item.from), to: r(item.to) };
    case 'note':
      return { ...item, actors: item.actors.map(r) };
    case 'activate':
    case 'deactivate':
    case 'destroy':
      return { ...item, actor: r(item.actor) };
    case 'create':
      return { ...item, id: r(item.id) };
    default:
      return item;
  }
}

export function renameParticipant(m: SeqModel, from: string, to: string): SeqModel {
  if (from === to || participantTaken(m, to)) return m;
  const r = (id: string) => (id === from ? to : id);
  return {
    ...m,
    participants: m.participants.map((p) => (p.id === from ? { ...p, id: to, declared: true } : p)),
    boxes: m.boxes.map((b) => ({ ...b, members: b.members.map(r) })),
    items: m.items.map((it) => mapActors(it, r)),
  };
}

const mentions = (item: SeqItem, id: string): boolean => {
  switch (item.t) {
    case 'message':
      return item.from === id || item.to === id;
    case 'activate':
    case 'deactivate':
    case 'destroy':
      return item.actor === id;
    case 'create':
      return item.id === id;
    default:
      return false;
  }
};

/** Removes participants with everything that refers to them (notes keep their other actors). */
export function deleteParticipants(m: SeqModel, ids: string[]): SeqModel {
  const set = new Set(ids);
  const items: SeqItem[] = [];
  for (const it of m.items) {
    if ([...set].some((id) => mentions(it, id))) continue;
    if (it.t === 'note') {
      const actors = it.actors.filter((a) => !set.has(a));
      if (!actors.length) continue;
      items.push({ ...it, actors, position: actors.length > 1 ? 'over' : it.position });
      continue;
    }
    items.push(it);
  }
  return {
    ...m,
    participants: m.participants.filter((p) => !set.has(p.id)),
    boxes: m.boxes.map((b) => ({ ...b, members: b.members.filter((x) => !set.has(x)) })).filter((b) => b.members.length),
    items,
  };
}

/** Moves a participant to another column, keeping box members together when possible. */
export function moveParticipant(m: SeqModel, id: string, toIndex: number): SeqModel {
  const from = m.participants.findIndex((p) => p.id === id);
  if (from === -1) return m;
  const participants = [...m.participants];
  const [p] = participants.splice(from, 1);
  participants.splice(Math.max(0, Math.min(toIndex, participants.length)), 0, p);
  const order = new Map(participants.map((x, i) => [x.id, i]));
  const boxes = m.boxes.map((b) => ({ ...b, members: [...b.members].sort((a, c) => order.get(a)! - order.get(c)!) }));
  return { ...m, participants: participants.map((x) => ({ ...x, declared: true })), boxes };
}

export interface BlockInfo {
  start: number;
  end: number;
  branches: number[];
  depth: number;
}

/** Matches block starts with their branches and ends; null when nesting is broken. */
export function blockStructure(items: SeqItem[]): Map<number, BlockInfo> | null {
  const out = new Map<number, BlockInfo>();
  const stack: BlockInfo[] = [];
  items.forEach((it, i) => {
    if (it.t === 'block') {
      const b = { start: i, end: -1, branches: [], depth: stack.length };
      stack.push(b);
      out.set(i, b);
    } else if (it.t === 'branch') {
      stack[stack.length - 1]?.branches.push(i);
    } else if (it.t === 'end') {
      const b = stack.pop();
      if (b) b.end = i;
    }
  });
  if (stack.length) return null;
  for (const [i, it] of items.entries()) {
    if (it.t === 'branch' && ![...out.values()].some((b) => b.branches.includes(i))) return null;
    if (it.t === 'end' && ![...out.values()].some((b) => b.end === i)) return null;
  }
  return out;
}

/** Block that owns a start, branch or end marker. */
export function blockOf(items: SeqItem[], index: number): BlockInfo | null {
  const s = blockStructure(items);
  if (!s) return null;
  for (const b of s.values()) if (b.start === index || b.end === index || b.branches.includes(index)) return b;
  return null;
}

export function insertItem(m: SeqModel, item: SeqItem, index?: number): SeqModel {
  const items = [...m.items];
  items.splice(index ?? items.length, 0, item);
  return { ...m, items };
}

export function updateItem(m: SeqModel, index: number, patch: Partial<SeqItem>): SeqModel {
  return { ...m, items: m.items.map((it, i) => (i === index ? ({ ...it, ...patch } as SeqItem) : it)) };
}

/**
 * Deletes items. Deleting a block start or end unwraps the whole block (its
 * markers go, its content stays); deleting a branch removes only that marker.
 */
export function deleteItems(m: SeqModel, indexes: number[]): SeqModel {
  const drop = new Set(indexes);
  for (const i of indexes) {
    const it = m.items[i];
    if (it?.t !== 'block' && it?.t !== 'end') continue;
    const b = blockOf(m.items, i);
    if (b) {
      drop.add(b.start);
      drop.add(b.end);
      b.branches.forEach((x) => drop.add(x));
    }
  }
  return { ...m, items: m.items.filter((_, i) => !drop.has(i)) };
}

/** Moves one item; refused when it would break block nesting. */
export function moveItem(m: SeqModel, from: number, to: number): SeqModel {
  if (from === to || from < 0 || from >= m.items.length) return m;
  const items = [...m.items];
  const [it] = items.splice(from, 1);
  items.splice(Math.max(0, Math.min(to, items.length)), 0, it);
  if (!blockStructure(items)) return m;
  return { ...m, items };
}

/** Wraps the inclusive range [first, last] in a new block. */
export function wrapItems(m: SeqModel, first: number, last: number, kind: BlockKind, label: string): SeqModel {
  const items = [...m.items];
  items.splice(last + 1, 0, { t: 'end' });
  items.splice(first, 0, { t: 'block', kind, label });
  if (!blockStructure(items)) return m;
  return { ...m, items };
}

/** Adds an else/and/option branch just before the end of the block starting at `start`. */
export function addBranch(m: SeqModel, start: number, label: string): SeqModel {
  const it = m.items[start];
  const b = blockOf(m.items, start);
  if (it?.t !== 'block' || !b) return m;
  const kind = BRANCH_OF[it.kind];
  if (!kind) return m;
  return insertItem(m, { t: 'branch', kind, label }, b.end);
}

export function hasAutonumber(m: SeqModel): boolean {
  return m.items.some((it) => it.t === 'raw' && /^autonumber\b(?!\s+off)/.test(it.text));
}

export function toggleAutonumber(m: SeqModel, on: boolean): SeqModel {
  const items = m.items.filter((it) => !(it.t === 'raw' && /^autonumber\b/.test(it.text)));
  return { ...m, items: on ? [{ t: 'raw', text: 'autonumber' }, ...items] : items };
}

/** Participants (column indexes) touched by the items of a range, for block frames. */
export function columnsUsed(m: SeqModel, first: number, last: number): [number, number] | null {
  const idx = new Map(m.participants.map((p, i) => [p.id, i]));
  const cols: number[] = [];
  for (let i = first; i <= last; i++) {
    const it = m.items[i];
    if (!it) continue;
    if (it.t === 'message') cols.push(idx.get(it.from) ?? 0, idx.get(it.to) ?? 0);
    else if (it.t === 'note') it.actors.forEach((a) => cols.push(idx.get(a) ?? 0));
    else if (it.t === 'activate' || it.t === 'deactivate' || it.t === 'destroy') cols.push(idx.get(it.actor) ?? 0);
  }
  if (!cols.length) return null;
  return [Math.min(...cols), Math.max(...cols)];
}
