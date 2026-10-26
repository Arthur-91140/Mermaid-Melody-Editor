import dayjs from 'dayjs';
import { FolderPlus, ListPlus, Maximize, Minus, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { allTasks, getSetting, type GanttModel, type GanttTask } from '../../diagrams/gantt/model';
import {
  addSection,
  addTask,
  deleteSection,
  deleteTasks,
  moveTask,
  moveTaskTo,
  renameSection,
  resizeTaskTo,
  taskKeyAfterReparse,
  updateTask,
} from '../../diagrams/gantt/ops';
import { calendarOf, isExcluded, schedule, type ScheduledTask } from '../../diagrams/gantt/schedule';
import { useDiagram } from '../../hooks/useDiagram';
import { useT } from '../../i18n';
import { useDocuments } from '../../store/documents';
import { useSelection } from '../../store/selection';
import { useSettings } from '../../store/settings';
import { EditableText, GraphContext, startEditing, type GraphCallbacks } from '../graph/context';
import { ganttIds } from './ids';
import { DAY, MIN, ticks } from './timeScale';

const LEFT_W = 230;
const HEAD_H = 44;
const ROW_H = 34;
const SEC_H = 30;

type Row =
  | { kind: 'section'; index: number; name: string | null; y: number; h: number }
  | { kind: 'task'; section: number; pos: number; task: GanttTask; s: ScheduledTask; y: number; h: number };

type Drag = { key: string; mode: 'move' | 'resize'; dx: number } | { key: string; mode: 'row'; y: number };

export function GanttCanvas() {
  const t = useT();
  const lang = useSettings((s) => s.language);
  const { model, apply } = useDiagram<GanttModel>();
  const docId = useDocuments((s) => s.currentId) ?? '';
  const scroller = useRef<HTMLDivElement>(null);
  const leftWrap = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ left: 0, top: 0 });
  const [viewW, setViewW] = useState(0);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    setViewW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const selected = useSelection((s) => s.ids);
  const sel = new Set(selected);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [pxPerMs, setPxPerMs] = useState<number | null>(null);

  const cal = useMemo(() => calendarOf(model), [model]);
  const timeBased = /[Hhms]/.test(cal.dateFormat.replace(/MMM|MM|M/g, ''));
  const scheduled = useMemo(() => schedule(model), [model]);
  const byKey = useMemo(() => new Map(scheduled.map((s) => [s.key, s])), [scheduled]);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    let y = 0;
    model.sections.forEach((sec, si) => {
      if (sec.name !== null) {
        out.push({ kind: 'section', index: si, name: sec.name, y, h: SEC_H });
        y += SEC_H;
      }
      sec.tasks.forEach((task, pos) => {
        out.push({ kind: 'task', section: si, pos, task, s: byKey.get(task.key)!, y, h: ROW_H });
        y += ROW_H;
      });
    });
    return out;
  }, [model.sections, byKey]);
  const bodyH = rows.reduce((s, r) => s + r.h, 0) + ROW_H;

  const range = useMemo(() => {
    const valid = scheduled.filter((s) => s.valid);
    const today = Date.now();
    if (!valid.length) return { t0: today - 2 * DAY, t1: today + 14 * DAY };
    const min = Math.min(...valid.map((s) => s.start.getTime()));
    const max = Math.max(...valid.map((s) => Math.max(s.end.getTime(), s.renderEnd.getTime())));
    const pad = timeBased ? Math.max(5 * MIN, (max - min) * 0.08) : 2 * DAY;
    return { t0: dayjs(min - pad).startOf(timeBased ? 'minute' : 'day').valueOf(), t1: max + pad * 2 };
  }, [scheduled, timeBased]);

  const fitScale = () => {
    const w = (viewW || 700) - 40;
    return Math.max(w, 200) / Math.max(range.t1 - range.t0, MIN);
  };
  useEffect(() => setPxPerMs(null), [docId]);
  const scale = pxPerMs ?? fitScale();
  const x = (time: number) => (time - range.t0) * scale;
  const width = Math.max(200, x(range.t1));
  const axis = useMemo(
    () => ticks(range.t0, range.t1, scale, lang, getSetting(model, 'axisFormat')),
    [range, scale, lang, model],
  );

  const callbacks: GraphCallbacks = {
    setEditing: startEditing,
    commitText: (cid, text) => {
      const p = ganttIds.parse(cid);
      const value = text.trim().replace(/[:\n]/g, ' ');
      if (!value) return;
      if (p.kind === 'task') apply(updateTask(model, p.id, { name: value }));
      else apply(renameSection(model, Number(p.id), value));
    },
  };

  const select = (id: string, additive: boolean) => {
    const cur = useSelection.getState().ids;
    useSelection.getState().set(additive ? (cur.includes(id) ? cur.filter((v) => v !== id) : [...cur, id]) : [id]);
  };

  const deleteSelection = (ids: string[]) => {
    const parsed = ids.map(ganttIds.parse);
    let next = deleteTasks(model, parsed.filter((p) => p.kind === 'task').map((p) => p.id));
    for (const i of parsed.filter((p) => p.kind === 'section').map((p) => Number(p.id)).sort((a, b) => b - a)) next = deleteSection(next, i);
    useSelection.getState().clear();
    apply(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('input, textarea, select, .cm-editor, .dialog')) return;
      const ids = useSelection.getState().ids;
      if ((e.key === 'Delete' || e.key === 'Backspace') && ids.length) {
        e.preventDefault();
        deleteSelection(ids);
      } else if (e.key === 'F2' && ids.length === 1) {
        e.preventDefault();
        startEditing(ids[0]);
      } else if (e.key === 'Escape') useSelection.getState().clear();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /** Snaps a time delta to whole days, or to 5 minutes for time-based charts. */
  const snap = (ms: number) => {
    const unit = timeBased ? (scale * 5 * MIN > 6 ? 5 * MIN : 60 * MIN) : DAY;
    return Math.round(ms / unit) * unit;
  };

  const startBarDrag = (e: React.PointerEvent, row: Extract<Row, { kind: 'task' }>, mode: 'move' | 'resize') => {
    if (e.button !== 0) return;
    e.stopPropagation();
    select(ganttIds.task(row.task.key), e.shiftKey || e.ctrlKey || e.metaKey);
    if (!row.s.valid) return;
    const sx = e.clientX;
    let dx = 0;
    const move = (ev: PointerEvent) => {
      dx = ev.clientX - sx;
      if (Math.abs(dx) > 3) setDrag({ key: row.task.key, mode, dx });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDrag(null);
      const delta = snap(dx / scale);
      if (!delta) return;
      if (mode === 'move') apply(moveTaskTo(model, row.task.key, new Date(row.s.start.getTime() + delta), row.s.start));
      else apply(resizeTaskTo(model, row.task.key, row.s.start, new Date(row.s.end.getTime() + delta)));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const startRowDrag = (e: React.PointerEvent, row: Extract<Row, { kind: 'task' }>) => {
    if (e.button !== 0) return;
    select(ganttIds.task(row.task.key), e.shiftKey || e.ctrlKey || e.metaKey);
    const top = (leftWrap.current?.getBoundingClientRect().top ?? 0) - (scroller.current?.scrollTop ?? 0);
    const sy = e.clientY;
    let moved = false;
    let y = 0;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.abs(ev.clientY - sy) < 5) return;
      moved = true;
      y = ev.clientY - top;
      setDrag({ key: row.task.key, mode: 'row', y });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDrag(null);
      if (!moved) return;
      const target = dropTarget(y);
      if (!target) return;
      apply(moveTask(model, row.task.key, target.section, target.pos > row.pos && target.section === row.section ? target.pos - 1 : target.pos));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  /** Section and position where a task dragged to `y` lands. */
  const dropTarget = (y: number): { section: number; pos: number; lineY: number } | null => {
    let last: { section: number; pos: number; lineY: number } | null = { section: 0, pos: 0, lineY: 0 };
    for (const r of rows) {
      if (y < r.y + r.h / 2) {
        if (r.kind === 'task') return { section: r.section, pos: r.pos, lineY: r.y };
        return last ?? { section: r.index, pos: 0, lineY: r.y + r.h };
      }
      last = r.kind === 'task' ? { section: r.section, pos: r.pos + 1, lineY: r.y + r.h } : { section: r.index, pos: 0, lineY: r.y + r.h };
    }
    return last;
  };

  const addTaskAction = () => {
    const sel0 = selected.map(ganttIds.parse).find((p) => p.kind === 'task');
    const selRow = rows.find((r) => r.kind === 'task' && sel0 && r.task.key === sel0.id) as Extract<Row, { kind: 'task' }> | undefined;
    const secSel = selected.map(ganttIds.parse).find((p) => p.kind === 'section');
    const section = selRow ? selRow.section : secSel ? Number(secSel.id) : model.sections.length - 1;
    const hasTasks = allTasks(model).length > 0;
    let res = addTask(model, section, {
      name: t('gantt.newTask'),
      start: hasTasks ? { kind: 'prev' } : { kind: 'date', value: dayjs().format(cal.dateFormat) },
      end: { kind: 'duration', value: timeBased ? '30m' : '3d' },
    });
    if (selRow) res = { ...res, model: moveTask(res.model, res.key, section, selRow.pos + 1) };
    const key = taskKeyAfterReparse(res.model, res.key);
    useSelection.getState().set([ganttIds.task(key)]);
    apply(res.model);
    setTimeout(() => startEditing(ganttIds.task(key)), 60);
  };

  const addSectionAction = () => {
    const next = addSection(model, t('gantt.newSection'));
    const index = next.sections.length - 1;
    useSelection.getState().set([ganttIds.section(index)]);
    apply(next);
    setTimeout(() => startEditing(ganttIds.section(index)), 60);
  };

  // ---- Rendering ----
  const bars: ReactNode[] = [];
  const labels: ReactNode[] = [];
  const deps: ReactNode[] = [];
  const idToRow = new Map<string, Extract<Row, { kind: 'task' }>>();
  for (const r of rows) if (r.kind === 'task') idToRow.set(r.s.id, r);

  for (const r of rows) {
    if (r.kind === 'section') {
      const id = ganttIds.section(r.index);
      labels.push(
        <div
          key={id}
          className={`gantt-section${sel.has(id) ? ' selected' : ''}`}
          style={{ top: r.y, height: r.h }}
          onPointerDown={(e) => select(id, e.shiftKey || e.ctrlKey || e.metaKey)}
          onDoubleClick={() => startEditing(id)}
        >
          <EditableText id={id} text={r.name ?? ''} multiline={false} />
        </div>,
      );
      bars.push(<div key={`band${id}`} className="gantt-band" style={{ top: r.y, height: r.h, width }} />);
      continue;
    }
    const id = ganttIds.task(r.task.key);
    const isSel = sel.has(id);
    const tags = r.task.tags;
    const d = drag && drag.key === r.task.key && drag.mode !== 'row' ? drag : null;
    const start = x(r.s.start.getTime()) + (d?.mode === 'move' ? d.dx : 0);
    const end = x(r.s.renderEnd.getTime()) + (d ? d.dx : 0);
    const cls = ['gantt-bar', ...tags, isSel ? 'selected' : '', r.s.valid ? '' : 'invalid'].filter(Boolean).join(' ');
    labels.push(
      <div
        key={id}
        className={`gantt-name${isSel ? ' selected' : ''}`}
        style={{ top: r.y, height: r.h, opacity: drag?.mode === 'row' && drag.key === r.task.key ? 0.4 : 1 }}
        onPointerDown={(e) => startRowDrag(e, r)}
        onDoubleClick={() => startEditing(id)}
        title={r.s.id}
      >
        <EditableText id={id} text={r.task.name} multiline={false} />
      </div>,
    );
    if (tags.includes('milestone')) {
      const cx = start;
      bars.push(
        <div
          key={`bar${id}`}
          className={`${cls} milestone`}
          style={{ left: cx - 9, top: r.y + r.h / 2 - 9 }}
          onPointerDown={(e) => startBarDrag(e, r, 'move')}
          title={`${r.task.name} — ${r.s.start.toLocaleString(lang)}`}
        />,
      );
    } else if (tags.includes('vert')) {
      bars.push(<div key={`bar${id}`} className="gantt-vert" style={{ left: start, height: bodyH }} title={r.task.name} />);
    } else {
      bars.push(
        <div
          key={`bar${id}`}
          className={cls}
          style={{ left: start, top: r.y + 7, width: Math.max(6, end - start), height: r.h - 14 }}
          onPointerDown={(e) => startBarDrag(e, r, 'move')}
          title={`${r.task.name}\n${r.s.start.toLocaleString(lang)} → ${r.s.end.toLocaleString(lang)}`}
        >
          <span className="gantt-bar-label">{r.task.name}</span>
          <span className="gantt-resize" onPointerDown={(e) => startBarDrag(e, r, 'resize')} />
        </div>,
      );
    }
    if (r.task.start.kind === 'after') {
      for (const ref of r.task.start.ids) {
        const from = idToRow.get(ref);
        if (!from) continue;
        const x1 = x(from.s.renderEnd.getTime());
        const y1 = from.y + from.h / 2;
        const x2 = start;
        const y2 = r.y + r.h / 2;
        deps.push(
          <path
            key={`dep${ref}${id}`}
            d={`M ${x1} ${y1} H ${Math.max(x1 + 8, x2 - 10)} V ${y2} H ${x2 - 2}`}
            fill="none"
            stroke="var(--faint)"
            strokeWidth={1.3}
            markerEnd="url(#gantt-arrow)"
          />,
        );
      }
    }
  }

  // Shade excluded days when days are wide enough to see.
  const shades: ReactNode[] = [];
  if (cal.excludes.length && scale * DAY >= 6 && !timeBased) {
    for (let d = dayjs(range.t0).startOf('day'); d.valueOf() < range.t1; d = d.add(1, 'day')) {
      if (isExcluded(d, cal)) shades.push(<div key={d.valueOf()} className="gantt-shade" style={{ left: x(d.valueOf()), width: scale * DAY, height: bodyH }} />);
    }
  }
  const now = Date.now();
  const todayOn = (getSetting(model, 'todayMarker') ?? '') !== 'off' && now > range.t0 && now < range.t1;
  const rowDrop = drag?.mode === 'row' ? dropTarget(drag.y) : null;

  return (
    <GraphContext.Provider value={callbacks}>
      <div className="gantt-canvas" style={{ gridTemplateColumns: `${LEFT_W}px 1fr`, gridTemplateRows: `${HEAD_H}px 1fr` }}>
        <div className="gantt-corner">{getSetting(model, 'title') ?? ''}</div>
        <div className="gantt-axis-wrap">
          <div className="gantt-axis" style={{ width: width + 40, transform: `translateX(${-scroll.left}px)` }}>
            {axis.ticks.map((tk) => (
              <div key={tk.t} className="gantt-tick" style={{ left: x(tk.t) }}>
                {tk.label}
              </div>
            ))}
          </div>
        </div>
        <div
          className="gantt-left-wrap"
          ref={leftWrap}
          onWheel={(e) => {
            if (scroller.current) scroller.current.scrollTop += e.deltaY;
          }}
        >
          <div className="gantt-left" style={{ height: bodyH, transform: `translateY(${-scroll.top}px)` }}>
            {labels}
            {rowDrop && <div className="gantt-drop" style={{ top: rowDrop.lineY }} />}
          </div>
        </div>
        <div
          className="gantt-scroll"
          ref={scroller}
          onScroll={(e) => setScroll({ left: e.currentTarget.scrollLeft, top: e.currentTarget.scrollTop })}
        >
          <div
            className="gantt-body"
            style={{ width: width + 40, height: bodyH }}
            onPointerDown={(e) => e.target === e.currentTarget && useSelection.getState().clear()}
          >
            {shades}
            {axis.ticks.map((tk) => (
              <div key={tk.t} className="gantt-gridline" style={{ left: x(tk.t), height: bodyH }} />
            ))}
            <svg className="gantt-deps" width={width} height={bodyH} aria-hidden="true">
              <defs>
                <marker id="gantt-arrow" viewBox="-8 -5 10 10" refX={0} refY={0} markerWidth={8} markerHeight={8} orient="auto">
                  <path d="M -7 -4 L 0 0 L -7 4 z" fill="var(--faint)" />
                </marker>
              </defs>
              {deps}
            </svg>
            {bars}
            {todayOn && (
              <div className="gantt-today" style={{ left: x(now), height: bodyH }}>
                <span>{t('gantt.today')}</span>
              </div>
            )}
          </div>
        </div>
        <div className="floating-toolbar" style={{ left: 12, bottom: 12 }}>
          <button type="button" className="icon-btn small" title={t('gantt.addTask')} onClick={addTaskAction}>
            <ListPlus size={15} />
          </button>
          <button type="button" className="icon-btn small" title={t('gantt.addSection')} onClick={addSectionAction}>
            <FolderPlus size={15} />
          </button>
          <span className="sep" />
          <button type="button" className="icon-btn small" title={t('canvas.zoomOut')} onClick={() => setPxPerMs(scale / 1.5)}>
            <Minus size={15} />
          </button>
          <button type="button" className="icon-btn small" title={t('canvas.zoomIn')} onClick={() => setPxPerMs(scale * 1.5)}>
            <Plus size={15} />
          </button>
          <button type="button" className="icon-btn small" title={t('canvas.fit')} onClick={() => setPxPerMs(null)}>
            <Maximize size={14} />
          </button>
        </div>
      </div>
    </GraphContext.Provider>
  );
}
