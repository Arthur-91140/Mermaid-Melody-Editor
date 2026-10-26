import type { Node, NodeProps } from '@xyflow/react';
import type { VisualStyle } from '../../diagrams/style';
import { EditableText, NodeHandles } from '../graph/context';

export interface MemberView {
  text: string;
  isStatic: boolean;
  isAbstract: boolean;
}

export interface ClassNodeData extends Record<string, unknown> {
  name: string;
  annotations: string[];
  attributes: MemberView[];
  methods: MemberView[];
  visual: VisualStyle;
  boundary: 'rect';
}

export type ClassNodeType = Node<ClassNodeData, 'umlClass'>;

function Member({ m }: { m: MemberView }) {
  return (
    <div className="uml-member" style={{ textDecoration: m.isStatic ? 'underline' : undefined, fontStyle: m.isAbstract ? 'italic' : undefined }}>
      {m.text}
    </div>
  );
}

export function ClassNodeView({ id, data, selected }: NodeProps<ClassNodeType>) {
  const v = data.visual;
  return (
    <div
      className={`uml-class${selected ? ' selected' : ''}`}
      style={{ background: v.fill, borderColor: selected ? undefined : v.stroke, color: v.color, borderStyle: v.strokeDasharray ? 'dashed' : undefined }}
    >
      <NodeHandles />
      <div className="uml-head">
        {data.annotations.map((a) => (
          <div key={a} className="uml-annotation">
            «{a}»
          </div>
        ))}
        <EditableText id={id} text={data.name} multiline={false} className="uml-name" />
      </div>
      <div className="uml-section">
        {data.attributes.map((m, i) => (
          <Member key={i} m={m} />
        ))}
      </div>
      <div className="uml-section">
        {data.methods.map((m, i) => (
          <Member key={i} m={m} />
        ))}
      </div>
    </div>
  );
}
