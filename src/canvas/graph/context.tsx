import { Handle, Position } from '@xyflow/react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';

export interface GraphCallbacks {
  /** Canvas id (node or edge) whose text is being edited inline. */
  editing: string | null;
  setEditing: (id: string | null) => void;
  /** Called with the new display text when an inline edit is confirmed. */
  commitText: (id: string, text: string) => void;
}

export const GraphContext = createContext<GraphCallbacks>({
  editing: null,
  setEditing: () => undefined,
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
  const { editing, setEditing, commitText } = useGraph();
  const active = editing === id;
  const [draft, setDraft] = useState(text);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!active) return;
    setDraft(text);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.select();
    });
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
