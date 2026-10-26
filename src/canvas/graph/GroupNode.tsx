import type { Node, NodeProps } from '@xyflow/react';
import type { VisualStyle } from '../../diagrams/style';
import { EditableText, NodeHandles } from './context';
import type { GroupData } from './GraphCanvas';

export interface GroupNodeData extends GroupData {
  title: string;
  visual?: VisualStyle;
  /** Allows linking to the group itself (flowchart subgraphs, composite states). */
  connectable?: boolean;
  rounded?: boolean;
}

export type GroupNodeType = Node<GroupNodeData, 'mmeGroup'>;

export function GroupNode({ id, data }: NodeProps<GroupNodeType>) {
  const v = data.visual ?? {};
  return (
    <div
      className="mme-group"
      style={{
        background: v.fill,
        borderColor: v.stroke,
        borderStyle: v.stroke ? 'solid' : undefined,
        color: v.color,
        borderRadius: data.rounded ? 16 : undefined,
      }}
    >
      {data.connectable && <NodeHandles />}
      <div className="mme-group-title" style={{ color: v.color }}>
        <EditableText id={id} text={data.title} multiline={false} />
      </div>
    </div>
  );
}
