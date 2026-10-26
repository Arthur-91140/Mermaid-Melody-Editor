import { boundaryPoint, type Boundary, type Box, type Point } from '../canvas/graph/geometry';
import { PREVIEW_KEY, type Layout } from '../store/documents';

/** How elements relate, so that moved elements stay connected. */
export interface Structure {
  /** Edges: canvas id of the edge (annotated path and label) and of its two ends. */
  edges: { id: string; from: string; to: string }[];
  /** Groups (subgraphs, composite states, namespaces) with their direct members. */
  clusters: { id: string; members: string[] }[];
}

const TRANSLATE = /translate\(\s*(-?[\d.e+-]+)[\s,]+(-?[\d.e+-]+)\s*\)/;

export function getTranslate(el: Element): Point {
  const m = TRANSLATE.exec(el.getAttribute('transform') ?? '');
  return m ? { x: Number(m[1]), y: Number(m[2]) } : { x: 0, y: 0 };
}

export function setTranslate(el: Element, p: Point) {
  const tf = el.getAttribute('transform') ?? '';
  const next = `translate(${round(p.x)}, ${round(p.y)})`;
  el.setAttribute('transform', TRANSLATE.test(tf) ? tf.replace(TRANSLATE, next) : `${next} ${tf}`.trim());
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Elements that can be moved: Mermaid node groups tagged with a canvas id. */
export function nodeElements(svg: SVGSVGElement): Map<string, SVGGElement> {
  const out = new Map<string, SVGGElement>();
  svg.querySelectorAll<SVGGElement>('g.node[data-mme]').forEach((g) => {
    const id = g.getAttribute('data-mme')!;
    if (!out.has(id)) out.set(id, g);
  });
  return out;
}

export function clusterElements(svg: SVGSVGElement): Map<string, SVGGElement> {
  const out = new Map<string, SVGGElement>();
  svg.querySelectorAll<SVGGElement>('g.cluster[data-mme], g.statediagram-cluster[data-mme]').forEach((g) => {
    out.set(g.getAttribute('data-mme')!, g);
  });
  return out;
}

/** Size of a node as Mermaid drew it, before any resizing. */
export function naturalSize(g: SVGGElement): { w: number; h: number } {
  if (!g.hasAttribute('data-mme-w0')) {
    const b = g.getBBox();
    g.setAttribute('data-mme-w0', String(b.width));
    g.setAttribute('data-mme-h0', String(b.height));
  }
  return { w: Number(g.getAttribute('data-mme-w0')), h: Number(g.getAttribute('data-mme-h0')) };
}

const isLabelPart = (el: Element) =>
  el.classList.contains('label') ||
  el.classList.contains('text') ||
  el.classList.contains('mme-hit') ||
  el.tagName === 'text' ||
  el.tagName === 'foreignObject';

/** Scales the shape of a node (not its text) around its center. */
function scaleShape(g: SVGGElement, sx: number, sy: number) {
  for (const child of Array.from(g.children)) {
    if (isLabelPart(child)) continue;
    if (!child.hasAttribute('data-mme-tf')) child.setAttribute('data-mme-tf', child.getAttribute('transform') ?? '');
    const base = child.getAttribute('data-mme-tf') ?? '';
    const scale = sx === 1 && sy === 1 ? '' : `scale(${round(sx)}, ${round(sy)})`;
    const tf = `${scale} ${base}`.trim();
    if (tf) child.setAttribute('transform', tf);
    else child.removeAttribute('transform');
    // Borders keep their width when the shape grows or shrinks.
    for (const el of [child, ...Array.from(child.querySelectorAll('*'))]) {
      if (scale) el.setAttribute('vector-effect', 'non-scaling-stroke');
      else el.removeAttribute('vector-effect');
    }
  }
}

/** Box of a node in the drawing's coordinates. */
export function nodeBox(g: SVGGElement): Box {
  const t = getTranslate(g);
  const b = g.getBBox();
  return { x: t.x + b.x, y: t.y + b.y, w: b.width, h: b.height };
}

export function clusterBox(g: SVGGElement): Box | null {
  const r = g.querySelector('rect.outer') ?? g.querySelector(':scope > rect');
  if (!r) return null;
  return {
    x: Number(r.getAttribute('x')),
    y: Number(r.getAttribute('y')),
    w: Number(r.getAttribute('width')),
    h: Number(r.getAttribute('height')),
  };
}

function shapeOf(g: SVGGElement): Boundary {
  if (g.querySelector(':scope > circle, :scope > ellipse')) return 'ellipse';
  const poly = g.querySelector(':scope > polygon');
  if (poly && (poly.getAttribute('points') ?? '').trim().split(/\s+/).length === 4) return 'diamond';
  return 'rect';
}

/** Moves a cluster's frame and title so that it wraps `box`. */
function setClusterBox(g: SVGGElement, box: Box) {
  const outer = g.querySelector('rect.outer') ?? g.querySelector(':scope > rect');
  if (!outer) return;
  const old = clusterBox(g)!;
  outer.setAttribute('x', String(round(box.x)));
  outer.setAttribute('y', String(round(box.y)));
  outer.setAttribute('width', String(round(box.w)));
  outer.setAttribute('height', String(round(box.h)));
  const inner = g.querySelector('rect.inner');
  if (inner) {
    const top = Number(inner.getAttribute('y')) - old.y;
    inner.setAttribute('x', String(round(box.x)));
    inner.setAttribute('y', String(round(box.y + top)));
    inner.setAttribute('width', String(round(box.w)));
    inner.setAttribute('height', String(round(Math.max(0, box.h - top - (old.h - top - Number(inner.getAttribute('height')))))));
  }
  const label = g.querySelector('.cluster-label');
  if (label) {
    const t = getTranslate(label);
    setTranslate(label, { x: t.x + (box.x + box.w / 2) - (old.x + old.w / 2), y: t.y + box.y - old.y });
  }
}

function pathEnds(d: string): { start: Point; end: Point } | null {
  const nums = (d.match(/-?[\d.]+(?:e[-+]?\d+)?/gi) ?? []).map(Number);
  if (nums.length < 4) return null;
  return { start: { x: nums[0], y: nums[1] }, end: { x: nums[nums.length - 2], y: nums[nums.length - 1] } };
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Gap Mermaid leaves at each end of a path for its arrow markers. */
function markerGaps(path: SVGPathElement): { start: number; end: number } {
  if (!path.hasAttribute('data-mme-gap')) {
    let start = 0;
    let end = 0;
    try {
      const pts = JSON.parse(atob(path.getAttribute('data-points') ?? '')) as Point[];
      const ends = pathEnds(path.getAttribute('d') ?? '');
      if (pts.length && ends) {
        start = Math.min(12, dist(pts[0], ends.start));
        end = Math.min(12, dist(pts[pts.length - 1], ends.end));
      }
    } catch {
      /* no layout points: no gap */
    }
    path.setAttribute('data-mme-gap', `${start},${end}`);
  }
  const [start, end] = path.getAttribute('data-mme-gap')!.split(',').map(Number);
  return { start, end };
}

function sidePoint(b: Box, toward: Point, vertical: boolean): Point {
  const c = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  if (vertical) return { x: c.x, y: toward.y > c.y ? b.y + b.h : b.y };
  return { x: toward.x > c.x ? b.x + b.w : b.x, y: c.y };
}

const toward = (from: Point, to: Point, d: number): Point => {
  const l = dist(from, to) || 1;
  return { x: from.x + ((to.x - from.x) / l) * d, y: from.y + ((to.y - from.y) / l) * d };
};

/** Redraws an edge between two boxes, Mermaid-style (leaving and entering along the main axis). */
function reroute(path: SVGPathElement, a: Box, aShape: Boundary, b: Box, bShape: Boundary): { mid: Point; oldEnds: { start: Point; end: Point } | null; ends: { start: Point; end: Point } } {
  const oldEnds = pathEnds(path.getAttribute('d') ?? '');
  const gaps = markerGaps(path);
  const ca = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const cb = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const overlapX = a.x < b.x + b.w && b.x < a.x + a.w;
  const overlapY = a.y < b.y + b.h && b.y < a.y + a.h;
  const vertical = overlapX && !overlapY ? true : overlapY && !overlapX ? false : Math.abs(cb.y - ca.y) >= Math.abs(cb.x - ca.x);
  let s = aShape === 'rect' ? sidePoint(a, cb, vertical) : boundaryPoint(a, aShape, vertical ? { x: ca.x, y: cb.y } : { x: cb.x, y: ca.y });
  let e = bShape === 'rect' ? sidePoint(b, ca, vertical) : boundaryPoint(b, bShape, vertical ? { x: cb.x, y: ca.y } : { x: ca.x, y: cb.y });
  const c1 = vertical ? { x: s.x, y: (s.y + e.y) / 2 } : { x: (s.x + e.x) / 2, y: s.y };
  const c2 = vertical ? { x: e.x, y: (s.y + e.y) / 2 } : { x: (s.x + e.x) / 2, y: e.y };
  if (gaps.start) s = toward(s, c1, gaps.start);
  if (gaps.end) e = toward(e, c2, gaps.end);
  path.setAttribute('d', `M${round(s.x)},${round(s.y)} C${round(c1.x)},${round(c1.y)} ${round(c2.x)},${round(c2.y)} ${round(e.x)},${round(e.y)}`);
  const mid = { x: (s.x + 3 * c1.x + 3 * c2.x + e.x) / 8, y: (s.y + 3 * c1.y + 3 * c2.y + e.y) / 8 };
  return { mid, oldEnds, ends: { start: s, end: e } };
}

/** Saves some attributes the first time, and puts them back on later passes (so that passes do not pile up). */
function restore(el: Element, attrs: string[]) {
  const saved = el.getAttribute('data-mme-orig');
  if (saved) {
    const orig = JSON.parse(saved) as Record<string, string | null>;
    for (const a of attrs) {
      if (orig[a] == null) el.removeAttribute(a);
      else el.setAttribute(a, orig[a]!);
    }
    return;
  }
  const orig: Record<string, string | null> = {};
  for (const a of attrs) orig[a] = el.getAttribute(a);
  el.setAttribute('data-mme-orig', JSON.stringify(orig));
}

function restoreAll(svg: SVGSVGElement) {
  restore(svg, ['viewBox', 'width', 'height']);
  svg.querySelectorAll('path[data-mme], path[data-mme-link]').forEach((p) => restore(p, ['d']));
  svg.querySelectorAll('g.edgeLabel, g.edgeTerminals, .cluster-label').forEach((g) => restore(g, ['transform']));
  svg.querySelectorAll('g.cluster > rect, g.statediagram-cluster rect').forEach((r) => restore(r, ['x', 'y', 'width', 'height']));
}

export interface ApplyOptions {
  /** Refit the drawing's viewBox to its content (not while dragging). */
  fit?: boolean;
}

/**
 * Applies the positions and sizes saved for the preview to Mermaid's drawing.
 * It can be called again on the same drawing (e.g. while dragging).
 * Returns the ids of the elements that were changed.
 */
export function applyManualLayout(svg: SVGSVGElement, structure: Structure, layout: Layout, opts: ApplyOptions = {}): Set<string> {
  restoreAll(svg);
  const nodes = nodeElements(svg);
  const clusters = clusterElements(svg);
  const changed = new Set<string>();

  for (const [id, g] of nodes) {
    const pos = layout[PREVIEW_KEY + id];
    const natural = naturalSize(g);
    if (!natural.w) continue;
    const sx = pos?.w ? pos.w / natural.w : 1;
    const sy = pos?.h ? pos.h / natural.h : 1;
    scaleShape(g, sx, sy);
    if (!g.hasAttribute('data-mme-t0')) {
      const t = getTranslate(g);
      g.setAttribute('data-mme-t0', `${t.x},${t.y}`);
    }
    const [x0, y0] = g.getAttribute('data-mme-t0')!.split(',').map(Number);
    setTranslate(g, pos ? { x: pos.x, y: pos.y } : { x: x0, y: y0 });
    if (pos) changed.add(id);
  }

  // Groups wrap their members again, innermost first.
  const depth = (id: string, seen = new Set<string>()): number => {
    const parent = structure.clusters.find((c) => c.members.includes(id));
    if (!parent || seen.has(parent.id)) return 0;
    seen.add(parent.id);
    return 1 + depth(parent.id, seen);
  };
  const ordered = [...structure.clusters].sort((a, b) => depth(b.id) - depth(a.id));
  for (const c of ordered) {
    const g = clusters.get(c.id);
    if (!g || !c.members.some((m) => changed.has(m))) continue;
    const boxes = c.members
      .map((m) => (nodes.get(m) ? nodeBox(nodes.get(m)!) : clusters.get(m) ? clusterBox(clusters.get(m)!) : null))
      .filter((b): b is Box => !!b && b.w > 0);
    if (!boxes.length) continue;
    const label = g.querySelector('.cluster-label') as SVGGElement | null;
    const top = (label?.getBBox().height ?? 16) + 12;
    const x1 = Math.min(...boxes.map((b) => b.x)) - 12;
    const y1 = Math.min(...boxes.map((b) => b.y)) - top;
    const x2 = Math.max(...boxes.map((b) => b.x + b.w)) + 12;
    const y2 = Math.max(...boxes.map((b) => b.y + b.h)) + 12;
    setClusterBox(g, { x: x1, y: y1, w: Math.max(x2 - x1, label?.getBBox().width ?? 0), h: y2 - y1 });
    changed.add(c.id);
  }

  const boxOf = (id: string): { box: Box; shape: Boundary } | null => {
    const n = nodes.get(id);
    if (n) return { box: nodeBox(n), shape: shapeOf(n) };
    const c = clusters.get(id);
    const b = c ? clusterBox(c) : null;
    return b ? { box: b, shape: 'rect' } : null;
  };

  const terminals = Array.from(svg.querySelectorAll<SVGGElement>('g.edgeTerminals'));
  for (const e of structure.edges) {
    if (!changed.has(e.from) && !changed.has(e.to)) continue;
    if (e.from === e.to) continue;
    const path = svg.querySelector<SVGPathElement>(`path[data-mme="${CSS.escape(e.id)}"], path[data-mme-link="${CSS.escape(e.id)}"]`);
    const a = boxOf(e.from);
    const b = boxOf(e.to);
    if (!path || !a || !b) continue;
    const { mid, oldEnds, ends } = reroute(path, a.box, a.shape, b.box, b.shape);
    svg.querySelectorAll(`g.edgeLabel[data-mme="${CSS.escape(e.id)}"], g.edgeLabel[data-mme-link="${CSS.escape(e.id)}"]`).forEach((l) => setTranslate(l, mid));
    if (oldEnds) {
      // Cardinalities sit near the ends of the edge: they follow them.
      for (const t of terminals) {
        const p = getTranslate(t);
        for (const [from, to] of [
          [oldEnds.start, ends.start],
          [oldEnds.end, ends.end],
        ] as const) {
          if (dist(p, from) < 45) {
            setTranslate(t, { x: p.x + to.x - from.x, y: p.y + to.y - from.y });
            break;
          }
        }
      }
    }
  }

  if (opts.fit && changed.size) fitViewBox(svg);
  return changed;
}

/** Makes the drawing's viewBox wrap all its content. */
export function fitViewBox(svg: SVGSVGElement) {
  const root = svg.querySelector(':scope > g') as SVGGElement | null;
  if (!root) return;
  const b = root.getBBox();
  if (!b.width || !b.height) return;
  const pad = 8;
  svg.setAttribute('viewBox', `${round(b.x - pad)} ${round(b.y - pad)} ${round(b.width + pad * 2)} ${round(b.height + pad * 2)}`);
  svg.setAttribute('width', String(round(b.width + pad * 2)));
  svg.setAttribute('height', String(round(b.height + pad * 2)));
}
