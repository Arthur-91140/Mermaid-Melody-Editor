import { Square, SquareDashed } from 'lucide-react';
import { flowIds } from '../canvas/flowchart/ids';
import { displayToLabel, isMarkdownLabel, labelToDisplay } from '../diagrams/common';
import type { FlowModel } from '../diagrams/flowchart/model';
import { addEdge, addNode, deleteItems, groupItems, updateEdge, updateNode, updateSubgraph } from '../diagrams/flowchart/ops';
import { cleanId, tag, type PreviewEditing } from './types';

export const flowPreview: PreviewEditing<FlowModel> = {
  annotate(svg, m) {
    svg.querySelectorAll('g.node').forEach((g) => {
      const id = /flowchart-(.+)-\d+$/.exec(cleanId(g.id))?.[1];
      if (id && m.nodes.some((n) => n.id === id)) tag(g, flowIds.node(id));
    });
    svg.querySelectorAll('g.cluster').forEach((g) => {
      const id = cleanId(g.id);
      const sg =
        m.subgraphs.find((s) => s.id === id && !s.implicitId) ??
        m.subgraphs.find((s) => s.implicitId && labelToDisplay(s.title) === g.textContent?.trim());
      if (sg) tag(g, flowIds.group(sg.id));
    });
    const edgeIndex = new Map<string, number>();
    svg.querySelectorAll('path.flowchart-link').forEach((p, i) => {
      if (i >= m.edges.length) return;
      tag(p, flowIds.edge(i));
      const dataId = p.getAttribute('data-id');
      if (dataId) edgeIndex.set(dataId, i);
    });
    svg.querySelectorAll('g.edgeLabel').forEach((g) => {
      const dataId = g.querySelector('[data-id]')?.getAttribute('data-id');
      const i = dataId ? edgeIndex.get(dataId) : undefined;
      if (i !== undefined) tag(g, flowIds.edge(i));
    });
  },

  textOf(m, cid) {
    const { kind, id } = flowIds.parse(cid);
    if (kind === 'edge') return labelToDisplay(m.edges[Number(id)]?.label ?? '');
    if (kind === 'group') {
      const sg = m.subgraphs.find((s) => s.id === id);
      return sg ? labelToDisplay(sg.title ?? sg.id) : null;
    }
    const n = m.nodes.find((x) => x.id === id);
    return n ? labelToDisplay(n.label ?? n.id) : null;
  },

  commitText(m, cid, text) {
    const { kind, id } = flowIds.parse(cid);
    if (kind === 'edge') {
      const e = m.edges[Number(id)];
      return { model: updateEdge(m, Number(id), { label: text.trim() ? displayToLabel(text, isMarkdownLabel(e?.label)) : null }) };
    }
    if (kind === 'group') {
      const sg = m.subgraphs.find((s) => s.id === id);
      return { model: updateSubgraph(m, id, { title: text.trim() ? displayToLabel(text, isMarkdownLabel(sg?.title)) : null }) };
    }
    const n = m.nodes.find((x) => x.id === id);
    if (!n) return null;
    const label = text === id && n.label === null ? null : displayToLabel(text, isMarkdownLabel(n.label));
    return { model: updateNode(m, id, { label }) };
  },

  remove(m, ids) {
    const parsed = ids.map(flowIds.parse);
    return deleteItems(
      m,
      parsed.filter((p) => p.kind === 'node').map((p) => p.id),
      parsed.filter((p) => p.kind === 'group').map((p) => p.id),
      parsed.filter((p) => p.kind === 'edge').map((p) => Number(p.id)),
    );
  },

  connect(m, from, to) {
    const a = flowIds.parse(from);
    const b = flowIds.parse(to);
    if (a.kind === 'edge' || b.kind === 'edge') return null;
    return { model: addEdge(m, a.id, b.id), select: [flowIds.edge(m.edges.length)] };
  },

  structure(m) {
    const groups = new Set(m.subgraphs.map((sg) => sg.id));
    const cid = (id: string) => (groups.has(id) ? flowIds.group(id) : flowIds.node(id));
    return {
      edges: m.edges.map((e, i) => ({ id: flowIds.edge(i), from: cid(e.from), to: cid(e.to) })),
      clusters: m.subgraphs.map((sg) => ({
        id: flowIds.group(sg.id),
        members: [
          ...m.nodes.filter((n) => n.parent === sg.id).map((n) => flowIds.node(n.id)),
          ...m.subgraphs.filter((x) => x.parent === sg.id).map((x) => flowIds.group(x.id)),
        ],
      })),
    };
  },

  addActions: (t) => [
    {
      id: 'node',
      title: t('canvas.addNode'),
      icon: <Square size={16} />,
      run(m, selection) {
        const parent = selection.map(flowIds.parse).find((p) => p.kind === 'node' || p.kind === 'group');
        const anchor = parent?.kind === 'node' ? m.nodes.find((n) => n.id === parent.id) : undefined;
        const res = addNode(m, { label: t('flow.newNode'), parent: parent?.kind === 'group' ? parent.id : (anchor?.parent ?? null) });
        const model = anchor ? addEdge(res.model, anchor.id, res.id) : res.model;
        return { model, select: [flowIds.node(res.id)], edit: flowIds.node(res.id) };
      },
    },
    {
      id: 'subgraph',
      title: t('flow.addSubgraph'),
      icon: <SquareDashed size={16} />,
      run(m, selection) {
        const ids = selection.map(flowIds.parse).filter((p) => p.kind !== 'edge').map((p) => p.id);
        if (ids.length) {
          const res = groupItems(m, ids, t('flow.newSubgraph'));
          return { model: res.model, select: [flowIds.group(res.id)], edit: flowIds.group(res.id) };
        }
        const res = addNode(m, { label: t('flow.newNode') });
        const g = groupItems(res.model, [res.id], t('flow.newSubgraph'));
        return { model: g.model, select: [flowIds.group(g.id)], edit: flowIds.group(g.id) };
      },
    },
  ],
};
