import type { Node, NodeProps } from '@xyflow/react';
import type { CSSProperties } from 'react';
import { textColorFor, type VisualStyle } from '../../diagrams/style';
import { EditableText, NodeHandles } from '../graph/context';
import type { Boundary } from '../graph/geometry';
import { shapeElements, shapeInfo } from './FlowShape';

export interface FlowNodeData extends Record<string, unknown> {
  shape: string;
  text: string;
  boundary: Boundary;
  visual: VisualStyle;
}

export type FlowNodeType = Node<FlowNodeData, 'flow'>;

export function FlowNodeView({ id, data, selected, width, height }: NodeProps<FlowNodeType>) {
  const info = shapeInfo(data.shape);
  const v = data.visual;
  const style: CSSProperties = info.fixed
    ? { width: info.fixed, height: info.fixed }
    : data.shape === 'fork'
      ? { width: 90, height: 10 }
      : {
          padding: info.padding,
          minWidth: info.minWidth,
          aspectRatio: info.square ? '1' : undefined,
          color: textColorFor(v),
          fontWeight: v.fontWeight,
          fontStyle: v.fontStyle,
        };
  const w = width ?? 0;
  const h = height ?? 0;
  return (
    <div className={`flow-node${selected ? ' selected' : ''}${info.square ? ' square' : ''}${v.whiteSpace === 'nowrap' ? ' nowrap' : ''}`} style={style}>
      {w > 0 && h > 0 && (
        <svg className="flow-node-svg" width={w} height={h} aria-hidden="true">
          {shapeElements(data.shape, w, h, {
            fill: v.fill ?? 'var(--node-fill)',
            stroke: selected ? 'var(--accent)' : (v.stroke ?? 'var(--node-stroke)'),
            strokeWidth: selected ? 2.2 : (v.strokeWidth ?? 1.5),
            strokeDasharray: v.strokeDasharray,
          })}
        </svg>
      )}
      <NodeHandles />
      {!info.noLabel && <EditableText id={id} text={data.text} className="flow-node-label" />}
    </div>
  );
}
