import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export interface View {
  x: number;
  y: number;
  k: number;
}

/** Wheel / drag navigation for canvases drawn without React Flow. */
export function usePanZoom(box: RefObject<HTMLDivElement | null>, initial: View = { x: 24, y: 16, k: 1 }) {
  const [view, setView] = useState<View>(initial);
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('textarea, input, select')) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setView((v) => {
        if (e.ctrlKey || e.metaKey) {
          const k = Math.min(3, Math.max(0.2, v.k * Math.exp(-e.deltaY * 0.0025)));
          return { k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k };
        }
        const dx = e.shiftKey ? e.deltaY : e.deltaX;
        const dy = e.shiftKey ? 0 : e.deltaY;
        return { ...v, x: v.x - dx, y: v.y - dy };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [box]);

  /** Starts panning from a pointer-down on the background. */
  const startPan = useCallback((e: React.PointerEvent) => {
    const start = { x: e.clientX, y: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y };
    const move = (ev: PointerEvent) => setView((v) => ({ ...v, x: start.vx + ev.clientX - start.x, y: start.vy + ev.clientY - start.y }));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, []);

  const zoomBy = useCallback(
    (f: number) => {
      const el = box.current;
      const cx = (el?.clientWidth ?? 600) / 2;
      const cy = (el?.clientHeight ?? 400) / 2;
      setView((v) => {
        const k = Math.min(3, Math.max(0.2, v.k * f));
        return { k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k };
      });
    },
    [box],
  );

  /** Fits a `w` × `h` world rectangle starting at (0, 0); `widthOnly` lets tall content scroll. */
  const fit = useCallback(
    (w: number, h: number, maxK = 1, widthOnly = false) => {
      const el = box.current;
      if (!el || !w || !h) return;
      const byWidth = (el.clientWidth - 88) / w;
      const k = Math.max(0.25, Math.min(maxK, widthOnly ? byWidth : Math.min(byWidth, (el.clientHeight - 48) / h)));
      // Leaves room for the tool palette on the left.
      setView({ k, x: Math.max(64, (el.clientWidth - w * k) / 2), y: 24 });
    },
    [box],
  );

  /** Converts screen coordinates to world coordinates. */
  const toWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = box.current?.getBoundingClientRect();
      const v = viewRef.current;
      return { x: (clientX - (rect?.left ?? 0) - v.x) / v.k, y: (clientY - (rect?.top ?? 0) - v.y) / v.k };
    },
    [box],
  );

  return { view, setView, startPan, zoomBy, fit, toWorld };
}
