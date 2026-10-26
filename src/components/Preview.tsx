import { Maximize, Minus, Plus, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { startEditing, useEditing } from '../canvas/graph/context';
import type { DiagramModel } from '../diagrams';
import { useDiagram } from '../hooks/useDiagram';
import { useT } from '../i18n';
import { errorInfo, renderDiagram } from '../lib/mermaid';
import { PREVIEW_EDITING } from '../preview';
import { applyManualLayout, clusterBox, clusterElements, getTranslate, naturalSize, nodeBox, nodeElements, type Structure } from '../preview/manual';
import type { PreviewEdit } from '../preview/types';
import { PREVIEW_KEY, useDocuments, type Layout } from '../store/documents';
import { useSelection } from '../store/selection';
import { useSettings } from '../store/settings';
import { useStatus } from '../store/status';

interface View {
  x: number;
  y: number;
  k: number;
}

interface Link {
  x0: number;
  y0: number;
  x: number;
  y: number;
}

interface InlineEdit {
  id: string;
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

const PAPER_PAD = 24;

interface PreviewProps {
  /** Whether the preview is the only visual editor shown (it then handles keyboard shortcuts and inline renaming). */
  exclusive?: boolean;
}

export function Preview({ exclusive = true }: PreviewProps) {
  const t = useT();
  const mermaidTheme = useSettings((s) => s.mermaidTheme);
  const look = useSettings((s) => s.look);
  const lastValid = useStatus((s) => s.lastValidCode);
  const syntaxError = useStatus((s) => s.error);
  const docId = useDocuments((s) => s.currentId);
  const code = useDocuments((s) => s.code);
  const { parsed, layout, apply } = useDiagram<DiagramModel>();
  const selection = useSelection((s) => s.ids);
  const editingId = useEditing((s) => s.id);
  const [svg, setSvg] = useState('');
  const [renderedCode, setRenderedCode] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const [panning, setPanning] = useState(false);
  const [link, setLink] = useState<Link | null>(null);
  const [inline, setInline] = useState<InlineEdit | null>(null);
  /** Bumped whenever the drawing is changed outside React, to refresh the selection frame. */
  const [tick, setTick] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const size = useRef({ w: 0, h: 0 });
  const needsFit = useRef(true);

  const readOnly = (parsed.model as { readOnlyReason?: string | null } | null)?.readOnlyReason;
  const editor = parsed.model && !readOnly ? PREVIEW_EDITING[parsed.kind] : undefined;
  /** Elements can only be mapped when the drawing matches the current code. */
  const interactive = !!editor && renderedCode === code;
  const structure: Structure | null = interactive && editor?.structure && parsed.model ? editor.structure(parsed.model) : null;

  useEffect(() => {
    needsFit.current = true;
  }, [docId]);

  useEffect(() => {
    if (lastValid === null) return;
    let cancelled = false;
    renderDiagram(lastValid, { theme: mermaidTheme, look })
      .then((out) => {
        if (cancelled) return;
        setSvg(out);
        setRenderedCode(lastValid);
        setRenderError(null);
      })
      .catch((e) => !cancelled && setRenderError(errorInfo(e).message));
    return () => {
      cancelled = true;
    };
  }, [lastValid, mermaidTheme, look]);

  const fit = useCallback(() => {
    const el = box.current;
    const { w, h } = size.current;
    if (!el || !w || !h) return;
    const bw = el.clientWidth;
    const bh = el.clientHeight;
    const k = Math.min(1.5, (bw - 32) / w, (bh - 32) / h);
    setView({ k, x: (bw - w * k) / 2, y: (bh - h * k) / 2 });
  }, []);

  const svgEl = () => content.current?.querySelector('svg') ?? null;

  // Prepare the drawing: size it, tag it with model ids, then apply the positions set by the user.
  useLayoutEffect(() => {
    const el = svgEl();
    if (!el) return;
    if (!el.hasAttribute('data-mme-sized')) {
      const vb = el.viewBox.baseVal;
      el.setAttribute('width', String(vb?.width || el.getBoundingClientRect().width));
      el.setAttribute('height', String(vb?.height || el.getBoundingClientRect().height));
      el.style.maxWidth = 'none';
      el.setAttribute('data-mme-sized', '1');
    }
    const before = { x: el.viewBox.baseVal?.x ?? 0, y: el.viewBox.baseVal?.y ?? 0 };
    el.querySelectorAll('.mme-hit').forEach((n) => n.remove());
    el.querySelectorAll('[data-mme]').forEach((n) => n.removeAttribute('data-mme'));
    if (interactive && editor && parsed.model) {
      editor.annotate(el, parsed.model);
      if (structure) applyManualLayout(el, structure, layout, { fit: true });
    }
    const vb = el.viewBox.baseVal;
    size.current = { w: (vb?.width || 0) + PAPER_PAD * 2, h: (vb?.height || 0) + PAPER_PAD * 2 };
    if (needsFit.current) {
      needsFit.current = false;
      fit();
    } else if (vb && (vb.x !== before.x || vb.y !== before.y)) {
      // Keep the drawing still on screen when its bounds grow or shrink.
      setView((v) => ({ ...v, x: v.x + (vb.x - before.x) * v.k, y: v.y + (vb.y - before.y) * v.k }));
    }
    setTick((n) => n + 1);
    // `structure` is derived from the model.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svg, interactive, editor, parsed.model, layout, fit]);

  // Show the selection on the drawing.
  useLayoutEffect(() => {
    const sel = new Set(selection);
    svgEl()
      ?.querySelectorAll('[data-mme]')
      .forEach((n) => n.classList.toggle('mme-sel', sel.has(n.getAttribute('data-mme')!)));
  }, [svg, interactive, editor, parsed.model, selection]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('textarea')) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setView((v) => {
        if (e.ctrlKey || e.metaKey) {
          const k = Math.min(8, Math.max(0.1, v.k * Math.exp(-e.deltaY * 0.0025)));
          return { k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k };
        }
        return { ...v, x: v.x - e.deltaX, y: v.y - e.deltaY };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const zoomBy = (f: number) => {
    const el = box.current;
    if (!el) return;
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    setView((v) => {
      const k = Math.min(8, Math.max(0.1, v.k * f));
      return { k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k };
    });
  };

  const run = useCallback(
    (res: PreviewEdit<DiagramModel> | null) => {
      if (!res) return;
      if (res.select) useSelection.getState().set(res.select);
      apply(res.model, res.layout);
      if (res.edit) startEditing(res.edit);
    },
    [apply],
  );

  /** Element under the pointer that maps to a model element. */
  const hitAt = (target: EventTarget | null): Element | null =>
    interactive ? ((target as Element | null)?.closest?.('[data-mme]') ?? null) : null;

  const local = (clientX: number, clientY: number) => {
    const r = box.current!.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  };

  /** Nodes moved together with `id` (a group drags all the nodes inside it). */
  const nodesUnder = (id: string, nodes: Map<string, SVGGElement>): string[] => {
    if (nodes.has(id)) return [id];
    const c = structure?.clusters.find((x) => x.id === id);
    return c ? c.members.flatMap((m) => nodesUnder(m, nodes)) : [];
  };

  /** Follows a drag in drawing units; `onEnd` receives whether the pointer really moved. */
  const drag = (e: React.PointerEvent | PointerEvent, onMove: (dx: number, dy: number, ev: PointerEvent) => void, onEnd: (moved: boolean, ev: PointerEvent) => void) => {
    const sx = e.clientX;
    const sy = e.clientY;
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
      moved = true;
      onMove((ev.clientX - sx) / view.k, (ev.clientY - sy) / view.k, ev);
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      onEnd(moved, ev);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  /** Applies a temporary layout to the drawing (while dragging). */
  const preview = (temp: Layout) => {
    const el = svgEl();
    if (el && structure) applyManualLayout(el, structure, temp);
    setTick((n) => n + 1);
  };

  const startMove = (e: React.PointerEvent, ids: string[]) => {
    const el = svgEl();
    if (!el || !structure) return;
    const nodes = nodeElements(el);
    const targets = [...new Set(ids.flatMap((id) => nodesUnder(id, nodes)))];
    const starts = new Map(targets.map((id) => [id, getTranslate(nodes.get(id)!)]));
    const base = useDocuments.getState().layout;
    let temp = base;
    drag(
      e,
      (dx, dy) => {
        temp = { ...base };
        for (const [id, p] of starts) temp[PREVIEW_KEY + id] = { ...base[PREVIEW_KEY + id], x: p.x + dx, y: p.y + dy };
        preview(temp);
      },
      (moved) => moved && useDocuments.getState().setLayout(temp, true),
    );
  };

  const startResize = (e: React.PointerEvent, id: string, sx: number, sy: number) => {
    e.stopPropagation();
    e.preventDefault();
    const el = svgEl();
    const g = el ? nodeElements(el).get(id) : undefined;
    if (!g) return;
    const base = useDocuments.getState().layout;
    const saved = base[PREVIEW_KEY + id];
    const natural = naturalSize(g);
    const center = getTranslate(g);
    const w0 = saved?.w ?? natural.w;
    const h0 = saved?.h ?? natural.h;
    let temp = base;
    drag(
      e,
      (dx, dy, ev) => {
        let w = Math.max(16, w0 + 2 * dx * sx);
        let h = Math.max(16, h0 + 2 * dy * sy);
        if (ev.shiftKey) {
          const k = Math.max(w / w0, h / h0);
          w = w0 * k;
          h = h0 * k;
        }
        temp = { ...base, [PREVIEW_KEY + id]: { x: center.x, y: center.y, w: Math.round(w), h: Math.round(h) } };
        preview(temp);
      },
      (moved) => moved && useDocuments.getState().setLayout(temp, true),
    );
  };

  /** Drags a link from `from`; dropping it on another element connects them. */
  const startConnect = (e: React.PointerEvent, from: string, origin: { x: number; y: number }) => {
    e.stopPropagation();
    e.preventDefault();
    if (!editor?.connect) return;
    drag(
      e,
      (_dx, _dy, ev) => {
        const p = local(ev.clientX, ev.clientY);
        setLink({ x0: origin.x, y0: origin.y, x: p.x, y: p.y });
      },
      (moved, ev) => {
        setLink(null);
        if (!moved || !parsed.model) return;
        const to = hitAt(document.elementFromPoint(ev.clientX, ev.clientY))?.getAttribute('data-mme');
        if (to && to !== from) run(editor.connect!(parsed.model, from, to, t));
      },
    );
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('.floating-toolbar, .preview-error, .preview-inline, .preview-sel')) return;
    const hit = hitAt(e.target);

    if (hit && editor && parsed.model) {
      e.preventDefault();
      const id = hit.getAttribute('data-mme')!;
      const additive = e.shiftKey || e.ctrlKey || e.metaKey;
      const cur = useSelection.getState().ids;
      const next = additive ? (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]) : cur.includes(id) ? cur : [id];
      useSelection.getState().set(next);
      const el = svgEl();
      const movable = el && structure ? nodesUnder(id, nodeElements(el)).length > 0 : false;
      if (movable) {
        startMove(e, next.includes(id) ? next : [id]);
        return;
      }
      // Links and labels of freely laid out diagrams are only selected.
      if (structure) return;
      const r = hit.getBoundingClientRect();
      startConnect(e, id, local(r.left + r.width / 2, r.top + r.height / 2));
      return;
    }

    const start = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    let moved = false;
    setPanning(true);
    const move = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 3) moved = true;
      setView((v) => ({ ...v, x: start.vx + ev.clientX - start.x, y: start.vy + ev.clientY - start.y }));
    };
    const up = () => {
      setPanning(false);
      if (!moved && interactive) useSelection.getState().clear();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  /** Frame around the single selected element, with resize handles and link dots. */
  const frame = (() => {
    void tick;
    const el = svgEl();
    if (!interactive || !structure || selection.length !== 1 || !el || !box.current) return null;
    const id = selection[0];
    const node = nodeElements(el).get(id);
    const cluster = node ? undefined : clusterElements(el).get(id);
    const b = node ? nodeBox(node) : cluster ? clusterBox(cluster) : null;
    if (!b?.w) return null;
    // Worked out from the drawing and the view, which may not be on screen yet.
    const vb = el.viewBox.baseVal;
    return {
      id,
      resizable: !!node,
      left: view.x + (PAPER_PAD + b.x - (vb?.x ?? 0)) * view.k,
      top: view.y + (PAPER_PAD + b.y - (vb?.y ?? 0)) * view.k,
      width: b.w * view.k,
      height: b.h * view.k,
    };
  })();

  const savedPositions = Object.keys(layout).filter((k) => k.startsWith(PREVIEW_KEY));

  // Inline renaming over the drawing (when the canvas is not shown next to it).
  useLayoutEffect(() => {
    if (!exclusive || !editingId || !editor || !parsed.model || !interactive) {
      setInline((cur) => (cur && cur.id !== editingId ? null : cur));
      return;
    }
    if (inline?.id === editingId) return;
    const el = svgEl()?.querySelector(`[data-mme="${CSS.escape(editingId)}"]`);
    const text = editor.textOf(parsed.model, editingId);
    if (!el || text === null) return;
    const r = el.getBoundingClientRect();
    const p = local(r.left, r.top);
    setInline({ id: editingId, text, left: p.x, top: p.y, width: r.width, height: r.height });
  }, [exclusive, editingId, editor, parsed.model, interactive, svg, inline?.id]);

  const finishInline = (save: boolean, value: string) => {
    const cur = inline;
    setInline(null);
    startEditing(null);
    if (!save || !cur || value === cur.text || !editor || !parsed.model) return;
    run(editor.commitText(parsed.model, cur.id, value, layout));
  };

  useEffect(() => {
    if (!exclusive || !editor) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('input, textarea, select, .cm-editor, .dialog')) return;
      const ids = useSelection.getState().ids;
      const model = parsed.model;
      if (!model) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && ids.length) {
        e.preventDefault();
        useSelection.getState().clear();
        apply(editor.remove(model, ids));
      } else if (e.key === 'F2' && ids.length === 1) {
        e.preventDefault();
        startEditing(ids[0]);
      } else if (e.key === 'Escape') {
        useSelection.getState().clear();
      } else if (structure && ids.length && e.key.startsWith('Arrow')) {
        // Arrow keys nudge the selected elements.
        const el = svgEl();
        if (!el) return;
        e.preventDefault();
        const step = e.shiftKey ? 20 : 4;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        const nodes = nodeElements(el);
        const base = useDocuments.getState().layout;
        const next = { ...base };
        for (const id of new Set(ids.flatMap((x) => nodesUnder(x, nodes)))) {
          const p = getTranslate(nodes.get(id)!);
          next[PREVIEW_KEY + id] = { ...base[PREVIEW_KEY + id], x: p.x + dx, y: p.y + dy };
        }
        useDocuments.getState().setLayout(next, true);
      } else if (editor.onKey) {
        const res = editor.onKey(e, model, ids, t);
        if (res) {
          e.preventDefault();
          run(res);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exclusive, editor, parsed.model, apply, run, t, structure]);

  const dark = mermaidTheme === 'dark';
  const message = syntaxError?.message ?? renderError;

  return (
    <div
      className={`preview${panning ? ' panning' : ''}${interactive ? ' editable' : ''}`}
      ref={box}
      onPointerDown={onPointerDown}
      onDoubleClick={(e) => {
        const hit = hitAt(e.target);
        const id = hit?.getAttribute('data-mme');
        if (id && editor && parsed.model && editor.textOf(parsed.model, id) !== null) startEditing(id);
      }}
    >
      <div className="preview-content" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
        <div
          ref={content}
          className="preview-paper"
          style={{ background: dark ? '#1f2020' : '#ffffff', padding: PAPER_PAD }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      {link && (
        <svg className="preview-link" aria-hidden="true">
          <line x1={link.x0} y1={link.y0} x2={link.x} y2={link.y} />
          <circle cx={link.x} cy={link.y} r={4} />
        </svg>
      )}

      {frame && (
        <div className="preview-sel" style={{ left: frame.left - 4, top: frame.top - 4, width: frame.width + 8, height: frame.height + 8 }}>
          {frame.resizable &&
            ([
              [-1, -1, 'nw'],
              [1, -1, 'ne'],
              [-1, 1, 'sw'],
              [1, 1, 'se'],
            ] as const).map(([sx, sy, c]) => (
              <span key={c} className={`preview-handle ${c}`} title={t('preview.resize')} onPointerDown={(e) => startResize(e, frame.id, sx, sy)} />
            ))}
          {editor?.connect &&
            (['n', 's', 'w', 'e'] as const).map((side) => (
              <span
                key={side}
                className={`preview-dot ${side}`}
                title={t('preview.connect')}
                onPointerDown={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  startConnect(e, frame.id, local(r.left + r.width / 2, r.top + r.height / 2));
                }}
              />
            ))}
        </div>
      )}

      {inline && (
        <InlineEditor
          key={inline.id}
          edit={inline}
          onDone={finishInline}
        />
      )}

      {interactive && editor && (
        <div className="floating-toolbar vertical palette" onPointerDown={(e) => e.stopPropagation()}>
          {editor.addActions(t).map((a) => (
            <button
              key={a.id}
              type="button"
              className="icon-btn"
              title={a.title}
              onClick={(e) => {
                e.currentTarget.blur();
                if (parsed.model) run(a.run(parsed.model, useSelection.getState().ids, layout));
              }}
            >
              {a.icon}
            </button>
          ))}
        </div>
      )}

      <div className="floating-toolbar" style={{ right: 12, top: 12 }}>
        <button type="button" className="icon-btn small" title={t('preview.zoomOut')} onClick={() => zoomBy(1 / 1.2)}>
          <Minus size={15} />
        </button>
        <span className="zoom-label">{Math.round(view.k * 100)}%</span>
        <button type="button" className="icon-btn small" title={t('preview.zoomIn')} onClick={() => zoomBy(1.2)}>
          <Plus size={15} />
        </button>
        <span className="sep" />
        <button type="button" className="icon-btn small" title={t('preview.fit')} onClick={fit}>
          <Maximize size={14} />
        </button>
        {structure && (
          <button
            type="button"
            className="icon-btn small"
            title={t('preview.resetLayout')}
            disabled={!savedPositions.length}
            onClick={() => {
              const next = { ...layout };
              for (const k of savedPositions) delete next[k];
              useDocuments.getState().setLayout(next, true);
            }}
          >
            <RotateCcw size={14} />
          </button>
        )}
      </div>
      {interactive && <div className="canvas-hint">{t('preview.editHint')}</div>}
      {message && (
        <div className="preview-error">
          <strong>
            {t('preview.error')}
            {svg ? ` — ${t('preview.lastValid')}` : ''}
          </strong>
          {message}
        </div>
      )}
    </div>
  );
}

function InlineEditor({ edit, onDone }: { edit: InlineEdit; onDone: (save: boolean, value: string) => void }) {
  const [value, setValue] = useState(edit.text);
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    onDone(save, value);
  };
  const width = Math.max(140, edit.width + 24);
  return (
    <textarea
      ref={ref}
      className="preview-inline mme-inline-edit"
      style={{
        left: edit.left + edit.width / 2 - width / 2,
        top: edit.top + edit.height / 2 - 16,
        width,
      }}
      value={value}
      rows={Math.max(1, value.split('\n').length)}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish(true)}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') finish(false);
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          finish(true);
        }
      }}
    />
  );
}
