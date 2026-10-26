import { Brackets, Hash, Maximize, MessageSquarePlus, Minus, Plus, SplitSquareVertical, StickyNote, User, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { decodeEntities } from '../../diagrams/common';
import { BRANCH_OF, type BlockKind, type SeqItem, type SeqModel } from '../../diagrams/sequence/model';
import {
  addBranch,
  addParticipant,
  blockOf,
  deleteItems,
  deleteParticipants,
  hasAutonumber,
  insertItem,
  moveItem,
  moveParticipant,
  PARTICIPANT_ID_RE,
  participantTaken,
  renameParticipant,
  toggleAutonumber,
  updateItem,
  updateParticipant,
  wrapItems,
} from '../../diagrams/sequence/ops';
import { useDiagram } from '../../hooks/useDiagram';
import { useT, type TranslationKey } from '../../i18n';
import { useDocuments } from '../../store/documents';
import { useSelection } from '../../store/selection';
import { Menu, MenuItem } from '../../ui/Menu';
import { EditableText, GraphContext, startEditing, type GraphCallbacks } from '../graph/context';
import { usePanZoom } from '../usePanZoom';
import { BLOCK_KINDS, seqIds } from './ids';
import { columnAtX, COL_W, HEADER_H, indexAtY, layoutSequence, TOP, type SeqLayout } from './seqLayout';

type Drag =
  | { kind: 'message'; from: string; x0: number; y0: number; x: number; y: number }
  | { kind: 'item'; index: number; y: number }
  | { kind: 'participant'; id: string; x: number };

const decode = (s: string) => decodeEntities(s.replace(/<br\s*\/?>/gi, '\n'));
const encode = (s: string) => s.replace(/\r?\n/g, '<br>').replace(/;/g, '#59;').replace(/#(?!\w+;)/g, '#35;');

function arrowStyle(arrow: string) {
  const dashed = /^(<<)?--/.test(arrow);
  let head: 'filled' | 'open' | 'cross' | 'none' = 'filled';
  if (arrow.endsWith('x')) head = 'cross';
  else if (arrow.endsWith(')')) head = 'open';
  else if (/[^>]>$/.test(arrow) || arrow === '->' || arrow === '-->') head = 'none';
  return { dashed, head, both: arrow.startsWith('<<') };
}

function boxColor(raw: string): string | null {
  const first = raw.trim().split(/\s+/)[0] ?? '';
  const rgb = /^(rgba?\([^)]*\))/.exec(raw.trim());
  if (rgb) return rgb[1];
  try {
    if (first && typeof CSS !== 'undefined' && CSS.supports('color', first) && !/^(transparent)$/i.test(first)) return first;
  } catch {
    /* ignored */
  }
  return null;
}

function boxLabel(raw: string): string {
  const color = boxColor(raw);
  if (!color) return raw;
  return raw.trim().slice(color.length).trim();
}

function noteGeometry(layout: SeqLayout, it: Extract<SeqItem, { t: 'note' }>): { x: number; w: number } {
  const xs = it.actors.map((a) => layout.centerOf.get(a) ?? 0);
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  if (it.position === 'left of') return { x: min - COL_W / 2 - 4, w: COL_W / 2 - 4 + 6 };
  if (it.position === 'right of') return { x: min + 10, w: COL_W - 30 };
  return { x: min - 62, w: max - min + 124 };
}

export function SequenceCanvas() {
  const t = useT();
  const { model, apply } = useDiagram<SeqModel>();
  const docId = useDocuments((s) => s.currentId) ?? '';
  const box = useRef<HTMLDivElement>(null);
  const { view, startPan, zoomBy, fit, toWorld } = usePanZoom(box);
  const layout = useMemo(() => layoutSequence(model), [model]);
  const selected = useSelection((s) => s.ids);
  const sel = new Set(selected);
  const [drag, setDrag] = useState<Drag | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => fit(layout.width, layout.height), 30);
    return () => clearTimeout(timer);
    // Only when another document is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  const select = (id: string, additive: boolean) => {
    const cur = useSelection.getState().ids;
    useSelection.getState().set(additive ? (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]) : [id]);
  };

  const commitText = (cid: string, text: string) => {
    const p = seqIds.parse(cid);
    if (p.kind === 'participant') {
      const part = model.participants.find((x) => x.id === p.id);
      const value = text.trim();
      if (!part || !value) return;
      if (part.label === null && PARTICIPANT_ID_RE.test(value) && !participantTaken(model, value)) {
        useSelection.getState().set([seqIds.participant(value)]);
        apply(renameParticipant(model, p.id, value));
      } else apply(updateParticipant(model, p.id, { label: value === p.id ? null : value }));
      return;
    }
    const i = Number(p.id);
    const it = model.items[i];
    if (!it) return;
    if (it.t === 'message' || it.t === 'note') apply(updateItem(model, i, { text: encode(text.trim()) }));
    else if (it.t === 'block' || it.t === 'branch') apply(updateItem(model, i, { label: text.trim() }));
    else if (it.t === 'raw' && text.trim()) apply(updateItem(model, i, { text: text.trim() }));
  };
  const callbacks: GraphCallbacks = { setEditing: startEditing, commitText };

  const deleteSelection = (ids: string[]) => {
    const parsed = ids.map(seqIds.parse);
    let next = deleteItems(
      model,
      parsed.filter((p) => p.kind === 'item').map((p) => Number(p.id)),
    );
    next = deleteParticipants(next, parsed.filter((p) => p.kind === 'participant').map((p) => p.id));
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

  /** Tracks a pointer drag; `onEnd` receives the last world position (null if it was just a click). */
  const track = (e: React.PointerEvent, onMove: (w: { x: number; y: number }) => void, onEnd: (w: { x: number; y: number } | null) => void) => {
    e.stopPropagation();
    const sx = e.clientX;
    const sy = e.clientY;
    let moved = false;
    let last = toWorld(sx, sy);
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
      moved = true;
      last = toWorld(ev.clientX, ev.clientY);
      onMove(last);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      onEnd(moved ? last : null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const startMessage = (e: React.PointerEvent, from: string) => {
    if (e.button !== 0) return;
    const w = toWorld(e.clientX, e.clientY);
    const x0 = layout.centerOf.get(from) ?? w.x;
    track(
      e,
      (p) => setDrag({ kind: 'message', from, x0, y0: w.y, x: p.x, y: w.y }),
      (p) => {
        setDrag(null);
        if (!p) return;
        const col = columnAtX(model.participants.length, p.x);
        const to = model.participants[col]?.id;
        if (!to) return;
        if (to === from && Math.abs(p.x - x0) < 20) return;
        const index = indexAtY(layout, w.y);
        const item: SeqItem = { t: 'message', from, to, arrow: '->>', text: t('seq.newMessage'), activate: '' };
        useSelection.getState().set([seqIds.item(index)]);
        apply(insertItem(model, item, index));
        setTimeout(() => startEditing(seqIds.item(index)), 60);
      },
    );
  };

  const startItemDrag = (e: React.PointerEvent, index: number) => {
    if (e.button !== 0) return;
    select(seqIds.item(index), e.shiftKey || e.metaKey || e.ctrlKey);
    track(
      e,
      (p) => setDrag({ kind: 'item', index, y: p.y }),
      (p) => {
        setDrag(null);
        if (!p) return;
        let to = indexAtY(layout, p.y);
        if (to > index) to--;
        const next = moveItem(model, index, to);
        if (next === model) return;
        useSelection.getState().set([seqIds.item(to)]);
        apply(next);
      },
    );
  };

  const startParticipantDrag = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
    select(seqIds.participant(id), e.shiftKey || e.metaKey || e.ctrlKey);
    track(
      e,
      (p) => setDrag({ kind: 'participant', id, x: p.x }),
      (p) => {
        setDrag(null);
        if (!p) return;
        const col = columnAtX(model.participants.length, p.x);
        if (col !== model.participants.findIndex((x) => x.id === id)) apply(moveParticipant(model, id, col));
      },
    );
  };

  // ---- Toolbar actions ----
  const selectedItems = selected.map(seqIds.parse).filter((p) => p.kind === 'item').map((p) => Number(p.id)).sort((a, b) => a - b);
  const selectedParticipant = selected.map(seqIds.parse).find((p) => p.kind === 'participant')?.id;
  const insertAt = selectedItems.length ? selectedItems[selectedItems.length - 1] + 1 : model.items.length;

  const addPart = (kind: 'participant' | 'actor') => {
    const res = addParticipant(model, kind, kind === 'actor' ? t('seq.actor') : t('seq.participant'));
    useSelection.getState().set([seqIds.participant(res.id)]);
    apply(res.model);
  };

  const addMessage = () => {
    let m = model;
    while (m.participants.length < 2) m = addParticipant(m, 'participant', t('seq.participant')).model;
    const fromIdx = selectedParticipant ? m.participants.findIndex((p) => p.id === selectedParticipant) : 0;
    const from = m.participants[fromIdx].id;
    const to = m.participants[(fromIdx + 1) % m.participants.length].id;
    useSelection.getState().set([seqIds.item(insertAt)]);
    apply(insertItem(m, { t: 'message', from, to, arrow: '->>', text: t('seq.newMessage'), activate: '' }, insertAt));
    setTimeout(() => startEditing(seqIds.item(insertAt)), 60);
  };

  const addNote = () => {
    let m = model;
    if (!m.participants.length) m = addParticipant(m, 'participant', t('seq.participant')).model;
    const actor = selectedParticipant ?? m.participants[0].id;
    useSelection.getState().set([seqIds.item(insertAt)]);
    apply(insertItem(m, { t: 'note', position: 'right of', actors: [actor], text: t('seq.newNote') }, insertAt));
    setTimeout(() => startEditing(seqIds.item(insertAt)), 60);
  };

  const wrap = (kind: BlockKind) => {
    const first = selectedItems.length ? selectedItems[0] : Math.max(0, model.items.length - 1);
    const last = selectedItems.length ? selectedItems[selectedItems.length - 1] : model.items.length - 1;
    if (!model.items.length) return;
    const next = wrapItems(model, first, last, kind, kind === 'rect' ? 'rgb(219, 234, 254)' : t('seq.blockLabel'));
    if (next === model) return;
    useSelection.getState().set([seqIds.item(first)]);
    apply(next);
  };

  const selectedBlock = selectedItems.length === 1 ? blockOf(model.items, selectedItems[0]) : null;
  const blockItem = selectedBlock ? model.items[selectedBlock.start] : null;
  const canBranch = blockItem?.t === 'block' && !!BRANCH_OF[blockItem.kind];
  const autonumber = hasAutonumber(model);

  // ---- Rendering ----
  const lifelineTop = TOP + HEADER_H;
  const svgParts: ReactNode[] = [];
  const html: ReactNode[] = [];

  model.boxes.forEach((b, i) => {
    const cols = b.members.map((id) => model.participants.findIndex((p) => p.id === id)).filter((c) => c >= 0);
    if (!cols.length) return;
    const x1 = layout.colX(Math.min(...cols)) - COL_W / 2 + 4;
    const x2 = layout.colX(Math.max(...cols)) + COL_W / 2 - 4;
    const color = boxColor(b.raw);
    svgParts.push(
      <rect
        key={`box${i}`}
        x={x1}
        y={2}
        width={x2 - x1}
        height={layout.height - 8}
        rx={8}
        fill={color ? `color-mix(in srgb, ${color} 22%, transparent)` : 'var(--panel-3)'}
        stroke="var(--border-strong)"
        strokeDasharray="4 4"
      />,
    );
    const label = boxLabel(b.raw);
    if (label) html.push(<div key={`boxl${i}`} className="seq-box-label" style={{ left: x1, top: layout.height - 26, width: x2 - x1 }}>{label}</div>);
  });

  for (const f of layout.frames) {
    const it = model.items[f.start] as Extract<SeqItem, { t: 'block' }>;
    const isRect = it.kind === 'rect';
    const isSel = sel.has(seqIds.item(f.start));
    svgParts.push(
      <rect
        key={`frame${f.start}`}
        x={f.x1}
        y={f.y1}
        width={f.x2 - f.x1}
        height={f.y2 - f.y1}
        rx={4}
        fill={isRect ? `color-mix(in srgb, ${boxColor(it.label) ?? 'var(--accent)'} 25%, transparent)` : 'none'}
        stroke={isSel ? 'var(--accent)' : 'var(--border-strong)'}
        strokeWidth={isSel ? 2 : 1.2}
      />,
    );
    for (const br of f.branches) {
      svgParts.push(<line key={`br${br.index}`} x1={f.x1} x2={f.x2} y1={br.y} y2={br.y} stroke="var(--border-strong)" strokeDasharray="5 4" />);
    }
  }

  model.participants.forEach((p, i) => {
    const x = layout.colX(i);
    svgParts.push(
      <line key={`life${p.id}`} x1={x} x2={x} y1={lifelineTop} y2={layout.height - 20} stroke="var(--border-strong)" strokeWidth={1.4} strokeDasharray="5 5" />,
    );
  });

  for (const a of layout.activations) {
    const x = (layout.centerOf.get(a.actor) ?? 0) - 6 + a.level * 6;
    svgParts.push(
      <rect key={`act${a.actor}${a.y1}${a.level}`} x={x} y={a.y1} width={12} height={Math.max(8, a.y2 - a.y1)} fill="var(--node-fill)" stroke="var(--node-stroke)" />,
    );
  }

  model.items.forEach((it, i) => {
    const r = layout.rows[i];
    const id = seqIds.item(i);
    const isSel = sel.has(id);
    const dragging = drag?.kind === 'item' && drag.index === i;
    if (it.t === 'message') {
      const x1 = layout.centerOf.get(it.from) ?? 0;
      const x2 = layout.centerOf.get(it.to) ?? 0;
      const y = r.y + r.h - 16;
      const st = arrowStyle(it.arrow);
      const color = isSel ? 'var(--accent)' : 'var(--edge)';
      const marker = st.head === 'none' ? undefined : `url(#seq-${st.head}${isSel ? '-sel' : ''})`;
      const self = it.from === it.to;
      const d = self ? `M ${x1} ${y - 18} H ${x1 + 46} V ${y + 2} H ${x1 + 6}` : `M ${x1} ${y} L ${x2 + (x2 > x1 ? -2 : 2)} ${y}`;
      svgParts.push(
        <path
          key={`msg${i}`}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={isSel ? 2.2 : 1.6}
          strokeDasharray={st.dashed ? '6 4' : undefined}
          markerEnd={marker}
          markerStart={st.both ? `url(#seq-filled${isSel ? '-sel' : ''})` : undefined}
          opacity={dragging ? 0.4 : 1}
        />,
      );
      const left = self ? x1 + 52 : Math.min(x1, x2);
      const width = self ? COL_W - 60 : Math.max(60, Math.abs(x2 - x1));
      const num = layout.numbers.get(i);
      html.push(
        <div
          key={`msgl${i}`}
          className={`seq-msg${isSel ? ' selected' : ''}`}
          style={{ left, top: self ? r.y + 6 : r.y + 4, width, textAlign: self ? 'left' : 'center', opacity: dragging ? 0.4 : 1 }}
          onPointerDown={(e) => startItemDrag(e, i)}
          onDoubleClick={() => startEditing(id)}
        >
          <EditableText id={id} text={decode(it.text)} multiline={false} />
        </div>,
      );
      html.push(
        <div
          key={`msgh${i}`}
          className="seq-hit"
          style={{ left: Math.min(x1, x2, self ? x1 : Infinity), top: y - 7, width: self ? 50 : Math.abs(x2 - x1), height: 14 }}
          onPointerDown={(e) => startItemDrag(e, i)}
          onDoubleClick={() => startEditing(id)}
        />,
      );
      if (num !== undefined) {
        html.push(
          <div key={`num${i}`} className="seq-num" style={{ left: x1 - 9, top: y - 9 }}>
            {num}
          </div>,
        );
      }
    } else if (it.t === 'note') {
      const g = noteGeometry(layout, it);
      html.push(
        <div
          key={`note${i}`}
          className={`seq-note${isSel ? ' selected' : ''}`}
          style={{ left: g.x, top: r.y + 6, width: g.w, minHeight: r.h - 12, opacity: dragging ? 0.4 : 1 }}
          onPointerDown={(e) => startItemDrag(e, i)}
          onDoubleClick={() => startEditing(id)}
        >
          <EditableText id={id} text={decode(it.text)} />
        </div>,
      );
    } else if (it.t === 'block' || it.t === 'branch') {
      const f = it.t === 'block' ? layout.frames.find((x) => x.start === i) : layout.frames.find((x) => x.branches.some((b) => b.index === i));
      const x = (f?.x1 ?? 20) + 2;
      html.push(
        <div
          key={`blk${i}`}
          className={`seq-block-label${isSel ? ' selected' : ''}${it.t === 'branch' ? ' branch' : ''}`}
          style={{ left: x, top: r.y + (it.t === 'block' ? 6 : 4), opacity: dragging ? 0.4 : 1 }}
          onPointerDown={(e) => startItemDrag(e, i)}
          onDoubleClick={() => startEditing(id)}
        >
          <span className="seq-block-kind">{it.kind}</span>
          <span className="seq-block-text">
            [<EditableText id={id} text={it.label} multiline={false} />]
          </span>
        </div>,
      );
    } else if (it.t === 'end') {
      // The frame bottom is the visual for `end`; a thin handle keeps it draggable.
      const f = layout.frames.find((x) => x.end === i);
      html.push(
        <div
          key={`end${i}`}
          className={`seq-end${isSel ? ' selected' : ''}`}
          style={{ left: (f?.x1 ?? 20) + 4, top: r.y + r.h - 12, width: Math.max(30, (f?.x2 ?? 120) - (f?.x1 ?? 20) - 8) }}
          onPointerDown={(e) => startItemDrag(e, i)}
          title="end"
        />,
      );
    } else {
      const actor = 'actor' in it ? it.actor : it.t === 'create' ? it.id : null;
      const x = actor ? (layout.centerOf.get(actor) ?? 20) + 10 : 24;
      const label =
        it.t === 'raw' ? it.text : it.t === 'create' ? `create ${it.id}` : it.t === 'destroy' ? `destroy ${it.actor}` : `${it.t} ${it.actor}`;
      if (it.t === 'destroy' && actor) {
        const cx = layout.centerOf.get(actor) ?? 0;
        const cy = r.y + r.h / 2;
        svgParts.push(<path key={`x${i}`} d={`M ${cx - 9} ${cy - 9} L ${cx + 9} ${cy + 9} M ${cx + 9} ${cy - 9} L ${cx - 9} ${cy + 9}`} stroke="var(--danger)" strokeWidth={2.5} />);
      }
      html.push(
        <div
          key={`chip${i}`}
          className={`seq-chip${isSel ? ' selected' : ''}${it.t === 'raw' ? ' raw' : ''}`}
          style={{ left: x, top: r.y + 4, opacity: dragging ? 0.4 : 1 }}
          onPointerDown={(e) => startItemDrag(e, i)}
          onDoubleClick={() => it.t === 'raw' && startEditing(id)}
        >
          {it.t === 'raw' ? <EditableText id={id} text={label} multiline={false} /> : label}
        </div>,
      );
    }
  });

  model.participants.forEach((p, i) => {
    const x = layout.colX(i);
    const id = seqIds.participant(p.id);
    const isSel = sel.has(id);
    const type = /"type"\s*:\s*"(\w+)"/.exec(p.meta ?? '')?.[1];
    const dragX = drag?.kind === 'participant' && drag.id === p.id ? drag.x - x : 0;
    html.push(
      <div
        key={`head${p.id}`}
        className={`seq-head${isSel ? ' selected' : ''}${p.kind === 'actor' ? ' actor' : ''}${type ? ` type-${type}` : ''}`}
        style={{ left: x - (COL_W - 24) / 2 + dragX, top: TOP, width: COL_W - 24 }}
        onPointerDown={(e) => startParticipantDrag(e, p.id)}
        onDoubleClick={() => startEditing(id)}
        title={p.created ? 'create' : undefined}
      >
        {p.kind === 'actor' && (
          <svg width={22} height={24} viewBox="0 0 22 24" aria-hidden="true" className="seq-actor-icon">
            <circle cx={11} cy={5} r={4} fill="none" stroke="currentColor" strokeWidth={1.6} />
            <path d="M 11 9 V 17 M 3 12 H 19 M 11 17 L 4 23 M 11 17 L 18 23" stroke="currentColor" strokeWidth={1.6} fill="none" />
          </svg>
        )}
        <div className="seq-head-label">
          {type && <span className="seq-head-type">«{type}»</span>}
          <EditableText id={id} text={p.label ?? p.id} multiline={false} />
        </div>
      </div>,
    );
    html.push(
      <div
        key={`lifehit${p.id}`}
        className="seq-lifeline-hit"
        style={{ left: x - 10, top: lifelineTop, height: layout.height - lifelineTop - 20 }}
        onPointerDown={(e) => startMessage(e, p.id)}
        title={t('seq.hint')}
      />,
    );
  });

  if (drag?.kind === 'message') {
    svgParts.push(
      <path
        key="drag"
        d={`M ${drag.x0} ${drag.y0} L ${drag.x} ${drag.y0}`}
        stroke="var(--accent)"
        strokeWidth={2}
        strokeDasharray="4 3"
        markerEnd="url(#seq-filled-sel)"
      />,
    );
  }
  if (drag?.kind === 'item') {
    const idx = indexAtY(layout, drag.y);
    const y = idx < layout.rows.length ? layout.rows[idx].y : layout.rows.length ? layout.rows[layout.rows.length - 1].y + layout.rows[layout.rows.length - 1].h : lifelineTop + 20;
    svgParts.push(<line key="ins" x1={10} x2={layout.width - 10} y1={y} y2={y} stroke="var(--accent)" strokeWidth={2.5} />);
  }

  return (
    <GraphContext.Provider value={callbacks}>
      <div
        className="seq-canvas"
        ref={box}
        onPointerDown={(e) => {
          if (e.button !== 0 && e.button !== 1) return;
          if ((e.target as HTMLElement).closest('.floating-toolbar')) return;
          useSelection.getState().clear();
          startPan(e);
        }}
      >
        <div className="seq-world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, width: layout.width, height: layout.height }}>
          <svg width={layout.width} height={layout.height} className="seq-svg" aria-hidden="true">
            <defs>
              {[false, true].map((s) => (
                <g key={String(s)}>
                  <marker id={`seq-filled${s ? '-sel' : ''}`} viewBox="-10 -6 12 12" refX={0} refY={0} markerWidth={11} markerHeight={11} markerUnits="userSpaceOnUse" orient="auto-start-reverse">
                    <path d="M -10 -5 L 0 0 L -10 5 z" fill={s ? 'var(--accent)' : 'var(--edge)'} />
                  </marker>
                  <marker id={`seq-open${s ? '-sel' : ''}`} viewBox="-12 -7 14 14" refX={0} refY={0} markerWidth={13} markerHeight={13} markerUnits="userSpaceOnUse" orient="auto-start-reverse">
                    <path d="M -10 -6 L 0 0 L -10 6" fill="none" stroke={s ? 'var(--accent)' : 'var(--edge)'} strokeWidth={1.6} />
                  </marker>
                  <marker id={`seq-cross${s ? '-sel' : ''}`} viewBox="-12 -7 14 14" refX={0} refY={0} markerWidth={13} markerHeight={13} markerUnits="userSpaceOnUse" orient="auto">
                    <path d="M -10 -6 L -1 6 M -10 6 L -1 -6" fill="none" stroke={s ? 'var(--accent)' : 'var(--edge)'} strokeWidth={2} />
                  </marker>
                </g>
              ))}
            </defs>
            {svgParts}
          </svg>
          {html}
        </div>

        <div className="floating-toolbar vertical palette" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" className="icon-btn" title={t('seq.addParticipant')} onClick={() => addPart('participant')}>
            <UserPlus size={16} />
          </button>
          <button type="button" className="icon-btn" title={t('seq.addActor')} onClick={() => addPart('actor')}>
            <User size={16} />
          </button>
          <span className="sep" />
          <button type="button" className="icon-btn" title={t('seq.addMessage')} onClick={addMessage}>
            <MessageSquarePlus size={16} />
          </button>
          <button type="button" className="icon-btn" title={t('seq.addNote')} onClick={addNote}>
            <StickyNote size={16} />
          </button>
          <Menu
            trigger={({ toggle }) => (
              <button type="button" className="icon-btn" title={t('seq.wrap')} onClick={toggle} disabled={!model.items.length}>
                <Brackets size={16} />
              </button>
            )}
          >
            {(close) =>
              BLOCK_KINDS.map((k) => (
                <MenuItem key={k} close={close} label={t(`seq.block.${k}` as TranslationKey)} hint={k} onSelect={() => wrap(k)} />
              ))
            }
          </Menu>
          <button
            type="button"
            className="icon-btn"
            title={t('seq.branch')}
            disabled={!canBranch}
            onClick={() => selectedBlock && apply(addBranch(model, selectedBlock.start, t('seq.blockLabel')))}
          >
            <SplitSquareVertical size={16} />
          </button>
          <span className="sep" />
          <button
            type="button"
            className={`icon-btn${autonumber ? ' active' : ''}`}
            title={t('seq.autonumber')}
            onClick={() => apply(toggleAutonumber(model, !autonumber))}
          >
            <Hash size={16} />
          </button>
        </div>

        <div className="floating-toolbar" style={{ left: 12, bottom: 12 }} onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" className="icon-btn small" title={t('canvas.zoomOut')} onClick={() => zoomBy(1 / 1.2)}>
            <Minus size={15} />
          </button>
          <span className="zoom-label">{Math.round(view.k * 100)}%</span>
          <button type="button" className="icon-btn small" title={t('canvas.zoomIn')} onClick={() => zoomBy(1.2)}>
            <Plus size={15} />
          </button>
          <button type="button" className="icon-btn small" title={t('canvas.fit')} onClick={() => fit(layout.width, layout.height)}>
            <Maximize size={14} />
          </button>
        </div>
      </div>
    </GraphContext.Provider>
  );
}
