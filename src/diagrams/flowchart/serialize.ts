import { fmtLabel, indent } from '../common';
import type { FlowEdge, FlowMarker, FlowModel, FlowNode, FlowSubgraph } from './model';
import { CLASSIC_BY_SHAPE, normalizeShape } from './shapes';

const HEAD_CHAR: Record<FlowMarker, string> = { none: '', arrow: '>', circle: 'o', cross: 'x' };
const TAIL_CHAR: Record<FlowMarker, string> = { none: '', arrow: '<', circle: 'o', cross: 'x' };

export function nodeDecl(n: FlowNode): string {
  const classic = CLASSIC_BY_SHAPE[n.shape];
  if (n.syntax === 'at' || !classic) {
    const name = n.shapeName && normalizeShape(n.shapeName) === n.shape ? n.shapeName : n.shape;
    const parts = [`shape: ${name}`];
    if (n.label !== null) parts.push(`label: "${n.label.replace(/"/g, '#quot;')}"`);
    for (const [k, v] of n.props) parts.push(`${k}: ${v}`);
    return `${n.id}@{ ${parts.join(', ')} }`;
  }
  if (n.label === null && n.shape === 'rect') return n.id;
  return n.id + classic.open + fmtLabel(n.label ?? n.id) + classic.close;
}

export function linkToken(e: FlowEdge): string {
  const L = Math.max(1, Math.round(e.length) || 1);
  const tail = TAIL_CHAR[e.tail];
  const head = HEAD_CHAR[e.head];
  switch (e.line) {
    case 'thick':
      return tail + '='.repeat(L + 1) + (head || '=');
    case 'dotted':
      return tail + '-' + '.'.repeat(L) + '-' + head;
    case 'invisible':
      return '~'.repeat(L + 2);
    default:
      return tail + '-'.repeat(L + 1) + (head || '-');
  }
}

function hasDecoration(n: FlowNode): boolean {
  return n.label !== null || n.shape !== 'rect' || n.syntax === 'at';
}

function subgraphHeader(sg: FlowSubgraph): string {
  if (sg.implicitId) return `subgraph "${(sg.title ?? '').replace(/"/g, '#quot;')}"`;
  if (sg.title !== null && sg.title !== sg.id) return `subgraph ${sg.id} [${fmtLabel(sg.title)}]`;
  return `subgraph ${sg.id}`;
}

export function serializeFlowchart(m: FlowModel): { header: string; body: string[] } {
  const header = m.keyword + (m.direction ? ` ${m.direction}` : '');
  const body: string[] = [...m.extras];
  const nodeById = new Map(m.nodes.map((n) => [n.id, n]));
  const sgIds = new Set(m.subgraphs.map((s) => s.id));
  const parentOf = (p: string | null) => (p && sgIds.has(p) ? p : null);
  const referenced = new Set(m.edges.flatMap((e) => [e.from, e.to]));

  // A node's shape and label are written where it is first mentioned.
  const written = new Set<string>();
  const mention = (id: string): string => {
    const n = nodeById.get(id);
    if (!n || written.has(id)) return id;
    written.add(id);
    return nodeDecl(n);
  };

  /** Order in which edges are written; linkStyle indexes follow it. */
  const order: FlowEdge[] = [];
  const edgeLine = (e: FlowEdge): string => {
    order.push(e);
    const id = e.edgeId ? `${e.edgeId}@` : '';
    const label = e.label && e.line !== 'invisible' ? `|${fmtLabel(e.label)}|` : '';
    const from = mention(e.from);
    return `${from} ${id}${linkToken(e)}${label} ${mention(e.to)}`;
  };

  // Edges between two direct members of a subgraph are written inside its block;
  // every other edge is written at the top level. Edges keep their source order:
  // a block is written where its first internal edge appears.
  const scopeOf = (e: FlowEdge): string | null => {
    if (sgIds.has(e.from) || sgIds.has(e.to)) return null;
    const a = parentOf(nodeById.get(e.from)?.parent ?? null);
    const b = parentOf(nodeById.get(e.to)?.parent ?? null);
    return a === b ? a : null;
  };
  const sgParent = new Map(m.subgraphs.map((sg) => [sg.id, parentOf(sg.parent)]));
  /** Child of `scope` on the way down to `sg` (or null when `sg` is not below `scope`). */
  const childToward = (scope: string | null, sg: string | null): string | null => {
    let cur = sg;
    for (let guard = 0; cur && guard < 100; guard++) {
      const p = sgParent.get(cur) ?? null;
      if (p === scope) return cur;
      cur = p;
    }
    return null;
  };

  const emitted = new Set<string>();
  const writeScope = (scope: string | null): string[] => {
    const lines: string[] = [];
    const internal = m.edges.filter((e) => scopeOf(e) === scope);
    const used = new Set(internal.flatMap((e) => [e.from, e.to]));
    for (const n of m.nodes) {
      if (parentOf(n.parent) !== scope || used.has(n.id)) continue;
      if (scope !== null || hasDecoration(n) || !referenced.has(n.id)) lines.push(mention(n.id));
    }
    const writeBlock = (id: string) => {
      if (emitted.has(id)) return;
      emitted.add(id);
      const sg = m.subgraphs.find((x) => x.id === id)!;
      const inner = [...(sg.direction ? [`direction ${sg.direction}`] : []), ...writeScope(id)];
      lines.push(subgraphHeader(sg), ...indent(inner), 'end');
    };
    for (const e of m.edges) {
      const sc = scopeOf(e);
      if (sc === scope) lines.push(edgeLine(e));
      else {
        const child = childToward(scope, sc);
        if (child) writeBlock(child);
      }
    }
    for (const sg of m.subgraphs) if (parentOf(sg.parent) === scope) writeBlock(sg.id);
    return lines;
  };
  body.push(...writeScope(null));
  for (const e of m.edges) if (e.edgeId && e.props) body.push(`${e.edgeId}@{ ${e.props} }`);

  for (const cd of m.classDefs) body.push(`classDef ${cd.names} ${cd.style}`);

  const byClass = new Map<string, string[]>();
  for (const item of [...m.nodes, ...m.subgraphs]) {
    for (const c of item.classes) {
      if (!byClass.has(c)) byClass.set(c, []);
      byClass.get(c)!.push(item.id);
    }
  }
  for (const [cls, ids] of byClass) body.push(`class ${ids.join(',')} ${cls}`);

  for (const item of [...m.nodes, ...m.subgraphs]) {
    if (item.style) body.push(`style ${item.id} ${item.style}`);
  }

  if (m.linkStyleDefault) body.push(`linkStyle default ${m.linkStyleDefault}`);
  const byStyle = new Map<string, number[]>();
  order.forEach((e, i) => {
    if (!e.style) return;
    if (!byStyle.has(e.style)) byStyle.set(e.style, []);
    byStyle.get(e.style)!.push(i);
  });
  for (const [style, idx] of byStyle) body.push(`linkStyle ${idx.join(',')} ${style}`);

  for (const n of m.nodes) if (n.click) body.push(`click ${n.id} ${n.click}`);

  return { header, body: indent(body) };
}
