import { useState } from 'react';

interface SplitterProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  /** -1 when the resized panel is on the right of the splitter. */
  direction?: 1 | -1;
}

export function Splitter({ value, onChange, min, max, direction = 1 }: SplitterProps) {
  const [dragging, setDragging] = useState(false);
  return (
    <div
      className={`splitter${dragging ? ' dragging' : ''}`}
      role="separator"
      aria-orientation="vertical"
      onPointerDown={(e) => {
        e.preventDefault();
        const startX = e.clientX;
        const start = value;
        setDragging(true);
        document.body.style.cursor = 'col-resize';
        const move = (ev: PointerEvent) => {
          const next = start + (ev.clientX - startX) * direction;
          onChange(Math.round(Math.min(max, Math.max(min, next))));
        };
        const up = () => {
          setDragging(false);
          document.body.style.cursor = '';
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      }}
    />
  );
}
