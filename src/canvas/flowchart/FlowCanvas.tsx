import { useReactFlow, type Edge, type Node, type NodeTypes } from '@xyflow/react';
import { Ellipsis, SquareDashed } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { displayToLabel, isMarkdownLabel, labelToDisplay } from '../../diagrams/common';
import type { FlowEdge, FlowModel } from '../../diagrams/flowchart/model';
import {
  addEdge,
  addNode,
  deleteItems,
  duplicateNodes,
  reparent,
  updateEdge,
  updateNode,
  updateSubgraph,
  nextSubgraphId,
} from '../../diagrams/flowchart/ops';
import { EXTRA_SHAPES, PALETTE_SHAPES } from '../../diagrams/flowchart/shapes';
import { classStyles, visualStyle } from '../../diagrams/style';
import { useDiagram } from '../../hooks/useDiagram';
import { tryT, useT } from '../../i18n';
import { useDocuments, type Layout, type Pos } from '../../store/documents';
import { useSelection } from '../../store/selection';
import { Menu } from '../../ui/Menu';
import { startEditing } from '../graph/context';
import { assignBends, type EdgeLine, type FloatingEdgeData } from '../graph/FloatingEdge';
import { estimateText } from '../graph/geometry';
import { DRAG_MIME, GraphCanvas } from '../graph/GraphCanvas';
import { GroupNode } from '../graph/GroupNode';
import { autoLayout, freeSpot, placeMissing, toRankDir, type LayoutItem } from '../graph/layout';
import type { MarkerName } from '../graph/markers';
import { ShapeIcon, shapeInfo } from './FlowShape';
import { FlowNodeView } from './FlowNodeView';
import { flowIds } from './ids';

const NODE_TYPES: NodeTypes = { flow: FlowNodeView, mmeGroup: GroupNode };

const MARKERS: Record<FlowEdge['head'], MarkerName | null> = { none: null, arrow: 'arrow', circle: 'circle', cross: 'cross' };
const LINES: Record<FlowEdge['line'], EdgeLine> = { solid: 'solid', dotted: 'dashed', thick: 'thick', invisible: 'invisible' };

function nodeSize(shape: string, text: string): { width: number; height: number } {
  const info = shapeInfo(shape);
  if (info.fixed) return { width: info.fixed, height: info.fixed };
  if (shape === 'fork') return { width: 90, height: 10 };
  const t = estimateText(text);
  const pad = shape === 'diam' ? { x: 68, y: 44 } : { x: 40, y: 22 };
  let width = Math.max(info.minWidth ?? 60, t.w + pad.x);
  let height = t.h + pad.y;
  if (info.square) width = height = Math.max(width, height);
  return { width, height };
}

function layoutItems(m: FlowModel): LayoutItem[] {
  return [
    ...m.nodes.map((n) => ({ id: n.id, parent: n.parent, ...nodeSize(n.shape, labelToDisplay(n.label ?? n.id)) })),
    ...m.subgraphs.map((s) => ({ id: s.id, parent: s.parent, isGroup: true, width: 0, height: 0 })),
  ];
}

function Palette({ onAdd }: { onAdd: (payload: string, pos: Pos, free?: boolean) => void }) {
  const t = useT();
  const rf = useReactFlow();
  const center = (): Pos => {
    const el = document.querySelector('.graph-canvas');
    const r = el?.getBoundingClientRect();
    const p = rf.screenToFlowPosition({ x: (r?.left ?? 0) + (r?.width ?? 600) / 2, y: (r?.top ?? 0) + (r?.height ?? 400) / 2 });
    return p;
  };
  const item = (payload: string, title: string, icon: React.ReactNode) => (
    <button
      key={payload}
      type="button"
      className="icon-btn palette-item"
      title={title}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_MIME, payload);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={(e) => {
        e.currentTarget.blur();
        onAdd(payload, center(), true);
      }}
    >
      {icon}
    </button>
  );
  return (
    <div className="floating-toolbar vertical palette">
      {PALETTE_SHAPES.map((s) => item(`shape:${s}`, tryT(t, `shape.${s}`, s), <ShapeIcon shape={s} size={15} />))}
      <Menu
        trigger={({ toggle }) => (
          <button type="button" className="icon-btn" title={t('canvas.moreShapes')} onClick={toggle}>
            <Ellipsis size={16} />
          </button>
        )}
      >
        {(close) => (
          <div className="shape-grid" style={{ width: 280, padding: 4 }}>
            {EXTRA_SHAPES.map((s) => (
              <button
                key={s}
                type="button"
                className="shape-btn"
                title={tryT(t, `shape.${s}`, s)}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAG_MIME, `shape:${s}`);
                  close();
                }}
                onClick={() => {
                  close();
                  onAdd(`shape:${s}`, center(), true);
                }}
              >
                <ShapeIcon shape={s} size={15} />
              </button>
            ))}
          </div>
        )}
      </Menu>
      <span className="sep" />
      {item('subgraph', t('flow.addSubgraph'), <SquareDashed size={16} />)}
    </div>
  );
}

export function FlowCanvas() {
  const t = useT();
  const { model, layout, apply, setLayout } = useDiagram<FlowModel>();
  const docId = useDocuments((s) => s.currentId) ?? '';
  const dir = toRankDir(model.direction);

  const items = useMemo(() => layoutItems(model), [model]);
  const links = useMemo(() => model.edges.map((e) => ({ source: e.from, target: e.to })), [model.edges]);
  const positions = useMemo(() => placeMissing(items, links, layout, dir), [items, links, layout, dir]);

  // Remember positions computed for new nodes so that they do not move later.
  useEffect(() => {
    const added = Object.keys(positions).filter((k) => !layout[k]);
    if (!added.length) return;
    const next: Layout = { ...layout };
    for (const k of added) next[k] = positions[k];
    setLayout(next);
  }, [positions, layout, setLayout]);

  const sgIds = useMemo(() => new Set(model.subgraphs.map((s) => s.id)), [model.subgraphs]);
  const cid = (id: string) => (sgIds.has(id) ? flowIds.group(id) : flowIds.node(id));

  const { nodes, edges } = useMemo(() => {
    const groups: Node[] = model.subgraphs.map((sg) => {
      const depth = (() => {
        let d = 0;
        let p = sg.parent;
        while (p && d < 20) {
          d++;
          p = model.subgraphs.find((s) => s.id === p)?.parent ?? null;
        }
        return d;
      })();
      return {
        id: flowIds.group(sg.id),
        type: 'mmeGroup',
        position: layout[sg.id] ?? { x: 0, y: 0 },
        zIndex: -20 + depth,
        data: {
          isGroup: true,
          members: [
            ...model.nodes.filter((n) => n.parent === sg.id).map((n) => flowIds.node(n.id)),
            ...model.subgraphs.filter((s) => s.parent === sg.id).map((s) => flowIds.group(s.id)),
          ],
          title: labelToDisplay(sg.title ?? sg.id),
          visual: visualStyle(...classStyles(model.classDefs, sg.classes), sg.style),
          connectable: true,
        },
      };
    });
    const flowNodes: Node[] = model.nodes.map((n) => ({
      id: flowIds.node(n.id),
      type: 'flow',
      position: positions[n.id] ?? { x: 0, y: 0 },
      data: {
        shape: n.shape,
        text: labelToDisplay(n.label ?? n.id),
        boundary: shapeInfo(n.shape).boundary,
        visual: visualStyle(...classStyles(model.classDefs, n.classes), n.style),
      },
    }));
    const flowEdges: Edge<FloatingEdgeData>[] = model.edges.map((e, i) => {
      const v = visualStyle(model.linkStyleDefault, e.style);
      return {
        id: flowIds.edge(i),
        source: cid(e.from),
        target: cid(e.to),
        type: 'floating',
        data: {
          label: e.label ? labelToDisplay(e.label) : '',
          line: LINES[e.line],
          markerEnd: MARKERS[e.head],
          markerStart: MARKERS[e.tail],
          editable: e.line !== 'invisible',
          stroke: v.stroke,
          strokeWidth: v.strokeWidth,
        },
      };
    });
    return { nodes: [...groups, ...flowNodes], edges: assignBends(flowEdges) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, positions, layout]);

  const modelId = (canvasId: string) => flowIds.parse(canvasId).id;

  const occupied = () =>
    items
      .filter((it) => !it.isGroup && positions[it.id])
      .map((it) => ({ x: positions[it.id].x, y: positions[it.id].y, w: it.width, h: it.height }));

  /** Adds a palette item centered on `pos`; `free` moves it to the nearest empty spot. */
  const addAt = (payload: string, pos: Pos, free = false) => {
    if (payload === 'subgraph') {
      const id = nextSubgraphId(model);
      const next: FlowModel = {
        ...model,
        subgraphs: [...model.subgraphs, { id, title: t('flow.newSubgraph'), implicitId: false, direction: null, parent: null, classes: [], style: null }],
      };
      const at = { x: Math.round(pos.x - 100), y: Math.round(pos.y - 55) };
      apply(next, { ...layout, [id]: free ? freeSpot(at, 200, 110, occupied()) : at });
      useSelection.getState().set([flowIds.group(id)]);
      return;
    }
    const shape = payload.replace(/^shape:/, '');
    const label = shapeInfo(shape).noLabel ? null : t('flow.newNode');
    const res = addNode(model, { shape, label });
    const size = nodeSize(shape, label ?? '');
    const at = { x: Math.round(pos.x - size.width / 2), y: Math.round(pos.y - size.height / 2) };
    apply(res.model, { ...layout, [res.id]: free ? freeSpot(at, size.width, size.height, occupied()) : at });
    useSelection.getState().set([flowIds.node(res.id)]);
    if (label) setTimeout(() => startEditing(flowIds.node(res.id)), 60);
  };

  return (
    <GraphCanvas
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      fitKey={docId}
      palette={<Palette onAdd={addAt} />}
      onMove={(moved) => {
        const next = { ...layout };
        for (const [k, p] of Object.entries(moved)) next[modelId(k)] = p;
        setLayout(next, true);
      }}
      onConnect={(s, tgt) => apply(addEdge(model, modelId(s), modelId(tgt)))}
      onConnectToEmpty={(s, pos) => {
        const res = addNode(model, { label: t('flow.newNode') });
        const size = nodeSize('rect', t('flow.newNode'));
        apply(addEdge(res.model, modelId(s), res.id), {
          ...layout,
          [res.id]: { x: Math.round(pos.x - size.width / 2), y: Math.round(pos.y - size.height / 2) },
        });
        useSelection.getState().set([flowIds.node(res.id)]);
        setTimeout(() => startEditing(flowIds.node(res.id)), 60);
      }}
      onDelete={(nodeIds, edgeIds) => {
        const parsed = nodeIds.map(flowIds.parse);
        apply(
          deleteItems(
            model,
            parsed.filter((p) => p.kind === 'node').map((p) => p.id),
            parsed.filter((p) => p.kind === 'group').map((p) => p.id),
            edgeIds.map((e) => Number(flowIds.parse(e).id)),
          ),
        );
        useSelection.getState().clear();
      }}
      onReparent={(ids, group) => apply(reparent(model, ids.map(modelId), group ? modelId(group) : null))}
      onDropItem={addAt}
      onDuplicate={(ids) => {
        const nodeIds = ids.filter((i) => flowIds.parse(i).kind === 'node').map(modelId);
        const { model: next, mapping } = duplicateNodes(model, nodeIds);
        const l = { ...layout };
        for (const [from, to] of mapping) {
          const p = positions[from];
          if (p) l[to] = { x: p.x + 40, y: p.y + 40 };
        }
        apply(next, l);
        useSelection.getState().set([...mapping.values()].map(flowIds.node));
      }}
      onCommitText={(canvasId, text) => {
        const { kind, id } = flowIds.parse(canvasId);
        if (kind === 'edge') {
          const i = Number(id);
          const e = model.edges[i];
          apply(updateEdge(model, i, { label: text.trim() ? displayToLabel(text, isMarkdownLabel(e?.label)) : null }));
        } else if (kind === 'group') {
          const sg = model.subgraphs.find((s) => s.id === id);
          apply(updateSubgraph(model, id, { title: text.trim() ? displayToLabel(text, isMarkdownLabel(sg?.title)) : null }));
        } else {
          const n = model.nodes.find((x) => x.id === id);
          if (!n) return;
          const label = text === id && n.label === null ? null : displayToLabel(text, isMarkdownLabel(n.label));
          apply(updateNode(model, id, { label }));
        }
      }}
      onAutoLayout={(sizes) => {
        const measured = items.map((it) => {
          const s = sizes[it.isGroup ? flowIds.group(it.id) : flowIds.node(it.id)];
          return it.isGroup || !s ? it : { ...it, width: s.width, height: s.height };
        });
        setLayout({ ...layout, ...autoLayout(measured, links, dir) }, true);
      }}
    />
  );
}
