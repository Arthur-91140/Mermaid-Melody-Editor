import dagre from '@dagrejs/dagre';
import type { Layout, Pos } from '../../store/documents';
import { boxesOverlap, type Box } from './geometry';

export type RankDir = 'TB' | 'BT' | 'LR' | 'RL';

export interface LayoutItem {
  id: string;
  width: number;
  height: number;
  /** Group containing the item. */
  parent?: string | null;
  isGroup?: boolean;
}

export interface LayoutLink {
  source: string;
  target: string;
}

export function toRankDir(direction: string | null | undefined): RankDir {
  switch ((direction ?? '').toUpperCase()) {
    case 'LR':
    case '>':
      return 'LR';
    case 'RL':
    case '<':
      return 'RL';
    case 'BT':
    case '^':
      return 'BT';
    default:
      return 'TB';
  }
}

/** Full automatic layout (top-left positions of every non-group item). */
export function autoLayout(items: LayoutItem[], links: LayoutLink[], dir: RankDir, spacing = 1): Layout {
  const g = new dagre.graphlib.Graph({ compound: true, multigraph: true });
  g.setGraph({ rankdir: dir, nodesep: 46 * spacing, ranksep: 64 * spacing, edgesep: 20, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));
  const groups = new Set(items.filter((i) => i.isGroup).map((i) => i.id));
  for (const it of items) {
    if (it.isGroup) g.setNode(it.id, { paddingTop: 36 });
    else g.setNode(it.id, { width: it.width, height: it.height });
  }
  for (const it of items) {
    if (it.parent && groups.has(it.parent) && g.hasNode(it.parent)) g.setParent(it.id, it.parent);
  }
  links.forEach((l, i) => {
    // Dagre cannot route edges to clusters; those edges do not influence the layout.
    if (groups.has(l.source) || groups.has(l.target)) return;
    if (!g.hasNode(l.source) || !g.hasNode(l.target)) return;
    g.setEdge(l.source, l.target, { minlen: 1 }, `e${i}`);
  });
  dagre.layout(g);
  const out: Layout = {};
  for (const it of items) {
    if (it.isGroup) continue;
    const n = g.node(it.id) as { x: number; y: number; width: number; height: number } | undefined;
    if (n) out[it.id] = { x: Math.round(n.x - it.width / 2), y: Math.round(n.y - it.height / 2) };
  }
  return out;
}

/**
 * Places items that have no saved position next to a connected item (in the
 * flow direction), or after everything else, without overlapping.
 */
export function placeMissing(items: LayoutItem[], links: LayoutLink[], layout: Layout, dir: RankDir): Layout {
  const out: Layout = { ...layout };
  const leaves = items.filter((i) => !i.isGroup);
  const missing = leaves.filter((i) => !out[i.id]);
  if (!missing.length) return out;
  const size = new Map(leaves.map((i) => [i.id, i]));
  const boxes = (): Box[] =>
    leaves.filter((i) => out[i.id]).map((i) => ({ x: out[i.id].x, y: out[i.id].y, w: i.width, h: i.height }));

  if (missing.length === leaves.length) return { ...out, ...autoLayout(items, links, dir) };

  const horizontal = dir === 'LR' || dir === 'RL';
  const forward = dir === 'TB' || dir === 'LR' ? 1 : -1;
  for (const it of missing) {
    const neighbor = links
      .flatMap((l) => (l.target === it.id ? [l.source] : l.source === it.id ? [l.target] : []))
      .find((id) => out[id] && size.has(id));
    let pos: Pos;
    if (neighbor) {
      const n = out[neighbor];
      const ns = size.get(neighbor)!;
      const isTarget = links.some((l) => l.source === neighbor && l.target === it.id);
      const step = isTarget ? forward : -forward;
      pos = horizontal
        ? { x: n.x + step * (step > 0 ? ns.width + 70 : it.width + 70), y: n.y + (ns.height - it.height) / 2 }
        : { x: n.x + (ns.width - it.width) / 2, y: n.y + step * (step > 0 ? ns.height + 60 : it.height + 60) };
    } else {
      const all = boxes();
      const maxX = Math.max(...all.map((b) => b.x + b.w));
      const maxY = Math.max(...all.map((b) => b.y + b.h));
      const minX = Math.min(...all.map((b) => b.x));
      const minY = Math.min(...all.map((b) => b.y));
      pos = horizontal ? { x: minX, y: maxY + 60 } : { x: maxX + 70, y: minY };
    }
    // Slide sideways until the spot is free.
    const existing = boxes();
    for (let k = 0; k < 60; k++) {
      const b = { x: pos.x, y: pos.y, w: it.width, h: it.height };
      if (!existing.some((e) => boxesOverlap(b, e, 16))) break;
      if (horizontal) pos = { ...pos, y: pos.y + it.height + 30 };
      else pos = { ...pos, x: pos.x + it.width + 40 };
    }
    out[it.id] = { x: Math.round(pos.x), y: Math.round(pos.y) };
  }
  return out;
}
