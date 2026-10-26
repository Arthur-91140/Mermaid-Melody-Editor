import type { MindNode } from '../../diagrams/mindmap/model';
import { mindDisplayText } from '../../diagrams/mindmap/model';
import { estimateText } from '../graph/geometry';

export interface MindPlacement {
  x: number;
  y: number;
  w: number;
  h: number;
  side: 'root' | 'left' | 'right';
  depth: number;
  /** Index of the root child this node descends from (for colors). */
  branch: number;
}

const H_GAP = 56;
const V_GAP = 14;

export function mindSize(n: MindNode, depth: number): { w: number; h: number } {
  const t = estimateText(mindDisplayText(n), depth === 0 ? 8.4 : 7.4, depth === 0 ? 20 : 18);
  const pad = n.shape === 'circle' ? 34 : n.shape === 'cloud' || n.shape === 'bang' ? 40 : n.shape === 'hexagon' ? 44 : 28;
  let w = Math.max(depth === 0 ? 90 : 60, t.w + pad);
  let h = t.h + (n.shape === 'default' ? 12 : 20) + (n.icon ? 18 : 0);
  if (n.shape === 'circle') w = h = Math.max(w, h);
  return { w, h };
}

/** Tree layout with the root in the middle and its branches split to the right then the left. */
export function layoutMind(root: MindNode | null): Map<string, MindPlacement> {
  const out = new Map<string, MindPlacement>();
  if (!root) return out;
  const sizes = new Map<string, { w: number; h: number }>();
  const measure = (n: MindNode, depth: number) => {
    sizes.set(n.key, mindSize(n, depth));
    n.children.forEach((c) => measure(c, depth + 1));
  };
  measure(root, 0);
  const heightOf = new Map<string, number>();
  const subtree = (n: MindNode): number => {
    const own = sizes.get(n.key)!.h;
    const kids = n.children.reduce((s, c) => s + subtree(c), 0) + Math.max(0, n.children.length - 1) * V_GAP;
    const h = Math.max(own, kids);
    heightOf.set(n.key, h);
    return h;
  };
  subtree(root);

  const rs = sizes.get(root.key)!;
  out.set(root.key, { x: -rs.w / 2, y: -rs.h / 2, w: rs.w, h: rs.h, side: 'root', depth: 0, branch: -1 });

  const place = (n: MindNode, parentEdgeX: number, centerY: number, side: 'left' | 'right', depth: number, branch: number) => {
    const s = sizes.get(n.key)!;
    const x = side === 'right' ? parentEdgeX + H_GAP : parentEdgeX - H_GAP - s.w;
    out.set(n.key, { x, y: centerY - s.h / 2, w: s.w, h: s.h, side, depth, branch });
    const kidsHeight = n.children.reduce((sum, c) => sum + heightOf.get(c.key)!, 0) + Math.max(0, n.children.length - 1) * V_GAP;
    let y = centerY - kidsHeight / 2;
    for (const c of n.children) {
      const h = heightOf.get(c.key)!;
      place(c, side === 'right' ? x + s.w : x, y + h / 2, side, depth + 1, branch);
      y += h + V_GAP;
    }
  };

  const half = Math.ceil(root.children.length / 2);
  const sides: [MindNode[], 'right' | 'left'][] = [
    [root.children.slice(0, half), 'right'],
    [root.children.slice(half), 'left'],
  ];
  for (const [kids, side] of sides) {
    const total = kids.reduce((s, c) => s + heightOf.get(c.key)!, 0) + Math.max(0, kids.length - 1) * V_GAP * 2;
    let y = -total / 2;
    for (const c of kids) {
      const h = heightOf.get(c.key)!;
      const branch = root.children.indexOf(c);
      place(c, side === 'right' ? rs.w / 2 : -rs.w / 2, y + h / 2, side, 1, branch);
      y += h + V_GAP * 2;
    }
  }
  return out;
}
