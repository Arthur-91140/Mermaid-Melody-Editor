import { emptyFlowEdge, emptyFlowNode, type FlowEdge, type FlowModel, type FlowNode, type FlowSubgraph } from './model';
import { CLASSIC_BY_SHAPE } from './shapes';

export const FLOW_ID_RE = /^[\p{L}\p{N}_][\p{L}\p{N}_-]*$/u;

/** Reserved words that cannot be used as node ids. */
const RESERVED = new Set(['end', 'subgraph', 'graph', 'flowchart', 'style', 'class', 'classDef', 'click', 'linkStyle', 'direction']);

export function isTaken(m: FlowModel, id: string): boolean {
  return RESERVED.has(id) || m.nodes.some((n) => n.id === id) || m.subgraphs.some((s) => s.id === id);
}

/** Next free id in the A, B, ..., Z, A1, B1... sequence. */
export function nextNodeId(m: FlowModel): string {
  for (let round = 0; ; round++) {
    for (let c = 0; c < 26; c++) {
      const id = String.fromCharCode(65 + c) + (round ? String(round) : '');
      if (!isTaken(m, id)) return id;
    }
  }
}

export function nextSubgraphId(m: FlowModel, base = 'group'): string {
  let n = 1;
  while (isTaken(m, `${base}${n}`)) n++;
  return `${base}${n}`;
}

export function addNode(
  m: FlowModel,
  init: Partial<Pick<FlowNode, 'id' | 'label' | 'shape' | 'parent'>> = {},
): { model: FlowModel; id: string } {
  const id = init.id && !isTaken(m, init.id) ? init.id : nextNodeId(m);
  const node: FlowNode = {
    ...emptyFlowNode(id),
    label: init.label ?? null,
    shape: init.shape ?? 'rect',
    syntax: CLASSIC_BY_SHAPE[init.shape ?? 'rect'] ? 'classic' : 'at',
    parent: init.parent ?? null,
  };
  return { model: { ...m, nodes: [...m.nodes, node] }, id };
}

export function addEdge(m: FlowModel, from: string, to: string, patch: Partial<FlowEdge> = {}): FlowModel {
  return { ...m, edges: [...m.edges, { ...emptyFlowEdge(from, to), ...patch }] };
}

export function updateNode(m: FlowModel, id: string, patch: Partial<FlowNode>): FlowModel {
  return { ...m, nodes: m.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) };
}

export function updateSubgraph(m: FlowModel, id: string, patch: Partial<FlowSubgraph>): FlowModel {
  return { ...m, subgraphs: m.subgraphs.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
}

export function updateEdge(m: FlowModel, index: number, patch: Partial<FlowEdge>): FlowModel {
  return { ...m, edges: m.edges.map((e, i) => (i === index ? { ...e, ...patch } : e)) };
}

export function setShape(m: FlowModel, id: string, shape: string): FlowModel {
  return updateNode(m, id, { shape, shapeName: null, syntax: CLASSIC_BY_SHAPE[shape] ? 'classic' : 'at' });
}

/** Renames a node or subgraph id everywhere it is referenced. */
export function renameId(m: FlowModel, from: string, to: string): FlowModel {
  if (from === to || isTaken(m, to)) return m;
  const r = (id: string) => (id === from ? to : id);
  return {
    ...m,
    nodes: m.nodes.map((n) => ({ ...n, id: r(n.id), parent: n.parent && r(n.parent) })),
    subgraphs: m.subgraphs.map((s) => ({ ...s, id: r(s.id), parent: s.parent && r(s.parent), implicitId: s.id === from ? false : s.implicitId })),
    edges: m.edges.map((e) => ({ ...e, from: r(e.from), to: r(e.to) })),
  };
}

function subgraphDescendants(m: FlowModel, id: string): Set<string> {
  const out = new Set<string>();
  const visit = (sid: string) => {
    for (const s of m.subgraphs) {
      if (s.parent === sid && !out.has(s.id)) {
        out.add(s.id);
        visit(s.id);
      }
    }
  };
  visit(id);
  return out;
}

/** Moves nodes/subgraphs into `group` (or to the top level), refusing cycles. */
export function reparent(m: FlowModel, ids: string[], group: string | null): FlowModel {
  const set = new Set(ids);
  return {
    ...m,
    nodes: m.nodes.map((n) => (set.has(n.id) ? { ...n, parent: group } : n)),
    subgraphs: m.subgraphs.map((s) => {
      if (!set.has(s.id)) return s;
      if (group && (group === s.id || subgraphDescendants(m, s.id).has(group))) return s;
      return { ...s, parent: group };
    }),
  };
}

/**
 * Deletes nodes (with their links), links by index, and subgraphs. A deleted
 * subgraph hands its content over to its own parent.
 */
export function deleteItems(m: FlowModel, nodeIds: string[], subgraphIds: string[], edgeIndexes: number[]): FlowModel {
  const nodes = new Set(nodeIds);
  const sgs = new Set(subgraphIds);
  const edges = new Set(edgeIndexes);
  const parentOf = new Map(m.subgraphs.map((s) => [s.id, s.parent]));
  const lift = (p: string | null): string | null => {
    let cur = p;
    while (cur && sgs.has(cur)) cur = parentOf.get(cur) ?? null;
    return cur;
  };
  return {
    ...m,
    nodes: m.nodes.filter((n) => !nodes.has(n.id)).map((n) => ({ ...n, parent: lift(n.parent) })),
    subgraphs: m.subgraphs.filter((s) => !sgs.has(s.id)).map((s) => ({ ...s, parent: lift(s.parent) })),
    edges: m.edges.filter(
      (e, i) => !edges.has(i) && !nodes.has(e.from) && !nodes.has(e.to) && !sgs.has(e.from) && !sgs.has(e.to),
    ),
  };
}

/** Wraps items in a new subgraph placed in their common parent. */
export function groupItems(m: FlowModel, ids: string[], title: string): { model: FlowModel; id: string } {
  const id = nextSubgraphId(m);
  const parents = new Set(
    ids.map((x) => m.nodes.find((n) => n.id === x)?.parent ?? m.subgraphs.find((s) => s.id === x)?.parent ?? null),
  );
  const parent = parents.size === 1 ? [...parents][0] : null;
  const sg: FlowSubgraph = { id, title, implicitId: false, direction: null, parent, classes: [], style: null };
  return { model: reparent({ ...m, subgraphs: [...m.subgraphs, sg] }, ids, id), id };
}

/** Copies nodes (and the links between them); returns the id mapping. */
export function duplicateNodes(m: FlowModel, ids: string[]): { model: FlowModel; mapping: Map<string, string> } {
  let model = m;
  const mapping = new Map<string, string>();
  for (const id of ids) {
    const src = m.nodes.find((n) => n.id === id);
    if (!src) continue;
    const res = addNode(model, { shape: src.shape, label: src.label ?? src.id, parent: src.parent });
    model = updateNode(res.model, res.id, {
      syntax: src.syntax,
      shapeName: src.shapeName,
      props: src.props,
      classes: [...src.classes],
      style: src.style,
    });
    mapping.set(id, res.id);
  }
  for (const e of m.edges) {
    const from = mapping.get(e.from);
    const to = mapping.get(e.to);
    if (from && to) model = addEdge(model, from, to, { ...e, from, to, edgeId: null, props: null });
  }
  return { model, mapping };
}

export function reverseEdge(m: FlowModel, index: number): FlowModel {
  const e = m.edges[index];
  if (!e) return m;
  return updateEdge(m, index, { from: e.to, to: e.from, head: e.tail === 'none' ? e.head : e.tail, tail: e.tail === 'none' ? 'none' : e.head });
}

/** Toggles a class name on a node or subgraph. */
export function toggleClass(m: FlowModel, id: string, cls: string): FlowModel {
  const flip = (list: string[]) => (list.includes(cls) ? list.filter((c) => c !== cls) : [...list, cls]);
  return {
    ...m,
    nodes: m.nodes.map((n) => (n.id === id ? { ...n, classes: flip(n.classes) } : n)),
    subgraphs: m.subgraphs.map((s) => (s.id === id ? { ...s, classes: flip(s.classes) } : s)),
  };
}
