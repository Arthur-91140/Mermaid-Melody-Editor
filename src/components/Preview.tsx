import { Maximize, Minus, Plus } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { errorInfo, renderDiagram } from '../lib/mermaid';
import { useDocuments } from '../store/documents';
import { useSettings } from '../store/settings';
import { useStatus } from '../store/status';

interface View {
  x: number;
  y: number;
  k: number;
}

const PAPER_PAD = 24;

export function Preview() {
  const t = useT();
  const mermaidTheme = useSettings((s) => s.mermaidTheme);
  const look = useSettings((s) => s.look);
  const lastValid = useStatus((s) => s.lastValidCode);
  const syntaxError = useStatus((s) => s.error);
  const docId = useDocuments((s) => s.currentId);
  const [svg, setSvg] = useState('');
  const [renderError, setRenderError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const [panning, setPanning] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const size = useRef({ w: 0, h: 0 });
  const needsFit = useRef(true);

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

  useLayoutEffect(() => {
    const svgEl = content.current?.querySelector('svg');
    if (!svgEl) return;
    const vb = svgEl.viewBox.baseVal;
    const w = vb?.width || svgEl.getBoundingClientRect().width;
    const h = vb?.height || svgEl.getBoundingClientRect().height;
    svgEl.setAttribute('width', String(w));
    svgEl.setAttribute('height', String(h));
    svgEl.style.maxWidth = 'none';
    size.current = { w: w + PAPER_PAD * 2, h: h + PAPER_PAD * 2 };
    if (needsFit.current) {
      needsFit.current = false;
      fit();
    }
  }, [svg, fit]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
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

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('.floating-toolbar, .preview-error')) return;
    const start = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    setPanning(true);
    const move = (ev: PointerEvent) =>
      setView((v) => ({ ...v, x: start.vx + ev.clientX - start.x, y: start.vy + ev.clientY - start.y }));
    const up = () => {
      setPanning(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const dark = mermaidTheme === 'dark';
  const message = syntaxError?.message ?? renderError;

  return (
    <div className={`preview${panning ? ' panning' : ''}`} ref={box} onPointerDown={onPointerDown}>
      <div
        className="preview-content"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
      >
        <div
          ref={content}
          className="preview-paper"
          style={{ background: dark ? '#1f2020' : '#ffffff', padding: PAPER_PAD }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
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
