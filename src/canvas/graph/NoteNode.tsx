import type { Node, NodeProps } from '@xyflow/react';
import { EditableText, NodeHandles } from './context';

export interface NoteNodeData extends Record<string, unknown> {
  text: string;
  boundary: 'rect';
}

export type NoteNodeType = Node<NoteNodeData, 'note'>;

export function NoteNode({ id, data, selected }: NodeProps<NoteNodeType>) {
  return (
    <div className={`mme-note${selected ? ' selected' : ''}`}>
      <NodeHandles />
      <EditableText id={id} text={data.text} />
    </div>
  );
}
