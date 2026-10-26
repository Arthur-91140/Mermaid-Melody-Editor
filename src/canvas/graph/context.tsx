import { Handle, Position } from '@xyflow/react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { create } from 'zustand';

/** Canvas id (node or edge) whose text is being edited inline. */
export const useEditing = create<{ id: string | null }>(() => ({ id: null }));
export const startEditing = (id: string | null) => useEditing.setState({ id });

export interface GraphCallbacks {
  setEditing: (id: string | null) => void;
  /** Called with the new display text when an inline edit is confirmed. */
  commitText: (id: string, text: string) => void;
}

export const GraphContext = createContext<GraphCallbacks>({
  setEditing: startEditing,
  commitText: () => undefined,
});

export const useGraph = () => useContext(GraphContext);

/** Connection points on the four sides; edges are drawn to the shape border anyway. */
export function NodeHandles() {
  return (
    <>
      <Handle id="t" type="source" position={Position.Top} className="mme-handle" />
      <Handle id="r" type="source" position={Position.Right} className="mme-handle" />
      <Handle id="b" type="source" position={Position.Bottom} className="mme-handle" />
      <Handle id="l" type="source" position={Position.Left} className="mme-handle" />
    </>
  );
}

interface EditableTextProps {
  id: string;
  text: string;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
}

/** Text that turns into an input while `id` is being edited. */
export function EditableText({ id, text, className, multiline = true, placeholder }: EditableTextProps) {
  const { setEditing, commitText } = useGraph();
  const active = useEditing((s) => s.id === id);
  const [draft, setDraft] = useState(text);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!active) return;
    setDraft(text);
    // The textarea is mounted by now; focusing right away also works in background tabs.
    ref.current?.focus();
    ref.current?.select();
  }, [active, text]);

  if (!active) {
    return <span className={className}>{text || (placeholder ? <em className="mme-placeholder">{placeholder}</em> : ' ')}</span>;
  }
  const finish = (save: boolean) => {
    setEditing(null);
    if (save && draft !== text) commitText(id, draft);
  };
  return (
    <textarea
      ref={ref}
      className={`mme-inline-edit nodrag nopan nowheel ${className ?? ''}`}
      value={draft}
      rows={Math.max(1, draft.split('\n').length)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => finish(true)}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') finish(false);
        if (e.key === 'Enter' && (!multiline || !e.shiftKey)) {
          e.preventDefault();
          finish(true);
        }
      }}
    />
  );
}
