import { useCallback, useEffect, useMemo } from 'react';
import { useDiagram } from '../../hooks/useDiagram';
import type { Layout, Pos } from '../../store/documents';
import { autoLayout, freeSpot, placeMissing, type LayoutItem, type LayoutLink, type RankDir } from './layout';

/**
 * Positions for a graph canvas: saved positions first, computed ones for new
 * items (remembered so that they stay put), plus helpers for drags and auto-layout.
 * Layout keys are model keys; `toCanvasId` maps them to canvas ids.
 */
export function useGraphLayout(items: LayoutItem[], links: LayoutLink[], dir: RankDir, toCanvasId: (key: string) => string) {
  const { layout, setLayout } = useDiagram();
  const positions = useMemo(() => placeMissing(items, links, layout, dir), [items, links, layout, dir]);

  useEffect(() => {
    const added = Object.keys(positions).filter((k) => !layout[k]);
    if (!added.length) return;
    const next: Layout = { ...layout };
    for (const k of added) next[k] = positions[k];
    setLayout(next);
  }, [positions, layout, setLayout]);

  /** Saves dragged positions (canvas ids → model keys) as one undo step. */
  const onMove = useCallback(
    (moved: Record<string, Pos>, toKey: (canvasId: string) => string | null) => {
      const next = { ...layout };
      for (const [cid, p] of Object.entries(moved)) {
        const key = toKey(cid);
        if (key) next[key] = p;
      }
      setLayout(next, true);
    },
    [layout, setLayout],
  );

  const relayout = useCallback(
    (sizes: Record<string, { width: number; height: number }>) => {
      const measured = items.map((it) => {
        const s = sizes[toCanvasId(it.id)];
        return it.isGroup || !s ? it : { ...it, width: s.width, height: s.height };
      });
      setLayout({ ...layout, ...autoLayout(measured, links, dir) }, true);
    },
    [items, links, dir, layout, setLayout, toCanvasId],
  );

  /** Top-left position for a new `w` × `h` item centered on `center`, optionally moved to free space. */
  const spotFor = useCallback(
    (center: Pos, w: number, h: number, free: boolean): Pos => {
      const at = { x: Math.round(center.x - w / 2), y: Math.round(center.y - h / 2) };
      if (!free) return at;
      const boxes = items
        .filter((it) => !it.isGroup && positions[it.id])
        .map((it) => ({ x: positions[it.id].x, y: positions[it.id].y, w: it.width, h: it.height }));
      return freeSpot(at, w, h, boxes);
    },
    [items, positions],
  );

  return { positions, layout, onMove, relayout, spotFor };
}
