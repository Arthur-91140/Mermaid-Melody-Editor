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

function edgeLine(e: FlowEdge): string {
  const id = e.edgeId ? `${e.edgeId}@` : '';
  const label = e.label && e.line !== 'invisible' ? `|${fmtLabel(e.label)}|` : '';
  return `${e.from} ${id}${linkToken(e)}${label} ${e.to}`;
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

  const referenced = new Set<string>();
  for (const e of m.edges) {
    referenced.add(e.from);
    referenced.add(e.to);
  }

  for (const n of m.nodes) {
    if (n.parent === null && (hasDecoration(n) || !referenced.has(n.id))) body.push(nodeDecl(n));
  }

  const sgIds = new Set(m.subgraphs.map((s) => s.id));
  const writeSubgraph = (sg: FlowSubgraph, seen: Set<string>): string[] => {
    if (seen.has(sg.id)) return [];
    seen.add(sg.id);
    const inner: string[] = [];
    if (sg.direction) inner.push(`direction ${sg.direction}`);
    for (const n of m.nodes) if (n.parent === sg.id) inner.push(nodeDecl(n));
    for (const child of m.subgraphs) {
      if (child.parent === sg.id) inner.push(...writeSubgraph(child, seen));
    }
    return [subgraphHeader(sg), ...indent(inner), 'end'];
  };
  const seen = new Set<string>();
  for (const sg of m.subgraphs) {
    if (sg.parent === null || !sgIds.has(sg.parent)) body.push(...writeSubgraph(sg, seen));
  }

  for (const e of m.edges) body.push(edgeLine(e));
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
  m.edges.forEach((e, i) => {
    if (!e.style) return;
    if (!byStyle.has(e.style)) byStyle.set(e.style, []);
    byStyle.get(e.style)!.push(i);
  });
  for (const [style, idx] of byStyle) body.push(`linkStyle ${idx.join(',')} ${style}`);

  for (const n of m.nodes) if (n.click) body.push(`click ${n.id} ${n.click}`);

  return { header, body: indent(body) };
}
