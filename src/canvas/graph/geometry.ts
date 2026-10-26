export type Boundary = 'rect' | 'ellipse' | 'diamond';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

export const center = (b: Box): Point => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/** Point where the segment from the box center towards `toward` leaves the shape. */
export function boundaryPoint(b: Box, shape: Boundary, toward: Point): Point {
  const c = center(b);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const hw = Math.max(1, b.w / 2);
  const hh = Math.max(1, b.h / 2);
  let t: number;
  if (shape === 'ellipse') t = 1 / Math.sqrt((dx * dx) / (hw * hw) + (dy * dy) / (hh * hh));
  else if (shape === 'diamond') t = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh);
  else t = Math.min(hw / Math.abs(dx || 1e-9), hh / Math.abs(dy || 1e-9));
  return { x: c.x + dx * t, y: c.y + dy * t };
}

export interface EdgeGeometry {
  path: string;
  /** Point used for the main label. */
  mid: Point;
  start: Point;
  end: Point;
  /** Points near each end, for cardinality labels. */
  nearStart: Point;
  nearEnd: Point;
}

function quadAt(p0: Point, c: Point, p1: Point, t: number): Point {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x, y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y };
}

/**
 * Builds a path between two shapes. `bend` offsets the curve sideways so that
 * parallel edges between the same pair stay distinguishable.
 */
export function edgeGeometry(a: Box, aShape: Boundary, b: Box, bShape: Boundary, bend: number): EdgeGeometry {
  if (a === b || (a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h)) return selfLoop(a, bend);
  const ca = center(a);
  const cb = center(b);
  const dx = cb.x - ca.x;
  const dy = cb.y - ca.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const ctrl = { x: (ca.x + cb.x) / 2 + nx * bend, y: (ca.y + cb.y) / 2 + ny * bend };
  const start = boundaryPoint(a, aShape, bend ? ctrl : cb);
  const end = boundaryPoint(b, bShape, bend ? ctrl : ca);
  if (!bend) {
    const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    return {
      path: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
      mid,
      start,
      end,
      nearStart: lerp(start, end, Math.min(0.5, 22 / dist(start, end))),
      nearEnd: lerp(end, start, Math.min(0.5, 22 / dist(start, end))),
    };
  }
  // Control point so that the curve passes through `ctrl` at t = 0.5.
  const c = { x: 2 * ctrl.x - (start.x + end.x) / 2, y: 2 * ctrl.y - (start.y + end.y) / 2 };
  return {
    path: `M ${start.x} ${start.y} Q ${c.x} ${c.y} ${end.x} ${end.y}`,
    mid: quadAt(start, c, end, 0.5),
    start,
    end,
    nearStart: quadAt(start, c, end, 0.12),
    nearEnd: quadAt(start, c, end, 0.88),
  };
}

function selfLoop(b: Box, bend: number): EdgeGeometry {
  const size = 34 + Math.abs(bend) * 0.4;
  const start = { x: b.x + b.w * 0.75, y: b.y };
  const end = { x: b.x + b.w, y: b.y + b.h * 0.25 };
  const c1 = { x: start.x, y: start.y - size };
  const c2 = { x: end.x + size, y: end.y };
  return {
    path: `M ${start.x} ${start.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${end.x} ${end.y}`,
    mid: { x: b.x + b.w + size * 0.55, y: b.y - size * 0.55 },
    start,
    end,
    nearStart: { x: start.x - 10, y: start.y - 14 },
    nearEnd: { x: end.x + 14, y: end.y + 10 },
  };
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) || 1;
const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export function boxesOverlap(a: Box, b: Box, margin = 0): boolean {
  return a.x < b.x + b.w + margin && b.x < a.x + a.w + margin && a.y < b.y + b.h + margin && b.y < a.y + a.h + margin;
}

export function containsPoint(b: Box, p: Point): boolean {
  return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
}

/** Rough text size, used before the DOM has measured a node. */
export function estimateText(text: string, charWidth = 7.4, lineHeight = 18): { w: number; h: number } {
  const lines = text.split('\n');
  const longest = Math.max(1, ...lines.map((l) => l.length));
  return { w: Math.min(320, longest * charWidth), h: lines.length * lineHeight };
}
