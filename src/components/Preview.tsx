import { Maximize, Minus, Plus } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { startEditing, useEditing } from '../canvas/graph/context';
import type { DiagramModel } from '../diagrams';
import { useDiagram } from '../hooks/useDiagram';
import { useT } from '../i18n';
import { errorInfo, renderDiagram } from '../lib/mermaid';
import { PREVIEW_EDITING } from '../preview';
import type { PreviewEdit } from '../preview/types';
import { useDocuments } from '../store/documents';
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
  const box = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const size = useRef({ w: 0, h: 0 });
  const needsFit = useRef(true);

  const readOnly = (parsed.model as { readOnlyReason?: string | null } | null)?.readOnlyReason;
  const editor = parsed.model && !readOnly ? PREVIEW_EDITING[parsed.kind] : undefined;
  /** Elements can only be mapped when the drawing matches the current code. */
  const interactive = !!editor && renderedCode === code;

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

  useLayoutEffect(() => {
    const el = svgEl();
    if (!el) return;
    const vb = el.viewBox.baseVal;
    const w = vb?.width || el.getBoundingClientRect().width;
    const h = vb?.height || el.getBoundingClientRect().height;
    el.setAttribute('width', String(w));
    el.setAttribute('height', String(h));
    el.style.maxWidth = 'none';
    size.current = { w: w + PAPER_PAD * 2, h: h + PAPER_PAD * 2 };
    if (needsFit.current) {
      needsFit.current = false;
      fit();
    }
  }, [svg, fit]);

  // Tag the drawing with model ids, then show the selection on it.
  useLayoutEffect(() => {
    const el = svgEl();
    if (!el) return;
    el.querySelectorAll('[data-mme]').forEach((n) => n.removeAttribute('data-mme'));
    if (interactive && editor && parsed.model) editor.annotate(el, parsed.model);
    const sel = new Set(selection);
    el.querySelectorAll('[data-mme]').forEach((n) => n.classList.toggle('mme-sel', sel.has(n.getAttribute('data-mme')!)));
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

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('.floating-toolbar, .preview-error, .preview-inline')) return;
    const hit = hitAt(e.target);
    const start = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    let moved = false;

    if (hit && editor && parsed.model) {
      e.preventDefault();
      const from = hit.getAttribute('data-mme')!;
      const additive = e.shiftKey || e.ctrlKey || e.metaKey;
      const cur = useSelection.getState().ids;
      useSelection.getState().set(additive ? (cur.includes(from) ? cur.filter((x) => x !== from) : [...cur, from]) : [from]);
      if (!editor.connect) return;
      const r = hit.getBoundingClientRect();
      const origin = local(r.left + r.width / 2, r.top + r.height / 2);
      const move = (ev: PointerEvent) => {
        if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 6) return;
        moved = true;
        const p = local(ev.clientX, ev.clientY);
        setLink({ x0: origin.x, y0: origin.y, x: p.x, y: p.y });
      };
      const up = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        setLink(null);
        if (!moved) return;
        const target = hitAt(document.elementFromPoint(ev.clientX, ev.clientY));
        const to = target?.getAttribute('data-mme');
        if (to && to !== from && parsed.model) run(editor.connect!(parsed.model, from, to, t));
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      return;
    }

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
  }, [exclusive, editor, parsed.model, apply, run, t]);

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
