import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  ConnectionMode,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type EdgeChange,
  type EdgeTypes,
  type Node,
  type NodeChange,
  type NodeTypes,
  type OnConnectEnd,
} from '@xyflow/react';
import { LayoutGrid, Maximize, Minus, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useT } from '../../i18n';
import type { Pos } from '../../store/documents';
import { useSelection } from '../../store/selection';
import { useSettings } from '../../store/settings';
import { GraphContext, startEditing, type GraphCallbacks } from './context';
import { FloatingEdge } from './FloatingEdge';
import { containsPoint, type Box } from './geometry';
import { GraphMarkers } from './markers';

export const DRAG_MIME = 'application/x-mme-item';

export interface GroupData extends Record<string, unknown> {
  isGroup: true;
  /** Canvas ids of the direct members (nodes or nested groups). */
  members: string[];
}

const isGroup = (n: Node) => (n.data as Partial<GroupData>).isGroup === true;

const GROUP_PAD = 18;
const GROUP_HEADER = 30;
const EMPTY_GROUP = { w: 200, h: 110 };

function size(n: Node): { w: number; h: number } {
  return { w: n.measured?.width ?? n.width ?? 120, h: n.measured?.height ?? n.height ?? 44 };
}

/** Recomputes every group's box from its members (deepest groups first). */
function fitGroups(nodes: Node[]): Node[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const depth = (n: Node, seen = new Set<string>()): number => {
    const parent = nodes.find((g) => isGroup(g) && (g.data as GroupData).members.includes(n.id));
    if (!parent || seen.has(parent.id)) return 0;
    seen.add(parent.id);
    return 1 + depth(parent, seen);
  };
  const groups = nodes.filter(isGroup).sort((a, b) => depth(b) - depth(a));
  const boxes = new Map<string, Box>();
  for (const g of groups) {
    const members = (g.data as GroupData).members
      .map((id) => byId.get(id))
      .filter((m): m is Node => !!m && !m.dragging);
    let box: Box;
    if (!members.length) {
      box = { x: g.position.x, y: g.position.y, w: g.width ?? EMPTY_GROUP.w, h: g.height ?? EMPTY_GROUP.h };
      if (!(g.data as GroupData).members.length) box = { ...box, w: EMPTY_GROUP.w, h: EMPTY_GROUP.h };
    } else {
      const rects = members.map((m) => boxes.get(m.id) ?? { x: m.position.x, y: m.position.y, ...size(m) });
      const x1 = Math.min(...rects.map((r) => r.x)) - GROUP_PAD;
      const y1 = Math.min(...rects.map((r) => r.y)) - GROUP_PAD - GROUP_HEADER;
      const x2 = Math.max(...rects.map((r) => r.x + r.w)) + GROUP_PAD;
      const y2 = Math.max(...rects.map((r) => r.y + r.h)) + GROUP_PAD;
      box = { x: x1, y: y1, w: Math.max(x2 - x1, 120), h: y2 - y1 };
    }
    boxes.set(g.id, box);
  }
  return nodes.map((n) => {
    const b = boxes.get(n.id);
    if (!b) return n;
    if (n.position.x === b.x && n.position.y === b.y && n.width === b.w && n.height === b.h) return n;
    return { ...n, position: { x: b.x, y: b.y }, width: b.w, height: b.h };
  });
}

function descendants(nodes: Node[], id: string): string[] {
  const g = nodes.find((n) => n.id === id);
  if (!g || !isGroup(g)) return [];
  return (g.data as GroupData).members.flatMap((m) => [m, ...descendants(nodes, m)]);
}

export interface GraphCanvasProps {
  nodes: Node[];
  edges: Edge[];
  nodeTypes: NodeTypes;
  /** Changes the canvas fit when it changes (e.g. document id). */
  fitKey: string;
  /** New top-left positions after a drag. */
  onMove: (positions: Record<string, Pos>) => void;
  onConnect?: (source: string, target: string) => void;
  /** A connection dropped on empty space: create a node there. */
  onConnectToEmpty?: (source: string, position: Pos) => void;
  onDelete?: (nodeIds: string[], edgeIds: string[]) => void;
  /** A node dropped inside (or outside) a group. */
  onReparent?: (ids: string[], group: string | null) => void;
  onDropItem?: (payload: string, position: Pos) => void;
  onDuplicate?: (ids: string[]) => void;
  onCommitText: (id: string, text: string) => void;
  /** Receives the measured size of every canvas node. */
  onAutoLayout?: (sizes: Record<string, { width: number; height: number }>) => void;
  /** Ids that can be renamed inline (defaults to every node and edge). */
  canEdit?: (id: string) => boolean;
  palette?: ReactNode;
  toolbar?: ReactNode;
  hint?: ReactNode;
}

function Toolbar({ onAutoLayout, extra }: { onAutoLayout?: GraphCanvasProps['onAutoLayout']; extra?: ReactNode }) {
  const t = useT();
  const rf = useReactFlow();
  return (
    <div className="floating-toolbar" style={{ left: 12, bottom: 12 }}>
      <button type="button" className="icon-btn small" title={t('canvas.zoomOut')} onClick={() => rf.zoomOut()}>
        <Minus size={15} />
      </button>
      <button type="button" className="icon-btn small" title={t('canvas.zoomIn')} onClick={() => rf.zoomIn()}>
        <Plus size={15} />
      </button>
      <button type="button" className="icon-btn small" title={t('canvas.fit')} onClick={() => rf.fitView({ padding: 0.15, duration: 250 })}>
        <Maximize size={14} />
      </button>
      {onAutoLayout && (
        <>
          <span className="sep" />
          <button
            type="button"
            className="icon-btn small"
            title={t('canvas.autoLayout')}
            onClick={() => {
              const sizes: Record<string, { width: number; height: number }> = {};
              for (const n of rf.getNodes()) sizes[n.id] = { width: size(n).w, height: size(n).h };
              onAutoLayout(sizes);
              setTimeout(() => rf.fitView({ padding: 0.15, duration: 300 }), 60);
            }}
          >
            <LayoutGrid size={14} />
          </button>
        </>
      )}
      {extra && <span className="sep" />}
      {extra}
    </div>
  );
}

function Inner(props: GraphCanvasProps) {
  const { nodes: input, edges, nodeTypes, fitKey } = props;
  const rf = useReactFlow();
  useSettings((s) => s.theme);
  const [nodes, setNodes] = useState<Node[]>(() => fitGroups(input));
  const selectedIds = useSelection((s) => s.ids);
  const propsRef = useRef(props);
  propsRef.current = props;

  // Keep local nodes in sync with the model while preserving selection and measurements.
  useEffect(() => {
    setNodes((prev) => {
      const old = new Map(prev.map((n) => [n.id, n]));
      const selected = new Set(useSelection.getState().ids);
      return fitGroups(
        input.map((n) => {
          const p = old.get(n.id);
          return {
            ...n,
            selected: selected.has(n.id),
            ...(p?.measured ? { measured: p.measured } : {}),
          };
        }),
      );
    });
  }, [input]);

  const rfEdges = useMemo(() => {
    const selected = new Set(selectedIds);
    return edges.map((e) => ({ ...e, selected: selected.has(e.id) }));
  }, [edges, selectedIds]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const sel = new Set(useSelection.getState().ids);
    let touched = false;
    for (const c of changes) {
      if (c.type !== 'select') continue;
      touched = true;
      if (c.selected) sel.add(c.id);
      else sel.delete(c.id);
    }
    if (touched) useSelection.getState().set([...sel]);
  }, []);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((prev) => {
      let next = applyNodeChanges(changes, prev);
      // Dragging a group drags everything inside it.
      for (const c of changes) {
        if (c.type !== 'position' || !c.position) continue;
        const before = prev.find((n) => n.id === c.id);
        if (!before || !isGroup(before)) continue;
        const dx = c.position.x - before.position.x;
        const dy = c.position.y - before.position.y;
        if (!dx && !dy) continue;
        const inside = new Set(descendants(prev, c.id));
        next = next.map((n) => (inside.has(n.id) ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } : n));
      }
      return fitGroups(next);
    });
  }, []);

  const fitted = useRef<string | null>(null);
  useEffect(() => {
    if (fitted.current === fitKey) return;
    const timer = setTimeout(() => {
      rf.fitView({ padding: 0.15, maxZoom: 1.2 });
      fitted.current = fitKey;
    }, 80);
    return () => clearTimeout(timer);
  }, [fitKey, rf, nodes.length]);

  const onNodeDragStop = useCallback(
    (_: unknown, __: Node, dragged: Node[]) => {
      const p = propsRef.current;
      const current = rf.getNodes();
      const moved = new Set<string>();
      for (const d of dragged) {
        moved.add(d.id);
        descendants(current, d.id).forEach((x) => moved.add(x));
      }
      const positions: Record<string, Pos> = {};
      for (const n of current) {
        if (moved.has(n.id)) positions[n.id] = { x: Math.round(n.position.x), y: Math.round(n.position.y) };
      }
      p.onMove(positions);

      if (!p.onReparent) return;
      const groups = fitGroups(current.map((n) => (moved.has(n.id) && !isGroup(n) ? { ...n, dragging: true } : n))).filter(isGroup);
      const changes = new Map<string | null, string[]>();
      for (const d of dragged) {
        const node = current.find((n) => n.id === d.id);
        if (!node) continue;
        const s = size(node);
        const c = { x: node.position.x + s.w / 2, y: node.position.y + s.h / 2 };
        const excluded = new Set([d.id, ...descendants(current, d.id)]);
        const target =
          groups
            .filter((g) => !excluded.has(g.id))
            .filter((g) => containsPoint({ x: g.position.x, y: g.position.y, w: g.width ?? 0, h: g.height ?? 0 }, c))
            .sort((a, b) => (a.width ?? 0) * (a.height ?? 0) - (b.width ?? 0) * (b.height ?? 0))[0]?.id ?? null;
        const parent = current.find((g) => isGroup(g) && (g.data as GroupData).members.includes(d.id))?.id ?? null;
        if (target !== parent) {
          if (!changes.has(target)) changes.set(target, []);
          changes.get(target)!.push(d.id);
        }
      }
      for (const [target, ids] of changes) p.onReparent(ids, target);
    },
    [rf],
  );

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, state) => {
      const p = propsRef.current;
      if (state.isValid || !state.fromNode || !p.onConnectToEmpty) return;
      const target = (event.target as HTMLElement | null)?.closest('.react-flow__node');
      if (target) return;
      const pt = 'changedTouches' in event ? event.changedTouches[0] : event;
      const pos = rf.screenToFlowPosition({ x: pt.clientX, y: pt.clientY });
      p.onConnectToEmpty(state.fromNode.id, pos);
    },
    [rf],
  );

  const callbacks: GraphCallbacks = useMemo(
    () => ({
      setEditing: (id) => {
        if (id && propsRef.current.canEdit && !propsRef.current.canEdit(id)) return;
        startEditing(id);
      },
      commitText: (id, text) => propsRef.current.onCommitText(id, text),
    }),
    [],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('input, textarea')) return;
    const mod = e.ctrlKey || e.metaKey;
    const ids = useSelection.getState().ids;
    if (e.key === 'F2' && ids.length === 1) {
      e.preventDefault();
      callbacks.setEditing(ids[0]);
    } else if (mod && e.key.toLowerCase() === 'd' && ids.length) {
      e.preventDefault();
      propsRef.current.onDuplicate?.(ids.filter((id) => nodes.some((n) => n.id === id)));
    } else if (mod && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      useSelection.getState().set([...nodes.map((n) => n.id), ...edges.map((ed) => ed.id)]);
      setNodes((ns) => ns.map((n) => ({ ...n, selected: true })));
    } else if (e.key === 'Escape') {
      useSelection.getState().clear();
      setNodes((ns) => ns.map((n) => (n.selected ? { ...n, selected: false } : n)));
    }
  };

  const dark = document.documentElement.dataset.theme === 'dark';

  return (
    <GraphContext.Provider value={callbacks}>
      <div
        className="graph-canvas"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(DRAG_MIME)) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }
        }}
        onDrop={(e) => {
          const payload = e.dataTransfer.getData(DRAG_MIME);
          if (!payload) return;
          e.preventDefault();
          props.onDropItem?.(payload, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
        }}
      >
        <GraphMarkers />
        <ReactFlow
          nodes={nodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          edgeTypes={EDGE_TYPES}
          colorMode={dark ? 'dark' : 'light'}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          onSelectionChange={({ nodes: sn, edges: se }) =>
            useSelection.getState().set([...sn.map((n) => n.id), ...se.map((ed) => ed.id)])
          }
          onConnect={(c) => c.source && c.target && props.onConnect?.(c.source, c.target)}
          onConnectEnd={onConnectEnd}
          onBeforeDelete={async ({ nodes: dn, edges: de }) => {
            props.onDelete?.(
              dn.map((n) => n.id),
              de.map((ed) => ed.id),
            );
            return false;
          }}
          onNodeDoubleClick={(_, n) => callbacks.setEditing(n.id)}
          onEdgeDoubleClick={(_, ed) => callbacks.setEditing(ed.id)}
          connectionMode={ConnectionMode.Loose}
          deleteKeyCode={['Delete', 'Backspace']}
          multiSelectionKeyCode={['Meta', 'Control']}
          panOnScroll
          zoomOnDoubleClick={false}
          minZoom={0.1}
          maxZoom={3}
          elevateEdgesOnSelect
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} color="var(--grid)" />
          <MiniMap pannable zoomable className="mme-minimap" nodeStrokeWidth={2} style={{ width: 150, height: 100 }} />
          <Toolbar onAutoLayout={props.onAutoLayout} extra={props.toolbar} />
        </ReactFlow>
        {props.palette}
        {props.hint && <div className="canvas-hint">{props.hint}</div>}
      </div>
    </GraphContext.Provider>
  );
}

const EDGE_TYPES: EdgeTypes = { floating: FloatingEdge };

export function GraphCanvas(props: GraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <Inner {...props} />
    </ReactFlowProvider>
  );
}
