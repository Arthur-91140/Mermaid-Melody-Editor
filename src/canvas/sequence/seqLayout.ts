import type { SeqItem, SeqModel } from '../../diagrams/sequence/model';
import { blockStructure, columnsUsed } from '../../diagrams/sequence/ops';

export const COL_W = 170;
export const HEADER_H = 58;
export const TOP = 12;
const FIRST_ROW = TOP + HEADER_H + 28;

export interface Row {
  y: number;
  h: number;
}

export interface Frame {
  start: number;
  end: number;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  depth: number;
  branches: { index: number; y: number }[];
}

export interface Activation {
  actor: string;
  y1: number;
  y2: number;
  level: number;
}

export interface SeqLayout {
  colX: (i: number) => number;
  centerOf: Map<string, number>;
  rows: Row[];
  frames: Frame[];
  activations: Activation[];
  /** Message numbers when autonumber is on. */
  numbers: Map<number, number>;
  width: number;
  height: number;
}

function noteLines(text: string): number {
  return Math.max(1, text.split(/<br\s*\/?>/i).length);
}

function rowHeight(item: SeqItem): number {
  switch (item.t) {
    case 'message':
      return item.from === item.to ? 66 : 50;
    case 'note':
      return 30 + noteLines(item.text) * 17;
    case 'block':
      return 34;
    case 'branch':
      return 30;
    case 'end':
      return 18;
    default:
      return 28;
  }
}

export function layoutSequence(m: SeqModel): SeqLayout {
  const colX = (i: number) => 20 + i * COL_W + COL_W / 2;
  const centerOf = new Map(m.participants.map((p, i) => [p.id, colX(i)]));
  const rows: Row[] = [];
  let y = FIRST_ROW;
  for (const it of m.items) {
    const h = rowHeight(it);
    rows.push({ y, h });
    y += h;
  }
  const height = y + 40;
  const width = Math.max(1, m.participants.length) * COL_W + 40;

  const frames: Frame[] = [];
  const structure = blockStructure(m.items);
  if (structure) {
    for (const b of structure.values()) {
      const cols = columnsUsed(m, b.start, b.end) ?? [0, Math.max(0, m.participants.length - 1)];
      const inset = b.depth * 8;
      frames.push({
        start: b.start,
        end: b.end,
        depth: b.depth,
        x1: colX(cols[0]) - COL_W / 2 + 8 + inset,
        x2: colX(cols[1]) + COL_W / 2 - 8 - inset,
        y1: rows[b.start].y + 4,
        y2: rows[b.end].y + rows[b.end].h - 4,
        branches: b.branches.map((index) => ({ index, y: rows[index].y + 2 })),
      });
    }
  }

  const activations: Activation[] = [];
  const open = new Map<string, number[]>();
  const push = (actor: string, at: number) => {
    const list = open.get(actor) ?? [];
    list.push(at);
    open.set(actor, list);
  };
  const pop = (actor: string, at: number) => {
    const list = open.get(actor);
    const start = list?.pop();
    if (start !== undefined) activations.push({ actor, y1: start, y2: at, level: list!.length });
  };
  const numbers = new Map<number, number>();
  let autonumber = false;
  let n = 0;
  m.items.forEach((it, i) => {
    const r = rows[i];
    const mid = r.y + r.h - 16;
    if (it.t === 'raw' && /^autonumber\b/.test(it.text)) autonumber = !/\boff\b/.test(it.text);
    if (it.t === 'message') {
      if (autonumber) numbers.set(i, ++n);
      if (it.activate === '+') push(it.to, mid);
      if (it.activate === '-') pop(it.from, mid);
    } else if (it.t === 'activate') push(it.actor, r.y + r.h / 2);
    else if (it.t === 'deactivate') pop(it.actor, r.y + r.h / 2);
  });
  for (const [actor, list] of open) {
    while (list.length) {
      const start = list.pop()!;
      activations.push({ actor, y1: start, y2: height - 30, level: list.length });
    }
  }
  return { colX, centerOf, rows, frames, activations, numbers, width, height };
}

/** Index where an item dropped at world `y` should be inserted. */
export function indexAtY(layout: SeqLayout, y: number): number {
  for (let i = 0; i < layout.rows.length; i++) {
    const r = layout.rows[i];
    if (y < r.y + r.h / 2) return i;
  }
  return layout.rows.length;
}

/** Column index nearest to world `x`. */
export function columnAtX(count: number, x: number): number {
  return Math.max(0, Math.min(count - 1, Math.round((x - 20 - COL_W / 2) / COL_W)));
}
