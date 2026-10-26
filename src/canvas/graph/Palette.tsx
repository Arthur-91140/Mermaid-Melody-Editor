import { useReactFlow } from '@xyflow/react';
import type { ReactNode } from 'react';
import type { Pos } from '../../store/documents';
import { DRAG_MIME } from './GraphCanvas';

export interface PaletteItem {
  payload: string;
  title: string;
  icon: ReactNode;
  separatorBefore?: boolean;
}

/** Vertical tool palette: click adds at the view center, drag drops where released. */
export function Palette({ items, onAdd, extra }: { items: PaletteItem[]; onAdd: (payload: string, pos: Pos, free: boolean) => void; extra?: ReactNode }) {
  const rf = useReactFlow();
  const center = (): Pos => {
    const r = document.querySelector('.graph-canvas')?.getBoundingClientRect();
    return rf.screenToFlowPosition({ x: (r?.left ?? 0) + (r?.width ?? 600) / 2, y: (r?.top ?? 0) + (r?.height ?? 400) / 2 });
  };
  return (
    <div className="floating-toolbar vertical palette">
      {items.map((it) => (
        <span key={it.payload} style={{ display: 'contents' }}>
          {it.separatorBefore && <span className="sep" />}
          <button
            type="button"
            className="icon-btn palette-item"
            title={it.title}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(DRAG_MIME, it.payload);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onClick={(e) => {
              e.currentTarget.blur();
              onAdd(it.payload, center(), true);
            }}
          >
            {it.icon}
          </button>
        </span>
      ))}
      {extra}
    </div>
  );
}
