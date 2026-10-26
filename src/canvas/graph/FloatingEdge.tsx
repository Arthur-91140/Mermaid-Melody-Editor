import { BaseEdge, EdgeLabelRenderer, useInternalNode, type Edge, type EdgeProps, type InternalNode, type Node } from '@xyflow/react';
import { EditableText, useGraph } from './context';
import { edgeGeometry, type Boundary, type Box } from './geometry';
import { markerUrl, type MarkerName } from './markers';

export type EdgeLine = 'solid' | 'dashed' | 'dotted' | 'thick' | 'invisible';

export interface FloatingEdgeData extends Record<string, unknown> {
  label?: string;
  startLabel?: string;
  endLabel?: string;
  line?: EdgeLine;
  markerStart?: MarkerName | null;
  markerEnd?: MarkerName | null;
  /** Sideways offset of the curve (parallel edges). */
  bend?: number;
  /** Whether the label can be edited with a double-click. */
  editable?: boolean;
}

export type FloatingEdgeType = Edge<FloatingEdgeData, 'floating'>;

function nodeBox(n: InternalNode<Node>): Box {
  return {
    x: n.internals.positionAbsolute.x,
    y: n.internals.positionAbsolute.y,
    w: n.measured?.width ?? n.width ?? 120,
    h: n.measured?.height ?? n.height ?? 48,
  };
}

const LINE_STYLE: Record<EdgeLine, React.CSSProperties> = {
  solid: { strokeWidth: 1.6 },
  dashed: { strokeWidth: 1.6, strokeDasharray: '7 5' },
  dotted: { strokeWidth: 1.6, strokeDasharray: '3 4' },
  thick: { strokeWidth: 3.4 },
  invisible: { strokeWidth: 1.2, strokeDasharray: '2 6', opacity: 0.35 },
};

export function FloatingEdge({ id, source, target, data, selected }: EdgeProps<FloatingEdgeType>) {
  const s = useInternalNode(source);
  const t = useInternalNode(target);
  const { setEditing } = useGraph();
  if (!s || !t) return null;
  const sb = nodeBox(s);
  const tb = source === target ? sb : nodeBox(t);
  const g = edgeGeometry(
    sb,
    ((s.data as { boundary?: Boundary }).boundary ?? 'rect') as Boundary,
    tb,
    ((t.data as { boundary?: Boundary }).boundary ?? 'rect') as Boundary,
    data?.bend ?? 0,
  );
  const line = data?.line ?? 'solid';
  const label = data?.label ?? '';
  return (
    <>
      <BaseEdge
        id={id}
        path={g.path}
        markerStart={markerUrl(data?.markerStart, selected)}
        markerEnd={markerUrl(data?.markerEnd, selected)}
        interactionWidth={18}
        style={{ ...LINE_STYLE[line], stroke: selected ? 'var(--accent)' : 'var(--edge)' }}
      />
      <EdgeLabelRenderer>
        {(label || data?.editable) && (
          <div
            className={`mme-edge-label nodrag nopan${selected ? ' selected' : ''}${label ? '' : ' empty'}`}
            style={{ transform: `translate(-50%, -50%) translate(${g.mid.x}px, ${g.mid.y}px)` }}
            onDoubleClick={(e) => {
              if (!data?.editable) return;
              e.stopPropagation();
              setEditing(id);
            }}
          >
            <EditableText id={id} text={label} multiline={false} />
          </div>
        )}
        {data?.startLabel && (
          <div className="mme-edge-end-label" style={{ transform: `translate(-50%, -50%) translate(${g.nearStart.x}px, ${g.nearStart.y - 12}px)` }}>
            {data.startLabel}
          </div>
        )}
        {data?.endLabel && (
          <div className="mme-edge-end-label" style={{ transform: `translate(-50%, -50%) translate(${g.nearEnd.x}px, ${g.nearEnd.y - 12}px)` }}>
            {data.endLabel}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}

/** Gives parallel edges between the same two nodes different curvatures. */
export function assignBends<E extends { source: string; target: string; data?: FloatingEdgeData }>(edges: E[]): E[] {
  const groups = new Map<string, E[]>();
  for (const e of edges) {
    const key = [e.source, e.target].sort().join('\u0000');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  for (const list of groups.values()) {
    if (list.length < 2 && list[0]?.source !== list[0]?.target) continue;
    list.forEach((e, i) => {
      const offset = list.length === 1 ? 0 : (i - (list.length - 1) / 2) * 36;
      // Edges stored in the opposite direction bend the other way in absolute terms.
      const sign = e.source <= e.target ? 1 : -1;
      e.data = { ...e.data, bend: offset * sign + (e.source === e.target ? i * 18 : 0) };
    });
  }
  return edges;
}
