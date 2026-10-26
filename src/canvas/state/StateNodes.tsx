import type { Node, NodeProps } from '@xyflow/react';
import type { StateKind } from '../../diagrams/state/model';
import { textColorFor, type VisualStyle } from '../../diagrams/style';
import { EditableText, NodeHandles } from '../graph/context';
import type { Boundary } from '../graph/geometry';

export interface StateNodeData extends Record<string, unknown> {
  kind: StateKind;
  title: string;
  lines: string[];
  visual: VisualStyle;
  boundary: Boundary;
  /** Fork/join bars are vertical when the diagram flows left-right. */
  vertical?: boolean;
}

export type StateNodeType = Node<StateNodeData, 'state'>;

export function StateNodeView({ id, data, selected }: NodeProps<StateNodeType>) {
  const v = data.visual;
  const ring = selected ? 'var(--accent)' : (v.stroke ?? 'var(--node-stroke)');
  switch (data.kind) {
    case 'start':
      return (
        <div className="state-pseudo" style={{ width: 20, height: 20, background: selected ? 'var(--accent)' : 'var(--text)' }}>
          <NodeHandles />
        </div>
      );
    case 'end':
      return (
        <div className="state-pseudo" style={{ width: 22, height: 22, border: `2px solid ${selected ? 'var(--accent)' : 'var(--text)'}`, padding: 3 }}>
          <NodeHandles />
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: selected ? 'var(--accent)' : 'var(--text)' }} />
        </div>
      );
    case 'choice':
      return (
        <div style={{ width: 30, height: 30, position: 'relative' }}>
          <NodeHandles />
          <svg width={30} height={30} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden="true">
            <path d="M 15 0 L 30 15 L 15 30 L 0 15 Z" fill={v.fill ?? 'var(--node-fill)'} stroke={ring} strokeWidth={1.5} />
          </svg>
        </div>
      );
    case 'fork':
    case 'join':
      return (
        <div
          className="state-bar"
          style={{ width: data.vertical ? 8 : 90, height: data.vertical ? 90 : 8, background: selected ? 'var(--accent)' : 'var(--text)' }}
          title={data.kind}
        >
          <NodeHandles />
        </div>
      );
    default:
      return (
        <div
          className={`state-box${selected ? ' selected' : ''}`}
          style={{ background: v.fill, borderColor: selected ? undefined : v.stroke, color: textColorFor(v), borderStyle: v.strokeDasharray ? 'dashed' : undefined }}
        >
          <NodeHandles />
          <EditableText id={id} text={data.title} multiline={false} className="state-title" />
          {data.lines.length > 0 && (
            <div className="state-desc">
              {data.lines.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          )}
        </div>
      );
  }
}
